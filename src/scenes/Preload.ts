import Phaser from 'phaser';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { ContentBundle } from '../content/schemas';
import { CONTENT_FILES } from '../content/schemas';
import { Content } from '../systems/Content';
import { GameState } from '../systems/GameState';

/** Načte veškerý obsah (JSON) + assety, naplní Content. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add
      .text(cx, cy - 80, 'Odbor blanických výjezdů úřaduje…', {
        fontFamily: FONTS.ui,
        fontSize: '42px',
        color: '#e8d9a8',
      })
      .setOrigin(0.5);
    const barBg = this.add.rectangle(cx, cy, 640, 28, COLORS.uiPanel).setStrokeStyle(3, COLORS.uiAccent);
    const bar = this.add.rectangle(cx - 318, cy, 2, 22, COLORS.uiAccent).setOrigin(0, 0.5);
    this.load.on('progress', (p: number) => bar.setSize(Math.max(2, 636 * p), 22));
    this.load.on('complete', () => {
      barBg.destroy();
      bar.destroy();
    });

    for (const [key, file] of Object.entries(CONTENT_FILES)) {
      this.load.json(`content:${key}`, `content/${file}`);
    }

    // pozadí menu (pokud soubor existuje; chybí-li, menu použije kreslenou siluetu)
    this.load.image('menu_bg', 'assets/images/menu_bg.png');
    // pozadí pro úvodní slideshow (Intro) - velké obrázky; chybí-li, scéna použije tmavé pozadí
    this.load.image('table_paper', 'assets/images/table_paper.png');
    // experiment: razítko jako obrázek (viz STAMP_STYLE v config.ts); chybí-li, použije se kreslené
    this.load.image('stamp_pixel', 'assets/images/pixel_google/stamp_pixel.png');
    // animovaná svíčka - 4 snímky vedle sebe (208×119 → snímek 52×119)
    this.load.spritesheet('candle_sheet', 'assets/images/pixel_google/spritesheet_candle_fire.png', {
      frameWidth: 52,
      frameHeight: 119,
    });
    // vosková tyčinka (pečetní vosk) pro minihru s pečetí; chybí-li, použije se kreslená
    this.load.image('wax_stick', 'assets/images/pixel_google/seelwax.png');
    // obrázek „FACKA!" pro cutaway při facce; chybí-li, použije se textový nadpis
    this.load.image('facka', 'assets/images/pixel_google/facka.png');
    this.load.on('loaderror', (f: Phaser.Loader.File) => {
      if (f.key === 'menu_bg') console.info('menu_bg.png zatím není - použije se kreslené pozadí');
    });

    // audio (CC0 - viz CREDITS.md)
    this.load.audio('music', 'assets/audio/music_loop.mp3');
    this.load.audio('music2', 'assets/audio/music_loop2.mp3');
    this.load.audio('music3', 'assets/audio/music_loop3.ogg');
    this.load.audio('music4', 'assets/audio/music_loop4.ogg');
    this.load.audio('sfx_stamp', 'assets/audio/sfx_stamp.ogg');
    this.load.audio('sfx_paper', 'assets/audio/sfx_paper.ogg');
    this.load.audio('sfx_slap', 'assets/audio/sfx_slap.ogg');
    this.load.audio('sfx_fanfare', 'assets/audio/sfx_fanfare.ogg');
    this.load.audio('sfx_click', 'assets/audio/sfx_click.ogg');
  }

  create(): void {
    const bundle = {} as Record<string, unknown>;
    const missing: string[] = [];
    for (const key of Object.keys(CONTENT_FILES)) {
      const data = this.cache.json.get(`content:${key}`);
      if (!data) {
        missing.push(key);
        continue;
      }
      // soubory mají tvar { version, items } - strings.json má { version, items: {k: LString} }
      bundle[key] = data.items ?? data;
    }
    if (missing.length > 0) {
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80, `CHYBÍ OBSAH: ${missing.join(', ')}`, {
          fontFamily: FONTS.doc,
          fontSize: '32px',
          color: '#ff6b5e',
        })
        .setOrigin(0.5);
      return;
    }
    Content.init(bundle as unknown as ContentBundle);

    // Debug skok do scény: ?start=Office&day=3 | ?start=Ending&ending=released
    const params = new URLSearchParams(location.search);
    const lang = params.get('lang');
    if (lang === 'cs' || lang === 'en') GameState.lang = lang;
    const start = params.get('start');
    const allowed = ['Menu', 'Intro', 'Newspaper', 'Office', 'DayEnd', 'Ending', 'Lab'];
    if (start && allowed.includes(start)) {
      GameState.reset();
      const day = Number(params.get('day') ?? 1);
      if (day >= 1 && day <= 5) GameState.day = day;
      // debug: ?pending=R22,R23 → tyhle vyhlášky nechej čekat v šuplíku (test zahrání)
      const pend = new Set((params.get('pending') ?? '').split(/[.,]/).filter(Boolean));
      // debug skok: uvedeme v platnost vyhlášky odpovídající epoše (jinak by byly jen base).
      // Vousové vyhlášky (3 délky) kapneme na 2, ať nikdy nejsou v platnosti všechny 3.
      if (start === 'Office' || start === 'Newspaper') {
        const BEARD_RULES = new Set(['R23', 'R29', 'R30']);
        let beard = 0;
        for (const r of Content.all.rules) {
          if (r.day > day || pend.has(r.id)) continue;
          if (BEARD_RULES.has(r.id)) { if (beard >= 2) continue; beard++; }
          GameState.enactRule(r.id);
        }
      }
      for (const id of pend) GameState.addPendingRule(id);
      const ending = params.get('ending');
      if (ending === 'survived' || ending === 'beaten' || ending === 'released') {
        GameState.endingType = ending;
      }
      this.scene.start(start);
      return;
    }
    this.scene.start('Menu');
  }
}
