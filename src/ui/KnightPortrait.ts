import Phaser from 'phaser';

/**
 * Procedurální pixel-art portrét rytíře (busta). Deterministický podle
 * sprite klíče — stejný rytíř vypadá vždy stejně. Kreslí se jednou do
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

export type BeardLen = 'none' | 'short' | 'long';

/**
 * Délka vousu rytíře — JEDEN zdroj pravdy pro portrét i pro objektivní verdikt
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
  // na prostém hashi degenerovaně — skoro všichni by měli vous). Váhy ≈ půl bez
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
  const hair = HAIRS[(h >> 9) % HAIRS.length];
  const helmet = vaclav ? 3 : (h >> 12) % 4; // 0 kettle, 1 bascinet, 2 kroužková kukla, 3 bez helmy
  const bl = beardLen(spriteKey, tags); // 'none' | 'short' | 'long'
  const beard = bl !== 'none';
  const halo = tags.includes('svatozar');

  const g = scene.add.graphics();
  const px = (x: number, y: number, w: number, hh: number, c: number) => {
    g.fillStyle(c, 1);
    g.fillRect(x * S, y * S, w * S, hh * S);
  };

  // ramena + varkoč
  px(4, 31, 24, 9, tabard);
  px(6, 29, 20, 2, tabard);
  px(14, 32, 4, 8, accent); // svislý pruh
  px(10, 34, 12, 2, accent); // břevno — dohromady kříž
  px(4, 31, 2, 9, METAL_DARK); // nárameníky
  px(26, 31, 2, 9, METAL_DARK);

  // krk
  px(14, 27, 4, 3, skin);

  // hlava
  px(11, 12, 10, 14, skin);
  px(10, 14, 1, 9, skin);
  px(21, 14, 1, 9, skin);

  // rysy obličeje — variace dle hashe (obočí, nos, úsměv, znaménko)
  const feat = (h >> 18) % 4;
  // oči
  px(13, 18, 2, 1, 0x1c1a16);
  px(17, 18, 2, 1, 0x1c1a16);
  // obočí: feat 1 = huňaté (silnější), feat 3 = zvednuté
  if (feat === 1) {
    px(12, 16, 3, 2, hair);
    px(17, 16, 3, 2, hair);
  } else if (feat === 3) {
    px(13, 16, 2, 1, hair);
    px(17, 17, 2, 1, hair);
  } else {
    px(13, 17, 2, 1, hair);
    px(17, 17, 2, 1, hair);
  }
  // nos (feat 2 = větší)
  const noseC = SKINS[(h >> 6) % SKINS.length] === 0xc89060 ? 0xb07848 : 0xc89060;
  if (feat === 2) px(15, 20, 2, 3, noseC);
  else px(15, 20, 2, 2, noseC);
  // znaménko
  if ((h >> 20) % 5 === 0) px(19, 22, 1, 1, 0x7a5030);
  // ústa (feat 0 = úsměv)
  if (!beard) {
    if (feat === 0) { px(14, 23, 1, 1, 0x8a5a50); px(15, 24, 2, 1, 0x8a5a50); px(17, 23, 1, 1, 0x8a5a50); }
    else px(14, 23, 4, 1, 0x8a5a50);
  }

  // vousy — 3 jasně odlišné délky: žádné / krátký / dlouhý (viz beardLen).
  // „bez vousu" = úplně hladká tvář (žádný knír), ať vyhláška o vousech čte
  // jednoznačně z portrétu.
  const longBeard = bl === 'long';
  if (beard) {
    px(11, 21, 10, 5, hair);
    px(12, 26, 8, 2, hair);
    px(14, 21, 4, 1, skin); // mezera pro ústa… vlastně knír
    px(14, 22, 4, 1, 0x8a5a50);
    if (longBeard) {
      // dlouhý vous sahá přes krk až na varkoč — špičatý
      px(12, 28, 8, 3, hair);
      px(13, 31, 6, 2, hair);
      px(14, 33, 4, 2, hair);
      px(15, 35, 2, 2, hair);
    }
  }

  // brýle (tag bryle) — kulaté obroučky přes oči
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
  if (helmet === 0) {
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
    // bez helmy — vlasy
    px(10, 8, 12, 5, hair);
    px(9, 10, 2, 6, hair);
    px(21, 10, 2, 6, hair);
  }

  // svatozář
  if (halo) {
    g.lineStyle(S, 0xffd700, 0.9);
    g.strokeEllipse(16 * S, 3.5 * S, 16 * S, 4 * S);
  }

  // ---------- VIZUÁLNÍ VADY / DOPLŇKY (vrstvené dle tagů — „NFT opice" princip) ----------

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
    // srp — čepel obloukem
    px(2, 24, 2, 10, 0x6b4a2a);
    px(2, 21, 6, 2, 0xb8c0cc);
    px(7, 22, 2, 4, 0xb8c0cc);
  }

  // štít v levém dolním rohu busty — barva dle hashe (≥3), znak dle tagu
  const SHIELD_COLORS = [0x7a1f12, 0x24366b, 0x1d4020, 0x3a2a16, 0x4b2a6b];
  const shieldTag = tags.find(
    (t) => t === 'stit_lev2' || t === 'stit_lev1' || t === 'stit_prazdny' || t === 'stit_orlice',
  );
  if (shieldTag) {
    const sc = vaclav ? 0xb02020 : SHIELD_COLORS[(h >> 22) % SHIELD_COLORS.length];
    px(1, 26, 11, 11, sc);
    px(2, 37, 9, 2, sc);
    px(4, 39, 5, 1, sc);
    g.lineStyle(4, 0xd4a017, 1);
    g.strokeRect(1 * S, 26 * S, 11 * S, 13 * S);
    const sil = 0xe8e0d0;
    if (shieldTag === 'stit_orlice') {
      // orlice (svatováclavská) — tělo, dvě křídla, hlava
      px(6, 30, 1, 5, sil); // tělo
      px(3, 31, 3, 1, sil); px(2, 32, 2, 2, sil); // levé křídlo
      px(7, 31, 3, 1, sil); px(9, 32, 2, 2, sil); // pravé křídlo
      px(6, 28, 1, 2, sil); // krk
      px(5, 27, 3, 1, sil); // hlava (rozpětí)
      px(5, 35, 1, 2, sil); px(7, 35, 1, 2, sil); // nohy
    } else if (shieldTag !== 'stit_prazdny') {
      // stříbrný lev ve skoku — VÝRAZNÉ ocasy (herní info!)
      px(5, 31, 4, 4, sil); px(8, 30, 2, 2, sil);
      px(5, 35, 1, 3, sil); px(8, 35, 1, 2, sil);
      px(3, 28, 1, 5, sil); px(2, 27, 1, 2, sil); // první ocas + háček
      if (shieldTag === 'stit_lev2') {
        px(5, 27, 1, 4, sil); px(6, 26, 1, 2, sil); // druhý ocas — poctivý dvouocasý lev
      }
    }
  }

  // kališnický kalich na varkoči (husitský symbol) — po Bílé hoře zapovězený
  if (tags.includes('kalich')) {
    const gold = 0xe8c020;
    px(15, 33, 2, 3, gold); // noha kalicha
    px(13, 36, 6, 1, gold); // podstavec
    px(13, 31, 6, 2, gold); // horní okraj číše
    px(14, 32, 4, 2, 0xb89010); // tělo číše (stín)
    px(13, 31, 1, 2, gold);
    px(18, 31, 1, 2, gold);
  }

  // růženec — šňůra korálků s křížkem u krku (katolický)
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
