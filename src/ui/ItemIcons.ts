import Phaser from 'phaser';

/**
 * Výstroj rytíře jako pixel-art předměty na stole.
 * Parsuje volné texty z knight.equipment („obouruční meč (150 cm)")
 * a kreslí deterministické ikony — meče ve velikostních variantách!
 */

export interface ParsedItem {
  key: string; // klíč pro hádanky (reason.itemKeys) i kreslení
  label: string; // původní text — rytířova „odpověď" při kliknutí
  cm?: number;
  color?: number;
  tails?: number; // lev na štítu: 0 = bez lva, 1/2 = počet ocasů
  symbol?: 'lev2' | 'lev1' | 'empty' | 'orlice'; // znak na štítu
  shieldColor?: number;
}

const S = 6; // pixel

export function parseEquipment(raw: string, tags: string[]): ParsedItem | null {
  const s = raw.toLowerCase();
  const item: ParsedItem = { key: '', label: raw };

  const cmMatch = s.match(/(\d+)\s*cm/);
  if (cmMatch) item.cm = Number(cmMatch[1]);
  const sahMatch = s.match(/(\d+(?:[.,]\d+)?)\s*sáh/);
  if (sahMatch) item.cm = Math.round(Number(sahMatch[1].replace(',', '.')) * 178);

  if (/meč|šavle|mec /.test(s)) item.key = 'mec';
  else if (/kopí/.test(s)) item.key = 'kopi';
  else if (/štít/.test(s)) {
    item.key = 'stit';
    item.symbol = tags.includes('stit_orlice') || /orlic/.test(s)
      ? 'orlice'
      : tags.includes('stit_lev1')
        ? 'lev1'
        : tags.includes('stit_prazdny') || /bez (lva|znaku)|prázdn/.test(s)
          ? 'empty'
          : tags.includes('stit_lev2') || /lv|lev/.test(s)
            ? 'lev2'
            : 'empty';
    item.tails = item.symbol === 'lev2' ? 2 : item.symbol === 'lev1' ? 1 : 0;
    item.shieldColor = /modr/.test(s) ? 0x24366b : /zelen/.test(s) ? 0x1d4020 : /čern|vran/.test(s) ? 0x2a2a30 : /žlut|zlat/.test(s) ? 0x7a5a16 : 0x7a1f12;
  } else if (/přilb|helm/.test(s)) item.key = 'prilba';
  else if (/vest/.test(s)) item.key = 'vesta';
  else if (/bot|obuv/.test(s)) item.key = 'boty';
  else if (/podkov/.test(s)) item.key = 'podkovy';
  else if (/kůň|kobyl|oř\b|oře/.test(s)) {
    if (/žádn/.test(s)) return null;
    item.key = 'kun';
    item.color = /bíl/.test(s) ? 0xe8e8e8 : /vran|čern/.test(s) ? 0x2a2a30 : /hněd/.test(s) ? 0x6b4a2a : 0x8a7a55;
  } else if (/pánev|pánv/.test(s)) item.key = 'panev';
  else if (/srp/.test(s)) item.key = 'srp';
  else if (/kladiv/.test(s)) item.key = 'kladivo';
  else if (/luk|kuše|šíp/.test(s)) item.key = 'luk';
  else if (/sekyr|seker|halapart|topor/.test(s)) item.key = 'sekera';
  else if (/dýk|nůž|tesák/.test(s)) item.key = 'dyka';
  else if (/palcát|cep|řemdih/.test(s)) item.key = 'palcat';
  else if (/brn|plát|krun|drátěn/.test(s)) item.key = 'brneni';
  else if (/praporec|korouh|vlajk/.test(s)) item.key = 'praporec';
  else if (/kalich|číš/.test(s)) item.key = 'kalich';
  else if (/růženec|ruzenec|korál/.test(s)) item.key = 'ruzenec';
  else if (/mošn|listin|dokument|spis/.test(s)) item.key = 'mosna';
  else if (/odznak|hvězd|medail/.test(s)) item.key = 'odznak';
  else if (/polnic|trumpet|trumpk|fanfár/.test(s)) item.key = 'polnice';
  else if (/pochod|louč/.test(s)) item.key = 'pochoden';
  else if (/sud|soudek|bečk|medovin/.test(s)) item.key = 'sud';
  else if (/mapa|mapk|plán cest/.test(s)) item.key = 'mapa';
  else if (/ostruh/.test(s)) item.key = 'ostruhy';
  else if (/sedl/.test(s)) item.key = 'sedlo';
  else if (/vous|plnovous/.test(s)) return null; // vidět na portrétu
  else if (/svatozář|brýle|brejle/.test(s)) return null;
  else item.key = 'vec';

  return item;
}

