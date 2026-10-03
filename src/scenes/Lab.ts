import Phaser from 'phaser';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { Encounter, Rule } from '../content/schemas';
import { Content, L } from '../systems/Content';
import type { SealLetter, StampDecision, StampTarget } from '../systems/StampSystem';
import { StampSystem } from '../systems/StampSystem';
import { drawOfficeBackdrop } from '../ui/Backdrop';
import { makeButton } from '../ui/helpers';

/**
 * DEBUG LAB - samostatné spouštění jednotlivých miniher mimo běh hry.
 * Dostupné z hlavního menu (tlačítko s broučkem vlevo dole). Každou minihru
 * lze otestovat izolovaně: razítkování, vosková pečeť, rozvázání provázku.
 */
export class LabScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container; // herní objekty minihry
  private ui!: Phaser.GameObjects.Container; // hlavička, tlačítka, výsledek
  private stampSys: StampSystem | null = null;

  constructor() {
    super('Lab');
  }

  create(): void {
    drawOfficeBackdrop(this);
    this.layer = this.add.container(0, 0);
    this.ui = this.add.container(0, 0).setDepth(100);
    // debug: ?lab=stamp|approve|wax|wrap rovnou otevře konkrétní minihru
    const p = new URLSearchParams(location.search).get('lab');
    if (p === 'stamp') this.runStamp('reject', false);
    else if (p === 'approve') this.runStamp('approve', false);
    else if (p === 'wax') this.runStamp('reject', true);
    else if (p === 'wrap') this.runWrap();
    else if (p === 'rules') this.showRulesTest();
    else this.showMenu();
  }

  private cleanup(): void {
    this.stampSys?.teardown();
    this.stampSys = null;
    this.layer.removeAll(true);
    this.ui.removeAll(true);
  }

  // ---------- rozcestník miniher ----------

  private showMenu(): void {
    this.cleanup();
    const cx = GAME_WIDTH / 2;
    const head = this.add
      .text(cx, 140, 'DEBUG - MINIHRY', { fontFamily: FONTS.title, fontSize: '74px', color: '#d4a017' })
      .setOrigin(0.5);
    const sub = this.add
      .text(cx, 210, 'Vyber minihru a vyzkoušej ji izolovaně.', {
        fontFamily: FONTS.doc, fontSize: '28px', color: '#bfa978',
      })
      .setOrigin(0.5);
    this.ui.add([head, sub]);

    const games: Array<[string, () => void]> = [
      ['① Razítko - ZAMÍTNUTO', () => this.runStamp('reject', false)],
      ['② Razítko - SCHVÁLENO', () => this.runStamp('approve', false)],
      ['③ Vosková pečeť + razítko', () => this.runStamp('reject', true)],
      ['④ Provázek - rozvázání balíku', () => this.runWrap()],
      [Content.ui('labRulesTest'), () => this.showRulesTest()],
    ];
    let y = 300;
    for (const [label, fn] of games) {
      this.ui.add(makeButton(this, cx, y, label, fn, { fontSize: 38, width: 900 }));
      y += 120;
    }
    this.ui.add(makeButton(this, cx, y + 30, '◀ Hlavní menu', () => this.scene.start('Menu'), { fontSize: 32 }));
  }

  /** Hlavička běžící minihry: pruh + název + tlačítko zpět na seznam. */
  private addLabHeader(name: string): void {
    const bar = this.add.rectangle(GAME_WIDTH / 2, 40, GAME_WIDTH, 80, COLORS.uiPanel).setStrokeStyle(2, COLORS.uiAccent);
    const t = this.add
      .text(GAME_WIDTH / 2, 40, `LAB · ${name}`, { fontFamily: FONTS.ui, fontSize: '34px', color: '#e8d9a8' })
      .setOrigin(0.5);
    const back = makeButton(this, 170, 40, '◀ Seznam', () => this.showMenu(), { fontSize: 26, width: 240 });
    this.ui.add([bar, t, back]);
  }

  /** Oznámení výsledku minihry + volba Znovu / Seznam. */
  private showResult(msg: string, again: () => void): void {
    const cx = GAME_WIDTH / 2;
    const panel = this.add.rectangle(cx, GAME_HEIGHT - 150, 1040, 180, COLORS.uiPanel).setStrokeStyle(4, COLORS.stampGreen);
    const t = this.add
      .text(cx, GAME_HEIGHT - 190, msg, { fontFamily: FONTS.doc, fontSize: '34px', color: '#b8e0a8', align: 'center' })
      .setOrigin(0.5);
    const again2 = makeButton(this, cx - 180, GAME_HEIGHT - 120, '↻ Znovu', () => again(), { fontSize: 28 });
    const list = makeButton(this, cx + 180, GAME_HEIGHT - 120, '◀ Seznam', () => this.showMenu(), { fontSize: 28 });
    this.ui.add([panel, t, again2, list]);
  }

  // ---------- minihra: razítkování (+ volitelně vosková pečeť) ----------

  private runStamp(decision: StampDecision, wax: boolean): void {
    this.cleanup();
    this.addLabHeader(wax ? 'Vosková pečeť + razítko' : decision === 'reject' ? 'Razítko - ZAMÍTNUTO' : 'Razítko - SCHVÁLENO');

    const w = 640;
    const h = 560;
    const center = { x: 940, y: 560 };
    const angleDeg = 6;
    const circleLocal = { x: 330, y: 430 };
    const circleAngleDeg = 40;
    const requiredSeal: SealLetter = 'K';
    this.buildMockDoc(center, w, h, angleDeg, circleLocal, circleAngleDeg, wax, requiredSeal);

    const target: StampTarget = { center, w, h, angleDeg, circleLocal, circleAngleDeg, requireWax: wax };
    const recap = decision === 'reject' ? 'ZKOUŠKA: zamítací razítko' : 'ZKOUŠKA: schvalovací razítko';
    const paragraph = decision === 'reject' ? '§ č. 1/1448' : '';
    this.stampSys = new StampSystem(this, this.layer);
    this.stampSys.begin(
      decision,
      target,
      requiredSeal,
      wax,
      recap,
      paragraph,
      (r) => this.showResult(`✓ Hotovo - kvalita otisku: ${r.quality}`, () => this.runStamp(decision, wax)),
      () => this.showMenu(),
    );
  }

  /** Zkušební listina s kroužkem pro pečeť (geometrie sedí na StampTarget). */
  private buildMockDoc(
    center: { x: number; y: number }, w: number, h: number, angleDeg: number,
    circleLocal: { x: number; y: number }, cAngle: number, requireWax: boolean, requiredSeal: SealLetter,
  ): void {
    const paper = this.add.rectangle(0, 0, w, h, COLORS.paper).setStrokeStyle(4, 0x8a7a55).setOrigin(0, 0);
    const title = this.add.text(24, 20, 'ZKUŠEBNÍ LISTINA', { fontFamily: FONTS.ui, fontSize: '34px', color: '#7a1f12' });
    const body = this.add.text(24, 96, 'Testovací dokument pro ladění\nrazítkovací minihry.\n\nNamoč razítko o podušku, srovnej\núhel (kolečko / Q, E) podle zářezu\nkroužku a přitiskni na papír.', {
      fontFamily: FONTS.doc, fontSize: '27px', color: '#1c1a16', lineSpacing: 6,
    });
    const crx = circleLocal.x;
    const cry = circleLocal.y;
    const g = this.add.graphics();
    g.lineStyle(3, 0x9a8a60, 0.95);
    for (let a = 0; a < 360; a += 30) {
      g.beginPath();
      g.arc(crx, cry, 40, Phaser.Math.DegToRad(a), Phaser.Math.DegToRad(a + 16));
      g.strokePath();
    }
    const rad = Phaser.Math.DegToRad(cAngle - 90);
    g.lineStyle(5, 0x9a8a60, 1);
    g.lineBetween(crx + Math.cos(rad) * 40, cry + Math.sin(rad) * 40, crx + Math.cos(rad) * 56, cry + Math.sin(rad) * 56);
    const ghost = this.add
      .text(crx, cry, requireWax ? requiredSeal : '⊛', { fontFamily: FONTS.ui, fontSize: '30px', color: '#9a8a60' })
      .setOrigin(0.5).setAngle(cAngle).setAlpha(0.85);
    const lbl = this.add
      .text(crx, cry + 58, Content.ui(requireWax ? 'sealSlot' : 'stampSlot'), { fontFamily: FONTS.doc, fontSize: '15px', color: '#9a8a60' })
      .setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [paper, title, body, g, ghost, lbl];
    for (const c of children) {
      (c as unknown as { x: number; y: number }).x -= w / 2;
      (c as unknown as { x: number; y: number }).y -= h / 2;
    }
    const cont = this.add.container(center.x, center.y, children);
    cont.setAngle(angleDeg);
    this.layer.add(cont);
  }

  // ---------- minihra: provázek (rozvázání balíku) ----------

  private runWrap(): void {
    this.cleanup();
    this.addLabHeader('Provázek - rozvázání balíku');
    const w = 560;
    const h = 460;
    const x = GAME_WIDTH / 2 - w / 2;
    const y = 320;
    const cover = this.add.container(0, 0);
    const paper = this.add.rectangle(x, y, w, h, 0xe3d5b3).setOrigin(0, 0).setStrokeStyle(3, 0x8a7a55);
    const ttl = this.add.text(x + 20, y + 14, 'BALÍK SE SPISY', { fontFamily: FONTS.ui, fontSize: '30px', color: '#7a6a45' });
    const hint = this.add
      .text(x + w / 2, y + h - 28, Content.ui('wrapHint'), { fontFamily: FONTS.doc, fontSize: '22px', color: '#7a1f12' })
      .setOrigin(0.5);
    const g = this.add.graphics();
    const midY = y + h / 2;
    g.lineStyle(9, 0x8a5a2b, 1);
    g.lineBetween(x - 6, midY, x + w + 6, midY);
    g.lineBetween(x + w / 2, y - 6, x + w / 2, y + h + 6);
    g.lineStyle(3, 0x6a4420, 1);
    g.lineBetween(x - 6, midY + 4, x + w + 6, midY + 4);
    const knotX0 = x + 70;
    const knotEnd = x + w - 50;
    const knot = this.add.ellipse(knotX0, midY, 40, 30, 0x6a4420).setStrokeStyle(3, 0x4a2e14);
    const loop = this.add.ellipse(knotX0 - 14, midY - 12, 24, 18, 0x8a5a2b).setStrokeStyle(2, 0x4a2e14);
    knot.setInteractive({ useHandCursor: true, draggable: true });
    cover.add([paper, ttl, g, hint, knot, loop]);
    this.layer.add(cover);

    knot.on('drag', (_p: Phaser.Input.Pointer, dragX: number) => {
      const nx = Phaser.Math.Clamp(dragX, knotX0, knotEnd);
      knot.x = nx;
      loop.x = nx - 14;
      loop.y = midY - 12 - (nx - knotX0) * 0.05;
    });
    knot.on('dragend', () => {
      if (knot.x >= knotEnd - 12) {
        try { this.sound.play('sfx_paper', { volume: 0.9 }); } catch { /* ok */ }
        this.tweens.add({
          targets: cover, alpha: 0, y: '-=14', duration: 260, ease: 'Cubic.easeOut',
          onComplete: () => { cover.destroy(true); this.showResult('✓ Rozvázáno! Balík je otevřený.', () => this.runWrap()); },
        });
      } else {
        this.tweens.add({ targets: knot, x: knotX0, duration: 180, ease: 'Back.easeOut' });
        this.tweens.add({ targets: loop, x: knotX0 - 14, y: midY - 12, duration: 180, ease: 'Back.easeOut' });
      }
    });
  }

  // ---------- tajný test vyhlášek (seznam → URL s rozehraným testem) ----------

  /** Tagy pro vyhlášky, co nejsou vepsané do flaws (posuzují se objektivně z portrétu). */
  private static readonly TAG_FOR_RULE: Record<string, string> = {
    R22: 'kalich', R23: 'vous_dlouhy', R29: 'vous', R24: 'bryle', R25: 'urazka_vaclav', R14: 'stit',
  };

  /** Najdi encounter, na kterém jde danou vyhlášku rovnou vyzkoušet, a slož URL. */
  private buildTestUrl(rule: Rule): string {
    const d = rule.day;
    const encs = Content.all.encounters;
    const rules = Content.all.rules;
    const viewable = (e: Encounter): boolean => e.day === d || (e.day === undefined && e.minDay <= d);
    // 1) encounter s vepsaným flaw přesně na tuto vyhlášku
    let enc = encs.find((e) => viewable(e) && (e.flaws ?? []).some((f) => f.ruleRef === rule.id));
    // 2) objektivní (tagová) vyhláška → rytíř s odpovídajícím tagem
    if (!enc) {
      const tag = LabScene.TAG_FOR_RULE[rule.id];
      if (tag) enc = encs.find((e) => viewable(e) && (e.knight.tags ?? []).includes(tag));
    }
    // 3) jakýkoli encounter zamítnutelný v daný den (ať je co orazítkovat)
    if (!enc) {
      enc = encs.find((e) => viewable(e) && (e.flaws ?? []).some((f) => {
        const fr = rules.find((r) => r.id === f.ruleRef);
        return fr ? fr.day <= d : false;
      }));
    }
    let url = `?start=Office&day=${d}`;
    if (enc) url += `&enc=${enc.id}`;
    if (rule.id === 'R27') url += '&wax=1'; // vosková pečeť
    if (rule.id === 'R28') url += '&archive=1'; // archivace druhopisu
    return url;
  }

  private showRulesTest(): void {
    this.cleanup();
    this.addLabHeader('Test vyhlášek');
    const cx = GAME_WIDTH / 2;
    const head = this.add
      .text(cx, 120, Content.ui('labRulesTitle'), { fontFamily: FONTS.title, fontSize: '58px', color: '#d4a017' })
      .setOrigin(0.5);
    const sub = this.add
      .text(cx, 176, Content.ui('labRulesSub'), { fontFamily: FONTS.doc, fontSize: '24px', color: '#bfa978', align: 'center', wordWrap: { width: 1500 } })
      .setOrigin(0.5);
    this.ui.add([head, sub]);

    const rules = [...Content.all.rules].sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));
    const cols = 3;
    const colW = 600;
    const x0 = cx - (cols * colW) / 2 + colW / 2;
    const y0 = 240;
    const rowH = 76;
    const perCol = Math.ceil(rules.length / cols);
    rules.forEach((r, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      const bx = x0 + col * colW;
      const by = y0 + row * rowH;
      const label = `${L(r.cislo)} · den ${r.day}`;
      const btn = makeButton(this, bx, by, label, () => { location.search = this.buildTestUrl(r); }, {
        fontSize: 19, width: colW - 28, font: FONTS.doc,
      });
      this.ui.add(btn);
    });
    this.ui.add(makeButton(this, cx, GAME_HEIGHT - 46, '◀ Seznam miniher', () => this.showMenu(), { fontSize: 26 }));
  }
}
