import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';

/**
 * Procedurální pozadí úřadovny v jeskyni: krápníky, kamenná zeď,
 * police s šanony, dřevo stolu s léty, svíčka s teplou září.
 * Záměrně nízký kontrast — papíry a UI musí zůstat hlavní.
 */
export function drawOfficeBackdrop(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const rnd = new Phaser.Math.RandomDataGenerator(['blanik']); // deterministické

  // kamenná zeď
  g.fillStyle(0x241a10, 1);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT - 475);

  // skvrny/kameny ve zdi
  for (let i = 0; i < 90; i++) {
    const x = rnd.between(0, GAME_WIDTH);
    const y = rnd.between(90, GAME_HEIGHT - 500);
    const w = rnd.between(18, 70);
    const h = rnd.between(10, 34);
    g.fillStyle(rnd.pick([0x2a2015, 0x1f160d, 0x2d2317]), 1);
    g.fillRect(x, y, w, h);
  }

  // krápníky u stropu (dvě vrstvy siluet)
  g.fillStyle(0x15100a, 1);
  let x = -20;
  while (x < GAME_WIDTH) {
    const w = rnd.between(50, 130);
    const h = rnd.between(40, 150);
    g.fillTriangle(x, 0, x + w, 0, x + w / 2, h);
    x += w - rnd.between(10, 30);
  }
  g.fillStyle(0x0d0a06, 1);
  x = -40;
  while (x < GAME_WIDTH) {
    const w = rnd.between(40, 90);
    const h = rnd.between(25, 80);
    g.fillTriangle(x, 0, x + w, 0, x + w / 2, h);
    x += w + rnd.between(20, 60);
  }

  // police s šanony vlevo nahoře (za bublinou je prázdno, tak jen v rohu)
  const shelfX = 20;
  const shelfY = 120;
  g.fillStyle(0x3a2a16, 1);
  g.fillRect(shelfX, shelfY + 90, 240, 12);
  g.fillRect(shelfX, shelfY + 190, 240, 12);
  const spineColors = [0x6b2d1a, 0x4a5a2a, 0x2a4a5a, 0x5a4a2a, 0x4a2a4a];
  for (let s = 0; s < 2; s++) {
    let bx = shelfX + 8;
    while (bx < shelfX + 215) {
      const bw = rnd.between(18, 34);
      const bh = rnd.between(55, 80);
      g.fillStyle(rnd.pick(spineColors), 1);
      g.fillRect(bx, shelfY + 90 + s * 100 - bh, bw, bh);
      g.fillStyle(0xd4a017, 0.5);
      g.fillRect(bx + 3, shelfY + 90 + s * 100 - bh + 8, bw - 6, 5);
      bx += bw + 3;
    }
  }

  // stůl — dřevo s léty
  g.fillStyle(COLORS.desk, 1);
  g.fillRect(0, GAME_HEIGHT - 480, GAME_WIDTH, 480);
  g.fillStyle(COLORS.deskDark, 1);
  g.fillRect(0, GAME_HEIGHT - 482, GAME_WIDTH, 14);
  for (let i = 0; i < 26; i++) {
    const y = GAME_HEIGHT - 460 + i * 18 + rnd.between(-3, 3);
    g.fillStyle(0x50391f, rnd.realInRange(0.25, 0.6));
    g.fillRect(rnd.between(-100, 300), y, rnd.between(700, 1900), 3);
  }

  // svíčka vpravo nahoře na polici
  const cx = GAME_WIDTH - 150;
  const cy = 150;
  g.fillStyle(0x3a2a16, 1);
  g.fillRect(cx - 60, cy + 46, 140, 10); // polička
  g.fillStyle(0xe8e0d0, 1);
  g.fillRect(cx - 10, cy, 24, 46); // tělo svíčky
  g.fillStyle(0xd4a017, 1);
  g.fillTriangle(cx + 2, cy - 26, cx - 8, cy + 2, cx + 12, cy + 2); // plamen
  // teplá záře (PointLight je jen WebGL; na canvasu stačí svíčka bez záře)
  if (scene.game.renderer.type === Phaser.WEBGL) {
    scene.add.pointlight(cx + 2, cy - 8, 0xd4a017, 260, 0.12, 0.06).setDepth(1);
  }

  // vinětace — ztmavené rohy
  g.fillStyle(0x000000, 0.35);
  g.fillRect(0, 0, GAME_WIDTH, 26);
  g.fillRect(0, 0, 26, GAME_HEIGHT);
  g.fillRect(GAME_WIDTH - 26, 0, 26, GAME_HEIGHT);

  g.setDepth(0);
}
