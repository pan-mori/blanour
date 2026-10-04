import Phaser from 'phaser';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH, TUNING } from '../config';
import type { Rule } from '../content/schemas';
import { Content } from '../systems/Content';
import { GameState } from '../systems/GameState';
import { makeButton, title } from '../ui/helpers';
import { DayEndScene } from './DayEnd';

/**
 * Úvodní legislativa (den 0): hráč si na začátku runu zvolí pár vyhlášek, které bude
 * od prvního dne prosazovat - určí tím směr celého průchodu (každý run jiný). Dědí
 * kartičky a bránu z DayEndScene; liší se jen tím, že se vyhlášky rovnou uvedou v
 * platnost a pokračuje se na Newspaper (ne na další den).
 */
export class StartLawScene extends DayEndScene {
  constructor() {
    super('StartLaw');
  }

  create(): void {
    this.selected = new Set();
    const cx = GAME_WIDTH / 2;

    // kandidáti = vyhlášky platné už od 1. dne, které ještě nejsou v platnosti (tj. mimo
    // základní kolek+formulář R01/R02, které úřad drží automaticky). Vousové vyhlášky
    // omezíme na 2 v nabídce, ať se nedá zapnout všechny 3 (žádná délka by nebyla legální).
    const BEARD = new Set(['R23', 'R29', 'R30']);
    let beardSeen = 0;
    const candidates: Rule[] = Content.all.rules
      .filter((r) => r.day <= 1 && !GameState.enactedRules.has(r.id))
      .sort((a, b) => a.id.localeCompare(b.id))
      .filter((r) => {
        if (!BEARD.has(r.id)) return true;
        if (beardSeen >= 2) return false;
        beardSeen++;
        return true;
      })
      .slice(0, TUNING.legislationChoices);
    this.minPick = Math.min(TUNING.startRules, candidates.length);

    this.add.rectangle(cx, GAME_HEIGHT / 2, 1500, GAME_HEIGHT - 60, COLORS.uiPanel).setStrokeStyle(4, COLORS.uiAccent);
    title(this, cx, 86, Content.ui('startLawTitle'), 52);
    const hint = this.add
      .text(cx, 150, Content.ui('startLawHint').replace('{n}', String(this.minPick)), {
        fontFamily: FONTS.doc, fontSize: '26px', color: '#ffb3a7', align: 'center', wordWrap: { width: 1300 }, lineSpacing: 4,
      })
      .setOrigin(0.5, 0);

    // karty vyhlášek - 2 sloupce (stejné jako večerní legislativa)
    const perRow = 2;
    const cw = 700;
    const gapX = 40;
    const x0 = cx - (perRow * cw + (perRow - 1) * gapX) / 2;
    const colY0 = Math.max(300, Math.ceil(hint.y + hint.height + 30));
    const colY = [colY0, colY0];
    candidates.forEach((r, i) => {
      const col = i % perRow;
      const card = this.makeRuleCard(x0 + col * (cw + gapX), colY[col], cw, r);
      colY[col] += card.getData('h') + 16;
    });

    this.needTxt = this.add
      .text(cx, GAME_HEIGHT - 148, '', { fontFamily: FONTS.ui, fontSize: '24px', color: '#ffb3a7' })
      .setOrigin(0.5);
    this.nextBtn = makeButton(this, cx, GAME_HEIGHT - 80, Content.ui('startLawGo'), () => {
      if (this.selected.size < this.minPick) return;
      for (const id of this.selected) GameState.enactRule(id); // platí hned od 1. dne
      this.scene.start('Newspaper');
    }, { fontSize: 42 });
    this.refreshGate();
  }

  /** Jako v DayEnd, ale potvrzovací text říká, že vyhlášky platí HNED (ne „do šuplíku"). */
  protected refreshGate(): void {
    const remain = Math.max(0, this.minPick - this.selected.size);
    const ok = this.selected.size === this.minPick;
    this.needTxt.setText(ok ? Content.ui('startLawPicked') : `${Content.ui('legislaNeed')} ${remain} ${Content.ui('legislaMore')}`);
    this.needTxt.setColor(ok ? '#b8e0a8' : '#ffb3a7');
    const bg = this.nextBtn.list[0] as Phaser.GameObjects.Rectangle;
    const tx = this.nextBtn.list[1] as Phaser.GameObjects.Text;
    bg.setFillStyle(ok ? COLORS.uiPanelLight : 0x2a2318);
    tx.setAlpha(ok ? 1 : 0.4);
  }
}
