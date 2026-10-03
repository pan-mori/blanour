import Phaser from 'phaser';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Content } from '../systems/Content';

/**
 * Knihovna/spisovna se svitky vpravo nahoře, pod svíčkou. Kreslí se do pozadí
 * (zeď jeskyně, za papíry na stole) a slouží jako cíl archivace druhopisů.
 * Obdélník je zdroj pravdy i pro drop-zónu v Office.
 */
export const LIBRARY_RECT = { x: 1628, y: 212, w: 268, h: 286 } as const;

/**
 * Procedurální pozadí úřadovny v jeskyni: krápníky, kamenná zeď,
 * police s šanony, dřevo stolu s léty, svíčka s teplou září.
 * Záměrně nízký kontrast - papíry a UI musí zůstat hlavní.
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

  // stůl - dřevo s léty
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

  // knihovna/spisovna se svitky pod svíčkou (na zadní stěně, za papíry)
  drawLibrary(scene, g, rnd);

  // vinětace - ztmavené rohy
  g.fillStyle(0x000000, 0.35);
  g.fillRect(0, 0, GAME_WIDTH, 26);
  g.fillRect(0, 0, 26, GAME_HEIGHT);
  g.fillRect(GAME_WIDTH - 26, 0, 26, GAME_HEIGHT);

  g.setDepth(0);
}

/**
 * Dřevěná knihovna/spisovna plná svitků, zapuštěná do stěny pod svíčkou.
 * Deterministická (rnd se seedem z drawOfficeBackdrop). Rozměry = LIBRARY_RECT.
 */
function drawLibrary(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, rnd: Phaser.Math.RandomDataGenerator): void {
  const { x, y, w, h } = LIBRARY_RECT;

  // stín výklenku ve stěně
  g.fillStyle(0x0d0906, 1);
  g.fillRect(x - 10, y - 10, w + 20, h + 20);
  // zadní deska skříně
  g.fillStyle(0x2a1d10, 1);
  g.fillRect(x, y, w, h);

  const rows = 3;
  const frame = 10;
  const shelfH = (h - frame * 2) / rows;
  // rám
  g.lineStyle(frame, 0x4a331c, 1);
  g.strokeRect(x + frame / 2, y + frame / 2, w - frame, h - frame);

  for (let r = 0; r < rows; r++) {
    const sy = y + frame + r * shelfH;
    // police (dřevěná deska)
    g.fillStyle(0x5a4226, 1);
    g.fillRect(x + frame, sy + shelfH - 8, w - frame * 2, 8);
    g.fillStyle(0x3a2a16, 1);
    g.fillRect(x + frame, sy + shelfH - 8, w - frame * 2, 2);

    // svitky naskládané vedle sebe (čela rolí k divákovi)
    let sx = x + frame + 8;
    const top = sy + 8;
    const rollH = shelfH - 22;
    while (sx < x + w - frame - 20) {
      const rw = rnd.between(20, 30);
      const parch = rnd.pick([0xe8dcc0, 0xe0d2ad, 0xd8c79a, 0xeadfc4]);
      // tělo svitku
      g.fillStyle(parch, 1);
      g.fillRect(sx, top, rw, rollH);
      // čelo role (elipsa) - světlejší
      g.fillStyle(Phaser.Display.Color.ValueToColor(parch).brighten(12).color, 1);
      g.fillEllipse(sx + rw / 2, top + 7, rw, 14);
      // dírka uprostřed role
      g.fillStyle(0x7a6a45, 1);
      g.fillEllipse(sx + rw / 2, top + 7, rw * 0.42, 6);
      // stínek a stuha
      g.fillStyle(0x000000, 0.14);
      g.fillRect(sx + rw - 4, top, 4, rollH);
      g.fillStyle(rnd.pick([0x7a1f12, 0x8a2a18, 0x4a5a2a]), 0.9);
      g.fillRect(sx, top + rollH * 0.55, rw, 5);
      sx += rw + rnd.between(3, 7);
    }
  }

  // štítek SPISOVNA
  const lblText = (() => { try { return Content.ui('library'); } catch { return 'SPISOVNA'; } })();
  g.fillStyle(0x1d140c, 0.92);
  g.fillRect(x + w / 2 - 70, y - 2, 140, 26);
  scene.add
    .text(x + w / 2, y + 11, lblText, { fontFamily: FONTS.doc, fontSize: '17px', color: '#d4a017' })
    .setOrigin(0.5)
    .setDepth(1);
}
