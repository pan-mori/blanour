import Phaser from 'phaser';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH, TUNING } from '../config';
import type { Reason } from '../content/schemas';
import { Content, L } from '../systems/Content';
import { EncounterManager } from '../systems/EncounterManager';
import { GameState } from '../systems/GameState';
import type { ActiveEncounter } from '../systems/RuleEngine';
import { RuleEngine } from '../systems/RuleEngine';
import type { SealLetter, StampDecision, StampResult, StampTarget } from '../systems/StampSystem';
import { StampSystem } from '../systems/StampSystem';
import { drawOfficeBackdrop } from '../ui/Backdrop';
import { makeButton } from '../ui/helpers';
import { ensureItemTexture, parseEquipment } from '../ui/ItemIcons';
import { ensureKnightTexture } from '../ui/KnightPortrait';

/**
 * Jádro hry: přepážka. M1 verze — dokumenty jako panely, rozhodnutí tlačítky.
 * (M2: tahatelné papíry + razítkovací carry systém přes StampSystem.apply API.)
 */
export class OfficeScene extends Phaser.Scene {
  private enc: ActiveEncounter | null = null;
  private hud!: Phaser.GameObjects.Text;
  private heckleTimer?: Phaser.Time.TimerEvent;
  private heckleBubble?: Phaser.GameObjects.Container;
  private encounterLayer!: Phaser.GameObjects.Container;
  private overlayLayer!: Phaser.GameObjects.Container;
  private busy = false; // blokuje akce během outcome/cutaway
  private stampSys: StampSystem | null = null;
  private pendingReason: Reason | null = null;
  private stampTarget: StampTarget | null = null;
  private actionButtons: Phaser.GameObjects.Container[] = [];

  constructor() {
    super('Office');
  }

