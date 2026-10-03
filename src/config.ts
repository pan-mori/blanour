/** Globální konstanty a ladicí hodnoty — všechno tuning na jednom místě. */

export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

export const FONTS = {
  /** Psací stroj — texty dokumentů a delší čtení (čitelnost!) */
  doc: '"IBM Plex Mono", VT323, monospace',
  /** UI, titulky — pixelová identita */
  ui: '"Pixelify Sans"',
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
  decrees: 3, // „podpultové vyhlášky" — max 3 na celý run
  days: 5,
  /** Trpělivost rytíře na jeden encounter (ms); vyprší => facka */
  patienceMs: 90_000,
  /** Od kolika zbývajících ms začne ukazatel varovně blikat */
  patienceWarnMs: 20_000,
  stamp: {
    /** Max odchylka otisku od vodorovna (stupně) */
    angleTolDeg: 15,
    /** Přítlak (ms): pod minimem bledý, nad maximem rozmazaný */
    pressMinMs: 350,
    pressMaxMs: 950,
    /** Počet sytých otisků na jedno nabarvení */
    inkCharges: 3,
    /** Jak dlouho držet razítko na podušce (ms) */
    inkDipMs: 200,
  },
} as const;
