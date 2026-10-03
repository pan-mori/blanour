import Phaser from 'phaser';

/**
 * Hudební playlist — skladby se střídají v zamíchaném pořadí, ať nehraje
 * pořád jedna dokola. Běží přes globální zvukový manažer hry (přežívá scény).
 */
const TRACKS = ['music', 'music2', 'music3', 'music4'];

class MusicImpl {
  private sound?: Phaser.Sound.BaseSoundManager;
  private order: string[] = [];
  private idx = 0;
  private current?: Phaser.Sound.BaseSound;
  private started = false;

  /** Spustí playlist (idempotentní — podruhé nic nedělá). */
  start(sound: Phaser.Sound.BaseSoundManager): void {
    this.sound = sound;
    if (this.started) return;
    this.started = true;
    this.order = this.shuffle(TRACKS.filter((k) => sound.get(k) || this.canPlay(sound, k)));
    if (this.order.length === 0) return;
    this.playNext();
  }

  private canPlay(sound: Phaser.Sound.BaseSoundManager, key: string): boolean {
    // v cache může být zvuk i bez instance — zkusíme ho přidat
    return (sound.game.cache.audio as Phaser.Cache.BaseCache).exists(key);
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private playNext(): void {
    if (!this.sound || this.order.length === 0) return;
    const key = this.order[this.idx % this.order.length];
    this.idx++;
    try {
      this.current = this.sound.add(key, { volume: 0.35 });
      this.current.once(Phaser.Sound.Events.COMPLETE, () => this.playNext());
      this.current.play();
    } catch {
      /* skladba chybí — zkus další za chvíli, ať to necyklí donekonečna */
    }
  }
}

export const Music = new MusicImpl();
