import type { Encounter } from '../content/schemas';
import { Content } from './Content';
import { GameState } from './GameState';
import type { ActiveEncounter } from './RuleEngine';
import { RuleEngine } from './RuleEngine';

/** Sestaví frontu encounterů pro den a vydává je po jednom. */
class EncounterManagerImpl {
  private queue: ActiveEncounter[] = [];
  private history: ActiveEncounter[] = []; // už odbavení rytíři (pro cheat „o rytíře zpět")
  current: ActiveEncounter | null = null;
  total = 0;
  index = 0;

  buildDay(day: number, quota = 4): void {
    const seen = GameState.seenEncounterIds;
    // plánuje se proti schedulable množině (aktivní + čekající vyhlášky), aby den po
    // večerní legislativě nebyl prázdný - rytíře řešitelného teprve po zahrání čekající
    // vyhlášky SMÍME naplánovat, hráč ji při odbavení aktivně zahraje.
    const active = RuleEngine.schedulableRuleIds(day);

    // „Rytíři si dávají pozor": když je ve frontě vyhláška o výstroji, dovybav každého,
    // kdo není zamýšlený gotcha „chybí výstroj" - jinak jde skoro půlka rytířů zamítnout
    // jedním razítkem („chybí kůň") a strop maxSameRulePerRun to neutáhne (ten hlídá jen
    // plánovaný záměr, ne objektivní výstroj). Normalizujeme UŽ TADY, ať dávkovač i
    // razítkování vidí stejnou výstroj a plánovaná řešení sedí.
    const comply = (e: Encounter): Encounter => RuleEngine.complyGear(e, day, active);

    const pinnedAll = Content.all.encounters.filter((e) => e.day === day && !seen.has(e.id)).map(comply);
    // sv. Václav (ENC_008) je finálový boss → vždy jako POSLEDNÍ rytíř dne
    const finale = pinnedAll.filter((e) => e.id === 'ENC_008');
    const pinned = pinnedAll.filter((e) => e.id !== 'ENC_008');
    const pool = Content.all.encounters
      .filter(
        (e) =>
          e.day === undefined &&
          e.minDay <= day &&
          !seen.has(e.id) &&
          (e.requiresRules ?? []).every((r) => active.has(r)),
      )
      .map(comply);

    // GARANCE ŘEŠITELNOSTI + PESTROST: každému rytíři rezervujeme jednu konkrétní
    // vyhlášku jako zamýšlené řešení, a to z RUN rozpočtu (kolik rytířů na tu vyhlášku
    // ještě smíme naplánovat do stropu TUNING.maxSameRulePerRun). Tím je zaručeno, že
    // vybraný rytíř je řešitelný a že se „na stejnou věc" nevygeneruje víc než 2× za run.
    // POZOR: tohle neomezuje hráčova razítka - ta zůstávají ve skříni napořád.
    const budget = new Map<string, number>();
    for (const r of Content.all.rules) budget.set(r.id, GameState.scheduleLeft(r.id));
    const flawBag = pool.filter((e) => RuleEngine.rejectableNow(e, day, active, budget));
    const decreeBag = pool.filter(
      (e) => !RuleEngine.rejectableNow(e, day, active, budget) && RuleEngine.decreeCoverable(e),
    );
    let decreeBudget = Math.min(GameState.decreesLeft, 1);

    const weightedPick = (bag: Encounter[]): Encounter | null => {
      if (bag.length === 0) return null;
      const total = bag.reduce((s, e) => s + (e.weight ?? 1), 0);
      let roll = Math.random() * total;
      const idx = bag.findIndex((e) => (roll -= e.weight ?? 1) <= 0);
      return bag.splice(Math.max(idx, 0), 1)[0];
    };

    // z flawBagu bereme jen ty, co mají ještě rozpočtem krytý důvod; vybranému rytíři
    // ukousneme jedno použití z rozpočtu té vyhlášky (distinktní rezervace)
    const pickFlaw = (): Encounter | null => {
      for (let i = 0; i < flawBag.length; i++) {
        const free = RuleEngine.solvableReasons(flawBag[i], day, active, budget);
        if (free.length > 0) {
          const e = flawBag.splice(i, 1)[0];
          const rule = RuleEngine.reasonRule(free[0]);
          if (rule) {
            budget.set(rule, Math.max(0, (budget.get(rule) ?? 0) - 1)); // denní rezervace
            GameState.recordSchedule(rule); // + zápis do run stropu (max 2 na stejnou věc)
          }
          return e;
        }
      }
      return null;
    };

    const picked: Encounter[] = [...pinned];
    while (picked.length < quota) {
      let next: Encounter | null = null;
      // dekretové (čisté papíry) jen když je rozpočet - jinak radši kratší den
      if (decreeBudget > 0 && decreeBag.length > 0 && Math.random() < 0.4) {
        next = weightedPick(decreeBag);
        if (next) decreeBudget--;
      }
      if (!next) next = pickFlaw();
      if (!next) break; // došly řešitelní rytíři → den je kratší (lepší než neřešitelný)
      picked.push(next);
    }

    picked.push(...finale); // boss na konec
    for (const e of picked) seen.add(e.id);
    this.queue = picked.map((data) => ({ data, syntheticFlaws: [] }));
    this.history = [];
    this.total = this.queue.length;
    this.index = 0;
    this.current = null;
  }

  /** Po použití razítka: vyřaď z FRONTY rytíře, co už nejdou vyřešit (vyhlášce došel
   *  strop použití a není čím krýt). Posuzuje se proti schedulable množině a zbývajícímu
   *  rozpočtu runu; finálový boss (ENC_008) se nevyřazuje nikdy. */
  pruneUnsolvable(day: number): void {
    const sched = RuleEngine.schedulableRuleIds(day);
    this.queue = this.queue.filter(
      (ae) =>
        ae.data.id === 'ENC_008' ||
        RuleEngine.rejectableNow(ae.data, day, sched) ||
        RuleEngine.decreeCoverable(ae.data),
    );
    this.total = this.index + this.queue.length;
  }

  /** Debug/QA: fronta s jediným konkrétním encounterem. */
  buildSingle(id: string): boolean {
    const e = Content.all.encounters.find((x) => x.id === id);
    if (!e) return false;
    this.queue = [{ data: e, syntheticFlaws: [] }];
    this.history = [];
    this.total = 1;
    this.index = 0;
    this.current = null;
    return true;
  }

  /** Další rytíř na přepážku; null = den u konce. */
  next(): ActiveEncounter | null {
    if (this.current) this.history.push(this.current);
    this.current = this.queue.shift() ?? null;
    if (this.current) this.index++;
    return this.current;
  }

  /** CHEAT: o rytíře zpět. Vrátí předchozího (current pošle zpět do fronty),
   *  nebo null, když jsme na prvním rytíři (stav se nemění). */
  prev(): ActiveEncounter | null {
    const p = this.history.pop();
    if (!p) return null;
    if (this.current) this.queue.unshift(this.current);
    this.current = p;
    this.index = Math.max(1, this.index - 1);
    return this.current;
  }
}

export const EncounterManager = new EncounterManagerImpl();
