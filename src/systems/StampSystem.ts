import Phaser from 'phaser';
import { COLORS, FONTS, TUNING } from '../config';
import { Content } from './Content';

export type StampDecision = 'reject' | 'approve';
export type SealLetter = 'K' | 'E' | 'V';
export type StampQuality = 'crisp' | 'faded' | 'smudged' | 'crooked' | 'dry' | 'misplaced';

export interface StampResult {
  quality: StampQuality;
  ok: boolean;
}

/** Cíl razítkování: natočená žádost + náhodně umístěný a natočený kroužek pečeti. */
export interface StampTarget {
  center: { x: number; y: number };
  w: number;
  h: number;
  angleDeg: number;
  circleLocal: { x: number; y: number };
  circleAngleDeg: number;
  /** Vyžaduje tento formulář před razítkem i voskovou pečeť? (náhodně) */
  requireWax: boolean;
}

type Phase = 'wax' | 'stamp';
type WaxState = 'cold' | 'heating' | 'hot' | 'poured';

/**
 * Razítkování 4.0 — dvě fáze:
 *  FÁZE VOSK (náhodně vyžádaná): vzít červený vosk → nahřát nad svíčkou →
 *    kápnout na kroužek na formuláři (překryje vyznačený znak) → přitisknout
 *    SPRÁVNÉ pečetidlo (K/E/V). Je to podmínka postupu.
 *  FÁZE RAZÍTKO (vždy): vzít razítko ZAMÍTNUTO, namočit, Q/E/kolečkem srovnat
 *    PODLE zářezu kroužku a přitisknout vedle pečeti ve správném směru.
 */
export class StampSystem {
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Container;
  private decision: StampDecision = 'reject';
  private target!: StampTarget;
  private requiredSeal: SealLetter = 'K';
  private requireWax = false;
  private onDone!: (r: StampResult) => void;
  private onCancel?: () => void;

  private phase: Phase = 'stamp';
  private recapText = '';
  private paragraph = ''; // § důvodu — tiskne se pod ZAMÍTNUTO otisk

  // společné
  private tray!: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.Text;
  private recap!: Phaser.GameObjects.Container;
  private active = false;

  // vosk
  private waxState: WaxState = 'cold';
  private carriedWax: Phaser.GameObjects.Container | null = null;
  private heatMeter?: Phaser.GameObjects.Rectangle;
  private heat = 0;
  private candleZone!: Phaser.Geom.Circle;
  private candle?: Phaser.GameObjects.Container;
  private flameTween?: Phaser.Tweens.Tween;
  private waxBlob?: Phaser.GameObjects.Container;
  private sealImprinted = false;

