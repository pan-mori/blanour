import Phaser from 'phaser';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Content } from '../systems/Content';
import { GameState } from '../systems/GameState';
import { makeButton, title } from '../ui/helpers';

/**
 * Úplně poslední obrazovka - prolomení čtvrté stěny. Po všech koncích se hráče
 * zeptáme, jak by se rozhodl doopravdy on: vyjet s rytíři z Blaníku (povolit),
 * nebo je nechat spát (zamítnout). Volba nic nemění - je to jen tečka k zamyšlení.
 */
export class FinalChoiceScene extends Phaser.Scene {
  constructor() {
    super('FinalChoice');
  }

  private en = false;

  create(): void {
    this.en = GameState.lang === 'en';
    const cx = GAME_WIDTH / 2;

    title(this, cx, 300, this.en ? 'And you — how would you truly decide?' : 'A ty — jak by ses doopravdy rozhodl?', 76)
      .setColor('#e8d9a8');

    this.sub = this.add
      .text(cx, 470, this.en
        ? 'Ride out with the knights of Blaník — or let them sleep?'
        : 'Vyjet s rytíři z Blaníku — nebo je nechat spát?', {
        fontFamily: FONTS.doc, fontSize: '40px', color: '#bfa978', align: 'center', wordWrap: { width: 1400 },
      })
      .setOrigin(0.5);

    // nevyjet = ZAMÍTNOUT (červená), vyjet = POVOLIT VÝJEZD (zelená)
    this.btnReject = makeButton(this, cx - 360, 680, Content.ui('reject'), () => this.choose('reject'), {
      fontSize: 44, color: 0x5a1a10,
    });
    this.btnApprove = makeButton(this, cx + 360, 680, Content.ui('approve'), () => this.choose('approve'), {
      fontSize: 44, color: 0x1d4020,
    });
  }

  private sub!: Phaser.GameObjects.Text;
  private btnReject!: Phaser.GameObjects.Container;
  private btnApprove!: Phaser.GameObjects.Container;

  private choose(decision: 'reject' | 'approve'): void {
    this.sub.destroy();
    this.btnReject.destroy();
    this.btnApprove.destroy();

    const reaction = decision === 'approve'
      ? (this.en
        ? 'So you command. The knights ride out — may the nation fare better.'
        : 'Tak zní tvůj rozkaz. Rytíři vyjeli — ať je národu líp.')
      : (this.en
        ? "You let them sleep. Things aren't so bad yet. For now."
        : 'Necháváš je spát. Ještě není tak zle. Zatím.');

    const react = this.add
      .text(GAME_WIDTH / 2, 540, reaction, {
        fontFamily: FONTS.doc, fontSize: '44px', color: decision === 'approve' ? '#7fbf6a' : '#d4a017',
        align: 'center', wordWrap: { width: 1400 }, lineSpacing: 10,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: react, alpha: 1, duration: 600 });

    makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 180, Content.ui('backToMenu'), () => {
      this.scene.start('Menu');
    }, { fontSize: 40, color: COLORS.uiPanelLight });
  }
}
