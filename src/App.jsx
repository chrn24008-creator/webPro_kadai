import { useEffect, useRef } from "react";

export default function App() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const WIDTH = 800;
    const HEIGHT = 1000;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    /* ===== サウンド ===== */
    let audioCtx = null;
    const ensureAudio = () => {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

    /* ===== 状態 ===== */
    let started = false;
    let gameOver = false;
    let score = 0;
    let life = 3;
    let level = 1;
    let invincibleTimer = 0;

    let player;
    let bullets;
    let enemies;
    let enemyTimer;

    // ★スマホ操作用
    let touchActive = false;
    let touchTargetX = null; // 指のx（canvas座標）
    let lastShotAt = 0;      // 連射制御（ms）

    function initGame() {
      gameOver = false;
      score = 0;
      life = 3;
      level = 1;
      invincibleTimer = 0;

      player = { x: WIDTH / 2 - 40, y: HEIGHT - 120, w: 80, h: 80, speed: 6 };

      bullets = [];
      enemies = [];
      enemyTimer = 0;

      touchActive = false;
      touchTargetX = null;
      lastShotAt = 0;
    }
    initGame();

    /* ===== キー入力 ===== */
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
        gameOver = false;
        started = true;
        ensureAudio();
        sfx.start();
      }
    };
    const keyUp = (e) => (keys[e.key] = false);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    /* ===== タッチ/ポインター入力（スマホ対応の本体） ===== */

    // 画面上のタッチ位置を「canvas内部座標」に変換
    const toCanvasX = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = WIDTH / rect.width;
      return (clientX - rect.left) * scaleX;
    };

    const tryStartByTouch = () => {
      if (!started) {
        started = true;
        ensureAudio();
        sfx.start();
      }
    };

    const shoot = () => {
      if (!started || gameOver) return;

      const now = performance.now();
      if (now - lastShotAt < 150) return; // ★連射間隔（好みで調整）
      if (bullets.length >= 5) return;

      bullets.push({ x: player.x + player.w / 2 - 2, y: player.y });
      lastShotAt = now;
      sfx.shoot();
    };

    const onPointerDown = (e) => {
      e.preventDefault(); // ★スクロール等を防ぐ
      tryStartByTouch();

      // 画面がゲームオーバーなら「タップでリスタート」も可能にする
      if (gameOver) {
        initGame();
        gameOver = false;
        started = true;
        ensureAudio();
        sfx.start();
        return;
      }

      touchActive = true;
      touchTargetX = toCanvasX(e.clientX);

      // ★押した瞬間に1発撃つ（無しにしたければ消してOK）
      shoot();
    };

    const onPointerMove = (e) => {
      if (!touchActive) return;
      e.preventDefault();
      touchTargetX = toCanvasX(e.clientX);
    };

    const onPointerUp = (e) => {
      e.preventDefault();
      touchActive = false;
      touchTargetX = null;
    };

    // pointer events はスマホ/PC両方で安定
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPointerUp, { passive: false });

    /* ===== update ===== */
    function update() {
      if (!started || gameOver) return;

      if (invincibleTimer > 0) invincibleTimer--;
      level = Math.floor(score / 1000) + 1;

      // --- 移動（キーボード or タッチ） ---
      let dx = 0;

      // タッチ中は「指の位置へ追従」
      if (touchActive && touchTargetX != null) {
        const target = touchTargetX - player.w / 2;
        const diff = target - player.x;
        // スッと追従（最大speed）
        dx = Math.max(-player.speed, Math.min(player.speed, diff));
      } else {
        if (keys["ArrowLeft"]) dx -= player.speed;
        if (keys["ArrowRight"]) dx += player.speed;
      }

      player.x += dx;
      player.x = Math.max(0, Math.min(WIDTH - player.w, player.x));

      // --- キーボード発射 ---
      if (keys[" "] && bullets.length < 5) {
        bullets.push({ x: player.x + player.w / 2 - 2, y: player.y });
        keys[" "] = false;
        sfx.shoot();
      }

      bullets.forEach((b) => (b.y -= 8));
      bullets = bullets.filter((b) => b.y > 0);

      // --- 敵出現 ---
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

      // --- 弾 vs 敵 ---
      bullets.forEach((b) => {
        enemies.forEach((e) => {
          if (b.x < e.x + e.w && b.x + 5 > e.x && b.y < e.y + e.h && b.y + 20 > e.y) {
            e.y = HEIGHT + 100;
            b.y = -100;
            score += 100;
            sfx.kill();
          }
        });
      });

      // --- プレイヤー vs 敵 ---
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

    /* ===== draw ===== */
    function draw() {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      if (!started || invincibleTimer % 10 < 5) {
        ctx.fillStyle = "white";
        ctx.fillRect(player.x, player.y, player.w, player.h);
      }

      ctx.fillStyle = "yellow";
      bullets.forEach((b) => ctx.fillRect(b.x, b.y, 5, 20));

      ctx.fillStyle = "red";
      enemies.forEach((e) => ctx.fillRect(e.x, e.y, e.w, e.h));

      ctx.fillStyle = "white";
      ctx.font = "24px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`SCORE: ${score}`, 20, 40);
      ctx.fillText(`LIFE: ${life}`, 20, 70);
      ctx.fillText(`LEVEL: ${level}`, 20, 100);

      // ★スマホ操作ヒント
      if (!started) {
        ctx.font = "44px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SHOOTING GAME", WIDTH / 2, HEIGHT / 2 - 40);
        ctx.font = "24px sans-serif";
        ctx.fillText("Tap to Start", WIDTH / 2, HEIGHT / 2 + 20);
        ctx.fillText("Drag: Move   Tap: Shoot", WIDTH / 2, HEIGHT / 2 + 60);
      }

      if (gameOver) {
        ctx.font = "48px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2);
        ctx.font = "24px sans-serif";
        ctx.fillText("Tap or Press Enter to Restart", WIDTH / 2, HEIGHT / 2 + 50);
      }
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
