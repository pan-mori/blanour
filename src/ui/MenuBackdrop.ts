import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/**
 * Procedurální pixel-art horské pozadí menu (ladění dle referenční fotky:
 * tlumené olivově-sépiové nebe, modravé hřebeny, lesnaté kopce, v dálce
 * vrchol s rozhlednou = Blaník, vepředu siluety smrků). Deterministické.
 */
export function drawMenuMountains(scene: Phaser.Scene): void {
  const W = GAME_WIDTH;
  const H = GAME_HEIGHT;
  const g = scene.add.graphics();
  const rnd = new Phaser.Math.RandomDataGenerator(['blanik-menu']);

  // nebe — vodorovné pruhy od tmavé nahoře po teplejší u obzoru
  const skyTop = [0x4a4438, 0x56503f, 0x635a47, 0x6f6450, 0x7c6e54, 0x897a5a];
  const bands = skyTop.length;
  for (let i = 0; i < bands; i++) {
    g.fillStyle(skyTop[i], 1);
    g.fillRect(0, (H * 0.62 * i) / bands, W, Math.ceil((H * 0.62) / bands) + 1);
  }

  // vrstvy hřebenů (zezadu dopředu) — od modravě šedé po tmavě olivovou
  const ridge = (baseY: number, amp: number, color: number, step: number, jitter: number) => {
    g.fillStyle(color, 1);
    let x = -20;
    let y = baseY;
    g.beginPath();
    g.moveTo(x, H);
    g.lineTo(x, y);
    while (x < W + 20) {
      y = baseY + Math.sin(x / amp) * amp * 0.5 + rnd.between(-jitter, jitter);
      g.lineTo(x, y);
      x += step;
    }
    g.lineTo(W + 20, H);
    g.closePath();
    g.fillPath();
  };

  ridge(H * 0.46, 220, 0x5b6560, 70, 10); // nejvzdálenější, modravá
  ridge(H * 0.54, 170, 0x505a52, 60, 12);

  // hlavní vrchol s rozhlednou (Blaník) vlevo od středu
  const peakX = W * 0.34;
  const peakTop = H * 0.3;
  g.fillStyle(0x47514a, 1);
  g.beginPath();
  g.moveTo(peakX - 320, H * 0.55);
  g.lineTo(peakX, peakTop);
  g.lineTo(peakX + 360, H * 0.55);
  g.closePath();
  g.fillPath();
  // rozhledna na vrcholu
  g.fillStyle(0x2f352f, 1);
  g.fillRect(peakX - 6, peakTop - 34, 12, 36);
  g.fillRect(peakX - 12, peakTop - 40, 24, 8);

  // lesnaté kopce (olivové), dva překryvy
  ridge(H * 0.66, 140, 0x3c4631, 48, 14);
  ridge(H * 0.74, 110, 0x323b28, 40, 16);

  // textura lesa — tečky stromů na kopcích
  for (let i = 0; i < 900; i++) {
    const x = rnd.between(0, W);
    const y = rnd.between(Math.floor(H * 0.6), Math.floor(H * 0.82));
    g.fillStyle(rnd.pick([0x2a331f, 0x37422a, 0x222a18]), 1);
    g.fillRect(x, y, rnd.between(2, 5), rnd.between(3, 7));
  }

  // přední tmavý les + jednotlivé smrky
  g.fillStyle(0x1a1f12, 1);
  g.fillRect(0, H * 0.82, W, H * 0.18);
  const pine = (x: number, baseY: number, h: number, c: number) => {
    g.fillStyle(c, 1);
    const w = h * 0.5;
    for (let layer = 0; layer < 4; layer++) {
      const ly = baseY - (h * layer) / 4;
      const lw = w * (1 - layer / 5);
      g.fillTriangle(x - lw, ly, x + lw, ly, x, ly - h / 3.2);
    }
    g.fillRect(x - 2, baseY, 4, 14);
  };
  let px = -10;
  while (px < W + 40) {
    pine(px, H * 0.9 + rnd.between(-10, 30), rnd.between(90, 190), rnd.pick([0x12170d, 0x171d10, 0x0e1209]));
    px += rnd.between(55, 110);
  }

  g.setDepth(0);
}
