import { useEffect, useRef } from "react";

export default function App() {
  // canvas要素を参照するためのRef
  const canvasRef = useRef(null);

  useEffect(() => {
    // canvasと描画コンテキストの取得
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // ゲーム画面サイズ
    const WIDTH = 800;
    const HEIGHT = 1000;

    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    /* ===== ゲーム全体の状態管理 ===== */
    let gameOver = false;      // ゲームオーバー判定
    let score = 0;             // スコア
    let life = 3;              // 残機（ライフ）
    let level = 1;             // レベル
    let invincibleTimer = 0;   // 被弾後の無敵時間

    /* ===== ゲームオブジェクト ===== */
    let player;        // プレイヤー
    let bullets;       // 弾の配列
    let enemies;       // 敵の配列
    let enemyTimer;    // 敵出現用タイマー

    /* ===== ゲーム初期化処理 ===== */
    function initGame() {
      gameOver = false;
      score = 0;
      life = 3;
      level = 1;
      invincibleTimer = 0;

      // プレイヤー初期設定
      player = {
        x: WIDTH / 2 - 40,
        y: HEIGHT - 100,
        w: 80,
        h: 80,
        speed: 4
      };

      bullets = [];
      enemies = [];
      enemyTimer = 0;
    }

    // 初回起動時に初期化
    initGame();

    /* ===== キー入力管理 ===== */
    const keys = {};

    const keyDown = (e) => {
      keys[e.key] = true;

      // ゲームオーバー時にEnterで再スタート
      if (gameOver && e.key === "Enter") initGame();
    };

    const keyUp = (e) => {
      keys[e.key] = false;
    };

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    /* ===== ゲーム更新処理 ===== */
    function update() {
      if (gameOver) return;

      // 無敵時間のカウントダウン
      if (invincibleTimer > 0) invincibleTimer--;

      // スコアからレベルを計算
      level = Math.floor(score / 1000) + 1;

      /* --- プレイヤー移動 --- */
      if (keys["ArrowLeft"]) player.x -= player.speed;
      if (keys["ArrowRight"]) player.x += player.speed;
      player.x = Math.max(0, Math.min(WIDTH - player.w, player.x));

      /* --- 弾発射処理 --- */
      if (keys[" "] && bullets.length < 5) {
        bullets.push({
          x: player.x + player.w / 2 - 2,
          y: player.y
        });
        keys[" "] = false; // 押しっぱなし防止
      }

      // 弾の移動
      bullets.forEach((b) => (b.y -= 6));
      bullets = bullets.filter((b) => b.y > 0);

      /* --- 敵出現設定（レベルによる難易度変化） --- */
      let spawnInterval = 60;
      let enemySpeed = 2;

      if (level >= 2) {
        spawnInterval = 40; // 敵の数が増える
        enemySpeed = 4;     // 敵が速くなる
      }

      enemyTimer++;
      if (enemyTimer > spawnInterval) {
        enemies.push({
          x: Math.random() * (WIDTH - 50),
          y: -50,
          w: 50,
          h: 50,
          speed: enemySpeed,
          // レベル3以上で左右移動
          dx: level >= 3 ? (Math.random() < 0.5 ? -1 : 1) * level : 0
        });
        enemyTimer = 0;
      }

      /* --- 敵の移動処理 --- */
      enemies.forEach((e) => {
        e.y += e.speed;
        e.x += e.dx || 0;

        // 画面端で反射
        if (e.x < 0 || e.x + e.w > WIDTH) e.dx *= -1;
      });

      // 画面外の敵を削除
      enemies = enemies.filter((e) => e.y < HEIGHT + 50);

      /* --- 弾と敵の当たり判定 --- */
      bullets.forEach((b) => {
        enemies.forEach((e) => {
          if (
            b.x < e.x + e.w &&
            b.x + 5 > e.x &&
            b.y < e.y + e.h &&
            b.y + 20 > e.y
          ) {
            e.y = HEIGHT + 100; // 敵消去
            b.y = -100;         // 弾消去
            score += 100;       // スコア加算
          }
        });
      });

      /* --- プレイヤーと敵の当たり判定 --- */
      enemies.forEach((e) => {
        if (
          invincibleTimer === 0 &&
          player.x < e.x + e.w &&
          player.x + player.w > e.x &&
          player.y < e.y + e.h &&
          player.y + player.h > e.y
        ) {
          life--;
          invincibleTimer = 60; // 無敵時間付与
          e.y = HEIGHT + 100;

          if (life <= 0) gameOver = true;
        }
      });
    }

    /* ===== 描画処理 ===== */
    function draw() {
      // 背景描画
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // 無敵時間中は点滅表示
      if (invincibleTimer % 10 < 5) {
        ctx.fillStyle = "white";
        ctx.fillRect(player.x, player.y, player.w, player.h);
      }

      // 弾描画
      ctx.fillStyle = "yellow";
      bullets.forEach((b) => ctx.fillRect(b.x, b.y, 5, 20));

      // 敵描画
      ctx.fillStyle = "red";
      enemies.forEach((e) => ctx.fillRect(e.x, e.y, e.w, e.h));

      // UI表示
      ctx.fillStyle = "white";
      ctx.font = "24px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`SCORE: ${score}`, 20, 40);
      ctx.fillText(`LIFE: ${life}`, 20, 70);
      ctx.fillText(`LEVEL: ${level}`, 20, 100);

      // ゲームオーバー表示
      if (gameOver) {
        ctx.font = "48px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2);
        ctx.font = "24px sans-serif";
        ctx.fillText("Press Enter to Restart", WIDTH / 2, HEIGHT / 2 + 50);
      }
    }

    /* ===== メインループ ===== */
    function loop() {
      update();
      draw();
      requestAnimationFrame(loop);
    }

    loop();

    // クリーンアップ処理
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  /* ===== Reactの描画部分 ===== */
  return (
    <div
      style={{
        background: "black",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ border: "2px solid white" }}
      />
    </div>
  );
}
