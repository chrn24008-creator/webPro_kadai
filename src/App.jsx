import { useEffect, useRef } from "react";

export default function App() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // 論理サイズ（ゲーム内の座標系）
    const WIDTH = 800;
    const HEIGHT = 1000;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    /* ===== サウンド（WebAudio） ===== */
    let audioCtx = null;

    const ensureAudio = () => {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === "suspended") audioCtx.resume();
    };

    const beep = (freq = 440, duration = 0.06, type = "square", gain = 0.05) => {
      if (!audioCtx) return;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + duration);
    };

    const sfx = {
      shoot: () => beep(880, 0.04, "square", 0.03),
      hit: () => beep(220, 0.08, "sawtooth", 0.06),
      kill: () => beep(660, 0.06, "triangle", 0.05),
      start: () => beep(523, 0.08, "triangle", 0.05),
      gameover: () => beep(130, 0.2, "sawtooth", 0.08),
    };

    /* ===== ゲーム状態 ===== */
    let started = false;
    let gameOver = false;
    let score = 0;
    let life = 3;
    let level = 1;
    let invincibleTimer = 0;

    /* ===== オブジェクト ===== */
    let player;
    let bullets;
    let enemies;
    let enemyTimer;

    // 連射制御（仮想ボタンの押しっぱなし用）
    let lastShotAt = 0;

    function initGame() {
      gameOver = false;
      score = 0;
      life = 3;
      level = 1;
      invincibleTimer = 0;

      player = {
        x: WIDTH / 2 - 40,
        y: HEIGHT - 120,
        w: 80,
        h: 80,
        speed: 6,
      };

      bullets = [];
      enemies = [];
      enemyTimer = 0;
      lastShotAt = 0;
    }
    initGame();

    /* ===== キー入力（PC用） ===== */
    const keys = {};
    const keyDown = (e) => {
      keys[e.key] = true;

      if (!started && e.key === "Enter") {
        started = true;
        ensureAudio();
        sfx.start();
        return;
      }

      if (gameOver && e.key === "Enter") {
        initGame();
        started = true;
        ensureAudio();
        sfx.start();
      }
    };
    const keyUp = (e) => {
      keys[e.key] = false;
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    /* ===== 仮想ボタンUI ===== */
    // 画面下にボタンを置く（固定座標）
    const PAD = 20;
    const BTN_H = 90;
    const BTN_Y = HEIGHT - BTN_H - PAD;

    // 左/右は同サイズ、SHOOTは大きめ
    const LEFT_BTN = { x: PAD, y: BTN_Y, w: 160, h: BTN_H, label: "◀" };
    const RIGHT_BTN = { x: PAD + 180, y: BTN_Y, w: 160, h: BTN_H, label: "▶" };
    const SHOOT_BTN = {
      x: WIDTH - PAD - 260,
      y: BTN_Y,
      w: 260,
      h: BTN_H,
      label: "SHOOT",
    };

    // 押下状態（押しっぱなし対応）
    let vLeft = false;
    let vRight = false;
    let vShoot = false;

    // pointerIdごとに「どのボタン押してるか」を覚える（マルチタッチ対応）
    const pointerMap = new Map(); // pointerId -> "left" | "right" | "shoot" | null

    const pointInRect = (px, py, r) =>
      px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

    // 画面上の座標 -> canvas内部座標
    const toCanvasPos = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = WIDTH / rect.width;
      const scaleY = HEIGHT / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const tryStart = () => {
      if (!started) {
        started = true;
        ensureAudio();
        sfx.start();
      }
    };

    const shootOnce = () => {
      if (!started || gameOver) return;

      const now = performance.now();
      if (now - lastShotAt < 150) return; // 連射間隔（調整可）
      if (bullets.length >= 5) return;

      bullets.push({ x: player.x + player.w / 2 - 2, y: player.y });
      lastShotAt = now;
      sfx.shoot();
    };

    const recomputeVirtualStates = () => {
      // pointerMapの中身から現在の押下状態を作り直す
      vLeft = false;
      vRight = false;
      vShoot = false;

      for (const v of pointerMap.values()) {
        if (v === "left") vLeft = true;
        if (v === "right") vRight = true;
        if (v === "shoot") vShoot = true;
      }
    };

    const onPointerDown = (e) => {
      e.preventDefault();
      tryStart();

      // ゲームオーバー中は、どこタップでもリスタート可
      if (gameOver) {
        initGame();
        started = true;
        ensureAudio();
        sfx.start();
        return;
      }

      const p = toCanvasPos(e.clientX, e.clientY);

      let which = null;
      if (pointInRect(p.x, p.y, LEFT_BTN)) which = "left";
      else if (pointInRect(p.x, p.y, RIGHT_BTN)) which = "right";
      else if (pointInRect(p.x, p.y, SHOOT_BTN)) which = "shoot";

      pointerMap.set(e.pointerId, which);
      recomputeVirtualStates();

      // SHOOTは押した瞬間に1発出す（押しっぱなしはupdate側でも撃つ）
      if (which === "shoot") {
        ensureAudio();
        shootOnce();
      }
    };

    const onPointerMove = (e) => {
      // 指がボタンからはみ出したら解除、別ボタンに移ったら切替したいので判定し直す
      if (!pointerMap.has(e.pointerId)) return;
      e.preventDefault();

      const p = toCanvasPos(e.clientX, e.clientY);

      let which = null;
      if (pointInRect(p.x, p.y, LEFT_BTN)) which = "left";
      else if (pointInRect(p.x, p.y, RIGHT_BTN)) which = "right";
      else if (pointInRect(p.x, p.y, SHOOT_BTN)) which = "shoot";

      const prev = pointerMap.get(e.pointerId);
      pointerMap.set(e.pointerId, which);
      recomputeVirtualStates();

      // moveでshootに入った瞬間に1発（気持ちよくする）
      if (which === "shoot" && prev !== "shoot") {
        ensureAudio();
        shootOnce();
      }
    };

    const onPointerUp = (e) => {
      if (!pointerMap.has(e.pointerId)) return;
      e.preventDefault();
      pointerMap.delete(e.pointerId);
      recomputeVirtualStates();
    };

    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPointerUp, { passive: false });

    /* ===== update ===== */
    function update() {
      if (!started || gameOver) return;

      if (invincibleTimer > 0) invincibleTimer--;

      level = Math.floor(score / 1000) + 1;

      // ---- 移動（キーボード or 仮想ボタン）----
      let dx = 0;
      if (keys["ArrowLeft"] || vLeft) dx -= player.speed;
      if (keys["ArrowRight"] || vRight) dx += player.speed;

      // 両方押しなら相殺
      if ((keys["ArrowLeft"] || vLeft) && (keys["ArrowRight"] || vRight)) dx = 0;

      player.x += dx;
      player.x = Math.max(0, Math.min(WIDTH - player.w, player.x));

      // ---- 発射（キーボード）----
      if (keys[" "] && bullets.length < 5) {
        bullets.push({ x: player.x + player.w / 2 - 2, y: player.y });
        keys[" "] = false;
        sfx.shoot();
        lastShotAt = performance.now();
      }

      // ---- 発射（仮想ボタン：押しっぱなし連射）----
      if (vShoot) {
        ensureAudio();
        shootOnce();
      }

      bullets.forEach((b) => (b.y -= 8));
      bullets = bullets.filter((b) => b.y > 0);

      // ---- 敵出現（レベルで変化）----
      let spawnInterval = 60;
      let enemySpeed = 2;
      if (level >= 2) {
        spawnInterval = 40;
        enemySpeed = 4;
      }

      enemyTimer++;
      if (enemyTimer > spawnInterval) {
        enemies.push({
          x: Math.random() * (WIDTH - 50),
          y: -50,
          w: 50,
          h: 50,
          speed: enemySpeed,
          dx: level >= 3 ? (Math.random() < 0.5 ? -1 : 1) * level : 0,
        });
        enemyTimer = 0;
      }

      enemies.forEach((e) => {
        e.y += e.speed;
        e.x += e.dx || 0;
        if (e.x < 0 || e.x + e.w > WIDTH) e.dx *= -1;
      });
      enemies = enemies.filter((e) => e.y < HEIGHT + 80);

      // ---- 弾 vs 敵 ----
      bullets.forEach((b) => {
        enemies.forEach((e) => {
          if (
            b.x < e.x + e.w &&
            b.x + 5 > e.x &&
            b.y < e.y + e.h &&
            b.y + 20 > e.y
          ) {
            e.y = HEIGHT + 100;
            b.y = -100;
            score += 100;
            sfx.kill();
          }
        });
      });

      // ---- プレイヤー vs 敵 ----
      enemies.forEach((e) => {
        if (
          invincibleTimer === 0 &&
          player.x < e.x + e.w &&
          player.x + player.w > e.x &&
          player.y < e.y + e.h &&
          player.y + player.h > e.y
        ) {
          life--;
          invincibleTimer = 60;
          e.y = HEIGHT + 100;
          sfx.hit();

          if (life <= 0) {
            gameOver = true;
            sfx.gameover();
          }
        }
      });
    }

    /* ===== ボタン描画ヘルパー ===== */
    const drawButton = (btn, pressed) => {
      // 背景
      ctx.globalAlpha = pressed ? 0.9 : 0.6;
      ctx.fillStyle = pressed ? "#ffffff" : "#888888";
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);

      // 枠線
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "white";
      ctx.lineWidth = 4;
      ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);

      // 文字
      ctx.fillStyle = "black";
      ctx.font = btn.label === "SHOOT" ? "34px sans-serif" : "48px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    };

    /* ===== draw ===== */
    function draw() {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // プレイヤー
      if (!started || invincibleTimer % 10 < 5) {
        ctx.fillStyle = "white";
        ctx.fillRect(player.x, player.y, player.w, player.h);
      }

      // 弾
      ctx.fillStyle = "yellow";
      bullets.forEach((b) => ctx.fillRect(b.x, b.y, 5, 20));

      // 敵
      ctx.fillStyle = "red";
      enemies.forEach((e) => ctx.fillRect(e.x, e.y, e.w, e.h));

      // UI
      ctx.fillStyle = "white";
      ctx.font = "24px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`SCORE: ${score}`, 20, 40);
      ctx.fillText(`LIFE: ${life}`, 20, 70);
      ctx.fillText(`LEVEL: ${level}`, 20, 100);

      // 開始前メッセージ
      if (!started) {
        ctx.font = "44px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SHOOTING GAME", WIDTH / 2, HEIGHT / 2 - 40);
        ctx.font = "24px sans-serif";
        ctx.fillText("Tap to Start / Enter", WIDTH / 2, HEIGHT / 2 + 20);
        ctx.fillText("Mobile: Buttons below", WIDTH / 2, HEIGHT / 2 + 60);
      }

      // ゲームオーバー
      if (gameOver) {
        ctx.font = "48px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2);
        ctx.font = "24px sans-serif";
        ctx.fillText("Tap or Press Enter to Restart", WIDTH / 2, HEIGHT / 2 + 50);
      }

      // ★仮想ボタン描画（常に表示）
      drawButton(LEFT_BTN, vLeft);
      drawButton(RIGHT_BTN, vRight);
      drawButton(SHOOT_BTN, vShoot);
    }

    const loop = () => {
      update();
      draw();
      requestAnimationFrame(loop);
    };
    loop();

    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);

      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      if (audioCtx) audioCtx.close();
    };
  }, []);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="game-canvas" />
    </div>
  );
}