/** Vytvoří (jednou) texturu předmětu; vrací klíč textury + rozměry. */
export function ensureItemTexture(scene: Phaser.Scene, item: ParsedItem): string {
  const texKey = `item:${item.key}:${item.cm ?? ''}:${item.color ?? ''}:${item.tails ?? ''}:${item.symbol ?? ''}:${item.shieldColor ?? ''}`;
  if (scene.textures.exists(texKey)) return texKey;

  const g = scene.add.graphics();
  const px = (x: number, y: number, w: number, h: number, c: number) => {
    g.fillStyle(c, 1);
    g.fillRect(x * S, y * S, w * S, h * S);
  };
  const STEEL = 0xb8c0cc;
  const STEEL_D = 0x6a7480;
  const WOOD = 0x6b4a2a;
  let W = 16;
  let H = 16;

  switch (item.key) {
    case 'mec': {
      // čepel dle délky: 60 cm ≈ krátká, 150+ ≈ obouruč
      const blade = Phaser.Math.Clamp(Math.round((item.cm ?? 110) / 9), 7, 22);
      W = 10;
      H = blade + 7;
      px(3.4, 0, 3.2, blade, STEEL);
      px(3.4, 0, 1.2, blade, 0xdde4ee); // odlesk
      px(4.4, -0.2 + 0.2, 1, 1, 0xdde4ee);
      px(1, blade, 8, 1.8, WOOD); // záštita
      px(3.8, blade + 1.8, 2.4, 4, 0x4a2e14); // jílec
      px(3.2, blade + 5.6, 3.6, 1.8, 0xd4a017); // hruška
      break;
    }
    case 'kopi':
      W = 6;
      H = 30;
      px(2.4, 4, 1.2, 26, WOOD);
      px(1.6, 0, 2.8, 5, STEEL);
      break;
    case 'stit': {
      W = 16;
      H = 19;
      const sc = item.shieldColor ?? 0x7a1f12;
      const sil = 0xe8e0d0;
      px(1, 0, 14, 13, sc);
      px(2, 13, 12, 3, sc);
      px(5, 16, 6, 1.6, sc);
      g.lineStyle(3, 0xd4a017, 1);
      g.strokeRect(1 * S, 0, 14 * S, 16 * S);
      if (item.symbol === 'orlice') {
        // orlice — tělo, křídla, hlava
        px(7, 5, 2, 6, sil); // tělo
        px(3, 6, 4, 1.4, sil); px(2, 7, 2, 2, sil); // levé křídlo
        px(9, 6, 4, 1.4, sil); px(12, 7, 2, 2, sil); // pravé křídlo
        px(7, 3, 2, 2, sil); px(6, 2, 4, 1.2, sil); // krk+hlava
        px(6, 11, 1.4, 2, sil); px(8.6, 11, 1.4, 2, sil); // nohy
      } else if ((item.tails ?? 0) > 0) {
        px(5, 5, 5, 6, sil);
        px(9, 4, 2.4, 2.4, sil);
        px(4.4, 10.5, 1.2, 3, sil);
        px(8, 11, 1.2, 2.4, sil);
        px(3.4, 2.6, 1.2, 4, sil); // ocas 1
        if ((item.tails ?? 0) === 2) px(5.4, 1.6, 1.2, 4, sil); // ocas 2
      }
      break;
    }
    case 'prilba':
      W = 14;
      H = 12;
      px(2, 4, 10, 4, STEEL);
      px(3, 1, 8, 3, STEEL);
      px(0, 8, 14, 2, STEEL_D); // krempa
      break;
    case 'vesta':
      W = 14;
      H = 15;
      px(2, 1, 10, 13, 0xd6e014);
      px(4, 1, 2, 13, 0xb0b8c0);
      px(8, 1, 2, 13, 0xb0b8c0);
      px(5.4, 0, 3, 2, 0x14100c);
      break;
    case 'boty':
      W = 16;
      H = 12;
      px(1, 0, 4, 9, 0x4a2e14);
      px(1, 9, 7, 2.4, 0x3a2410);
      px(9, 0, 4, 9, 0x4a2e14);
      px(9, 9, 7, 2.4, 0x3a2410);
      break;
    case 'podkovy':
      W = 13;
      H = 13;
      g.lineStyle(10, STEEL_D, 1);
      g.beginPath();
      g.arc(6.5 * S, 6 * S, 4.4 * S, Phaser.Math.DegToRad(-200), Phaser.Math.DegToRad(20));
      g.strokePath();
      break;
    case 'kun': {
      W = 22;
      H = 18;
      const c = item.color ?? 0x8a7a55;
      px(4, 6, 13, 6, c); // tělo
      px(15, 2, 4, 6, c); // krk+hlava
      px(18, 2, 3.4, 3, c);
      px(5, 12, 2, 5, c);
      px(13, 12, 2, 5, c);
      px(2.6, 5.4, 2, 5, c); // ocas
      px(16, 1, 1.2, 2, 0x14100c); // ucho
      break;
    }
    case 'panev':
      W = 18;
      H = 10;
      px(1, 3, 9, 5, 0x3a3a40);
      g.fillStyle(0x3a3a40, 1);
      g.fillEllipse(5.5 * S, 5.5 * S, 9 * S, 5 * S);
      px(10, 4.4, 7, 1.6, WOOD);
      break;
    case 'srp':
      W = 13;
      H = 15;
      g.lineStyle(8, STEEL, 1);
      g.beginPath();
      g.arc(6 * S, 5.4 * S, 4.4 * S, Phaser.Math.DegToRad(-220), Phaser.Math.DegToRad(30));
      g.strokePath();
      px(5.4, 9, 1.6, 6, WOOD);
      break;
    case 'kladivo':
      W = 12;
      H = 16;
      px(2, 0, 8, 3.4, STEEL_D);
      px(5, 3.4, 2, 12, WOOD);
      break;
    case 'mosna':
      W = 14;
      H = 13;
      px(1, 4, 12, 8, 0x8a5a2b);
      px(1, 2.4, 12, 3, 0x6b4420);
      px(6, 6.4, 2, 2, 0xd4a017);
      break;
    case 'odznak':
      W = 12;
      H = 12;
      g.fillStyle(0xc03028, 1);
      g.fillCircle(6 * S, 6 * S, 5 * S);
      g.fillStyle(0xd4a017, 1);
      g.fillCircle(6 * S, 6 * S, 3.4 * S);
      break;
    case 'luk':
      W = 14;
      H = 26;
      g.lineStyle(8, WOOD, 1);
      g.beginPath();
      g.arc(11 * S, 13 * S, 11 * S, Phaser.Math.DegToRad(120), Phaser.Math.DegToRad(240));
      g.strokePath();
      g.lineStyle(2, 0xe8e0d0, 1);
      g.lineBetween(4 * S, 3 * S, 4 * S, 23 * S); // tětiva
      break;
    case 'sekera':
      W = 14;
      H = 28;
      px(6, 4, 2, 23, WOOD); // topor
      px(2, 2, 7, 7, STEEL); // hlava
      g.fillStyle(STEEL, 1);
      g.fillTriangle(2 * S, 2 * S, 2 * S, 9 * S, -2 * S, 5.5 * S); // ostří
      break;
    case 'dyka':
      W = 8;
      H = 18;
      px(3, 0, 2, 12, STEEL);
      px(3.5, 0, 1, 12, 0xdde4ee);
      px(1, 12, 6, 1.4, WOOD);
      px(3, 13, 2, 4, 0x4a2e14);
      break;
    case 'palcat':
      W = 12;
      H = 26;
      px(5, 7, 2, 19, WOOD);
      g.fillStyle(STEEL_D, 1);
      g.fillCircle(6 * S, 5 * S, 5 * S);
      for (let a = 0; a < 360; a += 60) {
        const rr = Phaser.Math.DegToRad(a);
        px(6 + Math.cos(rr) * 5.5, 5 + Math.sin(rr) * 5.5, 1.4, 1.4, STEEL_D);
      }
      break;
    case 'brneni':
      W = 16;
      H = 18;
      px(3, 0, 10, 4, STEEL); // ramena
      px(2, 4, 12, 10, STEEL);
      px(2, 4, 12, 1, 0xdde4ee);
      for (let i = 1; i < 4; i++) px(2, 4 + i * 3, 12, 1, STEEL_D); // pláty
      px(6, 14, 4, 4, STEEL);
      break;
    case 'praporec':
      W = 16;
      H = 26;
      px(2, 0, 1.6, 26, WOOD); // žerď
      px(3.6, 1, 11, 9, 0x7a1f12); // list
      g.fillStyle(0x7a1f12, 1);
      g.fillTriangle(14.6 * S, 1 * S, 14.6 * S, 10 * S, 11 * S, 5.5 * S); // vlaštovčí ocas
      px(7, 3, 4, 4, 0xd4a017); // znak
      break;
    case 'kalich':
      W = 12;
      H = 16;
      g.fillStyle(0xe8c020, 1);
      g.fillTriangle(2 * S, 2 * S, 10 * S, 2 * S, 6 * S, 9 * S); // číše
      px(5, 9, 2, 4, 0xe8c020); // noha
      px(3, 13, 6, 1.6, 0xe8c020); // podstavec
      px(2, 2, 8, 1.4, 0xf4e060); // okraj
      break;
    case 'ruzenec':
      W = 12;
      H = 16;
      for (let a = 0; a < 360; a += 45) {
        const rr = Phaser.Math.DegToRad(a);
        px(6 + Math.cos(rr) * 4.5, 6 + Math.sin(rr) * 4.5, 1.4, 1.4, 0xd8d0c0);
      }
      px(5.3, 11, 1.4, 4, 0xc0b8a8); // křížek
      px(4, 12.5, 4, 1.4, 0xc0b8a8);
      break;
    case 'polnice':
      W = 20;
      H = 12;
      px(1, 5, 4, 2, 0xd4a017); // náustek
      px(5, 4.5, 8, 3, 0xe8c020); // tělo
      g.fillStyle(0xe8c020, 1);
      g.fillTriangle(19 * S, 1 * S, 19 * S, 11 * S, 12 * S, 6 * S); // zvon (otvor vpravo)
      px(6, 8, 6, 1.4, 0xd4a017); // spodní trubička
      break;
    case 'pochoden':
      W = 10;
      H = 24;
      px(4, 8, 2, 16, WOOD); // násada
      px(3.4, 6, 3.2, 3, 0x3a2410); // koš
      g.fillStyle(0xd4601a, 1); // plamen vnější
      g.fillTriangle(5 * S, -2 * S, 1.5 * S, 7 * S, 8.5 * S, 7 * S);
      g.fillStyle(0xffe080, 1); // plamen vnitřní
      g.fillTriangle(5 * S, 2 * S, 3 * S, 7 * S, 7 * S, 7 * S);
      break;
    case 'sud':
      W = 16;
      H = 18;
      px(2, 1, 12, 16, 0x7a4a1e); // tělo sudu
      px(4, 2, 1.4, 14, 0x8a5a2b); // dužiny (světlo)
      px(9, 2, 1.4, 14, 0x8a5a2b);
      px(1, 4, 14, 2, 0x4a2e12); // horní obruč
      px(1, 11, 14, 2, 0x4a2e12); // dolní obruč
      break;
    case 'mapa':
      W = 18;
      H = 14;
      px(2, 2, 14, 10, 0xe8dcc0); // list
      px(2, 1, 2, 12, 0xd8c8a0); // levý svitek
      px(14, 1, 2, 12, 0xd8c8a0); // pravý svitek
      g.lineStyle(2, 0x8a5a2b, 1); // cesta
      g.beginPath();
      g.moveTo(5 * S, 10 * S);
      g.lineTo(8 * S, 6 * S);
      g.lineTo(12 * S, 8 * S);
      g.strokePath();
      px(11, 5, 1.6, 1.6, 0x7a1f12); // × = cíl
      break;
    case 'ostruhy':
      W = 14;
      H = 12;
      g.lineStyle(4, STEEL_D, 1); // pásek do oblouku
      g.beginPath();
      g.arc(5 * S, 6 * S, 4 * S, Phaser.Math.DegToRad(-120), Phaser.Math.DegToRad(120));
      g.strokePath();
      px(9, 5, 2, 2, STEEL); // krček
      g.fillStyle(STEEL, 1); // hvězdice (rowel)
      for (let a = 0; a < 360; a += 45) {
        const rr = Phaser.Math.DegToRad(a);
        px(11.5 + Math.cos(rr) * 2.2, 6 + Math.sin(rr) * 2.2, 1.2, 1.2, STEEL);
      }
      g.fillStyle(STEEL_D, 1);
      g.fillCircle(11.5 * S, 6 * S, 1.6 * S);
      break;
    case 'sedlo':
      W = 18;
      H = 12;
      g.fillStyle(0x6b4a2a, 1);
      g.fillRoundedRect(2 * S, 3 * S, 14 * S, 6 * S, 3 * S); // sedlo
      px(1, 7, 16, 3, 0x5a3a1e); // spodní krytí
      px(3, 2, 3, 3, 0x7a5a30); // přední rozsocha
      px(12, 2, 3, 3, 0x7a5a30); // zadní rozsocha
      px(1, 9, 2, 3, 0x4a2e14); // třmen vlevo
      px(15, 9, 2, 3, 0x4a2e14); // třmen vpravo
      break;
    default:
      W = 12;
      H = 14;
      px(2, 1, 8, 12, 0xe8dcc0);
      px(3.4, 3.4, 5, 1, 0x8a7a55);
      px(3.4, 5.6, 5, 1, 0x8a7a55);
      px(3.4, 7.8, 5, 1, 0x8a7a55);
  }

  g.generateTexture(texKey, W * S, H * S);
  g.destroy();
  return texKey;
}
