import Phaser from 'phaser';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { ContentBundle } from '../content/schemas';
import { CONTENT_FILES } from '../content/schemas';
import { Content } from '../systems/Content';
import { GameState } from '../systems/GameState';

/**
 * Hlasy hecklerů (rytíři nadávající úředníkovi) - namluvené nahrávky v
 * public/assets/audio/heckle/. ID odpovídá infografice IG_<ID> (kind 'heckle'),
 * takže se přehraje přesně ta hláška, co je v bublině. Každá hláška má víc
 * namluvených variant od různých lidí (autor je v názvu: mori / vojta / dixi) -
 * hra jednu náhodně vybere, takže se hlas rytíře střídá.
 *   mori = Pan Mori (.m4a), vojta = Vojta (.m4a), dixi = Dixi (.mp3)
 * Pozn.: Dixi číslo v názvu neodpovídalo ID (číšloval 1-25 bez mezer), proto je
 * jeho řada přemapovaná podle pořadí hlášek na správná ID (viz audio-src/).
 */
export const HECKLE_VOICES: Record<string, string[]> = {
  H01: ['heckle_H01_mori1.m4a', 'heckle_H01_vojta1.m4a', 'heckle_H01_vojta2.m4a', 'heckle_H01_dixi1.mp3', 'heckle_H01_dixi2.mp3'],
  H02: ['heckle_H02_mori1.m4a', 'heckle_H02_vojta1.m4a', 'heckle_H02_dixi1.mp3', 'heckle_H02_dixi2.mp3'],
  H03: ['heckle_H03_mori1.m4a', 'heckle_H03_vojta1.m4a', 'heckle_H03_vojta2.m4a', 'heckle_H03_dixi1.mp3', 'heckle_H03_dixi2.mp3'],
  H04: ['heckle_H04_mori1.m4a', 'heckle_H04_vojta1.m4a', 'heckle_H04_dixi1.mp3', 'heckle_H04_dixi2.mp3'],
  H05: ['heckle_H05_dixi1.mp3', 'heckle_H05_dixi2.mp3'],
  H06: ['heckle_H06_mori1.m4a', 'heckle_H06_vojta1.m4a', 'heckle_H06_dixi1.mp3', 'heckle_H06_dixi2.mp3'],
  H07: ['heckle_H07_mori1.m4a', 'heckle_H07_vojta1.m4a', 'heckle_H07_dixi1.mp3', 'heckle_H07_dixi2.mp3'],
  H08: ['heckle_H08_mori1.m4a', 'heckle_H08_vojta1.m4a', 'heckle_H08_dixi1.mp3', 'heckle_H08_dixi2.mp3'],
  H09: ['heckle_H09_mori1.m4a', 'heckle_H09_vojta1.m4a', 'heckle_H09_dixi1.mp3', 'heckle_H09_dixi2.mp3'],
  H10: ['heckle_H10_mori1.m4a', 'heckle_H10_vojta1.m4a', 'heckle_H10_dixi1.mp3', 'heckle_H10_dixi2.mp3'],
  H11: ['heckle_H11_mori1.m4a', 'heckle_H11_vojta1.m4a', 'heckle_H11_dixi1.mp3', 'heckle_H11_dixi2.mp3'],
  H12: ['heckle_H12_mori1.m4a', 'heckle_H12_vojta1.m4a', 'heckle_H12_dixi1.mp3', 'heckle_H12_dixi2.mp3'],
  H13: ['heckle_H13_mori1.m4a', 'heckle_H13_vojta1.m4a', 'heckle_H13_dixi1.mp3', 'heckle_H13_dixi2.mp3'],
  H14: ['heckle_H14_mori1.m4a', 'heckle_H14_vojta1.m4a', 'heckle_H14_dixi1.mp3', 'heckle_H14_dixi2.mp3'],
  H17: ['heckle_H17_mori1.m4a', 'heckle_H17_vojta1.m4a', 'heckle_H17_dixi1.mp3', 'heckle_H17_dixi2.mp3'],
  H18: ['heckle_H18_mori1.m4a', 'heckle_H18_vojta1.m4a', 'heckle_H18_dixi1.mp3', 'heckle_H18_dixi2.mp3'],
  H19: ['heckle_H19_mori1.m4a', 'heckle_H19_vojta1.m4a', 'heckle_H19_dixi1.mp3', 'heckle_H19_dixi2.mp3'],
  H20: ['heckle_H20_mori1.m4a', 'heckle_H20_vojta1.m4a', 'heckle_H20_dixi1.mp3', 'heckle_H20_dixi2.mp3'],
  H21: ['heckle_H21_mori1.m4a', 'heckle_H21_vojta1.m4a', 'heckle_H21_dixi1.mp3', 'heckle_H21_dixi2.mp3'],
  H22: ['heckle_H22_mori1.m4a', 'heckle_H22_vojta1.m4a', 'heckle_H22_dixi1.mp3', 'heckle_H22_dixi2.mp3'],
  H25: ['heckle_H25_mori1.m4a', 'heckle_H25_dixi1.mp3', 'heckle_H25_dixi2.mp3'],
  H26: ['heckle_H26_mori1.m4a', 'heckle_H26_vojta1.m4a', 'heckle_H26_vojta2.m4a', 'heckle_H26_dixi1.mp3', 'heckle_H26_dixi2.mp3'],
  H27: ['heckle_H27_mori1.m4a', 'heckle_H27_vojta1.m4a', 'heckle_H27_dixi1.mp3', 'heckle_H27_dixi2.mp3'],
  H28: ['heckle_H28_mori1.m4a', 'heckle_H28_vojta1.m4a', 'heckle_H28_dixi1.mp3', 'heckle_H28_dixi2.mp3'],
  H31: ['heckle_H31_mori1.m4a', 'heckle_H31_vojta1.m4a', 'heckle_H31_dixi1.mp3', 'heckle_H31_dixi2.mp3'],
  H32: ['heckle_H32_mori1.m4a'],
  H33: ['heckle_H33_mori1.m4a'],
};

