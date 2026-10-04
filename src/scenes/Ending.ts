import Phaser from 'phaser';
import { FONTS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Content } from '../systems/Content';
import { GameState } from '../systems/GameState';
import { makeButton, title } from '../ui/helpers';

const ENDING_UI: Record<string, { titleKey: string; bodyKey: string; color: string }> = {
  survived: { titleKey: 'endSurvivedTitle', bodyKey: 'endSurvivedBody', color: '#7fbf6a' },
  beaten: { titleKey: 'endBeatenTitle', bodyKey: 'endBeatenBody', color: '#ff6b5e' },
  released: { titleKey: 'endReleasedTitle', bodyKey: 'endReleasedBody', color: '#d4a017' },
};

export class EndingScene extends Phaser.Scene {
  constructor() {
    super('Ending');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const kind = GameState.endingType ?? 'survived';
    const ui = ENDING_UI[kind];

    title(this, cx, 240, Content.ui(ui.titleKey), 84).setColor(ui.color);
    this.add
      .text(cx, 400, Content.ui(ui.bodyKey), {
        fontFamily: FONTS.doc,
        fontSize: '38px',
        color: '#e8d9a8',
        wordWrap: { width: 1300 },
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5, 0);

    const s = GameState.stats;
    this.add
      .text(
        cx,
        720,
        `${Content.ui('statRejected')}: ${s.rejected}   ·   ${Content.ui('statMistakes')}: ${s.rejectedWrong}   ·   ${Content.ui('statDecrees')}: ${s.decreesUsed}`,
        { fontFamily: FONTS.doc, fontSize: '32px', color: '#bfa978' },
      )
      .setOrigin(0.5);

    // poděkování dabérům (namluvili hlášky rytířů)
    this.add
      .text(
        cx,
        830,
        GameState.lang === 'en' ? 'Knight voices: Mori & Vojta & Dixi' : 'Hlasy rytířů namluvili: Mori a Vojta a Dixi',
        { fontFamily: FONTS.doc, fontSize: '28px', color: '#8a7a55' },
      )
      .setOrigin(0.5);

    makeButton(this, cx, GAME_HEIGHT - 180, GameState.lang === 'en' ? 'CONTINUE' : 'POKRAČOVAT', () => {
      this.scene.start('FinalChoice');
    }, { fontSize: 44 });
  }
}
