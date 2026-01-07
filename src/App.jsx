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

    let gameOver = false;
    let score = 0;
    let life = 3;
    let level = 1;
    let invincibleTimer = 0;

    let player;
    let bullets;
    let enemies;
    let enemyTimer;

    function initGame() {
      gameOver = false;
      score = 0;
      life = 3;
      level = 1;
      invincibleTimer = 0;

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

    initGame();

    const keys = {};

    const keyDown = (e) => {
      keys[e.key] = true;
      if (gameOver && e.key === "Enter") initGame();
    };

    const keyUp = (e) => (keys[e.key] = false);

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    function update() {
      if (gameOver) return;

      if (invincibleTimer > 0) invincibleTimer--;

      // レベル計算
      level = Math.floor(score / 1000) + 1;

      if (keys["ArrowLeft"]) player.x -= player.speed;
      if (keys["ArrowRight"]) player.x += player.speed;
      player.x = Math.max(0, Math.min(WIDTH - player.w, player.x));

      if (keys[" "] && bullets.length < 5) {
        bullets.push({
          x: player.x + player.w / 2 - 2,
          y: player.y
        });
        keys[" "] = false;
      }

      bullets.forEach((b) => (b.y -= 6));
      bullets = bullets.filter((b) => b.y > 0);

      

      // レベル計算
      level = Math.floor(score / 1000) + 1;
      
      // 出現間隔（敵の数）
      let spawnInterval = 60;
      if (level >= 2) {
        spawnInterval = 40;
      }
      
      // 敵スピード
      let enemySpeed = 2; 
      if (level >= 2) {
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
            dx: level >= 3 ? (Math.random() < 0.5 ? -1 : 1) * level : 0
        });
        enemyTimer = 0;
      }


      enemies.forEach((e) => {
        e.y += e.speed;
        e.x += e.dx || 0;

        if (e.x < 0 || e.x + e.w > WIDTH) e.dx *= -1;
      });

      enemies = enemies.filter((e) => e.y < HEIGHT + 50);

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
          }
        });
      });

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
          if (life <= 0) gameOver = true;
        }
      });
    }

    function draw() {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      if (invincibleTimer % 10 < 5) {
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

      if (gameOver) {
        ctx.font = "48px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2);
        ctx.font = "24px sans-serif";
        ctx.fillText("Press Enter to Restart", WIDTH / 2, HEIGHT / 2 + 50);
      }
    }

    function loop() {
      update();
      draw();
      requestAnimationFrame(loop);
    }

    loop();

    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  return (
    <div style={{
      background: "black",
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }}>
      <canvas ref={canvasRef} style={{ border: "2px solid white" }} />
    </div>
  );
}
