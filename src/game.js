// game.js
export function createGame(canvas, images, keys) {
  const ctx = canvas.getContext("2d");

  const init = () => ({
    player: { x: 220, y: 560, w: 48, h: 48, speed: 5 },
    bullets: [],
    enemyBullets: [],
    boss: {
      x: 160,
      y: 80,
      w: 160,
      h: 160,
      hp: 100,
      mode: "rest",
      modeTime: 0
    }
  });

  let game = init();

  const shoot = () => {
    game.bullets.push({
      x: game.player.x + game.player.w / 2 - 8,
      y: game.player.y,
      w: 16,
      h: 16,
      speed: 6
    });
  };

  const bossShootSpread = () => {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI;
      game.enemyBullets.push({
        x: game.boss.x + game.boss.w / 2,
        y: game.boss.y + game.boss.h / 2,
        vx: Math.cos(angle) * 3,
        vy: Math.sin(angle) * 3,
        r: 10
      });
    }
  };

  const bossShootAim = () => {
    const dx =
      game.player.x +
      game.player.w / 2 -
      (game.boss.x + game.boss.w / 2);
    const dy =
      game.player.y -
      (game.boss.y + game.boss.h / 2);
    const len = Math.hypot(dx, dy);

    game.enemyBullets.push({
      x: game.boss.x + game.boss.w / 2,
      y: game.boss.y + game.boss.h / 2,
      vx: (dx / len) * 4,
      vy: (dy / len) * 4,
      r: 12
    });
  };

  const update = () => {
    const p = game.player;

    if (keys.current["ArrowLeft"]) p.x -= p.speed;
    if (keys.current["ArrowRight"]) p.x += p.speed;
    p.x = Math.max(0, Math.min(canvas.width - p.w, p.x));

    if (keys.current["Space"] && Math.random() < 0.2) shoot();

    game.bullets.forEach(b => (b.y -= b.speed));
    game.enemyBullets.forEach(b => {
      b.x += b.vx;
      b.y += b.vy;
    });

    game.boss.modeTime++;
    if (game.boss.modeTime > 120) {
      game.boss.modeTime = 0;
      const modes = ["spread", "aim", "rest"];
      game.boss.mode = modes[Math.floor(Math.random() * modes.length)];
    }

    if (game.boss.mode === "spread" && game.boss.modeTime % 30 === 0)
      bossShootSpread();
    if (game.boss.mode === "aim" && game.boss.modeTime % 40 === 0)
      bossShootAim();

    // 自弾 → ボス
    game.bullets.forEach(b => {
      if (
        b.x < game.boss.x + game.boss.w &&
        b.x + b.w > game.boss.x &&
        b.y < game.boss.y + game.boss.h &&
        b.y + b.h > game.boss.y
      ) {
        game.boss.hp--;
        b.y = -999;
      }
    });

    // 敵弾 → プレイヤー
    for (const b of game.enemyBullets) {
      if (
        b.x > p.x &&
        b.x < p.x + p.w &&
        b.y > p.y &&
        b.y < p.y + p.h
      ) {
        alert("GAME OVER");
        game = init();
        return;
      }
    }

    if (game.boss.hp <= 0) {
      alert("YOU WIN!");
      game = init();
    }
  };

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(images.player, game.player.x, game.player.y, game.player.w, game.player.h);
    ctx.drawImage(images.boss, game.boss.x, game.boss.y, game.boss.w, game.boss.h);

    game.bullets.forEach(b =>
      ctx.drawImage(images.bullet, b.x, b.y, b.w, b.h)
    );

    game.enemyBullets.forEach(b =>
      ctx.drawImage(
        images.enemyBullet,
        b.x - b.r,
        b.y - b.r,
        b.r * 2,
        b.r * 2
      )
    );

    ctx.fillStyle = "yellow";
    ctx.fillText(`HP: ${game.boss.hp}`, 10, 20);
  };

  return { update, draw };
}
