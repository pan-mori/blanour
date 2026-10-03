import Phaser from 'phaser';
import { COLORS, FONTS } from '../config';
import { GameState } from '../systems/GameState';
import { Music } from '../systems/Music';

export interface ButtonOpts {
  width?: number;
  fontSize?: number;
  color?: number;
  textColor?: string;
  disabled?: boolean;
  /** Šířka pro zalamování textu - tlačítko se roztáhne na výšku. */
  wrap?: number;
  font?: string;
}

/**
 * Text, který se bude natáčet (žádost je nakloněná o pár stupňů).
 * Hra běží v pixelArt módu (NEAREST filtr), takže otočená textura textu
 * jinak zubatí/rozmazává. LINEAR filtr + vyšší rozlišení canvasu to srovná,
 * aniž bychom museli vypínat pixelArt pro celou hru.
 */
export function crispRotatedText(t: Phaser.GameObjects.Text): Phaser.GameObjects.Text {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  t.setResolution(Math.max(2, Math.ceil(dpr)));
  t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return t;
}

/** Jednoduché pixelové tlačítko (obdélník + text) s hover efektem. */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {},
): Phaser.GameObjects.Container {
  const fontSize = opts.fontSize ?? 36;
  const padX = 32;
  const padY = 14;
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: opts.font ?? FONTS.ui,
      fontSize: `${fontSize}px`,
      color: opts.textColor ?? '#e8d9a8',
      align: 'center',
      wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
    })
    .setOrigin(0.5);
  const w = opts.width ?? text.width + padX * 2;
  const h = text.height + padY * 2;
  const bgColor = opts.color ?? COLORS.uiPanelLight;
  const bg = scene.add.rectangle(0, 0, w, h, bgColor).setStrokeStyle(3, COLORS.uiAccent);
  const c = scene.add.container(x, y, [bg, text]);
  c.setSize(w, h);
  if (!opts.disabled) {
    // hover musí zůstat NEPRŮHLEDNÝ - na světlém podkladu (noviny) jinak prosvítá
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => bg.setFillStyle(0x6a5430, 1))
      .on('pointerout', () => bg.setFillStyle(bgColor))
      .on('pointerdown', () => {
        scene.tweens.add({ targets: c, scale: 0.96, duration: 50, yoyo: true });
        try {
          scene.sound.play('sfx_click', { volume: 0.35 });
        } catch {
          /* zvuk není kritický */
        }
        onClick();
      });
  } else {
    bg.setFillStyle(bgColor, 0.4);
    text.setAlpha(0.4);
  }
  return c;
}

/**
 * Ikonka zapnutí/vypnutí hudby (nota) - při ztlumení se přeškrtne.
 * Stav bere z GameState.audioMuted (přežívá scény i restart), rovnou nastaví
 * scene.sound.mute a při zapnutí (ne-ztlumení) rozjede hudbu.
 */
export function makeMusicToggle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size = 72,
): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, size, size, COLORS.uiPanelLight).setStrokeStyle(3, COLORS.uiAccent);
  const icon = scene.add.graphics();
  const strike = scene.add.graphics();
  const c = scene.add.container(x, y, [bg, icon, strike]);
  c.setSize(size, size);

  const redraw = (): void => {
    const muted = GameState.audioMuted;
    const col = muted ? 0x8a7a55 : 0xe8d9a8;
    icon.clear();
    icon.fillStyle(col, 1);
    icon.fillCircle(-9, 11, 9); // hlavička noty
    icon.fillRect(-2, -18, 5, 29); // nožička
    icon.fillTriangle(3, -18, 3, -2, 17, -10); // praporek
    strike.clear();
    if (muted) {
      strike.lineStyle(5, 0xd14a2a, 1);
      const r = size * 0.3;
      strike.lineBetween(-r, -r, r, r);
    }
    scene.sound.mute = muted;
  };
  redraw();

  bg.setInteractive({ useHandCursor: true })
    .on('pointerover', () => bg.setFillStyle(0x6a5430, 1))
    .on('pointerout', () => bg.setFillStyle(COLORS.uiPanelLight))
    .on('pointerdown', () => {
      GameState.toggleMuted();
      if (!GameState.audioMuted) Music.start(scene.sound); // kdyby hudba ještě neběžela
      redraw();
      scene.tweens.add({ targets: c, scale: 0.92, duration: 50, yoyo: true });
      try {
        scene.sound.play('sfx_click', { volume: 0.35 });
      } catch {
        /* zvuk není kritický */
      }
    });
  return c;
}

export function title(scene: Phaser.Scene, x: number, y: number, s: string, size = 72): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, s, {
      fontFamily: FONTS.title,
      fontSize: `${size}px`,
      color: '#e8d9a8',
      stroke: '#14100c',
      strokeThickness: 6,
    })
    .setOrigin(0.5);
}

export function bodyText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  s: string,
  size = 30,
  wrapWidth?: number,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, s, {
    fontFamily: FONTS.doc,
    fontSize: `${size}px`,
    color: '#e8d9a8',
    wordWrap: wrapWidth ? { width: wrapWidth } : undefined,
  });
}
