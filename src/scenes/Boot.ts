import Phaser from 'phaser';

/** Čeká na webfonty (Jersey 10, IBM Plex Mono) PŘED vytvořením prvního textu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    // pravé tlačítko otáčí razítkem — kontextové menu by překáželo
    this.input.mouse?.disableContextMenu();
    const ready = Promise.all([
      document.fonts.load('64px "Jersey 10"'),
      document.fonts.load('32px "IBM Plex Mono"'),
      document.fonts.load('600 32px "IBM Plex Mono"'),
      document.fonts.ready,
    ]);
    ready
      .catch((e) => console.warn('Fonty se nepodařilo načíst, pokračuji:', e))
      .finally(() => this.scene.start('Preload'));
  }
}