  create(): void {
    // pozadí úřadovny v jeskyni (krápníky, police, svíčka)
    drawOfficeBackdrop(this);

    // horní lišta
    this.add.rectangle(GAME_WIDTH / 2, 40, GAME_WIDTH, 80, COLORS.uiPanel).setStrokeStyle(2, COLORS.uiAccent);
    this.hud = this.add
      .text(GAME_WIDTH / 2, 40, '', { fontFamily: FONTS.ui, fontSize: '34px', color: '#e8d9a8' })
      .setOrigin(0.5);
    makeButton(this, 56, 40, '?', () => this.openHelp(), { fontSize: 34, width: 72 }).setDepth(10);

    // ikona dokumentu vpravo v 1/3 výšky → všechny platné vyhlášky
    const rg = this.add.graphics().setDepth(10);
    rg.fillStyle(0xf0e6c8, 1);
    rg.fillRect(1846, 326, 52, 66);
    rg.fillStyle(0xe0d4b0, 1);
    rg.fillRect(1852, 320, 52, 66);
    rg.lineStyle(3, 0x8a7a55, 1);
    rg.strokeRect(1852, 320, 52, 66);
    for (let i = 0; i < 4; i++) rg.lineBetween(1860, 334 + i * 12, 1896, 334 + i * 12);
    const rgSym = this.add
      .text(1878, 352, '§', { fontFamily: FONTS.ui, fontSize: '30px', color: '#7a1f12' })
      .setOrigin(0.5)
      .setDepth(11);
    const rgHit = this.add
      .rectangle(1876, 353, 76, 86, 0xffffff, 0.001)
      .setDepth(12)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => rgSym.setScale(1.2))
      .on('pointerout', () => rgSym.setScale(1))
      .on('pointerdown', () => this.openRules());
    this.tweens.add({ targets: [rgSym], angle: 6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    void rgHit;

    this.encounterLayer = this.add.container(0, 0);
    this.overlayLayer = this.add.container(0, 0).setDepth(100);

    // debug: ?enc=ENC_031 vynutí konkrétní encounter (QA obsahu)
    const dbgEnc = new URLSearchParams(location.search).get('enc');
    if (!dbgEnc || !EncounterManager.buildSingle(dbgEnc)) {
      EncounterManager.buildDay(GameState.day, 4);
    }
    this.nextKnight();
  }

  // ---------- tok encounterů ----------

  private nextKnight(): void {
    this.busy = false;
    this.heckleBubble?.destroy();
    this.heckleBubble = undefined;
    this.inspectPopup?.destroy();
    this.inspectPopup = undefined;
    this.stampSys?.teardown();
    this.stampSys = null;
    this.pendingReason = null;
    this.stampTarget = null;
    this.actionButtons = [];
    this.overlayLayer.removeAll(true);
    this.encounterLayer.removeAll(true);
    this.enc = EncounterManager.next();
    if (!this.enc) {
      this.scene.start('DayEnd');
      return;
    }
    try {
      this.sound.play('sfx_paper', { volume: 0.6 });
    } catch {
      /* zvuk není kritický */
    }
    this.renderEncounter(this.enc);
    this.updateHud();

    // příchod rytíře — krátký slide-in
    this.encounterLayer.setAlpha(0);
    this.encounterLayer.y = 36;
    this.tweens.add({ targets: this.encounterLayer, alpha: 1, y: 0, duration: 240, ease: 'Cubic.easeOut' });

    this.scheduleHeckle();
  }

  private updateHud(): void {
    const era = Content.era(GameState.day);
    const hearts = '♥'.repeat(GameState.lives) + '♡'.repeat(Math.max(0, TUNING.lives - GameState.lives));
    this.hud.setText(
      `${Content.ui('day')} ${GameState.day}/5 · L.P. ${era.year}   |   ` +
        `${Content.ui('knight')} ${EncounterManager.index}/${EncounterManager.total}   |   ` +
        `${hearts}   |   ${Content.ui('decrees')}: ${GameState.decreesLeft}`,
    );
  }

  // ---------- hecování (náhrada časového tlaku — bez trestu, jen atmosféra) ----------

  private scheduleHeckle(): void {
    this.heckleTimer?.remove();
    // debug: ?heckle=1 → pokřik už po 2 s (testování)
    const dbg = new URLSearchParams(location.search).has('heckle');
    this.heckleTimer = this.time.addEvent({
      delay: dbg ? 2000 : Phaser.Math.Between(28_000, 48_000),
      loop: true,
      callback: () => {
        if (this.busy || !this.enc) return;
        this.showHeckle();
      },
    });
  }

  private showHeckle(): void {
    this.heckleBubble?.destroy();
    const pool = Content.all.infographics.filter((i) => i.kind === 'heckle');
    if (pool.length === 0) return;
    const line = L(pool[Math.floor(Math.random() * pool.length)].text);

    const text = this.add.text(0, 0, `„${line}“`, {
      fontFamily: FONTS.doc,
      fontSize: '28px',
      color: '#5a1a10',
      fontStyle: 'bold',
      wordWrap: { width: 480 },
    });
    const bg = this.add
      .rectangle(-18, -14, text.width + 36, text.height + 28, 0xf3d9c4)
      .setStrokeStyle(3, 0xa8552a)
      .setOrigin(0, 0);
    this.heckleBubble = this.add.container(560, 330, [bg, text]).setDepth(55).setAlpha(0);
    this.tweens.add({ targets: this.heckleBubble, alpha: 1, y: 320, duration: 160 });
    // pokřik VŽDY otřese obrazovkou — a při razítkování kopne do úhlu razítka!
    this.cameras.main.shake(220, 0.006);
    this.stampSys?.nudge();
    this.tweens.add({ targets: this.encounterLayer, x: '+=6', duration: 50, yoyo: true, repeat: 3 });
    this.time.delayedCall(3200, () => {
      if (!this.heckleBubble) return;
      this.tweens.add({
        targets: this.heckleBubble,
        alpha: 0,
        duration: 250,
        onComplete: () => this.heckleBubble?.destroy(),
      });
    });
  }

  // ---------- vykreslení encounteru ----------

  private renderEncounter(enc: ActiveEncounter): void {
    const k = enc.data.knight;

    // rytíř — procedurální pixel-art portrét
    const px = 330;
    const py = 480;
    const portrait = this.add.rectangle(px, py, 380, 460, 0x2a2f3a).setStrokeStyle(4, COLORS.uiAccent);
    // debug: ?tags=stit_lev1.srp_kladivo vynutí vizuální tagy (testování portrétů)
    const dbgTags = new URLSearchParams(location.search).get('tags');
    const texKey = ensureKnightTexture(this, k.sprite, dbgTags ? dbgTags.split('.') : k.tags);
    const face = this.add.image(px, py - 20, texKey).setDisplaySize(330, 412);
    const name = this.add
      .text(px, py + 252, k.name, { fontFamily: FONTS.ui, fontSize: '34px', color: '#e8d9a8' })
      .setOrigin(0.5)
      .setStroke('#14100c', 6);
    // výstroj jako PŘEDMĚTY vyskládané na stole pod portrétem (klikací!)
    this.renderEquipmentItems(k.equipment, k.tags);

    // bublina s hláškou — PŘÍMO NAD portrétem (bez kolize s dokumenty)
    const bw = 560;
    const intro = this.add.text(0, 0, `„${L(k.intro)}“`, {
      fontFamily: FONTS.doc,
      fontSize: '27px',
      color: '#1c1a16',
      align: 'center',
      wordWrap: { width: bw - 44 },
    }).setOrigin(0.5);
    const bh = intro.height + 32;
    const bubbleBottom = 232; // těsně nad portrétem (horní hrana portrétu ~250)
    const by0 = bubbleBottom - bh;
    const bubble = this.add.rectangle(px, by0 + bh / 2, bw, bh, COLORS.paper).setStrokeStyle(3, 0x8a7a55);
    intro.setPosition(px, by0 + bh / 2);
    const tail = this.add.graphics();
    tail.fillStyle(COLORS.paper, 1);
    tail.fillTriangle(px - 18, bubbleBottom - 2, px + 18, bubbleBottom - 2, px, bubbleBottom + 22);
    tail.lineStyle(3, 0x8a7a55, 1);
    tail.lineBetween(px - 18, bubbleBottom - 2, px, bubbleBottom + 22);
    tail.lineBetween(px + 18, bubbleBottom - 2, px, bubbleBottom + 22);

    this.encounterLayer.add([portrait, face, name, tail, bubble, intro]);
    this.encounterLayer.bringToTop(intro);

    // dokumenty: žádost = velký nakloněný papír s kroužkem pro pečeť, přílohy vpravo
    this.stampTarget = null;
    const docs = enc.data.documents;
    if (docs.length > 0) this.renderPrimaryDoc(docs[0]);
    let sy = 250;
    for (let i = 1; i < docs.length; i++) {
      sy = this.renderSecondaryDoc(docs[i], sy) + 24;
    }

    // vzorník pečetí (od 2. dne, kdy platí vyhláška o pečetích)
    if (GameState.day >= 2) this.drawSealChart();

    // akční tlačítka
    const by = GAME_HEIGHT - 70;
    const reject = makeButton(this, 640, by, Content.ui('reject'), () => this.openReasonPicker(), {
      fontSize: 40,
      color: 0x5a1a10,
    });
    const approve = makeButton(this, 1050, by, Content.ui('approve'), () => this.confirmApprove(), {
      fontSize: 40,
      color: 0x1d4020,
    });
    this.encounterLayer.add([reject, approve]);
    this.actionButtons = [reject, approve];

    const decrees = RuleEngine.applicableDecrees(enc);
    if (decrees.length > 0) {
      const drawer = this.makeDecreeDrawer(1560, by - 6);
      this.encounterLayer.add(drawer);
      this.actionButtons.push(drawer);
    }
  }

  /** Ikona šuplíku „Podpultové vyhlášky" (nahrazuje tlačítko VYDAT VYHLÁŠKU). */
  private makeDecreeDrawer(x: number, y: number): Phaser.GameObjects.Container {
    const w = 320;
    const h = 96;
    const body = this.add.rectangle(0, 0, w, h, 0x3a2a16).setStrokeStyle(4, 0xd4a017);
    const face = this.add.rectangle(0, -6, w - 14, h - 24, 0x5a4226).setStrokeStyle(2, 0x3a2a16);
    const handle = this.add.rectangle(0, 20, 110, 18, 0x2a1c10).setStrokeStyle(3, 0xd4a017);
    const txt = this.add.text(0, -14, Content.ui('drawerDecrees'), {
      fontFamily: FONTS.ui, fontSize: '24px', color: '#e8d9a8', align: 'center', wordWrap: { width: w - 40 },
    }).setOrigin(0.5);
    const badge = this.add.text(w / 2 - 14, -h / 2 + 8, `${GameState.decreesLeft}`, {
      fontFamily: FONTS.doc, fontSize: '22px', color: '#d4a017',
    }).setOrigin(1, 0);
    const c = this.add.container(x, y, [body, face, handle, txt, badge]);
    c.setSize(w, h);
    face.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { face.setFillStyle(0x6a5030); this.tweens.add({ targets: handle, y: 26, duration: 90 }); })
      .on('pointerout', () => { face.setFillStyle(0x5a4226); this.tweens.add({ targets: handle, y: 20, duration: 90 }); })
      .on('pointerdown', () => {
        try { this.sound.play('sfx_paper', { volume: 0.5 }); } catch { /* ok */ }
        this.openDecreePicker();
      });
    return c;
  }

  // ---------- razítkování ----------

  /** Pečeť vyžadovaná cílovým formulářem (sealType šablony, jinak dle epochy). */
  private requiredSeal(): SealLetter {
    const ERA_SEAL: Record<number, SealLetter> = { 1: 'K', 2: 'K', 3: 'E', 4: 'V', 5: 'E' };
    const tmplId = this.enc?.data.documents[0]?.template;
    const tmpl = Content.all.docTemplates.find((t) => t.id === tmplId);
    return (tmpl?.sealType as SealLetter | undefined) ?? ERA_SEAL[GameState.day] ?? 'K';
  }

  /** Rozhodnutí padlo — teď ho musí hráč vykonat razítkem. */
  private enterStampMode(decision: StampDecision): void {
    if (!this.stampTarget) {
      // nouzovka: bez cíle vyřiď rovnou (nemělo by nastat)
      this.onStampDone(decision, { quality: 'crisp', ok: true });
      return;
    }
    for (const b of this.actionButtons) b.setVisible(false);
    this.inspectPopup?.destroy();
    this.inspectPopup = undefined;
    const recap =
      decision === 'approve'
        ? Content.ui('stampRecapApprove')
        : `${Content.ui('stampRecap')} ${this.pendingReason ? L(this.pendingReason.label) : ''}`;
    const paragraph = decision === 'reject' && this.pendingReason ? this.reasonParagraph(this.pendingReason) : '';
    this.stampSys = new StampSystem(this, this.encounterLayer);
    this.stampSys.begin(
      decision,
      this.stampTarget,
      this.requiredSeal(),
      this.stampTarget.requireWax,
      recap,
      paragraph,
      (r) => this.onStampDone(decision, r),
      () => {
        // ✕ Jiný důvod — zpátky k rozhodování
        this.stampSys = null;
        this.pendingReason = null;
        for (const b of this.actionButtons) b.setVisible(true);
      },
    );
  }

