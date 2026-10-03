import Phaser from 'phaser';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Content, L } from '../systems/Content';
import { GameState } from '../systems/GameState';
import { makeButton } from '../ui/helpers';

/** Ranní noviny: epocha dne, zprávy z venku, nová vyhláška dne. */
export class NewspaperScene extends Phaser.Scene {
  constructor() {
    super('Newspaper');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const era = Content.era(GameState.day);

    // list novin
    const paperW = 1240;
    this.add.rectangle(cx, GAME_HEIGHT / 2, paperW, GAME_HEIGHT - 80, COLORS.paper).setStrokeStyle(4, 0x8a7a55);

    const black = '#1c1a16';
    const sepia = '#4a4134';

    // hlavička
    this.add
      .text(cx, 110, L(era.masthead).toUpperCase(), {
        fontFamily: FONTS.ui,
        fontSize: '72px',
        color: black,
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 175, `${Content.ui('day')} ${GameState.day}/5  ·  L.P. ${era.year}  ·  ${L(era.label)}`, {
        fontFamily: FONTS.doc,
        fontSize: '32px',
        color: sepia,
      })
      .setOrigin(0.5);
    this.add.rectangle(cx, 210, paperW - 120, 4, 0x1c1a16);

    // zprávy
    const news = Content.pickNews(GameState.day, 3);
    let y = 250;
    for (const n of news) {
      const tone = n.tone === 'absurd' ? '❖' : '■';
      const head = this.add.text(cx - paperW / 2 + 80, y, `${tone} ${L(n.headline)}`, {
        fontFamily: FONTS.ui,
        fontSize: '36px',
        color: black,
        wordWrap: { width: paperW - 160 },
      });
      y += head.height + 8;
      if (n.body) {
        const body = this.add.text(cx - paperW / 2 + 110, y, L(n.body), {
          fontFamily: FONTS.doc,
          fontSize: '28px',
          color: sepia,
          wordWrap: { width: paperW - 200 },
        });
        y += body.height + 18;
      } else {
        y += 16;
      }
    }

    // rostoucí hromada PLATNÝCH vyhlášek, které teď musí úředník sám dodržovat
    const activeRules = Content.all.rules.filter((r) => GameState.enactedRules.has(r.id));
    if (activeRules.length > 0) {
      y = Math.max(y + 20, 520);
      const bottomLimit = GAME_HEIGHT - 150; // nad tlačítkem
      this.add.rectangle(cx, y + 10, paperW - 120, 4, 0x1c1a16);
      this.add
        .text(cx, y + 48, `⚖ ${Content.ui('helpRules')} (${activeRules.length}) ⚖`, {
          fontFamily: FONTS.ui,
          fontSize: '38px',
          color: '#7a1f12',
        })
        .setOrigin(0.5);

      void bottomLimit;
      // poslední 3 vyhlášky + flavor (celý seznam je pod § ve hře)
      const shown = activeRules.slice(-3);
      let ry = y + 90;
      for (const r of shown) {
        const t = this.add
          .text(cx, ry, `§ ${L(r.cislo)}: ${L(r.text)}`, {
            fontFamily: FONTS.doc, fontSize: '23px', color: black, wordWrap: { width: paperW - 220 }, align: 'center',
          })
          .setOrigin(0.5, 0);
        ry += t.height + 8;
      }
      this.add
        .text(cx, ry + 4, L({ cs: 'Hora tone v papírech. A ty v nich s ní.', en: 'The mountain drowns in paperwork. And you with it.' }), {
          fontFamily: FONTS.doc, fontSize: '23px', color: sepia, align: 'center', fontStyle: 'italic',
        })
        .setOrigin(0.5, 0);
    }

    makeButton(this, cx, GAME_HEIGHT - 90, Content.ui('openOffice'), () => {
      this.scene.start('Office');
    }, { fontSize: 44 });
  }
}
