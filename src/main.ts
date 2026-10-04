import '@fontsource/jersey-10/latin-400.css';
import '@fontsource/jersey-10/latin-ext-400.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-ext-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-ext-600.css';

import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/Boot';
import { PreloadScene } from './scenes/Preload';
import { MenuScene } from './scenes/Menu';
import { IntroScene } from './scenes/Intro';
import { NewspaperScene } from './scenes/Newspaper';
import { OfficeScene } from './scenes/Office';
import { DayEndScene } from './scenes/DayEnd';
import { StartLawScene } from './scenes/StartLaw';
import { EndingScene } from './scenes/Ending';
import { FinalChoiceScene } from './scenes/FinalChoice';
import { LabScene } from './scenes/Lab';
import { installAutoTest } from './debug/autotest';

const params = new URLSearchParams(location.search);

const game = new Phaser.Game({
  // ?renderer=canvas - nouzovka pro prostředí s rozbitým WebGL
  type: params.get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#14100c',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, PreloadScene, MenuScene, IntroScene, StartLawScene, NewspaperScene, OfficeScene, DayEndScene, EndingScene, FinalChoiceScene, LabScene],
});

// Debug/test hák: ?shot=nazev&wait=4500 → po čekání POSTne PNG snímek hry
// na /shot?name=nazev (headless test bez závislosti na kompozitoru prohlížeče).
installAutoTest(game, params);

if (params.has('shot')) {
  const wait = Number(params.get('wait') ?? 4500);
  const name = params.get('shot') || 'shot';
  setTimeout(() => {
    game.renderer.snapshot((img) => {
      void fetch(`/shot?name=${encodeURIComponent(name)}`, {
        method: 'POST',
        body: (img as HTMLImageElement).src,
      }).then(() => {
        document.title = 'SHOT_READY';
      });
    });
  }, wait);
}
