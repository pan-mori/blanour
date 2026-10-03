/** Globální konstanty a ladicí hodnoty - všechno tuning na jednom místě. */

export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

/**
 * Experiment: vzhled razítka.
 *  'drawn' = původní kreslené razítko (knoflík + držák + cedulka).
 *  'image' = obrázek assets/images/pixel_google/stamp_pixel.png (jen ZAMÍTNUTO;
 *            u SCHVÁLENO se stejně použije kreslené, obrázek pro schválení nemáme).
 * Přepni sem a zpět podle toho, který se ti bude líbit víc.
 */
export const STAMP_STYLE: 'drawn' | 'image' = 'image';

export const FONTS = {
  /** Psací stroj - texty dokumentů, delší čtení (čitelnost především!) */
  doc: '"IBM Plex Mono", monospace',
  /** UI - tlačítka, popisky, HUD. Sjednoceno na čitelný mono (dřív pixel). */
  ui: '"IBM Plex Mono", monospace',
  /** Velké nadpisy - pixelová identita (Jersey 10, čitelný pixel font). */
  title: '"Jersey 10", "IBM Plex Mono", monospace',
} as const;

export const COLORS = {
  bg: 0x14100c,
  desk: 0x5c4326,
  deskDark: 0x463219,
  paper: 0xf0e6c8,
  paperShadow: 0x2a2018,
  ink: 0x1d2951,
  stampRed: 0xa82810,
  stampGreen: 0x2f7d32,
  uiPanel: 0x241c12,
  uiPanelLight: 0x3a2e1d,
  uiText: 0xe8d9a8,
  uiAccent: 0xd4a017,
  danger: 0xc0392b,
} as const;

export const TUNING = {
  lives: 3,
  decrees: 3, // „podpultové vyhlášky" - max 3 na celý run
  days: 5,
  /** Trpělivost rytíře na jeden encounter (ms); vyprší => facka */
  patienceMs: 90_000,
  /** Od kolika zbývajících ms začne ukazatel varovně blikat */
  patienceWarnMs: 20_000,
  stamp: {
    /** Max odchylka otisku od kroužku (stupně) - úředník razítkuje ledabyle, ne přesně */
    angleTolDeg: 32,
    /** Přítlak (ms): pod minimem bledý, nad maximem rozmazaný */
    pressMinMs: 350,
    pressMaxMs: 950,
    /** Počet sytých otisků na jedno nabarvení */
    inkCharges: 3,
    /** Jak dlouho držet razítko na podušce (ms) */
    inkDipMs: 200,
  },
} as const;
