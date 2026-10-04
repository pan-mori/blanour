import Phaser from 'phaser';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH, TUNING } from '../config';
import type { Rule } from '../content/schemas';
import { Content, L } from '../systems/Content';
import { GameState } from '../systems/GameState';
import { RuleEngine } from '../systems/RuleEngine';
import { makeButton, title } from '../ui/helpers';

/** Konec dne: statistiky + legislativní fáze (úředník vydá ≥2 nové vyhlášky). */
export class DayEndScene extends Phaser.Scene {
  protected selected = new Set<string>();
  protected minPick = 2;
  protected nextBtn!: Phaser.GameObjects.Container;
  protected needTxt!: Phaser.GameObjects.Text;

  constructor(key = 'DayEnd') {
    super(key);
  }

  create(): void {
    this.selected = new Set();
    const cx = GAME_WIDTH / 2;
    const era = Content.era(GameState.day);
    try {
      this.sound.play('sfx_fanfare', { volume: 0.5 });
    } catch {
      /* zvuk není kritický */
    }
    const isLast = GameState.day >= TUNING.days;

    this.add.rectangle(cx, GAME_HEIGHT / 2, 1500, GAME_HEIGHT - 60, COLORS.uiPanel).setStrokeStyle(4, COLORS.uiAccent);
    title(this, cx, 70, `${Content.ui('dayDone')} ${GameState.day} - L.P. ${era.year}`, 52);

    // statistiky kompaktně
    const s = GameState.stats;
    this.add
      .text(
        cx,
        138,
        `${Content.ui('statRejected')}: ${s.rejected}   ·   ${Content.ui('statMistakes')}: ${s.rejectedWrong}\n` +
          `${Content.ui('statDecrees')}: ${s.decreesUsed}   ·   ${Content.ui('statActive')}: ${RuleEngine.activeRuleIds().size}`,
        { fontFamily: FONTS.doc, fontSize: '28px', color: '#bfa978', align: 'center', lineSpacing: 6 },
      )
      .setOrigin(0.5);

    if (isLast) {
      // poslední den - žádná legislativa, rovnou konec
      const pool = Content.all.infographics.filter((i) => i.kind === 'dayend');
      if (pool.length > 0) {
        this.add
          .text(cx, 260, `„${L(pool[Math.floor(Math.random() * pool.length)].text)}“`, {
            fontFamily: FONTS.doc, fontSize: '30px', color: '#bfa978', wordWrap: { width: 1200 }, align: 'center',
          })
          .setOrigin(0.5, 0);
      }
      makeButton(this, cx, GAME_HEIGHT - 110, Content.ui('nextDay'), () => {
        const t = GameState.nextDay();
        this.scene.start(t === 'ending:survived' ? 'Ending' : 'Newspaper');
      }, { fontSize: 44 });
      return;
    }

    // ---------- legislativní fáze ----------
    const nextDay = GameState.day + 1;
    // vyhlášky o vousech (3 délky) - nikdy nesmí být v platnosti všechny 3 naráz,
    // jinak by žádná délka vousu nebyla legální. Vždy nech aspoň jednu povolenou:
    // do nabídky pusť tolik vousových vyhlášek, aby ani výběr 2 nedal dohromady 3.
    const BEARD_RULES = new Set(['R23', 'R29', 'R30']);
    const beardActive = [...GameState.enactedRules, ...GameState.pendingRules]
      .filter((id) => BEARD_RULES.has(id)).length;
    const beardBudget = Math.max(0, 2 - beardActive);
    let beardSeen = 0;
    const candidates: Rule[] = Content.all.rules
      // už v platnosti NEBO čeká v šuplíku → znovu nenabízet
      .filter((r) => !GameState.enactedRules.has(r.id) && !GameState.pendingRules.includes(r.id) && r.day <= nextDay)
      .sort((a, b) => b.day - a.day || a.id.localeCompare(b.id))
      .filter((r) => {
        if (!BEARD_RULES.has(r.id)) return true;
        if (beardSeen >= beardBudget) return false;
        beardSeen++;
        return true;
      })
      .slice(0, TUNING.legislationChoices);
    this.minPick = Math.min(TUNING.rulesPerEvening, candidates.length); // vybírá se PŘESNĚ tolik (min i max)

    this.add
      .text(cx, 196, Content.ui('legislaTitle'), { fontFamily: FONTS.title, fontSize: '48px', color: '#d4a017' })
      .setOrigin(0.5);
    // hint pod hlavičku s mezerou (roste dolů); karty pak začnou až pod ním
    const hint = this.add
      .text(cx, 240, Content.ui('legislaHint').replace('{n}', String(this.minPick)), {
        fontFamily: FONTS.doc, fontSize: '25px', color: '#ffb3a7', align: 'center', wordWrap: { width: 1300 }, lineSpacing: 4,
      })
      .setOrigin(0.5, 0);

    // karty vyhlášek - 2 sloupce
    const perRow = 2;
    const cw = 700;
    const gapX = 40;
    const x0 = cx - (perRow * cw + (perRow - 1) * gapX) / 2;
    const colY0 = Math.max(320, Math.ceil(hint.y + hint.height + 26));
    let colY = [colY0, colY0];
    candidates.forEach((r, i) => {
      const col = i % perRow;
      const card = this.makeRuleCard(x0 + col * (cw + gapX), colY[col], cw, r);
      colY[col] += card.getData('h') + 16;
    });

    this.needTxt = this.add
      .text(cx, GAME_HEIGHT - 148, '', { fontFamily: FONTS.ui, fontSize: '24px', color: '#ffb3a7' })
      .setOrigin(0.5);
    this.nextBtn = makeButton(this, cx, GAME_HEIGHT - 80, Content.ui('nextDay'), () => {
      if (this.selected.size < this.minPick) return;
      // vyhlášky se NEuvedou v platnost rovnou - přistanou v šuplíku a hráč je
      // musí druhý den aktivně zahrát ze „Podpultových vyhlášek" na rytíře
      for (const id of this.selected) GameState.addPendingRule(id);
      const t = GameState.nextDay();
      this.scene.start(t === 'ending:survived' ? 'Ending' : 'Newspaper');
    }, { fontSize: 42 });
    this.refreshGate();
  }