  // razítko
  private trayStamp!: Phaser.GameObjects.Container;
  private carried: Phaser.GameObjects.Container | null = null;
  private imprints: Phaser.GameObjects.Container[] = []; // aktuální otisk (nový přepíše starý)
  private lastQuality: StampQuality | null = null; // kvalita posledního otisku (pro „Pustit jak je")
  private angle = 0;
  private inkCharges = 0;
  private pressStart = 0;
  private pressing = false;
  private inkPad!: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.layer = layer;
  }

  get isActive(): boolean {
    return this.active;
  }

  /** Otisky položené na dokument (po dokončení zůstávají ve vrstvě) — pro přetažení
   *  celé orazítkované žádosti na rytíře / do spisovny. */
  getImprints(): Phaser.GameObjects.Container[] {
    return this.imprints;
  }

  begin(
    decision: StampDecision,
    target: StampTarget,
    requiredSeal: SealLetter,
    requireWax: boolean,
    recapText: string,
    paragraph: string,
    onDone: (r: StampResult) => void,
    onCancel?: () => void,
  ): void {
    this.decision = decision;
    this.target = target;
    this.requiredSeal = requiredSeal;
    this.requireWax = requireWax && decision === 'reject';
    this.recapText = recapText;
    this.paragraph = paragraph;
    this.onDone = onDone;
    this.onCancel = onCancel;
    this.active = true;
    this.angle = Phaser.Math.Between(-60, 60);
    this.inkCharges = 0;
    this.sealImprinted = false;
    this.waxState = 'cold';
    this.lastQuality = null;

    this.buildRecap();
    this.buildCandle();
    this.bindInput();
    if (this.requireWax) this.startWaxPhase();
    else this.startStampPhase();
  }

  /** Hecování rytíře škubne neseným nástrojem. */
  nudge(): void {
    const obj = this.carried ?? this.carriedWax;
    if (!obj || this.pressing) return;
    if (this.carried) {
      this.angle += Phaser.Math.Between(10, 26) * (Math.random() < 0.5 ? -1 : 1);
      this.scene.tweens.add({ targets: this.carried, angle: this.angle, duration: 220, ease: 'Bounce.easeOut' });
    } else {
      this.scene.tweens.add({ targets: obj, x: `+=${Phaser.Math.Between(-14, 14)}`, duration: 120, yoyo: true });
    }
  }

  /** Test: dokonči celé razítkování (přeskočí vosk). */
  debugApply(angleOffset: number, pressMs: number, inked: boolean): void {
    if (this.requireWax && !this.sealImprinted) {
      this.placeWaxAndSeal(this.requiredSeal); // test: pečeť rovnou správně
    }
    if (this.phase !== 'stamp') this.startStampPhase();
    this.inkCharges = inked ? 1 : 0;
    this.angle = this.target.angleDeg + this.target.circleAngleDeg + angleOffset;
    const wp = this.circleWorldPos();
    this.applyStamp(wp.x + 70, wp.y, pressMs); // razítko vedle pečeti
    this.commitStamp(); // bez auto-finishe musí test otisk rovnou odevzdat
  }

  // ---------- geometrie ----------

  private circleWorldPos(): { x: number; y: number } {
    const { center, w, h, angleDeg, circleLocal } = this.target;
    const rad = Phaser.Math.DegToRad(angleDeg);
    const lx = circleLocal.x - w / 2;
    const ly = circleLocal.y - h / 2;
    return {
      x: center.x + lx * Math.cos(rad) - ly * Math.sin(rad),
      y: center.y + lx * Math.sin(rad) + ly * Math.cos(rad),
    };
  }

  private toLocal(px: number, py: number): { x: number; y: number } {
    const { center, w, h, angleDeg } = this.target;
    const rad = Phaser.Math.DegToRad(-angleDeg);
    const dx = px - center.x;
    const dy = py - center.y;
    return {
      x: dx * Math.cos(rad) - dy * Math.sin(rad) + w / 2,
      y: dx * Math.sin(rad) + dy * Math.cos(rad) + h / 2,
    };
  }

  private onPaper(px: number, py: number): boolean {
    const l = this.toLocal(px, py);
    return l.x >= 0 && l.x <= this.target.w && l.y >= 0 && l.y <= this.target.h;
  }

  // ---------- společné UI ----------

  private buildRecap(): void {
    const recapTxt = this.scene.add.text(0, 0, this.recapText, {
      fontFamily: FONTS.doc,
      fontSize: '26px',
      color: this.decision === 'reject' ? '#ffb3a7' : '#b8e0a8',
      fontStyle: 'bold',
      wordWrap: { width: 1020 },
      align: 'center',
    }).setOrigin(0.5);
    const recapBg = this.scene.add
      .rectangle(0, 0, recapTxt.width + 50, recapTxt.height + 24, 0x241c12, 0.97)
      .setStrokeStyle(3, this.decision === 'reject' ? 0xa82810 : 0x2f7d32);
    // vlevo od vzorníku pečetí (ten je vpravo nahoře)
    this.recap = this.scene.add.container(640, 126, [recapBg, recapTxt]).setDepth(60);
    this.layer.add(this.recap);
    this.hint = this.scene.add
      .text(820, 1040, '', { fontFamily: FONTS.doc, fontSize: '28px', color: '#d4a017', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(60);
    this.layer.add(this.hint);
  }

  /** Svíčka pro nahřívání vosku (vedle razítkovníku). Vše v kontejneru kvůli úklidu. */
  private buildCandle(): void {
    const cx = 1420;
    const cy = 760;
    const g = this.scene.add.graphics();
    g.fillStyle(0x3a2a16, 1); g.fillRect(cx - 46, cy + 44, 92, 14);
    g.fillStyle(0xe8e0d0, 1); g.fillRect(cx - 12, cy - 6, 24, 54);
    const flame = this.scene.add.graphics();
    const drawFlame = (s: number) => {
      flame.clear();
      flame.fillStyle(0xd4a017, 1);
      flame.fillTriangle(cx, cy - 36 * s, cx - 11, cy - 4, cx + 11, cy - 4);
      flame.fillStyle(0xffe080, 1);
      flame.fillTriangle(cx, cy - 22 * s, cx - 5, cy - 4, cx + 5, cy - 4);
    };
    drawFlame(1);
    this.flameTween = this.scene.tweens.addCounter({
      from: 90, to: 110, duration: 350, yoyo: true, repeat: -1,
      onUpdate: (t) => drawFlame((t.getValue() ?? 100) / 100),
    });
    const label = this.scene.add
      .text(cx, cy + 66, Content.ui('candle'), { fontFamily: FONTS.doc, fontSize: '20px', color: '#bfa978' })
      .setOrigin(0.5);
    this.candleZone = new Phaser.Geom.Circle(cx, cy - 16, 60);
    this.candle = this.scene.add.container(0, 0, [g, flame, label]).setDepth(40);
    this.layer.add(this.candle);
  }

  private setHint(s: string): void {
    this.hint.setText(s);
  }

  // ---------- FÁZE VOSK ----------

  private startWaxPhase(): void {
    this.phase = 'wax';
    this.buildWaxTray();
    this.setHint(Content.ui('waxTakeWax'));
  }

  private buildWaxTray(): void {
    const x = 1688;
    const y = 745;
    const panel = this.scene.add.rectangle(x, y, 400, 590, COLORS.uiPanelLight).setStrokeStyle(4, COLORS.uiAccent);
    const label = this.scene.add
      .text(x, y - 266, Content.ui('waxTitle'), { fontFamily: FONTS.ui, fontSize: '28px', color: '#e8d9a8' })
      .setOrigin(0.5);

    // vosková tyčinka na stole
    const stick = this.scene.add.container(x, y - 150, this.makeWaxStickParts());
    const stickHit = this.scene.add.rectangle(x, y - 150, 180, 120, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    stickHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.carriedWax && this.waxState !== 'poured') { this.pickUpWax(stick); p.event.stopPropagation(); }
    });

    // ohřívací ukazatel
    const heatBg = this.scene.add.rectangle(x, y + 16, 300, 24, 0x241c12).setStrokeStyle(2, COLORS.uiAccent);
    this.heatMeter = this.scene.add.rectangle(x - 148, y + 16, 2, 18, 0xd4a017).setOrigin(0, 0.5);
    const heatLbl = this.scene.add.text(x, y - 16, Content.ui('waxHeat'), { fontFamily: FONTS.doc, fontSize: '18px', color: '#8a7a55' }).setOrigin(0.5);

    // pečetidla K/E/V
    const stampLabel = this.scene.add
      .text(x, y + 60, Content.ui('waxMatrices'), { fontFamily: FONTS.doc, fontSize: '20px', color: '#bfa978' })
      .setOrigin(0.5);
    const matrices: Phaser.GameObjects.GameObject[] = [];
    (['K', 'E', 'V'] as SealLetter[]).forEach((letter, i) => {
      const sx = x - 110 + i * 110;
      const sy = y + 130;
      const handle = this.scene.add.rectangle(sx, sy - 34, 20, 34, 0x6b4a2a).setStrokeStyle(2, 0x3d2a18);
      const base = this.scene.add.circle(sx, sy, 34, 0x9aa4b0).setStrokeStyle(3, 0x6a7480);
      const mono = this.scene.add.text(sx, sy, letter, { fontFamily: FONTS.ui, fontSize: '28px', color: '#3a3a40' }).setOrigin(0.5);
      const hit = this.scene.add.circle(sx, sy, 40, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => { this.pressMatrix(letter); p.event.stopPropagation(); });
      matrices.push(handle, base, mono, hit);
    });

    const cancel = this.makeCancelButton(x, y + 262);
    this.tray = this.scene.add.container(0, 0, [panel, label, stick, stickHit, heatBg, this.heatMeter, heatLbl, stampLabel, ...matrices, ...cancel]);
    this.layer.add(this.tray);

    // zvýrazni kroužek na formuláři
    this.highlightCircle();
  }

  private makeWaxStickParts(): Phaser.GameObjects.GameObject[] {
    const stickBody = this.scene.add.rectangle(0, 10, 22, 70, 0x8a1810).setStrokeStyle(2, 0x5a1008);
    const tip = this.scene.add.circle(0, -26, 14, 0xa82010).setStrokeStyle(2, 0x5a1008);
    return [stickBody, tip];
  }

  private pickUpWax(stick: Phaser.GameObjects.Container): void {
    stick.setVisible(false);
    this.waxState = 'cold';
    this.heat = 0;
    this.carriedWax = this.scene.add.container(this.scene.input.activePointer.worldX, this.scene.input.activePointer.worldY, this.makeWaxStickParts());
    this.carriedWax.setDepth(82);
    this.layer.add(this.carriedWax);
    this.setHint(Content.ui('waxHeatIt'));
  }

  private highlightCircle(): void {
    const wp = this.circleWorldPos();
    const ring = this.scene.add.circle(wp.x, wp.y, 46).setStrokeStyle(4, COLORS.uiAccent, 0.9).setDepth(50);
    this.scene.tweens.add({ targets: ring, alpha: 0.3, scale: 1.1, duration: 600, yoyo: true, repeat: -1 });
    this.tray.add(ring);
  }

  private pressMatrix(letter: SealLetter): void {
    if (this.waxState !== 'poured' || this.sealImprinted) return;
    if (letter === this.requiredSeal) {
      this.placeSealLetter(letter);
      this.sealImprinted = true;
      try { this.scene.sound.play('sfx_stamp', { volume: 0.8 }); } catch { /* ok */ }
      this.setHint(Content.ui('waxSealedOk'));
      this.scene.time.delayedCall(700, () => {
        this.tray.destroy();
        this.startStampPhase();
      });
    } else {
      // špatné pečetidlo — vosk zmařen, nalej znovu
      try { this.scene.sound.play('sfx_slap', { volume: 0.4 }); } catch { /* ok */ }
      this.waxBlob?.destroy();
      this.waxBlob = undefined;
      this.waxState = 'cold';
      this.setHint(Content.ui('waxWrongMatrix'));
    }
  }

  private placeWaxAndSeal(letter: SealLetter): void {
    // (test) rovnou vosk i pečeť
    this.pourWaxAt(this.circleWorldPos());
    this.placeSealLetter(letter);
    this.sealImprinted = true;
  }

  private pourWaxAt(wp: { x: number; y: number }): void {
    this.waxBlob?.destroy();
    const g = this.scene.add.graphics().setDepth(49);
    g.fillStyle(0x9a1810, 1);
    g.fillCircle(wp.x, wp.y, 36);
    g.fillStyle(0xb02818, 1);
    g.fillCircle(wp.x - 6, wp.y - 6, 12);
    this.waxBlob = this.scene.add.container(0, 0, [g]);
    this.layer.add(this.waxBlob);
    this.carriedWax?.destroy();
    this.carriedWax = null;
    this.waxState = 'poured';
  }

  private placeSealLetter(letter: SealLetter): void {
    const wp = this.circleWorldPos();
    const mono = this.scene.add
      .text(wp.x, wp.y, letter, { fontFamily: FONTS.ui, fontSize: '34px', color: '#e8c49a' })
      .setOrigin(0.5).setDepth(50);
    const ring = this.scene.add.circle(wp.x, wp.y, 30).setStrokeStyle(3, 0x5a1008, 0.8).setDepth(50);
    this.waxBlob?.add([ring, mono]);
  }

  // ---------- FÁZE RAZÍTKO ----------

  private startStampPhase(): void {
    this.phase = 'stamp';
    this.buildStampTray();
    this.setHint(Content.ui('stampHintInk'));
    this.highlightCircle();
  }

  private buildStampTray(): void {
    const x = 1688;
    const y = 745;
    const panel = this.scene.add.rectangle(x, y, 400, 590, COLORS.uiPanelLight).setStrokeStyle(4, COLORS.uiAccent);
    const label = this.scene.add
      .text(x, y - 266, Content.ui('stampTray'), { fontFamily: FONTS.ui, fontSize: '30px', color: '#e8d9a8' })
      .setOrigin(0.5);

    this.trayStamp = this.makeStampVisual();
    this.trayStamp.setPosition(x, y - 40);
    const stampHit = this.scene.add.rectangle(x, y - 60, 300, 230, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    stampHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.carried) { this.pickUpStamp(); p.event.stopPropagation(); }
    });

    this.inkPad = this.scene.add.rectangle(x, y + 120, 300, 120, 0x3d1410).setStrokeStyle(4, 0x1d0a08);
    const padLabel = this.scene.add
      .text(x, y + 120, Content.ui('stampPad'), { fontFamily: FONTS.doc, fontSize: '26px', color: '#8a5a50' })
      .setOrigin(0.5);

    const cancel = this.makeCancelButton(x, y + 234);
    // „Předat dokument vojákovi" — kulaté voskové pečetidlo dole u svíčky (ne v panelu)
    const commit = this.makeCommitSeal(1410, 946);
    this.tray = this.scene.add.container(0, 0, [panel, label, this.trayStamp, stampHit, this.inkPad, padLabel, ...cancel, ...commit]);
    this.layer.add(this.tray);
  }

  /** „Předat dokument vojákovi" — kulaté voskové pečetidlo (odevzdá otisk; nesedí-li → facka). */
  private makeCommitSeal(x: number, y: number): Phaser.GameObjects.GameObject[] {
    const g = this.scene.add.graphics();
    g.fillStyle(0x7a1f12, 1); g.fillCircle(x, y, 52);
    g.fillStyle(0x8f2a18, 1); g.fillCircle(x, y, 42);
    g.lineStyle(3, 0x5a1510, 1); g.strokeCircle(x, y, 46);
    const sym = this.scene.add.text(x, y, '✓', { fontFamily: FONTS.ui, fontSize: '56px', color: '#e8c49a' }).setOrigin(0.5);
    const lbl = this.scene.add
      .text(x, y + 72, Content.ui('stampFinishSeal'), { fontFamily: FONTS.doc, fontSize: '21px', color: '#e8d9a8', align: 'center', wordWrap: { width: 240 } })
      .setOrigin(0.5);
    const hit = this.scene.add.circle(x, y, 56, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => sym.setScale(1.12));
    hit.on('pointerout', () => sym.setScale(1));
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => { p.event.stopPropagation(); this.commitStamp(); });
    return [g, sym, lbl, hit];
  }

  /** Odevzdání otisku „jak je" — kvalitu vyhodnotí Office (crisp projde, jinak facka). */
  private commitStamp(): void {
    this.finish({ quality: this.lastQuality ?? 'dry', ok: true });
  }

  /** Test: polož otisk BEZ odevzdání (ověření hromadění otisků). */
  debugStampOnly(angleOffset: number, pressMs: number): void {
    if (this.phase !== 'stamp') this.startStampPhase();
    this.inkCharges = 1;
    this.angle = this.target.angleDeg + this.target.circleAngleDeg + angleOffset;
    const wp = this.circleWorldPos();
    this.applyStamp(wp.x + Phaser.Math.Between(-40, 70), wp.y + Phaser.Math.Between(-30, 40), pressMs);
  }

  private makeCancelButton(x: number, y: number): Phaser.GameObjects.GameObject[] {
    const bg = this.scene.add.rectangle(x, y, 300, 52, 0x44391f).setStrokeStyle(3, COLORS.uiAccent);
    const tx = this.scene.add.text(x, y, Content.ui('stampCancel'), { fontFamily: FONTS.doc, fontSize: '23px', color: '#e8d9a8' }).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      const cb = this.onCancel;
      this.teardown();
      cb?.();
    });
    return [bg, tx];
  }

  private makeStampVisual(): Phaser.GameObjects.Container {
    const color = this.decision === 'reject' ? COLORS.stampRed : COLORS.stampGreen;
    const knob = this.scene.add.ellipse(0, -118, 84, 42, 0x8a5a2b).setStrokeStyle(3, 0x3d2a18);
    const handle = this.scene.add.rectangle(0, -66, 46, 86, 0x6b4a2a).setStrokeStyle(3, 0x3d2a18);
    const base = this.scene.add.rectangle(0, 0, 250, 62, color).setStrokeStyle(4, 0x1d0a08);
    const text = this.scene.add
      .text(0, 0, this.stampText(), { fontFamily: FONTS.ui, fontSize: '28px', color: '#00000088' })
      .setOrigin(0.5);
    return this.scene.add.container(0, 0, [knob, handle, base, text]);
  }

  private stampText(): string {
    return this.decision === 'reject' ? Content.ui('stampRejected') : Content.ui('stampApproved');
  }

  private pickUpStamp(): void {
    this.trayStamp.setVisible(false);
    this.carried = this.makeStampVisual();
    this.carried.setDepth(80);
    this.carried.setPosition(this.scene.input.activePointer.worldX, this.scene.input.activePointer.worldY);
    this.carried.setAngle(this.angle);
    this.layer.add(this.carried);
    this.setHint(this.inkCharges > 0 ? Content.ui('stampHintPress') : Content.ui('stampHintInk'));
  }

  private putBackStamp(): void {
    if (!this.carried) return;
    this.carried.destroy();
    this.carried = null;
    this.trayStamp.setVisible(true);
  }

  // ---------- vstup ----------

  private bindInput(): void {
    const input = this.scene.input;
    input.on('pointermove', this.onMove, this);
    input.on('pointerdown', this.onDown, this);
    input.on('pointerup', this.onUp, this);
    input.on('wheel', this.onWheel, this);
    this.scene.input.keyboard?.on('keydown-Q', this.rotL, this);
    this.scene.input.keyboard?.on('keydown-E', this.rotR, this);
    this.scene.input.keyboard?.on('keydown-ESC', this.putBackStamp, this);
    this.scene.events.on('update', this.onUpdate, this);
  }

  private unbindInput(): void {
    const input = this.scene.input;
    input.off('pointermove', this.onMove, this);
    input.off('pointerdown', this.onDown, this);
    input.off('pointerup', this.onUp, this);
    input.off('wheel', this.onWheel, this);
    this.scene.input.keyboard?.off('keydown-Q', this.rotL, this);
    this.scene.input.keyboard?.off('keydown-E', this.rotR, this);
    this.scene.input.keyboard?.off('keydown-ESC', this.putBackStamp, this);
    this.scene.events.off('update', this.onUpdate, this);
  }

  private rotL(): void { if (this.carried) { this.angle -= 5; this.carried.setAngle(this.angle); } }
  private rotR(): void { if (this.carried) { this.angle += 5; this.carried.setAngle(this.angle); } }
  private onWheel(_p: unknown, _o: unknown, _dx: number, dy: number): void {
    if (this.carried) { this.angle += dy > 0 ? 3 : -3; this.carried.setAngle(this.angle); }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.carried && !this.pressing) this.carried.setPosition(p.worldX, p.worldY);
    if (this.carriedWax) this.carriedWax.setPosition(p.worldX, p.worldY);
  }

  /** Nahřívání vosku — drží-li se LMB nad plamenem. */
  private onUpdate(): void {
    if (this.phase !== 'wax' || !this.carriedWax) return;
    const p = this.scene.input.activePointer;
    const overFlame = this.candleZone.contains(p.worldX, p.worldY);
    if (p.isDown && overFlame && this.waxState !== 'hot') {
      this.waxState = 'heating';
      this.heat = Math.min(100, this.heat + 2.2);
      this.heatMeter?.setSize(296 * (this.heat / 100), 18);
      // vosk se při nahřátí rozzáří
      const tip = this.carriedWax.list[1] as Phaser.GameObjects.Arc;
      tip.setFillStyle(Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0xa82010),
        Phaser.Display.Color.ValueToColor(0xff6020), 100, this.heat).color);
      if (this.heat >= 100) {
        this.waxState = 'hot';
        this.setHint(Content.ui('waxPour'));
      }
    }
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.phase === 'wax') {
      // kápnutí vosku na kroužek
      if (this.carriedWax && this.waxState === 'hot') {
        const wp = this.circleWorldPos();
        if (Phaser.Math.Distance.Between(p.worldX, p.worldY, wp.x, wp.y) <= 70) {
          this.pourWaxAt(wp);
          try { this.scene.sound.play('sfx_paper', { volume: 0.5 }); } catch { /* ok */ }
          this.setHint(Content.ui('waxPressMatrix'));
        }
      }
      return;
    }
    // fáze razítko
    if (!this.carried || p.rightButtonDown()) return;
    const padRect = this.inkPad.getBounds();
    if (padRect.contains(p.worldX, p.worldY)) {
      this.pressStart = p.downTime; this.pressing = true; this.carried.setScale(0.93);
      return;
    }
    if (this.onPaper(p.worldX, p.worldY)) {
      this.pressStart = p.downTime; this.pressing = true; this.carried.setScale(0.9);
      this.carried.setPosition(p.worldX, p.worldY);
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.phase !== 'stamp' || !this.carried || !this.pressing) return;
    this.pressing = false;
    this.carried.setScale(1);
    const held = p.upTime - this.pressStart;
    const padRect = this.inkPad.getBounds();
    if (padRect.contains(p.worldX, p.worldY)) {
      if (held >= TUNING.stamp.inkDipMs) {
        this.inkCharges = TUNING.stamp.inkCharges;
        this.scene.tweens.add({ targets: this.inkPad, alpha: 0.6, duration: 80, yoyo: true });
        this.angle += Phaser.Math.Between(16, 38) * (Math.random() < 0.5 ? -1 : 1);
        this.scene.tweens.add({ targets: this.carried, angle: this.angle, duration: 260, ease: 'Back.easeOut' });
        this.setHint(Content.ui('stampHintPress'));
      }
      return;
    }
    if (this.onPaper(p.worldX, p.worldY)) this.applyStamp(p.worldX, p.worldY, held);
  }

  // ---------- otisk razítka ----------

  private applyStamp(x: number, y: number, pressMs: number): void {
    const { angleTolDeg, pressMinMs, pressMaxMs } = TUNING.stamp;
    const wp = this.circleWorldPos();
    const dist = Phaser.Math.Distance.Between(x, y, wp.x, wp.y);
    const targetAngle = this.target.angleDeg + this.target.circleAngleDeg;
    const dev = Math.abs(Phaser.Math.Angle.ShortestBetween(this.angle % 360, targetAngle % 360));

    let quality: StampQuality;
    if (this.inkCharges <= 0) quality = 'dry';
    else if (dist > 150) quality = 'misplaced';
    else if (dev > angleTolDeg) quality = 'crooked';
    else if (pressMs < pressMinMs) quality = 'faded';
    else if (pressMs > pressMaxMs) quality = 'smudged';
    else quality = 'crisp';

    if (this.inkCharges > 0) this.inkCharges--;
    try { this.scene.sound.play('sfx_stamp', { volume: quality === 'dry' ? 0.25 : 0.8 }); } catch { /* ok */ }
    // otisky se HROMADÍ na formuláři (vizuální bordel je záměr); „Pustit jak je" bere poslední
    this.drawImprint(x, y, quality);
    this.lastQuality = quality;

    // BEZ auto-dokončení: hráč potvrdí „Pustit jak je" (crisp projde, jinak facka)
    let msg = quality === 'crisp' ? Content.ui('stampGood') : this.qualityMsg(quality);
    if (this.inkCharges <= 0 && quality === 'dry') msg += ` ${Content.ui('stampHintInk')}`;
    this.setHint(`${msg} ${Content.ui('stampCommitHint')}`);
  }

  /** Hláška ke kvalitě otisku (mimo crisp). */
  private qualityMsg(quality: StampQuality): string {
    const msgs: Record<Exclude<StampQuality, 'crisp'>, string> = {
      dry: Content.ui('stampDry'),
      crooked: Content.ui('stampCrooked'),
      faded: Content.ui('stampFaded'),
      smudged: Content.ui('stampSmudged'),
      misplaced: Content.ui('stampMisplaced'),
    };
    return msgs[quality as Exclude<StampQuality, 'crisp'>] ?? '';
  }

  private drawImprint(x: number, y: number, quality: StampQuality): void {
    const color = this.decision === 'reject' ? '#a82810' : '#2f7d32';
    const colorNum = Phaser.Display.Color.HexStringToColor(color).color;
    const alpha = quality === 'crisp' ? 0.92 : quality === 'faded' ? 0.35 : quality === 'dry' ? 0.12 : 0.85;
    // číslo směrnice pod otiskem (jen u zamítnutí, jen při skutečném tisku) —
    // z plného názvu vytáhneme kompaktní citaci „č. 5/1968", ať se vejde do rámečku
    let para = '';
    if (this.decision === 'reject' && this.paragraph) {
      const m = this.paragraph.match(/č\.\s*[0-9IVXLC]+(?:\s*\/\s*[0-9]+)?/i);
      para = m ? `§ ${m[0].replace(/\s+/g, ' ').trim()}` : this.paragraph.replace(/^§\s*/, '').trim();
    }
    const make = (ox: number, oy: number, a: number) => {
      const box = this.scene.add.rectangle(ox, oy, 270, 92).setStrokeStyle(4, colorNum, a);
      const txt = this.scene.add
        .text(ox, oy - (para ? 15 : 0), this.stampText(), { fontFamily: FONTS.ui, fontSize: '30px', color })
        .setOrigin(0.5).setAlpha(a);
      const parts: Phaser.GameObjects.GameObject[] = [box, txt];
      if (para) {
        const pTxt = this.scene.add
          .text(ox, oy + 20, para, { fontFamily: FONTS.doc, fontSize: '17px', color, align: 'center', wordWrap: { width: 250 } })
          .setOrigin(0.5).setAlpha(a);
        // zmenši, kdyby paragraf přetékal rámeček
        if (pTxt.width > 250) pTxt.setFontSize(14);
        parts.push(pTxt);
      }
      const c = this.scene.add.container(x, y, parts);
      c.setAngle(this.angle);
      this.layer.add(c);
      this.imprints.push(c); // zaznamenej otisk — jde ho setřít
      return c;
    };
    make(0, 0, alpha);
    if (quality === 'smudged') make(7, 5, alpha * 0.5);
  }

  /** Uklidí VŠECHNY objekty razítkování (vč. svíčky, plamene, vosku). */
  private cleanupVisuals(): void {
    this.flameTween?.remove();
    this.flameTween = undefined;
    this.candle?.destroy();
    this.candle = undefined;
    this.carried?.destroy();
    this.carried = null;
    this.carriedWax?.destroy();
    this.carriedWax = null;
    this.waxBlob?.destroy();
    this.waxBlob = undefined;
    this.tray?.destroy();
  }

  private finish(result: StampResult): void {
    this.active = false;
    this.unbindInput();
    this.carried?.destroy();
    this.carried = null;
    this.scene.time.delayedCall(450, () => {
      this.cleanupVisuals();
      this.hint.destroy();
      this.recap.destroy();
      this.onDone(result);
    });
  }

  teardown(): void {
    if (!this.active) return;
    this.active = false;
    this.unbindInput();
    // zrušení razítkování zahodí i rozdělané otisky (ať nezůstanou na dokumentu)
    for (const im of this.imprints) im.destroy();
    this.imprints = [];
    this.cleanupVisuals();
    this.hint?.destroy();
    this.recap?.destroy();
  }
}
