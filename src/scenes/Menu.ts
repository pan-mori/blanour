import Phaser from 'phaser';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Content } from '../systems/Content';
import { GameState } from '../systems/GameState';
import { Music } from '../systems/Music';
import { makeButton, title } from '../ui/helpers';
import { drawMenuMountains } from '../ui/MenuBackdrop';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    // hudba (playlist 4 skladeb) - autoplay policy: dokud hráč neklikne, je audio
    // zamčené, proto startujeme až po events.UNLOCKED (jinak se play ztratí do ticha)
    const startMusic = () => Music.start(this.sound);
    Music.setVolumeFactor(1); // v menu plná hlasitost (ztišení z vyhlášky o decibelech se nepřenáší)
    // zdroj pravdy je GameState.audioMuted (přežije restart scény při změně jazyka)
    this.sound.mute = GameState.audioMuted;
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, startMusic);
    else startMusic();

    // pozadí: pixel-art hora (menu_bg.png), jinak kreslená silueta Blaníku
    if (this.textures.exists('menu_bg')) {
      const bg = this.add.image(cx, GAME_HEIGHT / 2, 'menu_bg');
      const src = this.textures.get('menu_bg').getSourceImage();
      const scale = Math.max(GAME_WIDTH / src.width, GAME_HEIGHT / src.height);
      bg.setScale(scale); // vyplní obrazovku (cover)
    } else {
      drawMenuMountains(this);
    }
    // jemné rovnoměrné ztmavení přes CELOU obrazovku (bez viditelné hrany)
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x14100c, 0.22);

    title(this, cx, 220, Content.ui('title'), 110);
    this.add
      .text(cx, 320, Content.ui('subtitle'), {
        fontFamily: FONTS.doc,
        fontSize: '38px',
        color: '#e8d9a8',
        stroke: '#14100c',
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    makeButton(this, cx, 550, Content.ui('play'), () => {
      GameState.reset();
      this.scene.start('Newspaper');
    }, { fontSize: 52, width: 380 });

    // výběr jazyka: klikací vlajky (CZ / UK)
    this.add.text(cx, 612, Content.ui('langLabel'), {
      fontFamily: FONTS.doc, fontSize: '24px', color: '#bfa978', stroke: '#14100c', strokeThickness: 3,
    }).setOrigin(0.5);
    const setLang = (l: 'cs' | 'en') => { if (GameState.lang !== l) { GameState.lang = l; this.scene.restart(); } };
    this.makeFlag(cx - 90, 690, 'cs', GameState.lang === 'cs', () => setLang('cs'));
    this.makeFlag(cx + 90, 690, 'en', GameState.lang === 'en', () => setLang('en'));

    // úvodní příběhová slideshow (lze spustit kdykoli z menu)
    makeButton(this, cx, 800, Content.ui('story'), () => this.scene.start('Intro'), { fontSize: 34, width: 460 });

    makeButton(this, cx, 885, Content.ui('howTo'), () => this.showHowTo(), { fontSize: 30 });

    // přepínač zvuku - label se mění na místě (bez restartu scény)
    const musicLabel = () => `${Content.ui('music')}: ${this.sound.mute ? Content.ui('off') : Content.ui('on')}`;
    const musicBtn = makeButton(
      this,
      cx,
      965,
      musicLabel(),
      () => {
        this.sound.mute = GameState.toggleMuted();
        if (!this.sound.mute) startMusic(); // kdyby hudba ještě neběžela
        const txt = musicBtn.list.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text;
        txt?.setText(musicLabel());
      },
      { fontSize: 30, width: 560 },
    );

    // kontrola diakritiky (pangram) - nenápadně v patičce
    this.add
      .text(cx, GAME_HEIGHT - 60, 'Příliš žluťoučký kůň úpěl ďábelské ódy - © Odbor blanických výjezdů', {
        fontFamily: FONTS.doc,
        fontSize: '24px',
        color: '#6b5b40',
      })
      .setOrigin(0.5);

    this.add.rectangle(cx, 440, 900, 4, COLORS.uiAccent, 0.5);

    // debug: brouček vlevo dole → LAB s minihrami (samostatné testování)
    this.makeDebugBug(90, GAME_HEIGHT - 70);
  }

  /** Malý brouček (ladybug) vlevo dole - otevře DEBUG LAB s minihrami. */
  private makeDebugBug(x: number, y: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xc0392b, 1); g.fillEllipse(x, y, 34, 30); // tělo
    g.fillStyle(0x14100c, 1);
    g.fillEllipse(x, y - 15, 16, 12); // hlava
    g.fillRect(x - 1.5, y - 11, 3, 25); // středová čára
    g.fillCircle(x - 8, y - 2, 3); g.fillCircle(x + 8, y - 2, 3); // tečky
    g.fillCircle(x - 6, y + 8, 2.6); g.fillCircle(x + 6, y + 8, 2.6);
    g.lineStyle(2, 0x14100c, 1); // tykadla
    g.lineBetween(x - 4, y - 21, x - 10, y - 28);
    g.lineBetween(x + 4, y - 21, x + 10, y - 28);
    const label = this.add
      .text(x + 30, y, 'LAB', { fontFamily: FONTS.ui, fontSize: '26px', color: '#8a7a55' })
      .setOrigin(0, 0.5);
    const hit = this.add
      .rectangle(x + 12, y, 130, 64, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => label.setColor('#e8d9a8'))
      .on('pointerout', () => label.setColor('#8a7a55'))
      .on('pointerdown', () => {
        try { this.sound.play('sfx_click', { volume: 0.4 }); } catch { /* ok */ }
        this.scene.start('Lab');
      });
    void hit;
  }

  /** Klikací vlajka (cs = česká, en = britská) s highlightem aktivního jazyka. */
  private makeFlag(x: number, y: number, which: 'cs' | 'en', active: boolean, onClick: () => void): void {
    const w = 132;
    const h = 84;
    const x0 = x - w / 2;
    const y0 = y - h / 2;
    const g = this.add.graphics();

    if (which === 'cs') {
      g.fillStyle(0xffffff, 1); g.fillRect(x0, y0, w, h / 2); // bílá nahoře
      g.fillStyle(0xd7141a, 1); g.fillRect(x0, y0 + h / 2, w, h / 2); // červená dole
      g.fillStyle(0x11457e, 1); g.fillTriangle(x0, y0, x0, y0 + h, x0 + w * 0.5, y0 + h / 2); // modrý klín
    } else {
      // Union Jack (zjednodušený)
      g.fillStyle(0x012169, 1); g.fillRect(x0, y0, w, h);
      g.lineStyle(16, 0xffffff, 1); // bílé diagonály
      g.lineBetween(x0, y0, x0 + w, y0 + h);
      g.lineBetween(x0 + w, y0, x0, y0 + h);
      g.lineStyle(7, 0xc8102e, 1); // červené diagonály
      g.lineBetween(x0, y0, x0 + w, y0 + h);
      g.lineBetween(x0 + w, y0, x0, y0 + h);
      g.fillStyle(0xffffff, 1); // bílý kříž
      g.fillRect(x0 + w / 2 - 13, y0, 26, h);
      g.fillRect(x0, y0 + h / 2 - 13, w, 26);
      g.fillStyle(0xc8102e, 1); // červený kříž
      g.fillRect(x0 + w / 2 - 7, y0, 14, h);
      g.fillRect(x0, y0 + h / 2 - 7, w, 14);
    }
    // rámeček - zlatý u aktivního, tmavý u neaktivního
    g.lineStyle(active ? 5 : 3, active ? 0xd4a017 : 0x14100c, 1);
    g.strokeRect(x0, y0, w, h);

    const label = this.add
      .text(x, y + h / 2 + 18, which === 'cs' ? 'Čeština' : 'English', {
        fontFamily: FONTS.doc, fontSize: '20px', color: active ? '#d4a017' : '#8a7a55', stroke: '#14100c', strokeThickness: 3,
      })
      .setOrigin(0.5);

    const hit = this.add.rectangle(x, y, w + 10, h + 10, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { if (!active) { g.setAlpha(1); label.setColor('#e8d9a8'); } });
    hit.on('pointerout', () => { if (!active) { g.setAlpha(0.72); label.setColor('#8a7a55'); } });
    hit.on('pointerdown', () => {
      try { this.sound.play('sfx_click', { volume: 0.4 }); } catch { /* ok */ }
      onClick();
    });
    if (!active) g.setAlpha(0.72);
  }

  /** Overlay s pravidly hry. */
  private showHowTo(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const layer = this.add.container(0, 0).setDepth(200);
    const dim = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setInteractive();
    const panel = this.add.rectangle(cx, cy, 1400, 820, COLORS.uiPanel).setStrokeStyle(4, COLORS.uiAccent);
    const head = this.add
      .text(cx, cy - 350, Content.ui('howTo').toUpperCase(), {
        fontFamily: FONTS.ui,
        fontSize: '48px',
        color: '#d4a017',
      })
      .setOrigin(0.5);
    const body = this.add
      .text(cx, cy - 280, Content.ui('howToBody'), {
        fontFamily: FONTS.doc,
        fontSize: '30px',
        color: '#e8d9a8',
        wordWrap: { width: 1280 },
        lineSpacing: 8,
      })
      .setOrigin(0.5, 0);
    const close = makeButton(this, cx, cy + 350, Content.ui('close'), () => layer.destroy(true), { fontSize: 32 });
    layer.add([dim, panel, head, body, close]);
  }
}
