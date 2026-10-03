import Phaser from 'phaser';
import { COLORS, FONTS } from '../config';

export interface ButtonOpts {
  width?: number;
  fontSize?: number;
  color?: number;
  textColor?: string;
  disabled?: boolean;
  /** Šířka pro zalamování textu — tlačítko se roztáhne na výšku. */
  wrap?: number;
  font?: string;
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
    // hover musí zůstat NEPRŮHLEDNÝ — na světlém podkladu (noviny) jinak prosvítá
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
