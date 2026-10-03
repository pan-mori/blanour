import type { Encounter } from '../content/schemas';
import { Content } from './Content';
import { GameState } from './GameState';
import type { ActiveEncounter } from './RuleEngine';
import { RuleEngine } from './RuleEngine';

/** Sestaví frontu encounterů pro den a vydává je po jednom. */
class EncounterManagerImpl {
  private queue: ActiveEncounter[] = [];
  current: ActiveEncounter | null = null;
  total = 0;
  index = 0;

  buildDay(day: number, quota = 4): void {
    const seen = GameState.seenEncounterIds;
    const active = RuleEngine.activeRuleIds(day);

    const pinned = Content.all.encounters.filter((e) => e.day === day && !seen.has(e.id));
    const pool = Content.all.encounters.filter(
      (e) =>
        e.day === undefined &&
        e.minDay <= day &&
        !seen.has(e.id) &&
        (e.requiresRules ?? []).every((r) => active.has(r)),
    );

    // GARANCE ŘEŠITELNOSTI + CHYTŘÍ RYTÍŘI: v rámci dne rezervujeme KAŽDÉMU rytíři
    // jiný (dosud nepoužitý) důvod — stejné razítko tak nejde dát dvakrát.
    const dayReserved = new Set<string>(GameState.usedReasons);
    const flawBag = pool.filter((e) => RuleEngine.rejectableNow(e, day));
    const decreeBag = pool.filter((e) => !RuleEngine.rejectableNow(e, day) && RuleEngine.decreeCoverable(e));
    let decreeBudget = Math.min(GameState.decreesLeft, 1);

    const weightedPick = (bag: Encounter[]): Encounter | null => {
      if (bag.length === 0) return null;
      const total = bag.reduce((s, e) => s + (e.weight ?? 1), 0);
      let roll = Math.random() * total;
      const idx = bag.findIndex((e) => (roll -= e.weight ?? 1) <= 0);
      return bag.splice(Math.max(idx, 0), 1)[0];
    };

    // z flawBagu bereme jen ty, co mají ještě volný (nerezervovaný) důvod
    const pickFlaw = (): Encounter | null => {
      for (let i = 0; i < flawBag.length; i++) {
        const free = RuleEngine.solvableReasons(flawBag[i], day).filter((r) => !dayReserved.has(r));
        if (free.length > 0) {
          const e = flawBag.splice(i, 1)[0];
          dayReserved.add(free[0]); // rezervuj jeden distinktní důvod
          return e;
        }
      }
      return null;
    };

    const picked: Encounter[] = [...pinned];
    while (picked.length < quota) {
      let next: Encounter | null = null;
      // dekretové (čisté papíry) jen když je rozpočet — jinak radši kratší den
      if (decreeBudget > 0 && decreeBag.length > 0 && Math.random() < 0.4) {
        next = weightedPick(decreeBag);
        if (next) decreeBudget--;
      }
      if (!next) next = pickFlaw();
      if (!next) break; // došly řešitelní rytíři → den je kratší (lepší než neřešitelný)
      picked.push(next);
    }

    for (const e of picked) seen.add(e.id);
    this.queue = picked.map((data) => ({ data, syntheticFlaws: [] }));
    this.total = this.queue.length;
    this.index = 0;
    this.current = null;
  }

  /** Po použití razítka: vyřaď z FRONTY rytíře, co už nejdou vyřešit (razítko padlo). */
  pruneUnsolvable(day: number): void {
    this.queue = this.queue.filter(
      (ae) => RuleEngine.rejectableNow(ae.data, day) || RuleEngine.decreeCoverable(ae.data),
    );
    this.total = this.index + this.queue.length;
  }

  /** Debug/QA: fronta s jediným konkrétním encounterem. */
  buildSingle(id: string): boolean {
    const e = Content.all.encounters.find((x) => x.id === id);
    if (!e) return false;
    this.queue = [{ data: e, syntheticFlaws: [] }];
    this.total = 1;
    this.index = 0;
    this.current = null;
    return true;
  }

  /** Další rytíř na přepážku; null = den u konce. */
  next(): ActiveEncounter | null {
    this.current = this.queue.shift() ?? null;
    if (this.current) this.index++;
    return this.current;
  }
}

export const EncounterManager = new EncounterManagerImpl();
