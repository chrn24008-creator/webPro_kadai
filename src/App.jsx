// App.jsx
import { useEffect, useRef } from "react";
import { createGame } from "./game";

import playerSrc from "./assets/player.png";
import bossSrc from "./assets/boss.png";
import bulletSrc from "./assets/bullet.png";
import enemyBulletSrc from "./assets/enemy_bullet.png";

export default function App() {
  const canvasRef = useRef(null);
  const keys = useRef({});

  useEffect(() => {
    const canvas = canvasRef.current;

    const images = {
      player: new Image(),
      boss: new Image(),
      bullet: new Image(),
      enemyBullet: new Image()
    };

    images.player.src = playerSrc;
    images.boss.src = bossSrc;
    images.bullet.src = bulletSrc;
    images.enemyBullet.src = enemyBulletSrc;

    window.addEventListener("keydown", e => (keys.current[e.code] = true));
    window.addEventListener("keyup", e => (keys.current[e.code] = false));

    const game = createGame(canvas, images, keys);

    let animationId;
    const loop = () => {
      game.update();
      game.draw();
      animationId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div style={{ background: "#000", textAlign: "center" }}>
      <canvas ref={canvasRef} width={480} height={640} />
    </div>
  );
}
