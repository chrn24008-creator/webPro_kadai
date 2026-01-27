import { useEffect, useRef } from "react";

export default function App() {
  const gameCanvasRef = useRef(null);
  const uiCanvasRef = useRef(null);

  useEffect(() => {
    const gameCanvas = gameCanvasRef.current;
    const uiCanvas = uiCanvasRef.current;

    const gctx = gameCanvas.getContext("2d");
    const uctx = uiCanvas.getContext("2d");

    // ===== サイズ（論理座標）=====
    const GAME_W = 800;
    const GAME_H = 1000;
    const UI_H = 160;

    gameCanvas.width = GAME_W;
    gameCanvas.height = GAME_H;

    uiCanvas.width = GAME_W;
    uiCanvas.height = UI_H;

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

    /* ===== ゲーム全体の状態 ===== */
    let started = false;
    let gameOver = false;
    let score = 0;
    let life = 3;
    let level = 1;
    let invincibleTimer = 0;

    /* ===== ゲームオブジェクト ===== */
    let player;
    let bullets;
    let enemies;
    let enemyTimer;

    // 連射制御
    let lastShotAt = 0;

    function initGame() {
      gameOver = false;
      score = 0;
      life = 3;
      level = 1;
      invincibleTimer = 0;

      player = {
        x: GAME_W / 2 - 40,
        y: GAME_H - 140, // ボタンが下に来るので少し上げる
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

    /* ===== キー入力（PC） ===== */
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

    /* ===== 仮想ボタン（下のUI canvasに描く） ===== */
    const PAD = 20;
    const BTN_H = 100;
    const BTN_Y = (UI_H - BTN_H) / 2;

    const LEFT_BTN = { x: PAD, y: BTN_Y, w: 160, h: BTN_H, label: "◀" };
    const RIGHT_BTN = { x: PAD + 180, y: BTN_Y, w: 160, h: BTN_H, label: "▶" };
    const SHOOT_BTN = {
      x: GAME_W - PAD - 260,
      y: BTN_Y,
      w: 260,
      h: BTN_H,
      label: "SHOOT",
    };

    let vLeft = false;
    let vRight = false;
    let vShoot = false;

    // マルチタッチ対応：pointerId -> "left" | "right" | "shoot" | null
    const pointerMap = new Map();

    const pointInRect = (px, py, r) =>
      px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

    // UI canvasの画面座標 -> UI canvasの内部座標
    const toUiCanvasPos = (clientX, clientY) => {
      const rect = uiCanvas.getBoundingClientRect();
      const scaleX = GAME_W / rect.width;
      const scaleY = UI_H / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const recomputeVirtualStates = () => {
      vLeft = false;
      vRight = false;
      vShoot = false;
      for (const v of pointerMap.values()) {
        if (v === "left") vLeft = true;
        if (v === "right") vRight = true;
        if (v === "shoot") vShoot = true;
      }
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
      if (now - lastShotAt < 150) return; // 連射間隔
      if (bullets.length >= 5) return;

      bullets.push({
        x: player.x + player.w / 2 - 2,
        y: player.y,
      });
      lastShotAt = now;
      sfx.shoot();
    };

    const detectButton = (p) => {
      if (pointInRect(p.x, p.y, LEFT_BTN)) return "left";
      if (pointInRect(p.x, p.y, RIGHT_BTN)) return "right";
      if (pointInRect(p.x, p.y, SHOOT_BTN)) return "shoot";
      return null;
    };

    const onPointerDown = (e) => {
      e.preventDefault();
      tryStart();

      // ゲームオーバー中はUI側タップでリスタート可能にする
      if (gameOver) {
        initGame();
        started = true;
        ensureAudio();
        sfx.start();
        return;
      }

      const p = toUiCanvasPos(e.clientX, e.clientY);
      const which = detectButton(p);

      pointerMap.set(e.pointerId, which);
      recomputeVirtualStates();

      // SHOOTは押した瞬間に1発
      if (which === "shoot") {
        ensureAudio();
        shootOnce();
      }
    };

    const onPointerMove = (e) => {
      if (!pointerMap.has(e.pointerId)) return;
      e.preventDefault();

      const p = toUiCanvasPos(e.clientX, e.clientY);
      const prev = pointerMap.get(e.pointerId);
      const which = detectButton(p);

      pointerMap.set(e.pointerId, which);
      recomputeVirtualStates();

      // 移動中にshootに入った瞬間も1発
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

    // ★UI canvasだけがタッチ入力を受ける
    uiCanvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    uiCanvas.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPointerUp, { passive: false });

    /* ===== update ===== */
    function update() {
      if (!started || gameOver) return;

      if (invincibleTimer > 0) invincibleTimer--;

      level = Math.floor(score / 1000) + 1;

      // --- 移動（PCキー or 仮想ボタン） ---
      let dx = 0;

      const left = keys["ArrowLeft"] || vLeft;
      const right = keys["ArrowRight"] || vRight;

      if (left && !right) dx = -player.speed;
      if (right && !left) dx = player.speed;

      player.x += dx;
      player.x = Math.max(0, Math.min(GAME_W - player.w, player.x));

      // --- 発射（PC Space）---
      if (keys[" "] && bullets.length < 5) {
        bullets.push({
          x: player.x + player.w / 2 - 2,
          y: player.y,
        });
        keys[" "] = false;
        ensureAudio();
        sfx.shoot();
        lastShotAt = performance.now();
      }

      // --- 発射（仮想ボタン：押しっぱなし連射）---
      if (vShoot) {
        ensureAudio();
        shootOnce();
      }

      // 弾移動
      bullets.forEach((b) => (b.y -= 8));
      bullets = bullets.filter((b) => b.y > 0);

      // --- 敵出現（レベルによる変化） ---
      let spawnInterval = 60;
      let enemySpeed = 2;
      if (level >= 2) {
        spawnInterval = 40;
        enemySpeed = 4;
      }

      enemyTimer++;
      if (enemyTimer > spawnInterval) {
        enemies.push({
          x: Math.random() * (GAME_W - 50),
          y: -50,
          w: 50,
          h: 50,
          speed: enemySpeed,
          dx: level >= 3 ? (Math.random() < 0.5 ? -1 : 1) * level : 0,
        });
        enemyTimer = 0;
      }

      // 敵移動
      enemies.forEach((e) => {
        e.y += e.speed;
        e.x += e.dx || 0;
        if (e.x < 0 || e.x + e.w > GAME_W) e.dx *= -1;
      });
      enemies = enemies.filter((e) => e.y < GAME_H + 80);

      // --- 弾と敵の当たり判定 ---
      bullets.forEach((b) => {
        enemies.forEach((e) => {
          if (
            b.x < e.x + e.w &&
            b.x + 5 > e.x &&
            b.y < e.y + e.h &&
            b.y + 20 > e.y
          ) {
            e.y = GAME_H + 100;
            b.y = -100;
            score += 100;
            sfx.kill();
          }
        });
      });

      // --- プレイヤーと敵の当たり判定 ---
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
          e.y = GAME_H + 100;
          sfx.hit();

          if (life <= 0) {
            gameOver = true;
            sfx.gameover();
          }
        }
      });
    }

    /* ===== 描画 ===== */
    function drawGame() {
      // 背景
      gctx.fillStyle = "black";
      gctx.fillRect(0, 0, GAME_W, GAME_H);

      // プレイヤー（無敵点滅）
      if (!started || invincibleTimer % 10 < 5) {
        gctx.fillStyle = "white";
        gctx.fillRect(player.x, player.y, player.w, player.h);
      }

      // 弾
      gctx.fillStyle = "yellow";
      bullets.forEach((b) => gctx.fillRect(b.x, b.y, 5, 20));

      // 敵
      gctx.fillStyle = "red";
      enemies.forEach((e) => gctx.fillRect(e.x, e.y, e.w, e.h));

      // UI
      gctx.fillStyle = "white";
      gctx.font = "24px sans-serif";
      gctx.textAlign = "left";
      gctx.fillText(`SCORE: ${score}`, 20, 40);
      gctx.fillText(`LIFE: ${life}`, 20, 70);
      gctx.fillText(`LEVEL: ${level}`, 20, 100);

      // 開始前
      if (!started) {
        gctx.font = "44px sans-serif";
        gctx.textAlign = "center";
        gctx.fillText("SHOOTING GAME", GAME_W / 2, GAME_H / 2 - 40);
        gctx.font = "24px sans-serif";
        gctx.fillText("Press Enter or Tap Buttons to Start", GAME_W / 2, GAME_H / 2 + 20);
      }

      // ゲームオーバー
      if (gameOver) {
        gctx.font = "48px sans-serif";
        gctx.textAlign = "center";
        gctx.fillText("GAME OVER", GAME_W / 2, GAME_H / 2);
        gctx.font = "24px sans-serif";
        gctx.fillText("Press Enter or Tap UI to Restart", GAME_W / 2, GAME_H / 2 + 50);
      }
    }

    const drawButton = (btn, pressed) => {
      // 背景（押してると明るく）
      uctx.globalAlpha = pressed ? 0.95 : 0.65;
      uctx.fillStyle = pressed ? "#ffffff" : "#888888";
      uctx.fillRect(btn.x, btn.y, btn.w, btn.h);

      // 枠
      uctx.globalAlpha = 1;
      uctx.strokeStyle = "white";
      uctx.lineWidth = 4;
      uctx.strokeRect(btn.x, btn.y, btn.w, btn.h);

      // 文字
      uctx.fillStyle = "black";
      uctx.font = btn.label === "SHOOT" ? "34px sans-serif" : "48px sans-serif";
      uctx.textAlign = "center";
      uctx.textBaseline = "middle";
      uctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    };

    function drawUI() {
      // 背景
      uctx.fillStyle = "#222";
      uctx.fillRect(0, 0, GAME_W, UI_H);

      // ボタン
      drawButton(LEFT_BTN, vLeft);
      drawButton(RIGHT_BTN, vRight);
      drawButton(SHOOT_BTN, vShoot);

      // 小さめヒント
      uctx.fillStyle = "white";
      uctx.font = "18px sans-serif";
      uctx.textAlign = "center";
      uctx.textBaseline = "alphabetic";
      uctx.fillText("Mobile Controls", GAME_W / 2, UI_H - 12);
    }

    /* ===== メインループ ===== */
    const loop = () => {
      update();
      drawGame();
      drawUI();
      requestAnimationFrame(loop);
    };
    loop();

    // クリーンアップ
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);

      uiCanvas.removeEventListener("pointerdown", onPointerDown);
      uiCanvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      if (audioCtx) audioCtx.close();
    };
  }, []);

  return (
    <div className="app">
      <canvas ref={gameCanvasRef} className="game-canvas" />
      <canvas ref={uiCanvasRef} className="ui-canvas" />
    </div>
  );
}
