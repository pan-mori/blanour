import Phaser from 'phaser';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH, TUNING } from '../config';
import type { Decree, Reason, Rule } from '../content/schemas';
import { Content, L } from '../systems/Content';
import { EncounterManager } from '../systems/EncounterManager';
import { GameState } from '../systems/GameState';
import { Music } from '../systems/Music';
import type { ActiveEncounter } from '../systems/RuleEngine';
import { RuleEngine } from '../systems/RuleEngine';
import type { SealLetter, StampDecision, StampQuality, StampResult, StampTarget } from '../systems/StampSystem';
import { StampSystem } from '../systems/StampSystem';
import { drawOfficeBackdrop, LIBRARY_RECT } from '../ui/Backdrop';
import { makeButton, makeMusicToggle, crispRotatedText } from '../ui/helpers';
import { ensureItemTexture, parseEquipment } from '../ui/ItemIcons';
import { ensureKnightTexture } from '../ui/KnightPortrait';

/**
 * Jádro hry: přepážka. M1 verze - dokumenty jako panely, rozhodnutí tlačítky.
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
  // odevzdání/archivace: reference na žádost, otisky, portrét rytíře (drop-zóna)
  private primaryDoc: Phaser.GameObjects.Container | null = null;
  private primaryDocWH = { w: 0, h: 0 };
  private primaryDocBaseAngle = 0; // klidový náklon žádosti - pokřik ji z něj vychýlí max o 5°
  private vaclavReturns = 0; // finále: kolikrát už kníže vrátil dokument (potřeba 2)
  private vaclavSpots: { x: number; y: number; angle: number }[] = []; // razítkové kroužky
  private vaclavSpotIdx = 0; // který kroužek je právě na řadě
  private knightVisuals: Phaser.GameObjects.GameObject[] = [];
  private knightDropRect: Phaser.Geom.Rectangle | null = null;
  private handoverHint?: Phaser.GameObjects.Text;
  private dropGlow?: Phaser.GameObjects.Rectangle;
  // druhopis (archivace): kopie žádosti + její otisky + geometrie pro razítko
  private copyDoc?: Phaser.GameObjects.Container;
  private copyWH = { w: 320, h: 430 };
  private copyTarget?: StampTarget;
  private copyBodyText?: Phaser.GameObjects.Text;
  private copyParagraph = '';
  private ambientDark?: Phaser.GameObjects.Container; // zhasnutá svíčka + ztmavení (vyhláška o světle)
  private readonly LIGHT_DECREES = ['V_POCHODEN']; // vyhlášky o světle/ohni → tma
  private readonly NOISE_DECREES = ['V_POLNICE']; // vyhlášky o decibelech → ticho

  constructor() {
    super('Office');
  }

  /** Dopady vlastních vyhlášek na atmosféru: zákaz ohně → tma + zhasnutá svíčka;
   *  limit decibelů → poloviční hudba. Platí, dokud je dekret vydán (do konce runu). */
  private applyAmbientEffects(): void {
    const dark = this.LIGHT_DECREES.some((d) => GameState.issuedDecrees.includes(d));
    const quiet = this.NOISE_DECREES.some((d) => GameState.issuedDecrees.includes(d));

    this.ambientDark?.destroy();
    this.ambientDark = undefined;
    if (dark) {
      const ccx = GAME_WIDTH - 150; // svíčka z Backdropu
      const ccy = 150;
      const cover = this.add.graphics();
      cover.fillStyle(0x241a10, 1); cover.fillRect(ccx - 12, ccy - 30, 30, 36); // přes plamen
      cover.fillStyle(0x3a3a3a, 0.5); cover.fillRect(ccx + 1, ccy - 28, 3, 14); // dým
      const shade = this.add.rectangle(GAME_WIDTH / 2, (80 + GAME_HEIGHT) / 2, GAME_WIDTH, GAME_HEIGHT - 80, 0x000000, 0.4);
      this.ambientDark = this.add.container(0, 0, [cover, shade]).setDepth(5);
    }
    try { Music.setVolumeFactor(quiet ? 0.5 : 1); } catch { /* ok */ }
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
    // křížek vpravo nahoře - ukončit run a vrátit se do menu (s potvrzením)
    makeButton(this, GAME_WIDTH - 56, 40, '✕', () => this.confirmQuitRun(), { fontSize: 34, width: 72, color: 0x5a1a10 }).setDepth(10);
    // ikonka hudby (zap/vyp) — vlevo od křížku, přeškrtne se při ztlumení
    makeMusicToggle(this, GAME_WIDTH - 140, 40, 72).setDepth(10);

    // CHEATY (chord, záleží na pořadí stisku): drž W a přidej R = o rytíře dopředu
    // (aktuální ber jako správně vyřízený) · drž R a přidej W = o rytíře zpět.
    // Cheat se spustí jen když je druhá klávesa už držená.
    const kbd = this.input.keyboard;
    if (kbd) {
      const wKey = kbd.addKey('W');
      const rKey = kbd.addKey('R');
      kbd.on('keydown-R', () => { if (wKey.isDown) this.cheatNextKnight(); });
      kbd.on('keydown-W', () => { if (rKey.isDown) this.cheatPrevKnight(); });
    }

    // velké, viditelné tlačítko „Platné vyhlášky" vpravo → overlay se všemi vyhláškami
    const rbW = 128;
    const rbH = 162;
    const panel = this.add.rectangle(0, 0, rbW, rbH, 0xe6dcc0).setStrokeStyle(4, COLORS.uiAccent);
    const sym = this.add.text(0, -48, '§', { fontFamily: FONTS.ui, fontSize: '54px', color: '#7a1f12' }).setOrigin(0.5);
    const lbl = this.add
      .text(0, 20, Content.ui('helpRules'), { fontFamily: FONTS.ui, fontSize: '22px', color: '#4a4134', align: 'center', wordWrap: { width: rbW - 16 } })
      .setOrigin(0.5);
    const cnt = this.add.text(0, 62, `${GameState.enactedRules.size}×`, { fontFamily: FONTS.doc, fontSize: '22px', color: '#7a1f12' }).setOrigin(0.5);
    const rulesBtn = this.add.container(1852, 372, [panel, sym, lbl, cnt]).setDepth(10);
    rulesBtn.setSize(rbW, rbH);
    panel.setInteractive({ useHandCursor: true })
      .on('pointerover', () => panel.setFillStyle(0xfff0cf))
      .on('pointerout', () => panel.setFillStyle(0xe6dcc0))
      .on('pointerdown', () => this.openRules());
    this.tweens.add({ targets: rulesBtn, scale: 1.04, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.encounterLayer = this.add.container(0, 0);
    this.overlayLayer = this.add.container(0, 0).setDepth(100);

    // debug: ?enc=ENC_031 vynutí konkrétní encounter (QA obsahu)
    const dbgEnc = new URLSearchParams(location.search).get('enc');
    if (!dbgEnc || !EncounterManager.buildSingle(dbgEnc)) {
      EncounterManager.buildDay(GameState.day, 4);
    }
    this.nextKnight();

    // debug: ?demo=auto — sám dojede k zamítnutí + rovnému razítku (QA odevzdání/archivace)
    if (new URLSearchParams(location.search).get('demo') === 'auto') {
      this.time.delayedCall(900, () => this.runDemoReject());
    }
  }

  /** Křížek vpravo nahoře: dotaz na ukončení runu → ano = zpět do hlavního menu. */
  private confirmQuitRun(): void {
    if (this.busy) return;
    this.overlayLayer.removeAll(true);
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const dim = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setInteractive();
    const panel = this.add.rectangle(cx, cy, 1000, 320, COLORS.uiPanel).setStrokeStyle(4, COLORS.danger);
    const head = this.add
      .text(cx, cy - 80, Content.ui('quitConfirm'), {
        fontFamily: FONTS.ui, fontSize: '38px', color: '#ff6b5e', wordWrap: { width: 900 }, align: 'center',
      })
      .setOrigin(0.5);
    const yes = makeButton(this, cx - 200, cy + 70, Content.ui('quitYes'), () => {
      this.scene.start('Menu');
    }, { fontSize: 34, color: 0x5a1a10 });
    const no = makeButton(this, cx + 200, cy + 70, Content.ui('quitNo'), () => {
      this.overlayLayer.removeAll(true);
    }, { fontSize: 34 });
    this.overlayLayer.add([dim, panel, head, yes, no]);
  }

  /** CHEAT (W→R): o jednoho rytíře dopředu — aktuálního ber jako správně
   *  vyřízeného a přejdi na dalšího (nebo na konec dne, když byl poslední). */
  private cheatNextKnight(): void {
    if (this.enc) GameState.recordReject();
    this.nextKnight();
  }

  /** CHEAT (R→W): o jednoho rytíře zpět. */
  private cheatPrevKnight(): void {
    this.nextKnight(true);
  }

  /** Debug: zamítne prvním platným důvodem a položí rovný otisk → spadne do odevzdání. */
  private runDemoReject(): void {
    if (!this.enc) return;
    const flaw = this.enc.data.flaws[0];
    const reason = Content.all.reasons.find((r) => r.id === flaw?.reasonId) ?? this.cabinetReasons()[0];
    if (!reason) return;
    this.pendingReason = reason;
    this.enterStampMode('reject');
    this.time.delayedCall(300, () => this.stampSys?.debugApply(2, 600, true));
  }

  // ---------- tok encounterů ----------

  private nextKnight(back = false): void {
    this.busy = false;
    this.vaclavReturns = 0;
    this.vaclavSpots = [];
    this.vaclavSpotIdx = 0;
    this.heckleBubble?.destroy();
    this.heckleBubble = undefined;
    this.inspectPopup?.destroy();
    this.inspectPopup = undefined;
    this.stampSys?.teardown();
    this.stampSys = null;
    this.pendingReason = null;
    this.stampTarget = null;
    this.actionButtons = [];
    this.primaryDoc = null;
    this.knightVisuals = [];
    this.knightDropRect = null;
    this.handoverHint?.destroy();
    this.handoverHint = undefined;
    this.dropGlow?.destroy();
    this.dropGlow = undefined;
    this.overlayLayer.removeAll(true);
    this.encounterLayer.removeAll(true);
    // back (cheat): o rytíře zpět; když nejde (první rytíř), zůstaň na aktuálním
    this.enc = back ? (EncounterManager.prev() ?? EncounterManager.current) : EncounterManager.next();
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
    this.applyAmbientEffects(); // tma/ticho dle dříve vydaných vyhlášek

    // příchod rytíře — krátký slide-in
    this.encounterLayer.setAlpha(0);
    this.encounterLayer.y = 36;
    this.tweens.add({ targets: this.encounterLayer, alpha: 1, y: 0, duration: 240, ease: 'Cubic.easeOut' });

    this.scheduleHeckle();

    // u prvního rytíře dne ukaž hráči aktuální úřední podmínky (kolek + formulář
    // se mění každé období) — „úvodní vyhlášky". Při autotestu/demu přeskoč.
    const dbgDrive = /[?&](auto|demo)=/.test(location.search);
    if (EncounterManager.index === 1 && !dbgDrive) this.showActiveRulesIntro();
  }

  /** Úvodní přehled úředních podmínek dne (kolek + formulář) u prvního rytíře. */
  private showActiveRulesIntro(): void {
    this.busy = true;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const r01 = Content.all.rules.find((r) => r.id === 'R01');
    const r02 = Content.all.rules.find((r) => r.id === 'R02');
    const dim = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72).setInteractive();
    const panel = this.add.rectangle(cx, cy, 1200, 460, COLORS.uiPanel).setStrokeStyle(5, COLORS.uiAccent);
    const title = this.add
      .text(cx, cy - 170, Content.ui('introRulesTitle'), { fontFamily: FONTS.title, fontSize: '52px', color: '#d4a017' })
      .setOrigin(0.5);
    const body = [r01, r02]
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => `§ ${L(r.cislo)}\n${GameState.fillVars(L(r.text))}`)
      .join('\n\n');
    const txt = this.add
      .text(cx, cy - 90, body, {
        fontFamily: FONTS.doc, fontSize: '30px', color: '#e8d9a8', align: 'center', wordWrap: { width: 1080 }, lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    dim.once('pointerdown', () => {
      this.overlayLayer.removeAll(true);
      this.busy = false;
    });
    this.overlayLayer.add([dim, panel, title, txt]);
  }

  private updateHud(): void {
    const era = Content.era(GameState.day);
    const hearts = '♥'.repeat(GameState.lives) + '♡'.repeat(Math.max(0, TUNING.lives - GameState.lives));
    this.hud.setText(
      `${Content.ui('day')} ${GameState.day}/5 · L.P. ${era.year}   |   ` +
        `${Content.ui('knight')} ${EncounterManager.index}/${EncounterManager.total}   |   ` +
        `${hearts}`,
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
    // rozzlobený rytíř bouchne do stolu → žádost sebou trhne (stejně jako razítko),
    // ale jen o kousek — max 5° od klidového náklonu. Při razítkování ne: to by
    // rozhodilo zacílení otisku (tam už sebou škube samotné razítko přes nudge()).
    if (this.primaryDoc && !this.stampSys?.isActive) {
      const kick = Phaser.Math.FloatBetween(3, 5) * (Math.random() < 0.5 ? -1 : 1);
      const target = Phaser.Math.Clamp(
        this.primaryDoc.angle + kick,
        this.primaryDocBaseAngle - 5,
        this.primaryDocBaseAngle + 5,
      );
      this.tweens.add({ targets: this.primaryDoc, angle: target, duration: 220, ease: 'Bounce.easeOut' });
    }
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

    // finále: u sv. Václava zaruč tři dostupné vyhlášky (kopytový podpis, chybějící
    // příloha, nekonvertovaný výtisk) — kníže dvě z nich přebije autoritou, třetí už ne
    if (enc.data.id === 'ENC_008') { GameState.enactRule('R33'); GameState.enactRule('R34'); GameState.enactRule('R35'); }

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
    // portrét rytíře = drop-zóna pro odevzdání žádosti; vizuály odejdou spolu s žádostí
    this.knightVisuals = [portrait, face, name, tail, bubble, intro];
    this.knightDropRect = new Phaser.Geom.Rectangle(px - 210, py - 240, 420, 500);

    // dokumenty: žádost = velký nakloněný papír s kroužkem pro pečeť, přílohy vpravo
    this.stampTarget = null;
    const docs = enc.data.documents;
    if (docs.length > 0) this.renderPrimaryDoc(docs[0]);
    let sy = 250;
    for (let i = 1; i < docs.length; i++) {
      sy = this.renderSecondaryDoc(docs[i], sy) + 24;
    }

    // vzorník pečetí se zobrazí až s vyhláškou o pečetění (R27)
    if (GameState.enactedRules.has('R27')) this.drawSealChart();

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

    // šuplík je dostupný, když je co zahrát: zbývá rozpočet na dekret NEBO čeká
    // nějaká zvolená vyhláška z večerního úřadování (musí se aktivně uvést v platnost)
    if (GameState.decreesLeft > 0 || GameState.pendingRules.length > 0) {
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
    const face = this.add.rectangle(0, -14, w - 14, h - 32, 0x5a4226).setStrokeStyle(2, 0x3a2a16);
    // úchytka až dole, pod nápisem — ať se text netluče s rámečkem šuplíku
    const handle = this.add.rectangle(0, 30, 110, 16, 0x2a1c10).setStrokeStyle(3, 0xd4a017);
    // malý obrázek: útržek vyhlášky s linkami a mini pečetí + § znak
    const para = this.add.text(-w / 2 + 28, -16, '§', { fontFamily: FONTS.ui, fontSize: '42px', color: '#d4a017' }).setOrigin(0.5);
    const ig = this.add.graphics();
    ig.fillStyle(0xe8dcc0, 1); ig.fillRect(-w / 2 + 48, -32, 30, 38);
    ig.lineStyle(2, 0x8a7a55, 1);
    for (let i = 0; i < 3; i++) ig.lineBetween(-w / 2 + 53, -24 + i * 8, -w / 2 + 73, -24 + i * 8);
    ig.fillStyle(0xa82810, 1); ig.fillCircle(-w / 2 + 70, 2, 6); // mini pečeť
    const txt = this.add.text(26, -16, Content.ui('drawerDecrees'), {
      fontFamily: FONTS.ui, fontSize: '22px', color: '#e8d9a8', align: 'center', wordWrap: { width: w - 100 },
    }).setOrigin(0.5);
    // (bez čísla na šuplíku — kolik zbývá vydání je v HUD „Vyhlášky k vydání", ať to nemate)
    const c = this.add.container(x, y, [body, face, handle, para, ig, txt]);
    c.setSize(w, h);
    face.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { face.setFillStyle(0x6a5030); this.tweens.add({ targets: handle, y: 36, duration: 90 }); })
      .on('pointerout', () => { face.setFillStyle(0x5a4226); this.tweens.add({ targets: handle, y: 30, duration: 90 }); })
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
    // #4 ZPACKANÉ RAZÍTKO: otisk nesplnil podmínky (mimo kroužek / křivě / bledé / suché) = facka
    if (result.quality !== 'crisp') {
      this.pendingReason = null;
      if (this.isVaclavFinale()) { this.vaclavFail(this.qualityWhy(result.quality)); return; }
      const t = GameState.loseLife();
      this.updateHud();
      this.showCutaway(Content.ui('botchedStamp'), this.qualityWhy(result.quality), () => {
        if (t === 'ending:beaten') this.scene.start('Ending');
        else this.nextKnight();
      });
      return;
    }
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
      // FINÁLE: správné zamítnutí knížete — nejdřív ti dokument jednou vrátí,
      // pak (po druhém, voskem stvrzeném razítku) teprve podlehne
      if (this.isVaclavFinale()) {
        if (this.vaclavReturns < 2) { this.vaclavReturnsDocument(reason); return; }
        this.vaclavDefeated(); return;
      }
      // legendární razítko se SPOTŘEBUJE (univerzální — jinak by trivializovalo hru);
      // běžné razítko ZŮSTÁVÁ v sadě a hráč ho může použít znovu (buduje si sadu nástrojů)
      const legendary = RuleEngine.isLegendary(reason.id);
      const msg = legendary
        ? `⭐ ${Content.ui('legendaryUsed')}`
        : `✓ ${this.enc.data.outcomes?.rejectOk ? L(this.enc.data.outcomes.rejectOk) : Content.ui('rejectOkDefault')}\n(${L(verdict.flaw!.hint)})`;
      const tint = legendary ? 0xd4a017 : 0x2f7d32;
      // zápis do stavu + výsledkový box AŽ po fyzickém odevzdání (a archivaci)
      const finalize = (): void => {
        GameState.recordReject();
        if (legendary) GameState.useReason(reason.id);
        EncounterManager.pruneUnsolvable(GameState.day);
        // po odkliknutí info-boxu rovnou další rytíř (žádné extra tlačítko)
        this.showInfoBox(msg, tint, () => this.nextKnight());
      };
      const imprints = this.stampSys?.getImprints() ?? [];
      if (this.archiveActive()) this.beginArchiveFlow(imprints, reason, finalize);
      else this.beginHandover(imprints, finalize);
    } else {
      // facka VŽDY s vysvětlením, proč to bylo špatně
      const why = RuleEngine.rejectableNow(this.enc.data, GameState.day)
        ? `${Content.ui('whyWrongReason')} „${L(reason.label)}"`
        : Content.ui('whyClean');
      if (this.isVaclavFinale()) { this.vaclavFail(why); return; }
      const t = GameState.loseLife();
      this.updateHud();
      const msg = this.enc.data.outcomes?.rejectBad
        ? L(this.enc.data.outcomes.rejectBad)
        : Content.ui('rejectBadDefault');
      this.showCutaway(msg, why, () => {
        if (t === 'ending:beaten') this.scene.start('Ending');
        else this.nextKnight();
      });
    }
  }

  // ---------- FINÁLE: sv. Václav ----------

  /** Je na přepážce finálový boss (sv. Václav)? */
  private isVaclavFinale(): boolean {
    return this.enc?.data.id === 'ENC_008';
  }

  /** Dokreslí další razítkový kroužek (přerušovaný + zářez + popisek) do žádosti,
   *  v lokálních souřadnicích kontejneru. Použito při vrácení dokumentu knížetem. */
  private addStampSpotToDoc(lx: number, ly: number, angle: number): void {
    if (!this.primaryDoc) return;
    const g = this.add.graphics();
    g.lineStyle(3, 0x9a8a60, 0.95);
    for (let a = 0; a < 360; a += 30) {
      g.beginPath();
      g.arc(lx, ly, 40, Phaser.Math.DegToRad(a), Phaser.Math.DegToRad(a + 16));
      g.strokePath();
    }
    const rad = Phaser.Math.DegToRad(angle - 90);
    g.lineStyle(5, 0x9a8a60, 1);
    g.lineBetween(lx + Math.cos(rad) * 40, ly + Math.sin(rad) * 40, lx + Math.cos(rad) * 56, ly + Math.sin(rad) * 56);
    const ghost = this.add.text(lx, ly, '⊛', { fontFamily: FONTS.ui, fontSize: '30px', color: '#9a8a60' }).setOrigin(0.5).setAngle(angle).setAlpha(0.85);
    const lbl = this.add.text(lx, ly + 58, Content.ui('stampSlot'), { fontFamily: FONTS.doc, fontSize: '15px', color: '#9a8a60' }).setOrigin(0.5);
    this.primaryDoc.add([g, ghost, lbl]);
  }

  /** Kníže ti dokument jednou vrátí a svou autoritou přebije tenhle důvod zamítnutí
   *  (spotřebuje se). Pak musíš na žádosti najít JINOU chybu, na kterou už autorita
   *  neplatí. */
  private vaclavReturnsDocument(reason: Reason): void {
    this.vaclavReturns++;
    this.busy = true;
    GameState.useReason(reason.id); // kníže přebil tenhle důvod autoritou → už ho nelze použít
    this.stampSys?.teardown();
    this.stampSys = null;
    // další razítko půjde na JINÉ místo formuláře — posuň cíl na další kroužek
    const next = this.vaclavSpots[Math.min(this.vaclavSpotIdx + 1, this.vaclavSpots.length - 1)];
    if (next && this.stampTarget) {
      this.vaclavSpotIdx = Math.min(this.vaclavSpotIdx + 1, this.vaclavSpots.length - 1);
      this.addStampSpotToDoc(next.x - this.primaryDocWH.w / 2, next.y - this.primaryDocWH.h / 2, next.angle);
      this.stampTarget = { ...this.stampTarget, circleLocal: { x: next.x, y: next.y }, circleAngleDeg: next.angle };
    }
    try { this.sound.play('sfx_slap', { volume: 0.5 }); } catch { /* ok */ }
    this.cameras.main.shake(260, 0.010);
    // červené protirazítko „VRÁCENO" přes žádost
    if (this.primaryDoc) {
      const box = this.add.rectangle(0, -10, 320, 96, 0x000000, 0).setStrokeStyle(9, 0xa82810);
      const t = this.add.text(0, -10, Content.ui('vaclavReturnStamp'), { fontFamily: FONTS.ui, fontSize: '50px', color: '#a82810' }).setOrigin(0.5);
      const stamp = this.add.container(0, 0, [box, t]).setAngle(-12).setScale(3).setAlpha(0);
      this.primaryDoc.add(stamp);
      this.tweens.add({ targets: stamp, scale: 1, alpha: 0.92, duration: 200, ease: 'Back.easeOut' });
      this.tweens.add({ targets: this.primaryDoc, y: this.primaryDoc.y - 24, duration: 90, yoyo: true, repeat: 2 });
    }
    // bublina knížete „Synu. Tady úřaduju já."
    const bt = this.add.text(0, 0, `„${Content.ui('vaclavReturnBubble')}"`, {
      fontFamily: FONTS.doc, fontSize: '28px', color: '#5a1a10', fontStyle: 'bold', wordWrap: { width: 420 },
    });
    const bbg = this.add.rectangle(-18, -14, bt.width + 36, bt.height + 28, 0xf3d9c4).setStrokeStyle(3, 0xa8552a).setOrigin(0, 0);
    const bubble = this.add.container(540, 300, [bbg, bt]).setDepth(55);
    this.encounterLayer.add(bubble);
    this.time.delayedCall(1500, () => {
      bubble.destroy();
      this.showInfoBox(`✋ ${Content.ui('vaclavReturnMsg')}`, 0xa82810, () => {
        // zpátky k rozhodování — hráč musí najít JINOU chybu (ten důvod je spotřebovaný)
        this.busy = false;
        this.pendingReason = null;
        for (const b of this.actionButtons) b.setVisible(true);
      });
    });
  }

  /** Druhé razítko drželo — kníže podlehne, konec „Ještě není tak zle" (přežil jsi). */
  private vaclavDefeated(): void {
    this.stampSys?.teardown();
    this.stampSys = null;
    GameState.recordReject();
    this.showInfoBox(`✓ ${Content.ui('vaclavVictory')}`, 0x2f7d32, () => this.nextKnight());
  }

  /** Chyba na knížete = facka; pokud přežiješ, postavíš se mu znovu (ne další rytíř). */
  private vaclavFail(why: string): void {
    const t = GameState.loseLife();
    this.updateHud();
    this.showCutaway(Content.ui('vaclavFailMsg'), why, () => {
      if (t === 'ending:beaten') this.scene.start('Ending');
      else this.reshowVaclav();
    });
  }

  /** Znovu postav finálového rytíře (bez posunu fronty) — čerstvý pokus. */
  private reshowVaclav(): void {
    this.vaclavReturns = 0;
    this.vaclavSpots = [];
    this.vaclavSpotIdx = 0;
    this.busy = false;
    this.stampSys?.teardown();
    this.stampSys = null;
    this.pendingReason = null;
    this.stampTarget = null;
    this.actionButtons = [];
    this.primaryDoc = null;
    this.knightVisuals = [];
    this.knightDropRect = null;
    this.heckleBubble?.destroy();
    this.heckleBubble = undefined;
    this.inspectPopup?.destroy();
    this.inspectPopup = undefined;
    this.overlayLayer.removeAll(true);
    this.encounterLayer.removeAll(true);
    if (!this.enc) { this.scene.start('DayEnd'); return; }
    this.renderEncounter(this.enc);
    this.updateHud();
    this.applyAmbientEffects();
    this.scheduleHeckle();
  }

  /** Vysvětlení facky za zpackané razítko podle kvality otisku. */
  private qualityWhy(q: StampQuality): string {
    const m: Record<string, string> = {
      misplaced: Content.ui('stampMisplaced'),
      crooked: Content.ui('stampCrooked'),
      faded: Content.ui('stampFaded'),
      smudged: Content.ui('stampSmudged'),
      dry: Content.ui('stampDry'),
    };
    return `${Content.ui('whyBotched')} ${m[q] ?? ''}`;
  }

  // ---------- odevzdání (drag na rytíře) + archivace druhopisu ----------

  /** Spodní nápověda k aktuálnímu kroku odevzdání/archivace. */
  private setStepHint(text: string): void {
    this.handoverHint?.destroy();
    this.handoverHint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 38, text, {
        fontFamily: FONTS.doc, fontSize: '28px', color: '#d4a017', fontStyle: 'bold',
        align: 'center', wordWrap: { width: 1500 },
      })
      .setOrigin(0.5).setDepth(70);
  }

  /**
   * Přetažení skupiny (dokument + jeho otisky) do cílové zóny. Pohyb po deltě,
   * ať otisky drží s papírem. Mimo zónu = návrat zpět; v zóně = onDrop().
   */
  private dragGroupToZone(opts: {
    doc: Phaser.GameObjects.Container;
    extras: Phaser.GameObjects.Container[];
    w: number; h: number;
    zone: Phaser.Geom.Rectangle;
    hintKey: string;
    onDrop: () => void;
  }): void {
    this.busy = true;
    const { doc, extras, zone } = opts;
    // výchozí pozice pro případný návrat (otisky drží s papírem přes deltu)
    const homeDoc = { x: doc.x, y: doc.y };
    const homeExtras = extras.map((e) => ({ e, x: e.x, y: e.y }));
    const hit = this.add
      .rectangle(doc.x, doc.y, Math.max(opts.w, 160), Math.max(opts.h, 200), 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(hit);
    this.encounterLayer.add(hit);

    this.setStepHint(Content.ui(opts.hintKey));
    this.dropGlow?.destroy();
    this.dropGlow = this.add
      .rectangle(zone.centerX, zone.centerY, zone.width, zone.height)
      .setStrokeStyle(5, COLORS.uiAccent, 0.9).setDepth(6);
    this.tweens.add({ targets: this.dropGlow, alpha: 0.25, duration: 650, yoyo: true, repeat: -1 });

    let prevX = hit.x;
    let prevY = hit.y;
    const moveBy = (nx: number, ny: number): void => {
      const dx = nx - prevX;
      const dy = ny - prevY;
      prevX = nx; prevY = ny;
      doc.x += dx; doc.y += dy;
      for (const e of extras) { e.x += dx; e.y += dy; }
    };
    hit.on('drag', (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      moveBy(dragX, dragY);
    });
    hit.on('dragend', (p: Phaser.Input.Pointer) => {
      if (Phaser.Geom.Rectangle.Contains(zone, p.worldX, p.worldY)) {
        hit.destroy();
        this.dropGlow?.destroy(); this.dropGlow = undefined;
        opts.onDrop();
      } else {
        // mimo zónu → plynulý návrat papíru i otisků na původní místo
        this.tweens.add({ targets: doc, x: homeDoc.x, y: homeDoc.y, duration: 240, ease: 'Back.easeOut' });
        for (const he of homeExtras) {
          this.tweens.add({ targets: he.e, x: he.x, y: he.y, duration: 240, ease: 'Back.easeOut' });
        }
        hit.setPosition(homeDoc.x, homeDoc.y);
        prevX = homeDoc.x; prevY = homeDoc.y;
      }
    });
  }

  /** ODEVZDÁNÍ: přetáhni orazítkovanou žádost na rytíře; žádost i portrét odejdou. */
  private beginHandover(imprints: Phaser.GameObjects.Container[], onDone: () => void): void {
    if (!this.primaryDoc || !this.knightDropRect) { onDone(); return; }
    const doc = this.primaryDoc;
    doc.setVisible(true);
    for (const im of imprints) im.setVisible(true);
    this.dragGroupToZone({
      doc, extras: imprints, w: this.primaryDocWH.w, h: this.primaryDocWH.h,
      zone: this.knightDropRect, hintKey: 'handoverHint',
      onDrop: () => this.completeHandover(doc, imprints, onDone),
    });
  }

  private completeHandover(
    doc: Phaser.GameObjects.Container, imprints: Phaser.GameObjects.Container[], onDone: () => void,
  ): void {
    this.handoverHint?.destroy(); this.handoverHint = undefined;
    try { this.sound.play('sfx_paper', { volume: 0.85 }); } catch { /* ok */ }
    const kx = this.knightDropRect?.centerX ?? 330;
    const ky = this.knightDropRect?.centerY ?? 480;
    // žádost + otisky doletí k rytíři…
    this.tweens.add({
      targets: [doc, ...imprints], x: kx, y: ky, scale: 0.55, duration: 300, ease: 'Cubic.easeIn',
      onComplete: () => {
        // …a rytíř s nimi odejde dolů ze scény
        const movers = [doc, ...imprints, ...this.knightVisuals];
        this.tweens.add({
          targets: movers, y: '+=560', alpha: 0, angle: '+=5', duration: 480, ease: 'Cubic.easeIn',
          onComplete: () => onDone(),
        });
      },
    });
  }

  /** ARCHIVACE (vyhl. 28): vyhotov druhopis, znovu ho orazítkuj, založ do spisovny,
   *  teprve pak předej prvopis rytíři. */
  private beginArchiveFlow(
    originalImprints: Phaser.GameObjects.Container[], reason: Reason, onDone: () => void,
  ): void {
    const src = this.enc?.data.documents[0];
    if (!src || !this.primaryDoc) { this.beginHandover(originalImprints, onDone); return; }
    this.copyParagraph = this.reasonParagraph(reason);
    // schovej prvopis + jeho otisky, kým se vyrábí druhopis uprostřed stolu
    this.primaryDoc.setVisible(false);
    for (const im of originalImprints) im.setVisible(false);

    this.buildCopyDoc(src);
    this.setStepHint(Content.ui('archiveStep1'));
    this.runCopyTranscribe(() => {
      this.setStepHint(Content.ui('archiveStep2'));
      this.stampCopy((copyImprints) => {
        if (!this.copyDoc) { this.restoreAndHandover(originalImprints, onDone); return; }
        this.dragGroupToZone({
          doc: this.copyDoc, extras: copyImprints, w: this.copyWH.w, h: this.copyWH.h,
          zone: new Phaser.Geom.Rectangle(LIBRARY_RECT.x - 14, LIBRARY_RECT.y - 14, LIBRARY_RECT.w + 28, LIBRARY_RECT.h + 60),
          hintKey: 'archiveStep3',
          onDrop: () => this.archiveCopyToLibrary(this.copyDoc!, copyImprints, originalImprints, onDone),
        });
      });
    });
  }

  /** Blank druhopis uprostřed stolu (text se odkryje opisem). Nastaví copyTarget. */
  private buildCopyDoc(src: { template: string; fields: Record<string, string> }): void {
    const w = this.copyWH.w;
    const h = this.copyWH.h;
    const center = { x: 940, y: 540 };
    const paper = this.add.rectangle(0, 0, w, h, COLORS.paper).setStrokeStyle(4, 0x8a7a55).setOrigin(0, 0);
    const title = this.add.text(22, 16, Content.ui('copyTitle'), {
      fontFamily: FONTS.ui, fontSize: '26px', color: '#7a1f12',
    });
    const { bodyStr } = this.buildDocLines(src);
    const body = this.add.text(22, 66, bodyStr, {
      fontFamily: FONTS.doc, fontSize: '22px', color: '#1c1a16', lineSpacing: 5, wordWrap: { width: w - 44 },
    }).setAlpha(0); // odkryje se opisem
    this.copyBodyText = body;
    // kroužek pro razítko dole uprostřed (rovně, ať se dobře razítkuje)
    const crx = w / 2;
    const cry = h - 78;
    const g = this.add.graphics();
    g.lineStyle(3, 0x9a8a60, 0.95);
    for (let a = 0; a < 360; a += 30) {
      g.beginPath();
      g.arc(crx, cry, 40, Phaser.Math.DegToRad(a), Phaser.Math.DegToRad(a + 16));
      g.strokePath();
    }
    const ghost = this.add.text(crx, cry, '⊛', { fontFamily: FONTS.ui, fontSize: '30px', color: '#9a8a60' }).setOrigin(0.5).setAlpha(0.85);
    const lbl = this.add.text(crx, cry + 56, Content.ui('stampSlot'), { fontFamily: FONTS.doc, fontSize: '15px', color: '#9a8a60' }).setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [paper, title, body, g, ghost, lbl];
    for (const c of children) {
      (c as unknown as { x: number; y: number }).x -= w / 2;
      (c as unknown as { x: number; y: number }).y -= h / 2;
    }
    this.copyDoc = this.add.container(center.x, center.y, children);
    this.encounterLayer.add(this.copyDoc);
    this.copyTarget = {
      center, w, h, angleDeg: 0, circleLocal: { x: crx, y: cry }, circleAngleDeg: 0, requireWax: false,
    };
  }

  /** Opisovací minihra: tahej brkem po druhopisu, text se postupně odkrývá. */
  private runCopyTranscribe(onComplete: () => void): void {
    this.busy = true;
    const body = this.copyBodyText;
    const start = { x: 1180, y: 560 };
    // brk: šikmá čára s nibem
    const shaft = this.add.rectangle(0, 0, 10, 86, 0xe8dcc0).setStrokeStyle(2, 0x8a7a55).setOrigin(0.5, 1).setAngle(28);
    const nib = this.add.triangle(0, 6, 0, 0, -7, 16, 7, 16, 0x3a2a16).setOrigin(0.5, 0);
    const quill = this.add.container(start.x, start.y, [shaft, nib]).setDepth(72);
    quill.setSize(60, 90);
    const hit = this.add.rectangle(start.x, start.y, 70, 100, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true, draggable: true }).setDepth(72);
    this.input.setDraggable(hit);
    this.encounterLayer.add([quill, hit]);

    const NEED = 1500;
    let dist = 0;
    let px = hit.x;
    let py = hit.y;
    let done = false;
    hit.on('drag', (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      dist += Math.hypot(dragX - px, dragY - py);
      px = dragX; py = dragY;
      hit.setPosition(dragX, dragY);
      quill.setPosition(dragX, dragY);
      const prog = Phaser.Math.Clamp(dist / NEED, 0, 1);
      body?.setAlpha(prog);
      if (prog >= 1 && !done) {
        done = true;
        try { this.sound.play('sfx_paper', { volume: 0.5 }); } catch { /* ok */ }
        quill.destroy(); hit.destroy();
        onComplete();
      }
    });
  }

  /** Orazítkování druhopisu (razítko MUSÍ padnout znovu). Kvalitu neřešíme (prvopis už platí). */
  private stampCopy(onComplete: (copyImprints: Phaser.GameObjects.Container[]) => void): void {
    if (!this.copyTarget) { onComplete([]); return; }
    const recap = `${Content.ui('stampRecap')} ${Content.ui('copyTitle')}`;
    const sys = new StampSystem(this, this.encounterLayer);
    this.stampSys = sys;
    sys.begin(
      'reject', this.copyTarget, this.requiredSeal(), false, recap, this.copyParagraph,
      () => onComplete(sys.getImprints()),
      () => { this.stampCopy(onComplete); }, // zrušení = musí orazítkovat znovu (archivace je povinná)
    );
  }

  private archiveCopyToLibrary(
    copyDoc: Phaser.GameObjects.Container, copyImprints: Phaser.GameObjects.Container[],
    originalImprints: Phaser.GameObjects.Container[], onDone: () => void,
  ): void {
    this.handoverHint?.destroy(); this.handoverHint = undefined;
    try { this.sound.play('sfx_paper', { volume: 0.8 }); } catch { /* ok */ }
    const lx = LIBRARY_RECT.x + LIBRARY_RECT.w / 2;
    const ly = LIBRARY_RECT.y + LIBRARY_RECT.h / 2;
    this.tweens.add({
      targets: [copyDoc, ...copyImprints], x: lx, y: ly, scale: 0.22, alpha: 0, angle: 8,
      duration: 420, ease: 'Cubic.easeIn',
      onComplete: () => {
        copyDoc.destroy();
        for (const im of copyImprints) im.destroy();
        this.copyDoc = undefined;
        this.restoreAndHandover(originalImprints, onDone);
      },
    });
  }

  private restoreAndHandover(originalImprints: Phaser.GameObjects.Container[], onDone: () => void): void {
    this.setStepHint(Content.ui('archiveStep4'));
    this.beginHandover(originalImprints, onDone);
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
        fontFamily: FONTS.title,
        fontSize: '54px',
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
        fontFamily: FONTS.title,
        fontSize: '56px',
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
      const t = this.add.text(colX[col], colY2[col], `§ ${L(r.cislo)}: ${GameState.fillVars(L(r.text))}`, {
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
        let val = d.fields[f.key] ?? '—';
        // baseline hodnoty (formulář „B-1448", kolek „30") se zobrazují jako aktuální
        // úřední podmínka období — ať „správný" doklad vždy sedí na dnešní vyhlášku
        if (f.key === 'formular' && val === 'B-1448') val = GameState.reqFormular;
        if (f.key === 'kolek' && val.trim() === '30') val = String(GameState.reqKolek);
        lines.push(`${L(f.label)}: ${val}`);
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
    // žádost je nakloněná → text ostrý i pod úhlem (viz crispRotatedText)
    crispRotatedText(title);
    crispRotatedText(body);

    const contentBottom = title.height + 30 + body.height + 16;
    const h = contentBottom + 190; // volný pruh dole — kroužek se tam vždy vejde
    const paper = this.add.rectangle(0, 0, w, h, COLORS.paper).setStrokeStyle(4, 0x8a7a55).setOrigin(0, 0);

    // finále (sv. Václav): tři razítkové kroužky na RŮZNÝCH místech formuláře —
    // každé ze tří zamítnutí půjde na jiný kroužek (kníže vrací 2×)
    const isFinale = this.enc?.data.id === 'ENC_008';

    // vosková pečeť se vyžaduje až po enactnutí vyhlášky o pečetění (R27), pak ~50 %
    // debug: ?wax=1 vynutí (i bez vyhlášky, pro QA), ?wax=0 vypne. Ve finále nikdy.
    const waxParam = new URLSearchParams(location.search).get('wax');
    const waxRuleActive = GameState.enactedRules.has('R27');
    const requireWax = isFinale ? false : (waxParam === '1' ? true : waxParam === '0' ? false : (waxRuleActive && Math.random() < 0.5));

    // kroužek pečeti: náhodná pozice ve volném pruhu + zcela náhodné natočení.
    // Ve finále tři pevné kroužky vedle sebe; první se kreslí teď, další po vrácení.
    const cy3 = contentBottom + 95;
    if (isFinale) {
      this.vaclavSpots = [
        { x: 150, y: cy3, angle: Phaser.Math.Between(0, 359) },
        { x: w / 2, y: cy3, angle: Phaser.Math.Between(0, 359) },
        { x: w - 150, y: cy3, angle: Phaser.Math.Between(0, 359) },
      ];
      this.vaclavSpotIdx = 0;
    }
    const crx = isFinale ? this.vaclavSpots[0].x : Phaser.Math.Between(110, w - 110);
    const cry = isFinale ? this.vaclavSpots[0].y : Phaser.Math.Between(contentBottom + 70, h - 55);
    const cAngle = isFinale ? this.vaclavSpots[0].angle : Phaser.Math.Between(0, 359);
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
    const ghost = crispRotatedText(this.add
      .text(crx, cry, requireWax ? this.requiredSeal() : '⊛', {
        fontFamily: FONTS.ui, fontSize: '30px', color: '#9a8a60',
      }))
      .setOrigin(0.5).setAngle(cAngle).setAlpha(0.85);
    const lbl = crispRotatedText(this.add
      .text(crx, cry + 58, Content.ui(requireWax ? 'sealSlot' : 'stampSlot'), {
        fontFamily: FONTS.doc, fontSize: '15px', color: '#9a8a60',
      }))
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
    this.primaryDoc = cont;
    this.primaryDocBaseAngle = angle;
    this.primaryDocWH = { w, h };

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

  // ---------- rozhodnutí -----------

  // „dekret" už není samostatná kategorie — dekretové důvody padají do své pravé kategorie
  private readonly CATEGORY_ORDER: NonNullable<Reason['category']>[] = [
    'formular', 'poplatek', 'papiry', 'pecet', 'vira', 'vystroj', 'kun', 'chybi',
  ];

  private reasonCategory(r: Reason): NonNullable<Reason['category']> {
    return r.category ?? 'vystroj';
  }

  private reasonParagraph(r: Reason): string {
    const rule = Content.all.rules.find((x) => x.id === r.ruleRef);
    return rule ? L(rule.cislo) : `§ ${Content.ui('freshDecree')}`;
  }

  /** Procesní „pseudo-důvody" — vyhlášky, co mění postup, ne nabídku zamítnutí. */
  private readonly PROCESS_REASONS = new Set(['RZ_ARCHIV']);

  /** Je v platnosti vyhláška o archivaci (R28)? (nebo debug ?archive=1). */
  private archiveActive(): boolean {
    if (new URLSearchParams(location.search).get('archive') === '1') return true;
    return GameState.enactedRules.has('R28');
  }

  /** Důvody do skříně: VŠECHNY dostupné (i výstrojní — ty se teď vybírají jen odsud),
   *  kromě procesních vyhlášek (archivace není důvod k zamítnutí). */
  private cabinetReasons(): Reason[] {
    return RuleEngine.availableReasons(GameState.day).filter((r) => !this.PROCESS_REASONS.has(r.id));
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
      .text(cx, 150, Content.ui('cabinetTitle'), { fontFamily: FONTS.title, fontSize: '54px', color: '#d4a017' })
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
      const hasNew = reasons.some((r) => this.reasonCategory(r) === cat && RuleEngine.isIssuedDecreeReason(r.id));
      this.overlayLayer.add(
        this.makeDrawer(dx, dy, dw, dh, Content.ui(`cat_${cat}`), count, () => this.showCabinetDrawer(cat), 0x4a3420, count === 0, hasNew),
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
    bodyColor = 0x4a3420, dimEmpty = false, hasNew = false,
  ): Phaser.GameObjects.Container {
    const body = this.add.rectangle(0, 0, w, h, bodyColor).setStrokeStyle(hasNew ? 5 : 4, hasNew ? 0x2f9d32 : 0x6b4a2a).setOrigin(0, 0);
    const face = this.add.rectangle(6, 6, w - 12, h - 12, 0x5a4226).setStrokeStyle(2, 0x3a2a16).setOrigin(0, 0);
    const handle = this.add.rectangle(w / 2, h - 28, 120, 22, 0x2a1c10).setStrokeStyle(3, 0xd4a017);
    const text = this.add.text(w / 2, 42, label, {
      fontFamily: FONTS.ui, fontSize: '26px', color: '#e8d9a8', align: 'center', wordWrap: { width: w - 54 },
    }).setOrigin(0.5);
    const badge = this.add.text(w - 22, 16, `(${count})`, { fontFamily: FONTS.doc, fontSize: '24px', color: '#d4a017' }).setOrigin(1, 0);
    const parts: Phaser.GameObjects.GameObject[] = [body, face, handle, text, badge];
    if (hasNew) {
      const nb = this.add.text(14, 12, `⚡ ${Content.ui('decreeNewBadge')}`, { fontFamily: FONTS.ui, fontSize: '16px', color: '#8fe08f' }).setOrigin(0, 0);
      parts.push(nb);
    }
    const c = this.add.container(x, y, parts);
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
      .text(cx, 150, `▸ ${Content.ui(`cat_${cat}`)}`, { fontFamily: FONTS.title, fontSize: '54px', color: '#d4a017' })
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

  /** Mini tematická ikonka vyhlášky do pravého horního rohu karty — kreslená
   *  (ne emoji, ať sedí do pixel-art stylu a vykreslí se v každém fontu). */
  private makeCategoryIcon(cat: NonNullable<Reason['category']>, size = 46): Phaser.GameObjects.Container {
    const gold = 0xf0d68a, dark = 0x2a2016, paper = 0xe8dcc0, red = 0xc0392b, steel = 0xd0d4d8;
    const bg = this.add.rectangle(0, 0, size, size, dark).setStrokeStyle(2, 0xd4a017);
    const g = this.add.graphics();
    switch (cat) {
      case 'formular': // formulář: list s linkami a ohnutým rohem
        g.fillStyle(paper, 1); g.fillRect(-9, -13, 18, 26);
        g.fillStyle(dark, 1); g.fillTriangle(3, -13, 9, -13, 9, -7);
        g.lineStyle(2, dark, 1);
        for (let i = 0; i < 4; i++) g.lineBetween(-5, -5 + i * 5, 5, -5 + i * 5);
        break;
      case 'poplatek': // kolek/poplatek: komínek mincí
        g.lineStyle(2, dark, 1);
        for (let i = 0; i < 3; i++) { g.fillStyle(gold, 1); g.fillEllipse(0, 7 - i * 6, 24, 11); g.strokeEllipse(0, 7 - i * 6, 24, 11); }
        break;
      case 'papiry': // papíry: dva přeložené listy
        g.fillStyle(paper, 1); g.lineStyle(2, dark, 1);
        g.fillRect(-11, -7, 16, 22); g.strokeRect(-11, -7, 16, 22);
        g.fillRect(-3, -13, 16, 22); g.strokeRect(-3, -13, 16, 22);
        for (let i = 0; i < 3; i++) g.lineBetween(0, -6 + i * 5, 10, -6 + i * 5);
        break;
      case 'pecet': // pečeť: vosková pečeť se stuhami
        g.fillStyle(red, 1); g.fillTriangle(-7, 2, -1, 2, -4, 16); g.fillTriangle(7, 2, 1, 2, 4, 16);
        g.fillStyle(red, 1); g.fillCircle(0, -3, 11);
        g.fillStyle(0x8a1f16, 1); g.fillCircle(0, -3, 7);
        g.fillStyle(gold, 1); g.fillCircle(0, -3, 2.5);
        break;
      case 'vira': // víra: mešní kalich
        g.fillStyle(gold, 1);
        g.fillTriangle(-9, -12, 9, -12, 0, -1);
        g.fillRect(-2, -3, 4, 10);
        g.fillRect(-8, 7, 16, 3);
        break;
      case 'vystroj': // výstroj: meč našikmo
        g.lineStyle(4, steel, 1); g.lineBetween(-8, 11, 9, -10);
        g.lineStyle(4, gold, 1); g.lineBetween(-12, 3, -1, 10);
        g.fillStyle(gold, 1); g.fillCircle(-12, 12, 3);
        break;
      case 'kun': { // kůň: podkova pro štěstí
        g.lineStyle(5, steel, 1);
        g.beginPath();
        g.moveTo(-8, 11); g.lineTo(-8, -1); g.lineTo(0, -11); g.lineTo(8, -1); g.lineTo(8, 11);
        g.strokePath();
        g.fillStyle(dark, 1);
        for (const [hx, hy] of [[-8, 7], [8, 7], [-6, -3], [6, -3]]) g.fillCircle(hx, hy, 1.6);
        break;
      }
      case 'chybi': // chybí do boje: prázdné místo se škrtem
        g.lineStyle(2, gold, 1); g.strokeRect(-10, -10, 20, 20);
        g.lineStyle(3, red, 1); g.lineBetween(-9, 9, 9, -9);
        break;
      default: // záložní: razítkový kroužek s §
        g.lineStyle(3, red, 1); g.strokeCircle(0, 0, 11);
        g.lineStyle(3, gold, 1); g.lineBetween(0, -6, 0, 6); g.lineBetween(-4, -3, 4, 3);
        break;
    }
    return this.add.container(0, 0, [bg, g]);
  }

  /** Karta s konkrétním zamítacím razítkem: mini otisk + § paragraf + text důvodu. */
  private makeStampCard(x: number, y: number, w: number, h: number, r: Reason): Phaser.GameObjects.Container {
    // vzácnost: legendární = zlatá; čerstvě vydaná vyhláška = zelená (ať ji hráč najde)
    const legend = r.rarity === 'legendary';
    const fresh = RuleEngine.isIssuedDecreeReason(r.id);
    const baseFill = legend ? 0xf7e6a8 : fresh ? 0xe2f0d8 : 0xf0e6c8;
    const hoverFill = legend ? 0xffeeb0 : fresh ? 0xeffae4 : 0xfff4d8;
    const borderCol = legend ? 0xd4a017 : fresh ? 0x1d6a20 : 0x8a7a55;
    const card = this.add.rectangle(0, 0, w, h, baseFill).setStrokeStyle(legend || fresh ? 6 : 3, borderCol).setOrigin(0, 0);
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
    const parts: Phaser.GameObjects.GameObject[] = [card, sg, stTxt, para, lbl];
    // tematická ikonka v pravém horním rohu (štítky vzácnosti se posunou vlevo od ní)
    const icon = this.makeCategoryIcon(this.reasonCategory(r)).setPosition(w - 29, 29);
    parts.push(icon);
    if (legend) {
      const badge = this.add
        .text(w - 62, 12, `★ ${Content.ui('rarityLegendary')}`, { fontFamily: FONTS.ui, fontSize: '19px', color: '#9a6a00' })
        .setOrigin(1, 0);
      parts.push(badge);
    }
    if (fresh) {
      // mini infografika: popisek „⚡ NOVÁ VYHLÁŠKA" + útržek čerstvé vyhlášky s pečetí
      const badge = this.add
        .text(w - 62, 12, `⚡ ${Content.ui('decreeNewBadge')}`, { fontFamily: FONTS.ui, fontSize: '18px', color: '#1d6a20' })
        .setOrigin(1, 0);
      const ix = w - 68 - badge.width - 30;
      const ig = this.add.graphics();
      ig.fillStyle(0xe8dcc0, 1); ig.fillRect(ix, 12, 24, 30);
      ig.lineStyle(2, 0x8a7a55, 1);
      for (let i = 0; i < 3; i++) ig.lineBetween(ix + 5, 19 + i * 7, ix + 19, 19 + i * 7);
      ig.fillStyle(0xa82810, 1); ig.fillCircle(ix + 18, 38, 5);
      parts.push(ig, badge);
    }
    const c = this.add.container(x, y, parts);
    c.setSize(w, h);
    card.setInteractive({ useHandCursor: true })
      .on('pointerover', () => card.setFillStyle(hoverFill))
      .on('pointerout', () => card.setFillStyle(baseFill))
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

  /** Vydá dekret. U vyhlášky o světle nejdřív vyskočí vtipné „upsík" okno a teprve
   *  po kliknutí se zhasne; ostatní efekty (ztišení) platí hned. */
  private doIssueDecree(d: Decree): void {
    if (!this.enc) return;
    RuleEngine.issueDecree(this.enc, d);
    this.overlayLayer.removeAll(true);
    this.updateHud();
    if (this.LIGHT_DECREES.includes(d.id)) {
      // nejdřív vtip, po kliknutí teprve zhasne světlo (sebere se jas)
      this.showInfoBox(`😬 ${Content.ui('lightDecreeOops')}`, 0x7a1f12, () => this.applyAmbientEffects());
    } else {
      this.applyAmbientEffects(); // např. ztišení hudby hned
      this.showInfoBox(`⚖ ${Content.ui('decreeIssued')}\n${L(d.text)}`, 0xd4a017, () => {
        // encounter pokračuje — akční tlačítka zůstala, hráč teď zamítne novým důvodem
      });
    }
  }

  /** Hráč aktivně zahrál čekající vyhlášku ze šuplíku → teprve teď vstupuje v platnost.
   *  Encounter běží dál; pokud na ni rytíř sedí, dá se ho hned zamítnout novým důvodem. */
  private playPendingRule(rule: Rule): void {
    if (!GameState.playPendingRule(rule.id)) return;
    this.overlayLayer.removeAll(true);
    this.updateHud();
    try { this.sound.play('sfx_stamp', { volume: 0.5 }); } catch { /* zvuk není kritický */ }
    this.showInfoBox(`⚖ ${Content.ui('ruleEnacted')}\n${L(rule.cislo)}: ${L(rule.text)}`, 0x2f7d32, () => {
      // nic dalšího — akční tlačítka zůstala, hráč teď může zamítnout
    });
  }

  private openDecreePicker(): void {
    if (this.busy || !this.enc) return;
    this.overlayLayer.removeAll(true);
    // v šuplíku jsou dvě věci: čekající vyhlášky z úřadování (uvést v platnost)
    // a klasické podpultové dekrety pasující na tohoto rytíře
    const pending = GameState.pendingRules
      .map((id) => Content.all.rules.find((r) => r.id === id))
      .filter((r): r is Rule => !!r);
    const decrees = RuleEngine.applicableDecrees(this.enc);
    const cx = GAME_WIDTH / 2;

    // nic k zahrání — řekni to srozumitelně
    if (pending.length === 0 && decrees.length === 0) {
      const dim = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setInteractive();
      const panel = this.add.rectangle(cx, GAME_HEIGHT / 2, 1100, 360, COLORS.uiPanel).setStrokeStyle(4, COLORS.uiAccent);
      const head = this.add
        .text(cx, GAME_HEIGHT / 2 - 110, Content.ui('pickDecree'), { fontFamily: FONTS.title, fontSize: '48px', color: '#e8d9a8' })
        .setOrigin(0.5);
      const msg = this.add
        .text(cx, GAME_HEIGHT / 2 - 10, Content.ui('decreeNone'), {
          fontFamily: FONTS.doc, fontSize: '30px', color: '#bfa978', align: 'center', wordWrap: { width: 980 }, lineSpacing: 6,
        })
        .setOrigin(0.5);
      const cancel = makeButton(this, cx, GAME_HEIGHT / 2 + 120, Content.ui('close'), () => {
        this.overlayLayer.removeAll(true);
      }, { fontSize: 30 });
      this.overlayLayer.add([dim, panel, head, msg, cancel]);
      return;
    }

    // nejdřív tlačítka (víceřádková — výšku známe až po vytvoření), pak panel pod ně.
    // čekající vyhlášky jsou zelené (uvedou se v platnost), dekrety ve výchozí barvě
    const buttons: Phaser.GameObjects.Container[] = [];
    let totalH = 0;
    for (const r of pending) {
      let btn: Phaser.GameObjects.Container = makeButton(
        this,
        cx,
        0,
        `⚖ ${L(r.cislo)}: ${L(r.text)}`,
        () => this.playPendingRule(r),
        { fontSize: 25, width: 1160, wrap: 1080, font: FONTS.doc, color: 0x1d4020 },
      );
      // legendární vyhláška (odemyká univerzální razítko) → oranžový rámeček s nápisem
      if (RuleEngine.isLegendary(r.reasonId)) btn = this.wrapLegendary(btn, cx);
      buttons.push(btn);
      totalH += btn.height + 18;
    }
    for (const d of decrees) {
      let btn: Phaser.GameObjects.Container = makeButton(
        this,
        cx,
        0,
        L(d.text),
        () => this.doIssueDecree(d),
        { fontSize: 26, width: 1160, wrap: 1080, font: FONTS.doc },
      );
      if (RuleEngine.isLegendary(d.injectsReason)) btn = this.wrapLegendary(btn, cx);
      buttons.push(btn);
      totalH += btn.height + 18;
    }

    const panelH = Math.min(235 + totalH + 85, GAME_HEIGHT - 60);
    const top = GAME_HEIGHT / 2 - panelH / 2;
    const dim = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setInteractive();
    const panel = this.add.rectangle(cx, GAME_HEIGHT / 2, 1280, panelH, COLORS.uiPanel).setStrokeStyle(4, COLORS.uiAccent);
    const head = this.add
      .text(cx, top + 58, Content.ui('pickDecree'), {
        fontFamily: FONTS.title,
        fontSize: '52px',
        color: '#e8d9a8',
      })
      .setOrigin(0.5);
    // poznámka vysvětlí obě části: čekající vyhlášky (uvést v platnost) + rozpočet dekretů
    const noteParts: string[] = [];
    if (pending.length > 0) noteParts.push(Content.ui('pendingNote'));
    if (decrees.length > 0) noteParts.push(`${Content.ui('pickDecreeNote')} ${GameState.decreesLeft}×`);
    const note = this.add
      .text(cx, top + 116, noteParts.join('\n'), {
        fontFamily: FONTS.doc, fontSize: '24px', color: '#bfa978', align: 'center', wordWrap: { width: 1160 }, lineSpacing: 4,
      })
      .setOrigin(0.5);
    this.overlayLayer.add([dim, panel, head, note]);
    let by = top + 172;
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

  /** Obalí tlačítko vyhlášky do oranžového rámečku s hlavičkou „LEGENDÁRNÍ",
   *  aby hráč hned při výběru věděl, že vybírá legendární (univerzální) vyhlášku. */
  private wrapLegendary(btn: Phaser.GameObjects.Container, x: number): Phaser.GameObjects.Container {
    const ORANGE = 0xe07b1a;
    const bw = btn.width;
    const bh = btn.height;
    const pad = 12;
    const headH = 38;
    const frameW = bw + pad * 2;
    const frameH = bh + pad * 2 + headH;
    const topLocal = -frameH / 2;
    const frame = this.add.rectangle(0, 0, frameW, frameH, 0x000000, 0).setStrokeStyle(4, ORANGE);
    const headBar = this.add.rectangle(0, topLocal + headH / 2, frameW, headH, ORANGE);
    const headTxt = this.add
      .text(0, topLocal + headH / 2, `★ ${Content.ui('rarityLegendary')} ★`, {
        fontFamily: FONTS.ui, fontSize: '22px', color: '#1c1206',
      })
      .setOrigin(0.5);
    // tlačítko posuň pod hlavičku (uvnitř rámečku)
    btn.setPosition(0, topLocal + headH + pad + bh / 2);
    const wrap = this.add.container(x, 0, [frame, headBar, headTxt, btn]);
    wrap.setSize(frameW, frameH);
    return wrap;
  }

  // ---------- overlaye ----------

  /** Informační box o výsledku — zavře se klikem myší KAMKOLIV, pak onClose. */
  private showInfoBox(msg: string, tint: number, onClose: () => void): void {
    this.busy = true;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const dim = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5).setInteractive();
    const panel = this.add.rectangle(cx, cy - 20, 1160, 320, COLORS.uiPanel).setStrokeStyle(5, tint);
    const text = this.add
      .text(cx, cy - 30, msg, {
        fontFamily: FONTS.doc, fontSize: '34px', color: '#e8d9a8', wordWrap: { width: 1060 }, align: 'center',
      })
      .setOrigin(0.5);
    dim.once('pointerdown', () => {
      this.overlayLayer.removeAll(true);
      this.busy = false;
      onClose();
    });
    this.overlayLayer.add([dim, panel, text]);
  }


  /** Facka: screen shake + VŽDY důvod proč + infografická karta, čeká na klik. */
  private showCutaway(msg: string, why: string, after: () => void): void {
    this.busy = true;
    try {
      this.sound.play('sfx_slap', { volume: 0.9 });
    } catch {
      /* zvuk není kritický */
    }
    this.cameras.main.shake(250, 0.012);
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const pool = Content.all.infographics.filter((i) => i.kind === 'facka');
    const info = pool.length > 0 ? L(pool[Math.floor(Math.random() * pool.length)].text) : '';
    const dim = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setInteractive();
    const panel = this.add.rectangle(cx, cy, 1300, 700, COLORS.uiPanel).setStrokeStyle(5, COLORS.danger);
    // první text (zpráva, co se stalo) - nahoře
    const text = this.add
      .text(cx, cy - 330, msg, {
        fontFamily: FONTS.doc, fontSize: '34px', color: '#e8d9a8', wordWrap: { width: 1180 }, align: 'center',
      })
      .setOrigin(0.5, 0);
    // „FACKA!" jako obrázek-plakátek pod zprávou; chybí-li textura, spadne zpět na textový nadpis
    const slap: Phaser.GameObjects.GameObject = this.textures.exists('facka')
      ? this.add.image(cx, cy - 150, 'facka').setOrigin(0.5).setDisplaySize(130, 162)
      : this.add
          .text(cx, cy - 150, '✊ FACKA! ✊', { fontFamily: FONTS.title, fontSize: '84px', color: '#ff6b5e' })
          .setOrigin(0.5);
    // VŽDY vysvětlení, proč to byla chyba (zvýrazněný rámeček) - pod obrázkem
    const whyBox = this.add.rectangle(cx, cy + 40, 1200, 110, 0x2a1512).setStrokeStyle(3, 0xd4a017);
    const whyText = this.add
      .text(cx, cy + 40, why, {
        fontFamily: FONTS.doc, fontSize: '27px', color: '#f0d68a', wordWrap: { width: 1140 }, align: 'center', fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const infoText = this.add
      .text(cx, cy + 125, info ? `📜 ${info}` : '', {
        fontFamily: FONTS.doc, fontSize: '26px', color: '#bfa978', wordWrap: { width: 1140 }, align: 'center',
      })
      .setOrigin(0.5, 0);
    const btn = makeButton(this, cx, cy + 300, Content.ui('continue'), () => {
      this.overlayLayer.removeAll(true);
      this.busy = false;
      after();
    }, { fontSize: 32 });
    this.overlayLayer.add([dim, panel, slap, text, whyBox, whyText, infoText, btn]);
  }
}
