import type { ContentBundle, Era, LString, NewsItem, Rule } from '../content/schemas';
import { GameState } from './GameState';

/**
 * Typovaný přístup k obsahu po Preloadu + i18n helper.
 * Obsah je read-only; plní ho jednou PreloadScene.
 */
class ContentImpl {
  private bundle!: ContentBundle;

  init(bundle: ContentBundle): void {
    this.bundle = bundle;
  }

  get all(): ContentBundle {
    return this.bundle;
  }

  era(day: number): Era {
    const e = this.bundle.eras.find((x) => x.day === day);
    if (!e) throw new Error(`Chybí era pro den ${day} v eras.json`);
    return e;
  }

  /** Vyhlášky aktivní v daný den (vestavěné; hráčovy dekrety řeší RuleEngine). */
  activeRules(day: number): Rule[] {
    return this.bundle.rules.filter((r) => r.day <= day);
  }

  /** Náhodný výběr zpráv pro den (bez opakování v rámci běhu). */
  pickNews(day: number, count: number): NewsItem[] {
    const pool = this.bundle.news.filter(
      (n) => n.minDay <= day && (n.maxDay === undefined || n.maxDay >= day) && !GameState.seenNewsIds.has(n.id),
    );
    const picked: NewsItem[] = [];
    const bag = [...pool];
    while (picked.length < count && bag.length > 0) {
      const total = bag.reduce((s, n) => s + (n.weight ?? 1), 0);
      let roll = Math.random() * total;
      const idx = bag.findIndex((n) => (roll -= n.weight ?? 1) <= 0);
      const item = bag.splice(Math.max(idx, 0), 1)[0];
      picked.push(item);
      GameState.seenNewsIds.add(item.id);
    }
    return picked;
  }

  ui(key: string): string {
    const s = this.bundle.strings[key];
    if (!s) return `⟦${key}⟧`;
    return L(s);
  }
}

/** Lokalizace: vrátí EN jen pokud je jazyk EN a překlad není prázdný, jinak CS. */
export function L(s: LString | undefined): string {
  if (!s) return '';
  if (GameState.lang === 'en' && s.en && s.en.trim() !== '') return s.en;
  return s.cs;
}

export const Content = new ContentImpl();