  private onStampDone(decision: StampDecision, result: StampResult): void {
    if (!result.ok || !this.enc) return;
    if (decision === 'approve') {
      GameState.approve();
      this.scene.start('Ending');
      return;
    }
    const reason = this.pendingReason;
    this.pendingReason = null;
    if (!reason) return;
    const verdict = RuleEngine.validateRejection(this.enc, reason.id, GameState.day);
    if (verdict.ok) {
      GameState.recordReject();
      // chytří rytíři: tohle razítko je spotřebované, další rytíři si dají pozor
      GameState.useReason(reason.id);
      EncounterManager.pruneUnsolvable(GameState.day);
      const msg = this.enc.data.outcomes?.rejectOk
        ? L(this.enc.data.outcomes.rejectOk)
        : Content.ui('rejectOkDefault');
      this.showOutcome(`✓ ${msg}\n(${L(verdict.flaw!.hint)})`, 0x2f7d32, () => this.nextKnight());
    } else {
      const t = GameState.loseLife();
      this.updateHud();
      const msg = this.enc.data.outcomes?.rejectBad
        ? L(this.enc.data.outcomes.rejectBad)
        : Content.ui('rejectBadDefault');
      this.showCutaway(msg, () => {
        if (t === 'ending:beaten') this.scene.start('Ending');
        else this.nextKnight();
      });
    }
  }

  // ---------- nápověda ----------

  /** Overlay „?": JEN herní mechaniky (vyhlášky mají vlastní ikonu dokumentu). */
  private openHelp(): void {
    if (this.busy) return;
    this.busy = true;
    this.inspectPopup?.destroy();
    this.inspectPopup = undefined;
    const cx = GAME_WIDTH / 2;
    const dim = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setInteractive();
    const panel = this.add.rectangle(cx, 430, 1760, 660, COLORS.uiPanel).setStrokeStyle(4, COLORS.uiAccent);
    const head = this.add
      .text(cx, 160, `${Content.ui('helpTitle')} · ${Content.ui('helpHow').toUpperCase()}`, {
        fontFamily: FONTS.ui,
        fontSize: '40px',
        color: '#d4a017',
      })
      .setOrigin(0.5);
    this.overlayLayer.add([dim, panel, head]);

    const lines = ['helpH1', 'helpH2', 'helpH3', 'helpH4'];
    let hy = 235;
    lines.forEach((key, i) => {
      const icon = this.add.graphics();
      this.drawHelpIcon(icon, 200, hy + 26, i);
      const t = this.add.text(270, hy, Content.ui(key), {
        fontFamily: FONTS.doc,
        fontSize: '26px',
        color: '#e8d9a8',
        wordWrap: { width: 1480 },
        lineSpacing: 4,
      });
      this.overlayLayer.add([icon, t]);
      hy += Math.max(t.height, 58) + 26;
    });

    const close = makeButton(this, GAME_WIDTH - 280, 160, `✕ ${Content.ui('close')}`, () => {
      this.overlayLayer.removeAll(true);
      this.busy = false;
    }, { fontSize: 28 });
    this.overlayLayer.add(close);
  }

  /** Overlay se všemi platnými vyhláškami (ikona dokumentu vpravo). */
  private openRules(): void {
    if (this.busy) return;
    this.busy = true;
    this.inspectPopup?.destroy();
    this.inspectPopup = undefined;
    const cx = GAME_WIDTH / 2;
    const dim = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78).setInteractive();
    const panel = this.add.rectangle(cx, GAME_HEIGHT / 2, 1760, 980, COLORS.uiPanel).setStrokeStyle(4, COLORS.uiAccent);
    const rules = Content.all.rules.filter((r) => GameState.enactedRules.has(r.id));
    const head = this.add
      .text(cx, 95, `§ ${Content.ui('helpRules').toUpperCase()} (${rules.length}) §`, {
        fontFamily: FONTS.ui,
        fontSize: '42px',
        color: '#d4a017',
      })
      .setOrigin(0.5);
    this.overlayLayer.add([dim, panel, head]);

    // adaptivně 2–3 sloupce, ať se vejde i 20 vyhlášek pátého dne
    const cols = rules.length > 12 ? 3 : 2;
    const colW = cols === 3 ? 530 : 820;
    const colX = cols === 3 ? [120, 700, 1280] : [120, 980];
    const fs = rules.length > 16 ? 16 : rules.length > 12 ? 17 : 20;
    const per = Math.ceil(rules.length / cols);
    const colY2 = colX.map(() => 165);
    rules.forEach((r, i) => {
      const col = Math.min(Math.floor(i / per), cols - 1);
      const t = this.add.text(colX[col], colY2[col], `§ ${L(r.cislo)}: ${L(r.text)}`, {
        fontFamily: FONTS.doc,
        fontSize: `${fs}px`,
        color: '#bfa978',
        wordWrap: { width: colW },
      });
      this.overlayLayer.add(t);
      colY2[col] += t.height + 9;
    });