  protected makeRuleCard(x: number, y: number, w: number, r: Rule): Phaser.GameObjects.Container {
    // legendární vyhláška (odemyká univerzální razítko) → oranžový rámeček s hlavičkou
    const legendary = RuleEngine.isLegendary(r.reasonId);
    const ORANGE = 0xe07b1a;
    const headH = legendary ? 36 : 0;
    const txt = this.add.text(70, 12 + headH, `${L(r.cislo)}: ${L(r.text)}`, {
      fontFamily: FONTS.doc, fontSize: '20px', color: '#1c1a16', wordWrap: { width: w - 100 }, lineSpacing: 2,
    });
    const contentH = Math.max(txt.height + 28, 72);
    const h = contentH + headH;
    const cy = headH + contentH / 2; // střed obsahové části (pod hlavičkou)
    const card = this.add.rectangle(0, 0, w, h, 0xe6dcc0).setStrokeStyle(legendary ? 4 : 3, legendary ? ORANGE : 0x8a7a55).setOrigin(0, 0);
    const check = this.add.rectangle(36, cy, 34, 34, 0xf0e6c8).setStrokeStyle(3, 0x7a1f12);
    const tick = this.add.text(36, cy, '✓', { fontFamily: FONTS.ui, fontSize: '28px', color: '#2f7d32' })
      .setOrigin(0.5).setVisible(false);
    const children: Phaser.GameObjects.GameObject[] = [card, txt, check, tick];
    if (legendary) {
      const headBar = this.add.rectangle(0, 0, w, headH, ORANGE).setOrigin(0, 0);
      const headTxt = this.add
        .text(w / 2, headH / 2, `★ ${Content.ui('rarityLegendary')} ★`, { fontFamily: FONTS.ui, fontSize: '20px', color: '#1c1206' })
        .setOrigin(0.5);
      children.push(headBar, headTxt);
    }
    const c = this.add.container(x, y, children);
    c.setData('h', h);
    card.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.selected.has(r.id)) {
        this.selected.delete(r.id);
        card.setFillStyle(0xe6dcc0); tick.setVisible(false); check.setFillStyle(0xf0e6c8);
      } else {
        // vybírá se PŘESNĚ 2 - třetí výběr se neumožní
        if (this.selected.size >= this.minPick) {
          this.tweens.add({ targets: this.needTxt, scale: 1.2, duration: 80, yoyo: true });
          return;
        }
        this.selected.add(r.id);
        card.setFillStyle(0xfff0cf); tick.setVisible(true); check.setFillStyle(0xcfeccb);
        try { this.sound.play('sfx_stamp', { volume: 0.4 }); } catch { /* ok */ }
      }
      this.refreshGate();
    });
    return c;
  }

  protected refreshGate(): void {
    const remain = Math.max(0, this.minPick - this.selected.size);
    const ok = this.selected.size === this.minPick;
    this.needTxt.setText(ok ? Content.ui('legislaPicked').replace('{n}', String(this.minPick)) : `${Content.ui('legislaNeed')} ${remain} ${Content.ui('legislaMore')}`);
    this.needTxt.setColor(ok ? '#b8e0a8' : '#ffb3a7');
    const bg = this.nextBtn.list[0] as Phaser.GameObjects.Rectangle;
    const tx = this.nextBtn.list[1] as Phaser.GameObjects.Text;
    bg.setFillStyle(ok ? COLORS.uiPanelLight : 0x2a2318);
    tx.setAlpha(ok ? 1 : 0.4);
  }
}
