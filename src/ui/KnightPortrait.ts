import Phaser from 'phaser';

/**
 * Procedurální pixel-art portrét rytíře (busta). Deterministický podle
 * sprite klíče - stejný rytíř vypadá vždy stejně. Kreslí se jednou do
 * textury `portrait:<key>` na mřížce 32×40, pixel = 12 px.
 */

const S = 12; // velikost "pixelu"
const W = 32;
const H = 40;

const TABARDS = [0x7a1f12, 0x1d4020, 0x24366b, 0x6b4a2a, 0x4b2a6b, 0x3a6b62, 0x8a6a1a, 0x5a1a3a];
const ACCENTS = [0xd4a017, 0xe8e0d0, 0x1c1a16, 0xc0c8d0, 0x2f7d32, 0x7a1f12];
const SKINS = [0xe8c49a, 0xd8a878, 0xc89060, 0xf0d0b0, 0xb87a52, 0xdcae8a];
const HAIRS = [0x3d2a18, 0x6b4a2a, 0x8a8a8a, 0xd8c8a8, 0x2a2a2a, 0xa85a2a, 0xe8d8b0];
const METAL = 0x9aa4b0;
const METAL_DARK = 0x6a7480;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Murmur3 finalizer - rozptýlí i sekvenční hashe do všech bitů. */
function mix(x: number): number {
  let h = (x ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export type BeardLen = 'none' | 'short' | 'long';

/**
 * Délka vousu rytíře - JEDEN zdroj pravdy pro portrét i pro objektivní verdikt
 * vyhlášek o vousech. Explicitní tagy mají přednost; netagovaný rytíř dostane
 * délku deterministicky z hashe, aby portrét i posudek vždy souhlasily (nikdy
 * se nenakreslí vous, který by pravidlo nevidělo, a naopak).
 */
export function beardLen(spriteKey: string, tags: string[]): BeardLen {
  if (tags.includes('vous_dlouhy')) return 'long';
  if (tags.includes('vous') || tags.includes('vous_kratky') || tags.includes('plnovous')) return 'short';
  if (spriteKey === 'knight_vaclav') return 'none';
  // netagovaný rytíř: délku odvodíme deterministicky z dobře promíchaného hashe,
  // ať reálně existují všechny 3 varianty (sprite klíče „knight_NN" vycházejí
  // na prostém hashi degenerovaně - skoro všichni by měli vous). Váhy ≈ půl bez
  // vousu, třetina krátký, zbytek dlouhý.
  const h = hash(spriteKey);
  const m = ((h ^ (h >>> 7) ^ (h >>> 13) ^ (h >>> 23)) >>> 0) % 6;
  return m < 3 ? 'none' : m < 5 ? 'short' : 'long';
}

export function ensureKnightTexture(scene: Phaser.Scene, spriteKey: string, tags: string[]): string {
  const texKey = `portrait:${spriteKey}:${tags.join('.')}`;
  if (scene.textures.exists(texKey)) return texKey;

  const h = hash(spriteKey);
  const vaclav = spriteKey === 'knight_vaclav';
  const tabard = vaclav ? 0xe8e0d0 : TABARDS[h % TABARDS.length];
  const accent = vaclav ? 0xd4a017 : ACCENTS[(h >> 3) % ACCENTS.length];
  const skin = SKINS[(h >> 6) % SKINS.length];
  // barva vlasů = barva vousu a obočí. Sekvenční hash dával všem stejnou, proto mix();
  // svatý Václav si drží původní barvu
  const hair = vaclav ? HAIRS[(h >> 9) % HAIRS.length] : HAIRS[mix(h + 5 * 0x9e3779b1) % HAIRS.length];
  const helmet = vaclav ? 3 : (h >> 12) % 4; // 0 kettle, 1 bascinet, 2 kroužková kukla, 3 bez helmy
  const bl = beardLen(spriteKey, tags); // 'none' | 'short' | 'long'
  const beard = bl !== 'none';
  const halo = tags.includes('svatozar');
  // ---------- KOSMETICKÉ VARIANTY (jen vzhled, nesahají na beardLen ani na starší hash) ----------
  // Sprite klíče jsou sekvenční → surový hash má skoro stejné horní bity, proto mix().
  // Každý „slot" (čepice, vous, detail, tunika) má vlastní nezávislý výběr.
  // Pravidla proti kolizím s vyhláškami:
  //  - vousové ozdoby JEN k vousatým (hladká tvář = „bez vousu", knír/licousy by ji rozbily)
  //  - štít (lev/erb/orlice), kříž/kalich/růženec/svatozář, vesta, odznak a srp+kladivo
  //    zůstávají čitelné: tunikové vzory se jim vyhýbají, svatý Václav zůstává beze změn
  const pick = (slot: number, n: number) => mix(h + slot * 0x9e3779b1) % n;
  const variants = !vaclav;
  const hatVar = variants && !halo && pick(1, 18) < 9 ? pick(1, 18) : -1; // 0..8, jinak původní helma
  let beardStyle = variants && beard && pick(2, 10) < 5 ? pick(2, 10) : -1; // 0..4
  if (bl === 'short' && beardStyle === 1) beardStyle = 0; // rozdvojený vous jen u dlouhého
  if (bl === 'short' && beardStyle === 2) beardStyle = 3; // pletený cop jen u dlouhého
  const hasGlasses = tags.includes('bryle');
  let detail = variants && pick(3, 14) < 5 ? pick(3, 14) : -1; // 0 jizva, 1 páska, 2 náušnice, 3 pihy, 4 jizva
  if (detail === 1 && hasGlasses) detail = 0; // páska přes oko nejde s brýlemi
  const plainTags = !tags.some((t) => ['kalich', 'ruzenec', 'odznak', 'vesta', 'srp_kladivo'].includes(t));
  const bodyVar = variants && plainTags && pick(4, 16) < 7 ? pick(4, 16) : -1; // 0..6
  // 0 šerpa, 1 krokev, 2 šikmý kříž, 3 půlená, 4 plátový límec, 5 plášť, 6 opasek
  const crossOn = bodyVar !== 1 && bodyVar !== 2 && bodyVar !== 3;

  const g = scene.add.graphics();
  const px = (x: number, y: number, w: number, hh: number, c: number) => {
    g.fillStyle(c, 1);
    g.fillRect(x * S, y * S, w * S, hh * S);
  };

  // ramena + varkoč
  px(4, 31, 24, 9, tabard);
  px(6, 29, 20, 2, tabard);
  if (bodyVar === 3) px(16, 31, 12, 9, 0x8a6a1a); // půlená tunika - druhá půlka
  if (bodyVar === 3) px(17, 29, 9, 2, 0x8a6a1a);
  if (crossOn || bodyVar === 3) {
    px(14, 32, 4, 8, bodyVar === 3 ? 0xe8e0d0 : accent); // svislý pruh
    px(10, 34, 12, 2, bodyVar === 3 ? 0xe8e0d0 : accent); // břevno - dohromady kříž
  }
  px(4, 31, 2, 9, METAL_DARK); // nárameníky
  px(26, 31, 2, 9, METAL_DARK);

  // tunikové varianty (geometrické znaky; žádný lev/orlice/kalich - to jsou pravidla)
  if (bodyVar === 0) {
    // šikmá šerpa přes hruď
    for (let i = 0; i < 12; i++) px(6 + i * 1.6, 29.5 + i * 0.9, 3, 2.4, 0xc03028);
    px(20, 37, 3, 3, 0xd4a017);
  } else if (bodyVar === 1) {
    // krokev - dvě šikmé pruhy ve tvaru V
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < 16; i++) {
        const dy = i < 8 ? (7 - i) * 0.5 : (i - 8) * 0.5;
        px(8 + i, 32 + k * 3 + dy, 1, 1.6, accent);
      }
    }
  } else if (bodyVar === 2) {
    // svatoondřejský (šikmý) kříž
    for (let i = 0; i < 9; i++) {
      px(9 + i * 1.5, 31 + i, 2, 1.4, accent);
      px(21 - i * 1.5, 31 + i, 2, 1.4, accent);
    }
  } else if (bodyVar === 4) {
    // plátový límec + nárameníky s nýty
    px(4, 29, 7, 4, METAL); px(21, 29, 7, 4, METAL);
    px(4, 29, 7, 1, METAL_DARK); px(21, 29, 7, 1, METAL_DARK);
    for (const x of [6, 9, 23, 26]) px(x, 31, 1, 1, 0xe8e0d0);
    px(10, 28, 12, 3, METAL_DARK); px(10, 28, 12, 1, METAL);
  } else if (bodyVar === 5) {
    // plášť přes rameno se zlatou sponou
    px(17, 28, 11, 12, 0x7a1f12); px(17, 28, 11, 1, 0xa02a1a);
    px(20, 32, 2, 2, 0xd4a017); px(19, 36, 9, 1, 0x5a1510);
  } else if (bodyVar === 6) {
    // široký opasek s přezkou v barvě znaku
    px(4, 37, 24, 3, 0x3a2a16); px(14, 37, 4, 3, accent); px(15, 38, 2, 1, 0x3a2a16);
  }

  // krk
  px(14, 27, 4, 3, skin);

  // hlava
  px(11, 12, 10, 14, skin);
  px(10, 14, 1, 9, skin);
  px(21, 14, 1, 9, skin);

  // rysy obličeje - obočí, nos a výraz (jen vzhled; svatý Václav si drží původní obličej)
  const browVar = vaclav ? 2 : pick(7, 5); // 0 běžné, 1 huňaté, 2 zvednuté, 3 zamračené, 4 starostlivé
  const bigNose = !vaclav && pick(8, 4) === 0;
  const mouthVar = vaclav ? 0 : pick(6, 6); // 0 klidná, 1 úsměv, 2 kyselá, 3 otevřená, 4 úšklebek, 5 šklebí se
  // oči
  px(13, 18, 2, 1, 0x1c1a16);
  px(17, 18, 2, 1, 0x1c1a16);
  if (browVar === 1) {
    px(12, 16, 3, 2, hair);
    px(17, 16, 3, 2, hair);
  } else if (browVar === 2) {
    px(13, 16, 2, 1, hair);
    px(17, 17, 2, 1, hair);
  } else if (browVar === 3) {
    // zamračené - vnitřní konce dole
    px(12, 16, 2, 1, hair); px(14, 17, 1, 1, hair);
    px(18, 16, 2, 1, hair); px(17, 17, 1, 1, hair);
  } else if (browVar === 4) {
    // starostlivé - vnitřní konce nahoře
    px(14, 16, 1, 1, hair); px(12, 17, 2, 1, hair);
    px(17, 16, 1, 1, hair); px(18, 17, 2, 1, hair);
  } else {
    px(13, 17, 2, 1, hair);
    px(17, 17, 2, 1, hair);
  }
  // nos (větší u části rytířů)
  const noseC = SKINS[(h >> 6) % SKINS.length] === 0xc89060 ? 0xb07848 : 0xc89060;
  if (bigNose) px(15, 20, 2, 3, noseC);
  else px(15, 20, 2, 2, noseC);
  // znaménko
  if ((h >> 20) % 5 === 0) px(19, 22, 1, 1, 0x7a5030);

  // vousy - 3 jasně odlišné délky: žádné / krátký / dlouhý (viz beardLen).
  // „bez vousu" = úplně hladká tvář (žádný knír), ať vyhláška o vousech čte
  // jednoznačně z portrétu.
  const longBeard = bl === 'long';
  if (beard) {
    px(11, 21, 10, 5, hair);
    px(12, 26, 8, 2, hair);
    px(14, 21, 4, 1, skin); // mezera pro ústa… vlastně knír
    px(14, 22, 4, 1, 0x8a5a50);
    if (longBeard) {
      // dlouhý vous sahá přes krk až na varkoč - špičatý
      px(12, 28, 8, 3, hair);
      px(13, 31, 6, 2, hair);
      px(14, 33, 4, 2, hair);
      px(15, 35, 2, 2, hair);
    }
  }

  // vousové ozdoby (jen vousatí - délka vousu se nemění)
  if (beardStyle === 0) {
    // husarský knír s vykroucenými špičkami vyčnívajícími z obrysu hlavy
    px(12, 21, 8, 2, hair);
    px(9, 21, 2, 1, hair); px(21, 21, 2, 1, hair);
    px(8, 20, 1, 2, hair); px(23, 20, 1, 2, hair);
    px(8, 19, 1, 1, hair); px(23, 19, 1, 1, hair);
    px(12, 23, 8, 1, skin); // světlý proužek odděluje knír od vousu
    px(14, 23, 4, 1, 0x8a5a50);
  } else if (beardStyle === 1) {
    // rozdvojený dlouhý vous - mezi hroty prosvítá kříž
    px(12, 31, 3, 6, hair); px(17, 31, 3, 6, hair);
    px(15, 31, 2, 1, tabard); px(15, 32, 2, 5, accent);
    px(12, 37, 2, 2, hair); px(18, 37, 2, 2, hair);
  } else if (beardStyle === 2) {
    // pletený cop s korálky
    for (let y = 28; y < 37; y++) px(14 + (y % 2), y, 2, 1, y % 3 ? hair : 0x6b4a2a);
    px(14, 36, 4, 1, 0xd4a017); px(15, 37, 2, 1, 0xd4a017);
  } else if (beardStyle === 3) {
    // prošedivělý vous (barva, ne délka)
    const lum = ((hair >> 16) & 255) * 0.3 + ((hair >> 8) & 255) * 0.59 + (hair & 255) * 0.11;
    const streak = lum > 150 ? 0x8a7a68 : 0xc8c8c8; // na světlém vousu tmavé pramínky
    for (const [x, y, hh] of [[11, 22, 5], [19, 23, 4], [13, 27, 4], [18, 28, 3], [15, bl === 'long' ? 31 : 25, 3]])
      px(x, y, 1, hh, streak);
    px(11, 21, 2, 1, streak);
  } else if (beardStyle === 4) {
    // morčí knír a licousy
    px(10, 14, 2, 9, hair); px(20, 14, 2, 9, hair);
    px(12, 21, 8, 3, hair);
    px(11, 23, 1, 4, hair); px(20, 23, 1, 4, hair);
    px(14, 24, 4, 1, 0x8a5a50);
  }

  // ústa / výraz - kreslí se nad (případný) vous; u hladké tváře se jen mění tvar úst
  {
    const MO = 0x8a5a50;
    const y = !beard ? 23 : beardStyle === 0 ? 23 : beardStyle === 4 ? 24 : 22;
    if (!beard) px(14, 23, 4, 2, skin); // smaž výchozí ústa
    else if (beardStyle !== 0 && beardStyle !== 4) px(14, 22, 4, 2, hair); // smaž výchozí ústa ve vousu
    if (mouthVar === 1) { px(14, y, 1, 1, MO); px(15, y + 1, 2, 1, MO); px(17, y, 1, 1, MO); } // úsměv
    else if (mouthVar === 2) { px(15, y, 2, 1, MO); px(14, y + 1, 1, 1, MO); px(17, y + 1, 1, 1, MO); } // kyselá
    else if (mouthVar === 3) { px(14, y, 4, 2, 0x3a1a16); px(15, y, 2, 1, 0xe8e0d0); } // otevřená (hecuje)
    else if (mouthVar === 4) { px(14, y + 1, 2, 1, MO); px(16, y, 2, 1, MO); } // úšklebek
    else if (mouthVar === 5) { px(14, y, 4, 2, 0xe8e0d0); px(14, y, 4, 1, MO); px(14, y + 1, 4, 1, 0xc8c0b0); } // šklebí se
    else px(14, y, 4, 1, MO); // klidná
  }

  // detaily obličeje (bezpečné i u hladké tváře)
  if (detail === 0 || detail === 4) {
    // jizva přes tvář
    px(18, 15, 1, 3, 0xa85a50); px(19, 18, 1, 3, 0xa85a50); px(20, 21, 1, 2, 0xa85a50);
  } else if (detail === 1) {
    // páska přes oko
    px(12, 17, 4, 3, 0x14110e); px(10, 15, 12, 1, 0x14110e);
    px(10, 16, 2, 1, 0x14110e); px(16, 16, 1, 1, 0x14110e); px(20, 16, 2, 1, 0x14110e);
  } else if (detail === 2) {
    // zlatá náušnice
    px(10, 21, 1, 2, 0xd4a017);
  } else if (detail === 3) {
    // pihy
    for (const [x, y] of [[12, 20], [14, 21], [17, 21], [19, 20], [13, 22], [18, 22]]) px(x, y, 1, 1, 0xb07848);
  }

  // brýle (tag bryle) - kulaté obroučky přes oči
  if (tags.includes('bryle')) {
    const fr = 0x2a2a2a;
    px(12, 17, 4, 3, 0xcfe4ee); // levé sklo
    px(16, 17, 4, 3, 0xcfe4ee); // pravé sklo
    px(12, 17, 4, 1, fr); px(12, 19, 4, 1, fr); px(12, 17, 1, 3, fr); px(15, 17, 1, 3, fr);
    px(16, 17, 4, 1, fr); px(16, 19, 4, 1, fr); px(16, 17, 1, 3, fr); px(19, 17, 1, 3, fr);
    px(16, 18, 1, 1, fr); // můstek
    // oči skrz skla ztmavit zpět
    px(13, 18, 2, 1, 0x1c1a16); px(17, 18, 2, 1, 0x1c1a16);
  }

  // helma / vlasy
  if (hatVar === 0) {
    // kettle hat se širokou krempou a poutkem
    px(6, 10, 20, 2, METAL);
    px(10, 5, 12, 5, METAL);
    px(10, 5, 12, 1, METAL_DARK);
    px(6, 11, 20, 1, METAL_DARK);
    px(15, 3, 2, 2, METAL_DARK);
  } else if (hatVar === 1) {
    // bascinet s lícnicemi a barevným hřebenem
    px(10, 6, 12, 7, METAL);
    px(9, 9, 2, 10, METAL);
    px(21, 9, 2, 10, METAL);
    px(10, 6, 12, 1, METAL_DARK);
    px(12, 12, 8, 1, METAL_DARK);
    px(15, 3, 2, 3, accent);
    px(14, 5, 4, 1, accent);
  } else if (hatVar === 2) {
    // kettle hat s rudým pérem
    px(6, 10, 20, 2, METAL);
    px(10, 5, 12, 5, METAL);
    px(10, 5, 12, 1, METAL_DARK);
    px(6, 11, 20, 1, METAL_DARK);
    px(21, 5, 1, 4, 0xc03028); px(22, 3, 1, 4, 0xc03028); px(23, 2, 1, 3, 0xc03028); px(24, 1, 1, 2, 0xe05a40);
  } else if (hatVar === 3) {
    // normanská přilba s nosníkem
    px(10, 6, 12, 7, METAL);
    px(10, 6, 12, 1, METAL_DARK);
    px(9, 12, 14, 1, METAL_DARK);
    px(15, 13, 2, 7, METAL);
    px(15, 13, 2, 1, METAL_DARK);
  } else if (hatVar === 4) {
    // látková čepice s lemem v barvě znaku
    const capC = [0x3a4a8a, 0x7a1f12, 0x2f5a30, 0x5a3a22][h % 4];
    px(10, 7, 12, 5, capC);
    px(9, 11, 14, 2, accent);
    px(8, 8, 2, 3, capC);
    px(15, 5, 2, 2, accent);
  } else if (hatVar === 5) {
    // kolpak - vysoká kožešinová čepice
    px(9, 3, 14, 9, 0x5a3a22);
    px(9, 11, 14, 1, 0x2a1a10);
    for (let i = 0; i < 12; i++) px(10 + i, 4 + ((i * 3) % 7), 1, 1, 0x7a5434);
    px(8, 10, 1, 2, 0x5a3a22); px(23, 10, 1, 2, 0x5a3a22);
  } else if (hatVar === 6) {
    // kápě v barvě tuniky
    px(8, 6, 16, 8, tabard);
    px(7, 8, 3, 18, tabard); px(22, 8, 3, 18, tabard);
    px(10, 6, 12, 1, 0x2e1a44); px(9, 13, 3, 1, 0x2e1a44); px(20, 13, 3, 1, 0x2e1a44);
  } else if (hatVar === 7) {
    // kettle s hřebenem (vojenská přilba)
    px(8, 10, 16, 2, METAL);
    px(10, 5, 12, 5, METAL);
    px(10, 5, 12, 1, METAL_DARK);
    px(15, 2, 2, 3, 0x7a1f12); px(12, 3, 8, 1, 0x7a1f12); px(11, 4, 10, 1, 0x7a1f12);
  } else if (hatVar === 8) {
    // ovázaná hlava
    px(10, 8, 12, 4, 0xe8e0d0);
    px(10, 10, 12, 1, 0xc8c0b0);
    px(20, 8, 2, 7, 0xe8e0d0);
    px(21, 13, 1, 3, 0xc03028);
  } else if (helmet === 0) {
    // klobouková (kettle hat)
    px(6, 10, 20, 2, METAL);
    px(10, 5, 12, 5, METAL);
    px(10, 5, 12, 1, METAL_DARK);
  } else if (helmet === 1) {
    // bascinet s lícnicemi
    px(10, 6, 12, 7, METAL);
    px(9, 9, 2, 10, METAL);
    px(21, 9, 2, 10, METAL);
    px(10, 6, 12, 1, METAL_DARK);
  } else if (helmet === 2) {
    // kroužková kukla
    px(9, 8, 14, 5, METAL_DARK);
    px(9, 10, 2, 14, METAL_DARK);
    px(21, 10, 2, 14, METAL_DARK);
    px(9, 23, 14, 2, METAL_DARK);
  } else if (vaclav) {
    // knížecí čapka s křížkem
    px(10, 7, 12, 5, 0x7a1f12);
    px(9, 10, 14, 2, 0xd4a017);
    px(15, 4, 2, 3, 0xd4a017);
  } else {
    // bez helmy - vlasy
    px(10, 8, 12, 5, hair);
    px(9, 10, 2, 6, hair);
    px(21, 10, 2, 6, hair);
  }

  // svatozář
  if (halo) {
    g.lineStyle(S, 0xffd700, 0.9);
    g.strokeEllipse(16 * S, 3.5 * S, 16 * S, 4 * S);
  }

  // ---------- VIZUÁLNÍ VADY / DOPLŇKY (vrstvené dle tagů - „NFT opice" princip) ----------

  // reflexní/BOZP vesta přes varkoč
  if (tags.includes('vesta')) {
    px(7, 31, 18, 7, 0xd6e014); // neonově žlutá
    px(9, 31, 3, 7, 0xb0b8c0); // reflexní pruhy
    px(20, 31, 3, 7, 0xb0b8c0);
  }

  // srp a kladivo v pravici (místo poctivého meče)
  if (tags.includes('srp_kladivo')) {
    // násada kladiva + hlava
    px(26, 24, 2, 12, 0x6b4a2a);
    px(23, 23, 8, 3, 0x8a929e);
    // srp - čepel obloukem
    px(2, 24, 2, 10, 0x6b4a2a);
    px(2, 21, 6, 2, 0xb8c0cc);
    px(7, 22, 2, 4, 0xb8c0cc);
  }

  // štít v levém dolním rohu busty - barva dle hashe (≥3), znak dle tagu
  const SHIELD_COLORS = [0x7a1f12, 0x24366b, 0x1d4020, 0x3a2a16, 0x4b2a6b];
  const shieldTag = tags.find(
    (t) => t === 'stit_lev2' || t === 'stit_lev1' || t === 'stit_prazdny' || t === 'stit_orlice',
  );
  if (shieldTag) {
    // svatý Václav nese „plamennou orlici" - černou orlici na stříbrném poli se zlatými plameny
    const plamenna = vaclav && shieldTag === 'stit_orlice';
    const sc = plamenna ? 0xd8d0c0 : vaclav ? 0xb02020 : SHIELD_COLORS[(h >> 22) % SHIELD_COLORS.length];
    px(1, 26, 11, 11, sc);
    px(2, 37, 9, 2, sc);
    px(4, 39, 5, 1, sc);
    g.lineStyle(4, 0xd4a017, 1);
    g.strokeRect(1 * S, 26 * S, 11 * S, 13 * S);
    const sil = 0xe8e0d0;
    if (shieldTag === 'stit_orlice') {
      const ec = plamenna ? 0x1c1a16 : sil; // plamenná orlice = černá
      if (plamenna) {
        // zlaté plameny kolem orlice
        px(2, 28, 1, 3, 0xe8a81a); px(10, 28, 1, 3, 0xe8a81a);
        px(3.5, 27, 1, 1.4, 0xf0c838); px(8.5, 27, 1, 1.4, 0xf0c838);
      }
      // orlice (svatováclavská) - tělo, dvě křídla, hlava
      px(6, 30, 1, 5, ec); // tělo
      px(3, 31, 3, 1, ec); px(2, 32, 2, 2, ec); // levé křídlo
      px(7, 31, 3, 1, ec); px(9, 32, 2, 2, ec); // pravé křídlo
      px(6, 28, 1, 2, ec); // krk
      px(5, 27, 3, 1, ec); // hlava (rozpětí)
      px(5, 35, 1, 2, ec); px(7, 35, 1, 2, ec); // nohy
    } else if (shieldTag !== 'stit_prazdny') {
      // stříbrný lev ve skoku - VÝRAZNÉ ocasy (herní info!)
      px(5, 31, 4, 4, sil); px(8, 30, 2, 2, sil);
      px(5, 35, 1, 3, sil); px(8, 35, 1, 2, sil);
      px(3, 28, 1, 5, sil); px(2, 27, 1, 2, sil); // první ocas + háček
      if (shieldTag === 'stit_lev2') {
        px(5, 27, 1, 4, sil); px(6, 26, 1, 2, sil); // druhý ocas - poctivý dvouocasý lev
      }
    }
  }

  // kališnický kalich na varkoči (husitský symbol) - po Bílé hoře zapovězený
  if (tags.includes('kalich')) {
    const gold = 0xe8c020;
    px(15, 33, 2, 3, gold); // noha kalicha
    px(13, 36, 6, 1, gold); // podstavec
    px(13, 31, 6, 2, gold); // horní okraj číše
    px(14, 32, 4, 2, 0xb89010); // tělo číše (stín)
    px(13, 31, 1, 2, gold);
    px(18, 31, 1, 2, gold);
  }

  // růženec - šňůra korálků s křížkem u krku (katolický)
  if (tags.includes('ruzenec')) {
    const bead = 0xd8d0c0;
    for (let i = 0; i < 6; i++) px(10 + i, 28 + Math.abs(i - 2.5) * 0.6, 1, 1, bead);
    px(15, 34, 1, 3, 0xc0b8a8); // svislý křížek
    px(14, 35, 3, 1, 0xc0b8a8);
  }

  // svatováclavský odznak úderníka / medaile na hrudi
  if (tags.includes('odznak')) {
    px(21, 32, 3, 3, 0xc03028);
    px(22, 33, 1, 1, 0xd4a017);
  }

  g.generateTexture(texKey, W * S, H * S);
  g.destroy();
  return texKey;
}