/**
 * Namluvený (dabovaný) příběh Úřadu pro úvodní slideshow (Intro) - 11 slidů.
 * Klíč = číslo slidu (1..11), hodnota = díly v pořadí, jak se mají přehrát.
 * Některé slidy mají dva díly, co na sebe navazují (nejdřív .1, pak .2).
 * Klíče v cache: 'story:<slide>:<part>' (viz Preload.preload a IntroScene).
 */
export const STORY_VOICES: Record<number, string[]> = {
  1: ['1.mp3'],
  2: ['2.1.mp3', '2.2.mp3'],
  3: ['3.mp3'],
  4: ['4.1.mp3', '4.2.mp3'],
  5: ['5.1.mp3', '5.2.mp3'],
  6: ['6.mp3'],
  7: ['7.1.mp3', '7.2.mp3'],
  8: ['8.mp3'],
  9: ['9.1.mp3', '9.2.mp3'],
  10: ['10.mp3'],
  11: ['11.mp3'],
};

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

    // hlasy hecklerů (namluvené hlášky rytířů) - klíč 'heckle:IG_<ID>:<index>' ať sedí
    // s id infografiky. Varianty (mori/vojta/dixi) se indexují 1..N v pořadí manifestu;
    // hra pak náhodně vybere. Chybějící soubor jen vyhodí loaderror a hra jede dál.
    for (const [id, files] of Object.entries(HECKLE_VOICES)) {
      files.forEach((file, i) => {
        this.load.audio(`heckle:IG_${id}:${i + 1}`, `assets/audio/heckle/${file}`);
      });
    }

    // namluvený příběh pro Intro - klíč 'story:<slide>:<part>' v pořadí dílů
    for (const [slide, files] of Object.entries(STORY_VOICES)) {
      files.forEach((file, i) => {
        this.load.audio(`story:${slide}:${i + 1}`, `assets/audio/story/${file}`);
      });
    }
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
    const allowed = ['Menu', 'Intro', 'Newspaper', 'Office', 'DayEnd', 'Ending', 'FinalChoice', 'Lab'];
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