    const close = makeButton(this, GAME_WIDTH - 280, 95, `✕ ${Content.ui('close')}`, () => {
      this.overlayLayer.removeAll(true);
      this.busy = false;
    }, { fontSize: 28 });
    this.overlayLayer.add(close);
  }

  /** Piktogramy nápovědy: ① kurzor+meč ② dokument ③ razítko s pečetí ④ srdíčka. */
  private drawHelpIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, kind: number): void {
    if (kind === 0) {
      // meč + kurzor
      g.fillStyle(0xb8c0cc, 1);
      g.fillRect(x - 4, y - 26, 8, 34);
      g.fillStyle(0x6b4a2a, 1);
      g.fillRect(x - 14, y + 8, 28, 6);
      g.fillStyle(0xe8d9a8, 1);
      g.fillTriangle(x + 16, y + 2, x + 16, y + 26, x + 32, y + 18);
    } else if (kind === 1) {
      // dokument s razítkem
      g.fillStyle(0xf0e6c8, 1);
      g.fillRect(x - 18, y - 24, 38, 50);
      g.lineStyle(3, 0x8a7a55, 1);
      for (let i = 0; i < 3; i++) g.lineBetween(x - 10, y - 12 + i * 10, x + 12, y - 12 + i * 10);
      g.lineStyle(4, 0xa82810, 0.8);
      g.strokeRect(x - 12, y + 6, 26, 14);
    } else if (kind === 2) {
      // razítko s okénkem pečeti
      g.fillStyle(0x8a5a2b, 1);
      g.fillEllipse(x, y - 22, 26, 12);
      g.fillStyle(0x6b4a2a, 1);
      g.fillRect(x - 6, y - 18, 12, 22);
      g.fillStyle(0xa82810, 1);
      g.fillRect(x - 26, y + 4, 52, 16);
      g.fillStyle(0x7a1f12, 1);
      g.fillCircle(x - 15, y + 12, 7);
      g.fillStyle(0xe8c49a, 1);
      g.fillCircle(x - 15, y + 12, 4);
    } else {
      // srdíčka
      g.fillStyle(0xc0392b, 1);
      for (let i = 0; i < 3; i++) {
        const hx = x - 18 + i * 18;
        g.fillCircle(hx - 4, y - 2, 5);
        g.fillCircle(hx + 4, y - 2, 5);
        g.fillTriangle(hx - 9, y, hx + 9, y, hx, y + 12);
      }
    }
  }

  // ---------- výstroj na stole + výslech předmětů ----------

  private inspectPopup?: Phaser.GameObjects.Container;

  /** Vyskládá výstroj jako klikací předměty na stůl pod portrét (proměnný počet 1–8). */
  private renderEquipmentItems(equipment: string[], tags: string[]): void {
    const items = equipment.map((e) => parseEquipment(e, tags)).filter((i) => i !== null).slice(0, 8);
    if (items.length === 0) return;
    const perRow = items.length <= 4 ? Math.max(items.length, 1) : 4;
    const rows = Math.ceil(items.length / perRow);
    const startX = 120;
    const stripW = 580; // volný pruh pod portrétem, končí před dokumenty
    const cellW = Math.min(150, stripW / perRow);
    const cellH = rows > 1 ? 118 : 160;
    const startY = rows > 1 ? 758 : 788;
    // víc řad = menší předměty, ať se vejdou nad akční tlačítka
    const scale = rows > 1 ? 0.56 : 0.82;
    const imgH = rows > 1 ? 72 : 96;

    items.forEach((item, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const cx = startX + col * cellW + cellW / 2;
      const cy = startY + row * cellH;
      const tex = ensureItemTexture(this, item);
      const img = this.add.image(cx, cy + imgH, tex).setOrigin(0.5, 1);
      img.setScale(scale); // KONSTANTNÍ v rámci řady — rozdíly velikostí (délka meče!) zůstanou vidět
      img.setInteractive({ useHandCursor: true });
      img.on('pointerover', () => img.setScale(scale * 1.14));
      img.on('pointerout', () => img.setScale(scale));
      img.on('pointerdown', (p: Phaser.Input.Pointer) => {
        this.openInspect(item, cx, cy);
        p.event.stopPropagation();
      });
      const label = this.add
        .text(cx, cy + imgH + 6, item.label, {
          fontFamily: FONTS.doc,
          fontSize: rows > 1 ? '14px' : '17px',
          color: '#bfa978',
          wordWrap: { width: cellW - 8 },
          align: 'center',
        })
        .setOrigin(0.5, 0);
      this.encounterLayer.add([img, label]);
    });
  }

  /** Klik na předmět: rytíř JEN popíše/odpoví (nápověda). Zamítá se z razítkové skříně. */
  private openInspect(item: { key: string; label: string }, x: number, y: number): void {
    if (this.busy || this.stampSys?.isActive) return;
    this.inspectPopup?.destroy();

    const popup = this.add.container(0, 0).setDepth(95);
    const pw = 480;
    const pad = 22;
    const answer = this.add.text(0, 0, `„${item.label}. ${Content.ui('askSuffix')}“`, {
      fontFamily: FONTS.doc,
      fontSize: '27px',
      color: '#1c1a16',
      wordWrap: { width: pw - pad * 2 - 20 },
    });
    const hintLine = this.add.text(0, 0, Content.ui('inspectHint'), {
      fontFamily: FONTS.doc, fontSize: '19px', color: '#7a6a45', fontStyle: 'italic', wordWrap: { width: pw - pad * 2 },
    });
    const ph = answer.height + 14 + hintLine.height + pad * 2;
    const bx = Phaser.Math.Clamp(x, pw / 2 + 20, GAME_WIDTH - pw / 2 - 20);
    const by = Phaser.Math.Clamp(y - ph - 60, 100, GAME_HEIGHT - ph - 40);
    const bg = this.add.rectangle(bx, by + ph / 2, pw, ph, 0xf0e6c8).setStrokeStyle(3, 0x8a7a55);
    answer.setPosition(bx - pw / 2 + pad, by + pad);
    hintLine.setPosition(bx - pw / 2 + pad, by + pad + answer.height + 12);
    const closeBtn = this.add
      .text(bx + pw / 2 - 10, by + 4, '✕', { fontFamily: FONTS.ui, fontSize: '26px', color: '#7a1f12' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.inspectPopup?.destroy();
        this.inspectPopup = undefined;
      });
    popup.add([bg, answer, hintLine, closeBtn]);
    this.inspectPopup = popup;
  }

  // ---------- vykreslení dokumentů ----------

  private buildDocLines(d: { template: string; fields: Record<string, string> }): { titleStr: string; bodyStr: string } {
    const tmpl = Content.all.docTemplates.find((t) => t.id === d.template);
    const lines: string[] = [];
    if (tmpl) {
      for (const f of tmpl.fields) {
        lines.push(`${L(f.label)}: ${d.fields[f.key] ?? '—'}`);
      }
    } else {
      lines.push(...Object.entries(d.fields).map(([k2, v]) => `${k2}: ${v}`));
    }
    return { titleStr: tmpl ? L(tmpl.title) : d.template, bodyStr: lines.join('\n') };
  }

  /** Žádost: velká, náhodně nakloněná (±30°), s náhodně umístěným a otočeným kroužkem pro pečeť. */
  private renderPrimaryDoc(d: { template: string; fields: Record<string, string>; seal?: string }): void {
    const { titleStr, bodyStr } = this.buildDocLines(d);
    const w = 640;

    // adaptivní písmo — c. k. formuláře mají upovídané labely
    let fs = 30;
    let title!: Phaser.GameObjects.Text;
    let body!: Phaser.GameObjects.Text;
    for (;;) {
      title?.destroy();
      body?.destroy();
      title = this.add.text(24, 16, titleStr.toUpperCase(), {
        fontFamily: FONTS.ui,
        fontSize: `${fs}px`,
        color: '#7a1f12',
        wordWrap: { width: w - 48 },
      });
      body = this.add.text(24, title.height + 30, bodyStr, {
        fontFamily: FONTS.doc,
        fontSize: `${fs}px`,
        color: '#1c1a16',
        lineSpacing: 5,
        wordWrap: { width: w - 48 },
      });
      if (title.height + body.height + 240 <= 760 || fs <= 23) break;
      fs -= 3;
    }

    const contentBottom = title.height + 30 + body.height + 16;
    const h = contentBottom + 190; // volný pruh dole — kroužek se tam vždy vejde
    const paper = this.add.rectangle(0, 0, w, h, COLORS.paper).setStrokeStyle(4, 0x8a7a55).setOrigin(0, 0);

    // vosková pečeť je vyžadována NÁHODNĚ (~40 %) — podmínka postupu
    // debug: ?wax=1 vynutí, ?wax=0 vypne
    const waxParam = new URLSearchParams(location.search).get('wax');
    const requireWax = waxParam === '1' ? true : waxParam === '0' ? false : Math.random() < 0.4;

    // kroužek pečeti: náhodná pozice ve volném pruhu + zcela náhodné natočení
    const crx = Phaser.Math.Between(110, w - 110);
    const cry = Phaser.Math.Between(contentBottom + 70, h - 55);
    const cAngle = Phaser.Math.Between(0, 359);
    const g = this.add.graphics();
    g.lineStyle(3, 0x9a8a60, 0.95);
    for (let a = 0; a < 360; a += 30) {
      g.beginPath();
      g.arc(crx, cry, 40, Phaser.Math.DegToRad(a), Phaser.Math.DegToRad(a + 16));
      g.strokePath();
    }
    // zářez ukazuje orientaci kroužku — podle něj se srovnává razítko
    const rad = Phaser.Math.DegToRad(cAngle - 90);
    g.lineStyle(5, 0x9a8a60, 1);
    g.lineBetween(
      crx + Math.cos(rad) * 40, cry + Math.sin(rad) * 40,
      crx + Math.cos(rad) * 56, cry + Math.sin(rad) * 56,
    );
    const children: Phaser.GameObjects.GameObject[] = [paper, title, body, g];
    // znak pečeti (K/E/V) ukážeme jen když je vyžadován vosk — jinak je kroužek jen cíl razítka
    const ghost = this.add
      .text(crx, cry, requireWax ? this.requiredSeal() : '⊛', {
        fontFamily: FONTS.ui, fontSize: '30px', color: '#9a8a60',
      })
      .setOrigin(0.5).setAngle(cAngle).setAlpha(0.85);
    const lbl = this.add
      .text(crx, cry + 58, Content.ui(requireWax ? 'sealSlot' : 'stampSlot'), {
        fontFamily: FONTS.doc, fontSize: '15px', color: '#9a8a60',
      })
      .setOrigin(0.5);
    children.push(ghost, lbl);
    if (d.seal) {
      // (pečeť došlé listiny na žádosti bývá vzácná, ale ať nic nezmizí)
      children.push(...this.makeSealObjects(w - 70, h - 60, d.seal));
    }
    for (const c of children) {
      (c as unknown as { x: number; y: number }).x -= w / 2;
      (c as unknown as { x: number; y: number }).y -= h / 2;
    }

    const angle = Phaser.Math.Between(3, 10) * (Math.random() < 0.5 ? -1 : 1);
    const cx0 = 1010;
    const cy0 = Phaser.Math.Clamp(210 + h / 2, 330, 1080 - h / 2 - 120);
    const cont = this.add.container(cx0, cy0, children);
    cont.setAngle(angle);
    this.encounterLayer.add(cont);

    this.stampTarget = {
      center: { x: cx0, y: cy0 },
      w,
      h,
      angleDeg: angle,
      circleLocal: { x: crx, y: cry },
      circleAngleDeg: cAngle,
      requireWax,
    };
  }

  /** Přílohy: menší papíry ve sloupci vpravo. Vrací spodní hranu. */
  private renderSecondaryDoc(
    d: { template: string; fields: Record<string, string>; wrapped?: boolean; seal?: string },
    y: number,
  ): number {
    const { titleStr, bodyStr } = this.buildDocLines(d);
    const x = 1335; // končí před ikonou vyhlášek vpravo
    const w = 470;
    const tTitle = this.add.text(x + 18, y + 12, titleStr.toUpperCase(), {
      fontFamily: FONTS.ui,
      fontSize: '25px',
      color: '#7a1f12',
      wordWrap: { width: w - 36 },
    });
    const tBody = this.add.text(x + 18, y + tTitle.height + 22, bodyStr, {
      fontFamily: FONTS.doc,
      fontSize: '25px',
      color: '#1c1a16',
      lineSpacing: 5,
      wordWrap: { width: w - 36 },
    });
    const height = tTitle.height + tBody.height + 44;
    const paper = this.add.rectangle(x, y, w, height, COLORS.paper).setStrokeStyle(3, 0x8a7a55).setOrigin(0, 0);
    this.encounterLayer.add([paper, tTitle, tBody]);
    this.encounterLayer.bringToTop(tTitle);
    this.encounterLayer.bringToTop(tBody);
    if (d.seal) this.drawSeal(x + w - 58, y + height - 50, d.seal);
    if (d.wrapped) this.buildWrapCover(x, y, w, height, titleStr);
    return y + height;
  }

  // ---------- pečeti ----------

  /** Vosková pečeť na dokumentu: plná s monogramem, nebo zlomená (vada!). */
  private drawSeal(x: number, y: number, sealId: string): void {
    this.encounterLayer.add(this.makeSealObjects(x, y, sealId));
  }

  /** Objekty pečeti (nepřidává do vrstvy — pro vložení do kontejneru žádosti). */
  private makeSealObjects(x: number, y: number, sealId: string): Phaser.GameObjects.GameObject[] {
    const g = this.add.graphics();
    if (sealId === 'broken') {
      // zlomená: dvě odlomené poloviny + prasklina
      g.fillStyle(0x6a4a42, 1);
      g.slice(x - 6, y + 3, 30, Phaser.Math.DegToRad(100), Phaser.Math.DegToRad(285), false);
      g.fillPath();
      g.fillStyle(0x7a4a3a, 1);
      g.slice(x + 8, y - 5, 30, Phaser.Math.DegToRad(275), Phaser.Math.DegToRad(95), false);
      g.fillPath();
      g.lineStyle(3, 0x2a1410, 1);
      g.lineBetween(x - 14, y - 22, x + 2, y - 4);
      g.lineBetween(x + 2, y - 4, x - 8, y + 14);
      const warn = this.add
        .text(x, y + 38, Content.ui('sealBroken'), { fontFamily: FONTS.doc, fontSize: '20px', color: '#7a1f12' })
        .setOrigin(0.5);
      return [g, warn];
    }
    const letter = sealId.replace(/^pecet_/, '').charAt(0).toUpperCase();
    g.fillStyle(0x7a1f12, 1);
    g.fillCircle(x, y, 32);
    g.fillStyle(0x8f2a18, 1);
    g.fillCircle(x, y, 24);
    g.lineStyle(3, 0x5a1510, 1);
    g.strokeCircle(x, y, 28);
    const mono = this.add
      .text(x, y, letter, { fontFamily: FONTS.ui, fontSize: '30px', color: '#e8c49a' })
      .setOrigin(0.5);
    return [g, mono];
  }

  /** Vzorník platných pečetí — kartička v horním pruhu (kde býval časovač). */
  private drawSealChart(): void {
    const x0 = 1255;
    const y0 = 86;
    const seals: Array<[string, string]> = [
      ['K', 'konzistoř'],
      ['E', 'erár'],
      ['V', 'výbor'],
    ];
    const panel = this.add.rectangle(x0, y0, 625, 118, 0xe8dcc0).setOrigin(0, 0).setStrokeStyle(3, 0x8a7a55);
    const head = this.add.text(x0 + 16, y0 + 8, `${Content.ui('sealChart')} · ${Content.ui('sealChartNote')}`, {
      fontFamily: FONTS.doc,
      fontSize: '17px',
      color: '#7a1f12',
      fontStyle: 'bold',
      wordWrap: { width: 595 },
    });
    this.encounterLayer.add([panel, head]);
    seals.forEach(([letter, name], i) => {
      const sx = x0 + 60 + i * 200;
      const sy = y0 + 76;
      const g = this.add.graphics();
      g.fillStyle(0x7a1f12, 1);
      g.fillCircle(sx, sy, 24);
      g.lineStyle(2, 0x5a1510, 1);
      g.strokeCircle(sx, sy, 20);
      const mono = this.add
        .text(sx, sy, letter, { fontFamily: FONTS.ui, fontSize: '22px', color: '#e8c49a' })
        .setOrigin(0.5);
      const label = this.add
        .text(sx + 34, sy, name, { fontFamily: FONTS.doc, fontSize: '22px', color: '#4a4134' })
        .setOrigin(0, 0.5);
      this.encounterLayer.add([g, mono, label]);
    });
  }

  // ---------- provázek (minihra rozvázání) ----------

  /** Balík převázaný provázkem: obsah je skrytý, dokud hráč nepřetáhne uzel podél šňůry. */
  private buildWrapCover(x: number, y: number, w: number, h: number, titleStr: string): void {
    const cover = this.add.container(0, 0);
    const paper = this.add.rectangle(x, y, w, h, 0xe3d5b3).setOrigin(0, 0).setStrokeStyle(3, 0x8a7a55);
    const title = this.add.text(x + 20, y + 14, titleStr.toUpperCase(), {
      fontFamily: FONTS.ui,
      fontSize: '26px',
      color: '#7a6a45',
    });
    const hintText = this.add
      .text(x + w / 2, y + h - 28, Content.ui('wrapHint'), {
        fontFamily: FONTS.doc,
        fontSize: '20px',
        color: '#7a1f12',
      })
      .setOrigin(0.5);
    // provázek: kříž
    const g = this.add.graphics();
    const midY = y + h / 2;
    g.lineStyle(9, 0x8a5a2b, 1);
    g.lineBetween(x - 6, midY, x + w + 6, midY);
    g.lineBetween(x + w / 2, y - 6, x + w / 2, y + h + 6);
    g.lineStyle(3, 0x6a4420, 1);
    g.lineBetween(x - 6, midY + 4, x + w + 6, midY + 4);

    // uzel — tahací
    const knotX0 = x + 70;
    const knotEnd = x + w - 50;
    const knot = this.add.ellipse(knotX0, midY, 40, 30, 0x6a4420).setStrokeStyle(3, 0x4a2e14);
    const knotLoop = this.add.ellipse(knotX0 - 14, midY - 12, 24, 18, 0x8a5a2b).setStrokeStyle(2, 0x4a2e14);
    knot.setInteractive({ useHandCursor: true, draggable: true });

    cover.add([paper, title, g, hintText, knot, knotLoop]);
    this.encounterLayer.add(cover);
    this.encounterLayer.bringToTop(cover);

    knot.on('drag', (_p: Phaser.Input.Pointer, dragX: number) => {
      const nx = Phaser.Math.Clamp(dragX, knotX0, knotEnd);
      knot.x = nx;
      knotLoop.x = nx - 14;
      knotLoop.y = midY - 12 - (nx - knotX0) * 0.05; // smyčka se povytahuje
    });
    knot.on('dragend', () => {
      if (knot.x >= knotEnd - 12) {
        // rozvázáno!
        try {
          this.sound.play('sfx_paper', { volume: 0.9 });
        } catch {
          /* ticho nevadí */
        }
        this.tweens.add({
          targets: cover,
          alpha: 0,
          y: '-=14',
          duration: 260,
          ease: 'Cubic.easeOut',
          onComplete: () => cover.destroy(true),
        });
      } else {
        this.tweens.add({ targets: knot, x: knotX0, duration: 180, ease: 'Back.easeOut' });
        this.tweens.add({ targets: knotLoop, x: knotX0 - 14, y: midY - 12, duration: 180, ease: 'Back.easeOut' });
      }
    });
  }

  // ---------- rozhodnutí ----------

  private readonly CATEGORY_ORDER: NonNullable<Reason['category']>[] = [
    'formular', 'poplatek', 'papiry', 'pecet', 'vira', 'vystroj', 'kun', 'chybi', 'dekret',
  ];

  private reasonCategory(r: Reason): NonNullable<Reason['category']> {
    return r.category ?? 'vystroj';
  }

  private reasonParagraph(r: Reason): string {
    const rule = Content.all.rules.find((x) => x.id === r.ruleRef);
    return rule ? L(rule.cislo) : `§ ${Content.ui('freshDecree')}`;
  }

  /** Důvody do skříně: VŠECHNY dostupné (i výstrojní — ty se teď vybírají jen odsud). */
  private cabinetReasons(): Reason[] {
    return RuleEngine.availableReasons(GameState.day);
  }

  /** ZAMÍTNOUT → razítková skříň se zásuvkami (kategoriemi). */
  private openReasonPicker(): void {
    if (this.busy || !this.enc) return;
    this.overlayLayer.removeAll(true);
    const cx = GAME_WIDTH / 2;
    const reasons = this.cabinetReasons();
    // VŽDY ukaž všechny kategorie (zásuvky). Prázdné mají v závorce (0) a jsou
    // ztlumené — hráč tak vidí celou skříň a jak se plní vydáváním vyhlášek.
    const cats = [...this.CATEGORY_ORDER];

    const dim = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72).setInteractive();
    const panel = this.add.rectangle(cx, GAME_HEIGHT / 2, 1700, 920, 0x2a2016).setStrokeStyle(5, COLORS.uiAccent);
    const head = this.add
      .text(cx, 150, Content.ui('cabinetTitle'), { fontFamily: FONTS.ui, fontSize: '40px', color: '#d4a017' })
      .setOrigin(0.5);
    const sub = this.add
      .text(cx, 205, Content.ui('cabinetPick'), { fontFamily: FONTS.doc, fontSize: '26px', color: '#bfa978' })
      .setOrigin(0.5);
    this.overlayLayer.add([dim, panel, head, sub]);

    // zásuvky 4×N (vejde se všech 9 kategorií + případně Domluva)
    const perRow = 4;
    const dw = 380;
    const dh = 148;
    const gapX = 34;
    const gapY = 28;
    const totalW = perRow * dw + (perRow - 1) * gapX;
    const x0 = cx - totalW / 2;
    const y0 = 262;
    cats.forEach((cat, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const dx = x0 + col * (dw + gapX);
      const dy = y0 + row * (dh + gapY);
      const count = reasons.filter((r) => this.reasonCategory(r) === cat).length;
      this.overlayLayer.add(
        this.makeDrawer(dx, dy, dw, dh, Content.ui(`cat_${cat}`), count, () => this.showCabinetDrawer(cat), 0x4a3420, count === 0),
      );
    });

    // DOMLUVA — jen v socialistické éře (den 4) u rytíře se srpem a kladivem:
    // místo zamítnutí mu to rozmluvíš, přezbrojí se a kolo pokračuje
    if (this.canTalkOut()) {
      const i = cats.length;
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const dx = x0 + col * (dw + gapX);
      const dy = y0 + row * (dh + gapY);
      this.overlayLayer.add(this.makeDrawer(dx, dy, dw, dh, Content.ui('talkOut'), 1, () => this.rozmluvit(), 0x1d4020));
    }

    const cancel = makeButton(this, cx, GAME_HEIGHT - 120, Content.ui('cancel'), () => {
      this.overlayLayer.removeAll(true);
    }, { fontSize: 30 });
    this.overlayLayer.add(cancel);
  }

  /** Lze rytíři „rozmluvit" srp+kladivo? (socialistická éra) */
  private canTalkOut(): boolean {
    return GameState.day === 4 && !!this.enc?.data.knight.tags.includes('srp_kladivo');
  }

  /** Domluva: vynadáš mu za srp+kladivo, on se přezbrojí a týž rytíř pokračuje. */
  private rozmluvit(): void {
    if (!this.enc) return;
    this.overlayLayer.removeAll(true);
    const d = this.enc.data;
    // klon encounteru bez srp+kladivo (nemutujeme sdílený Content)
    const newEquip = d.knight.equipment
      .filter((e) => !/srp|kladiv/i.test(e))
      .concat('meč (115 cm)');
    const cloned = {
      ...d,
      knight: { ...d.knight, tags: d.knight.tags.filter((t) => t !== 'srp_kladivo'), equipment: newEquip },
      flaws: d.flaws.filter((f) => f.reasonId !== 'RZ_VYZBROJ'),
    };
    this.enc = { data: cloned, syntheticFlaws: this.enc.syntheticFlaws };

    // dialog: tvoje domluva → jeho vtipná odpověď → pokračuj
    this.showDialogue(Content.ui('talkScold'), Content.ui('talkReply'), () => {
      this.encounterLayer.removeAll(true);
      this.renderEncounter(this.enc!);
      this.updateHud();
      this.scheduleHeckle();
    });
  }

  /** Dvoubublinový dialog (tvoje věta → odpověď rytíře) s tlačítkem Pokračovat. */
  private showDialogue(mine: string, reply: string, after: () => void): void {
    this.busy = true;
    const cx = GAME_WIDTH / 2;
    const dim = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72).setInteractive();
    const panel = this.add.rectangle(cx, GAME_HEIGHT / 2, 1300, 560, COLORS.uiPanel).setStrokeStyle(4, COLORS.uiAccent);
    const youLbl = this.add.text(cx - 580, GAME_HEIGHT / 2 - 230, Content.ui('youClerk'), {
      fontFamily: FONTS.ui, fontSize: '26px', color: '#d4a017',
    });
    const youTx = this.add.text(cx - 580, GAME_HEIGHT / 2 - 190, mine, {
      fontFamily: FONTS.doc, fontSize: '30px', color: '#e8d9a8', wordWrap: { width: 1160 },
    });
    const kLbl = this.add.text(cx - 580, GAME_HEIGHT / 2 + 20, Content.ui('knight'), {
      fontFamily: FONTS.ui, fontSize: '26px', color: '#bfa978',
    });
    const kTx = this.add.text(cx - 580, GAME_HEIGHT / 2 + 60, reply, {
      fontFamily: FONTS.doc, fontSize: '30px', color: '#cfe4ee', wordWrap: { width: 1160 },
    });
    const btn = makeButton(this, cx, GAME_HEIGHT / 2 + 230, Content.ui('continue'), () => {
      dim.destroy(); panel.destroy(); youLbl.destroy(); youTx.destroy(); kLbl.destroy(); kTx.destroy(); btn.destroy();
      this.busy = false;
      after();
    }, { fontSize: 32 });
    this.overlayLayer.add([dim, panel, youLbl, youTx, kLbl, kTx, btn]);
  }

  /** Jedna zásuvka skříně (úchytka + štítek + počet razítek). */
  private makeDrawer(
    x: number, y: number, w: number, h: number, label: string, count: number, onClick: () => void,
    bodyColor = 0x4a3420, dimEmpty = false,
  ): Phaser.GameObjects.Container {
    const body = this.add.rectangle(0, 0, w, h, bodyColor).setStrokeStyle(4, 0x6b4a2a).setOrigin(0, 0);
    const face = this.add.rectangle(6, 6, w - 12, h - 12, 0x5a4226).setStrokeStyle(2, 0x3a2a16).setOrigin(0, 0);
    const handle = this.add.rectangle(w / 2, h - 28, 120, 22, 0x2a1c10).setStrokeStyle(3, 0xd4a017);
    const text = this.add.text(w / 2, 42, label, {
      fontFamily: FONTS.ui, fontSize: '26px', color: '#e8d9a8', align: 'center', wordWrap: { width: w - 54 },
    }).setOrigin(0.5);
    const badge = this.add.text(w - 22, 16, `(${count})`, { fontFamily: FONTS.doc, fontSize: '24px', color: '#d4a017' }).setOrigin(1, 0);
    const c = this.add.container(x, y, [body, face, handle, text, badge]);
    c.setSize(w, h);
    if (dimEmpty) { c.setAlpha(0.5); badge.setColor('#8a7a55'); } // prázdná zásuvka — ztlumená
    face.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { face.setFillStyle(0x6a5030); this.tweens.add({ targets: handle, y: h - 22, duration: 90 }); })
      .on('pointerout', () => { face.setFillStyle(0x5a4226); this.tweens.add({ targets: handle, y: h - 30, duration: 90 }); })
      .on('pointerdown', () => {
        try { this.sound.play('sfx_paper', { volume: 0.5 }); } catch { /* ok */ }
        onClick();
      });
    return c;
  }

  /** Otevřená zásuvka: konkrétní zamítací razítka, každé s § paragrafem. */
  private showCabinetDrawer(cat: NonNullable<Reason['category']>): void {
    this.overlayLayer.removeAll(true);
    const cx = GAME_WIDTH / 2;
    const reasons = this.cabinetReasons().filter((r) => this.reasonCategory(r) === cat);

    const dim = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72).setInteractive();
    const panel = this.add.rectangle(cx, GAME_HEIGHT / 2, 1700, 920, 0x2a2016).setStrokeStyle(5, COLORS.uiAccent);
    const head = this.add
      .text(cx, 150, `▸ ${Content.ui(`cat_${cat}`)}`, { fontFamily: FONTS.ui, fontSize: '40px', color: '#d4a017' })
      .setOrigin(0.5);
    this.overlayLayer.add([dim, panel, head]);

    // prázdná zásuvka — vysvětli, proč tu zatím nic není
    if (reasons.length === 0) {
      const note = this.add.text(cx, GAME_HEIGHT / 2 - 20, Content.ui('catEmpty'), {
        fontFamily: FONTS.doc, fontSize: '32px', color: '#bfa978', align: 'center', lineSpacing: 10, wordWrap: { width: 1300 },
      }).setOrigin(0.5);
      this.overlayLayer.add(note);
    }

    // karty razítek 2×N
    const perRow = reasons.length > 4 ? 2 : 1;
    const cw = perRow === 2 ? 760 : 1200;
    const ch = 140;
    const gapX = 50;
    const gapY = 26;
    const totalW = perRow * cw + (perRow - 1) * gapX;
    const x0 = cx - totalW / 2;
    const y0 = 230;
    reasons.forEach((r, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const dx = x0 + col * (cw + gapX);
      const dy = y0 + row * (ch + gapY);
      this.overlayLayer.add(this.makeStampCard(dx, dy, cw, ch, r));
    });

    const back = makeButton(this, cx - 220, GAME_HEIGHT - 120, Content.ui('cabinetBack'), () => this.openReasonPicker(), { fontSize: 28 });
    const cancel = makeButton(this, cx + 220, GAME_HEIGHT - 120, Content.ui('cancel'), () => {
      this.overlayLayer.removeAll(true);
    }, { fontSize: 28 });
    this.overlayLayer.add([back, cancel]);
  }

  /** Karta s konkrétním zamítacím razítkem: mini otisk + § paragraf + text důvodu. */
  private makeStampCard(x: number, y: number, w: number, h: number, r: Reason): Phaser.GameObjects.Container {
    const card = this.add.rectangle(0, 0, w, h, 0xf0e6c8).setStrokeStyle(3, 0x8a7a55).setOrigin(0, 0);
    // mini zamítací razítko vlevo
    const sg = this.add.graphics();
    sg.lineStyle(5, 0xa82810, 0.9);
    sg.strokeRect(24, 34, 150, 56);
    const stTxt = this.add
      .text(99, 62, Content.ui('stampRejected'), { fontFamily: FONTS.ui, fontSize: '22px', color: '#a82810' })
      .setOrigin(0.5)
      .setAngle(-6);
    const para = this.add.text(200, 24, this.reasonParagraph(r), {
      fontFamily: FONTS.doc, fontSize: '23px', color: '#7a1f12', fontStyle: 'bold',
    });
    const lbl = this.add.text(200, 58, L(r.label), {
      fontFamily: FONTS.doc, fontSize: '25px', color: '#1c1a16', wordWrap: { width: w - 220 },
    });
    const c = this.add.container(x, y, [card, sg, stTxt, para, lbl]);
    c.setSize(w, h);
    card.setInteractive({ useHandCursor: true })
      .on('pointerover', () => card.setFillStyle(0xfff4d8))
      .on('pointerout', () => card.setFillStyle(0xf0e6c8))
      .on('pointerdown', () => this.resolveReject(r));
    return c;
  }

  /** Výběr důvodu zavře nabídku a pošle hráče razítkovat — verdikt až po otisku. */
  private resolveReject(reason: Reason): void {
    if (!this.enc) return;
    this.overlayLayer.removeAll(true);
    this.pendingReason = reason;
    this.enterStampMode('reject');
  }

  private confirmApprove(): void {
    if (this.busy || !this.enc) return;
    this.overlayLayer.removeAll(true);
    const cx = GAME_WIDTH / 2;
    const dim = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setInteractive();
    const panel = this.add.rectangle(cx, GAME_HEIGHT / 2, 1000, 360, COLORS.uiPanel).setStrokeStyle(4, COLORS.danger);
    const head = this.add
      .text(cx, GAME_HEIGHT / 2 - 90, Content.ui('approveConfirm'), {
        fontFamily: FONTS.ui,
        fontSize: '38px',
        color: '#ff6b5e',
        wordWrap: { width: 900 },
        align: 'center',
      })
      .setOrigin(0.5);
    const yes = makeButton(this, cx - 200, GAME_HEIGHT / 2 + 80, Content.ui('yes'), () => {
      this.overlayLayer.removeAll(true);
      this.enterStampMode('approve');
    }, { fontSize: 36, color: 0x5a1a10 });
    const no = makeButton(this, cx + 200, GAME_HEIGHT / 2 + 80, Content.ui('no'), () => {
      this.overlayLayer.removeAll(true);
    }, { fontSize: 36 });
    this.overlayLayer.add([dim, panel, head, yes, no]);
  }

  private openDecreePicker(): void {
    if (this.busy || !this.enc) return;
    this.overlayLayer.removeAll(true);
    const decrees = RuleEngine.applicableDecrees(this.enc);
    const cx = GAME_WIDTH / 2;

    // nejdřív tlačítka (víceřádková — výšku známe až po vytvoření), pak panel pod ně
    const buttons: Phaser.GameObjects.Container[] = [];
    let totalH = 0;
    for (const d of decrees) {
      const btn = makeButton(
        this,
        cx,
        0,
        L(d.text),
        () => {
          if (!this.enc) return;
          RuleEngine.issueDecree(this.enc, d);
          this.overlayLayer.removeAll(true);
          this.updateHud();
          this.showOutcome(`⚖ ${Content.ui('decreeIssued')}\n${L(d.text)}`, 0xd4a017, () => {
            // encounter pokračuje — hráč teď může zamítnout s novým důvodem
          });
        },
        { fontSize: 26, width: 1160, wrap: 1080, font: FONTS.doc },
      );
      buttons.push(btn);
      totalH += btn.height + 18;
    }

    const panelH = Math.min(185 + totalH + 85, GAME_HEIGHT - 60);
    const top = GAME_HEIGHT / 2 - panelH / 2;
    const dim = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setInteractive();
    const panel = this.add.rectangle(cx, GAME_HEIGHT / 2, 1280, panelH, COLORS.uiPanel).setStrokeStyle(4, COLORS.uiAccent);
    const head = this.add
      .text(cx, top + 60, Content.ui('pickDecree'), {
        fontFamily: FONTS.ui,
        fontSize: '40px',
        color: '#e8d9a8',
      })
      .setOrigin(0.5);
    this.overlayLayer.add([dim, panel, head]);
    let by = top + 125;
    for (const btn of buttons) {
      btn.setY(by + btn.height / 2);
      this.overlayLayer.add(btn);
      by += btn.height + 18;
    }
    const cancel = makeButton(this, cx, top + panelH - 55, Content.ui('cancel'), () => {
      this.overlayLayer.removeAll(true);
    }, { fontSize: 28 });
    this.overlayLayer.add(cancel);
  }

  // ---------- overlaye ----------

  /** Krátké oznámení výsledku, pak callback. */
  private showOutcome(msg: string, tint: number, after: () => void): void {
    this.busy = true;
    const cx = GAME_WIDTH / 2;
    const dim = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45).setInteractive();
    const panel = this.add.rectangle(cx, GAME_HEIGHT / 2, 1100, 300, COLORS.uiPanel).setStrokeStyle(5, tint);
    const text = this.add
      .text(cx, GAME_HEIGHT / 2, msg, {
        fontFamily: FONTS.doc,
        fontSize: '34px',
        color: '#e8d9a8',
        wordWrap: { width: 1000 },
        align: 'center',
      })
      .setOrigin(0.5);
    this.overlayLayer.add([dim, panel, text]);
    this.time.delayedCall(1800, () => {
      this.overlayLayer.removeAll(true);
      this.busy = false;
      after();
    });
  }

  /** Facka: screen shake + infografická karta, čeká na klik. */
  private showCutaway(msg: string, after: () => void): void {
    this.busy = true;
    try {
      this.sound.play('sfx_slap', { volume: 0.9 });
    } catch {
      /* zvuk není kritický */
    }
    this.cameras.main.shake(250, 0.012);
    const cx = GAME_WIDTH / 2;
    const pool = Content.all.infographics.filter((i) => i.kind === 'facka');
    const info = pool.length > 0 ? L(pool[Math.floor(Math.random() * pool.length)].text) : '';
    const dim = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setInteractive();
    const panel = this.add.rectangle(cx, GAME_HEIGHT / 2, 1200, 520, COLORS.uiPanel).setStrokeStyle(5, COLORS.danger);
    const slap = this.add
      .text(cx, GAME_HEIGHT / 2 - 170, '✊ FACKA! ✊', { fontFamily: FONTS.ui, fontSize: '64px', color: '#ff6b5e' })
      .setOrigin(0.5);
    const text = this.add
      .text(cx, GAME_HEIGHT / 2 - 60, msg, {
        fontFamily: FONTS.doc,
        fontSize: '34px',
        color: '#e8d9a8',
        wordWrap: { width: 1080 },
        align: 'center',
      })
      .setOrigin(0.5, 0);
    const infoText = this.add
      .text(cx, GAME_HEIGHT / 2 + 90, info ? `📜 ${info}` : '', {
        fontFamily: FONTS.doc,
        fontSize: '28px',
        color: '#bfa978',
        wordWrap: { width: 1080 },
        align: 'center',
      })
      .setOrigin(0.5, 0);
    const btn = makeButton(this, cx, GAME_HEIGHT / 2 + 210, Content.ui('continue'), () => {
      this.overlayLayer.removeAll(true);
      this.busy = false;
      after();
    }, { fontSize: 32 });
    this.overlayLayer.add([dim, panel, slap, text, infoText, btn]);
  }
}
