import type { Decree, Encounter, Flaw, Reason } from '../content/schemas';
import { Content } from './Content';
import { GameState } from './GameState';

/** Encounter rozehraný na stole — vestavěné flaws + flaws vstříknuté dekrety. */
export interface ActiveEncounter {
  data: Encounter;
  syntheticFlaws: Flaw[];
}

/**
 * Ground truth je autorsky zapsaná v encounter.flaws; tady se jen vyhodnocuje.
 * reason.ruleRef smí odkazovat na vyhlášku (R…) NEBO dekret (V…) — dekretové
 * důvody se aktivují vydáním dekretu (GameState.issuedDecrees).
 */
export const RuleEngine = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  activeRuleIds(_day?: number): Set<string> {
    // aktivní jsou vyhlášky, které úředník uvedl v platnost + jím vydané dekrety
    const ids = new Set(GameState.enactedRules);
    for (const d of GameState.issuedDecrees) ids.add(d);
    return ids;
  },

  /** Důvody, které hráč SMÍ použít: aktivní vyhláška + ještě NEPOUŽITÉ (razítko jen jednou). */
  availableReasons(day: number): Reason[] {
    const active = this.activeRuleIds(day);
    return Content.all.reasons.filter((r) => active.has(r.ruleRef) && !GameState.usedReasons.has(r.id));
  },

  /** Je zvolený důvod správný pro tento encounter? */
  validateRejection(enc: ActiveEncounter, reasonId: string, day: number): { ok: boolean; flaw?: Flaw } {
    const active = this.activeRuleIds(day);
    // „Chybí do boje" (R21) se posuzuje OBJEKTIVNĚ z výstroje — platí u každého,
    // komu daná věc fakticky chybí, ne jen tam, kde to autor vepsal do flaws.
    const chibi = this.chibiVerdict(enc.data, reasonId, active);
    if (chibi) return chibi;
    // vizuální prohřešky na portrétu (vousy/brýle/kalich/urážka) — objektivně dle tagu
    const tagV = this.tagReasonVerdict(enc.data, reasonId, active);
    if (tagV) return tagV;
    // délka meče (RZ_ZBROJAK) — objektivně z viditelné délky, ne jen z autorského flawu
    const sword = this.swordVerdict(enc.data, reasonId, active);
    if (sword) return sword;
    const flaw = [...enc.data.flaws, ...enc.syntheticFlaws].find(
      (f) => f.reasonId === reasonId && active.has(f.ruleRef),
    );
    return { ok: !!flaw, flaw };
  },

  /** Objektivní verdikt pro „chybí do boje" (null = není to chibi důvod). */
  chibiVerdict(data: Encounter, reasonId: string, active: Set<string>): { ok: boolean; flaw?: Flaw } | null {
    const CAT: Record<string, 'weapon' | 'horse' | 'armour'> = {
      RZ_CHYBI_ZBRAN: 'weapon',
      RZ_CHYBI_KUN: 'horse',
      RZ_CHYBI_ZBROJ: 'armour',
    };
    const cat = CAT[reasonId];
    if (!cat || !active.has('R21')) return null;
    // světec (svatozář) do boje gear nepotřebuje — chrání finále se sv. Václavem
    if (data.knight.tags.includes('svatozar')) return { ok: false };
    const has = this.hasGear(data.knight.equipment, cat);
    if (has) return { ok: false };
    const hintKey = { weapon: 'chibiHintZbran', horse: 'chibiHintKun', armour: 'chibiHintZbroj' }[cat];
    return { ok: true, flaw: { reasonId, ruleRef: 'R21', hint: { cs: Content.ui(hintKey), en: Content.ui(hintKey) } } };
  },

  /** Objektivní verdikt pro vizuální prohřešky vázané na tag portrétu. */
  tagReasonVerdict(data: Encounter, reasonId: string, active: Set<string>): { ok: boolean; flaw?: Flaw } | null {
    const MAP: Record<string, { tag: string; rule: string; hintKey: string }> = {
      RZ_VOUS_DLOUHY: { tag: 'vous_dlouhy', rule: 'R23', hintKey: 'tagHintVousDlouhy' },
      RZ_BRYLE: { tag: 'bryle', rule: 'R24', hintKey: 'tagHintBryle' },
      RZ_KALICH: { tag: 'kalich', rule: 'R22', hintKey: 'tagHintKalich' },
      RZ_URAZKA_VACLAV: { tag: 'urazka_vaclav', rule: 'R25', hintKey: 'tagHintVaclav' },
    };
    const m = MAP[reasonId];
    if (!m || !active.has(m.rule)) return null;
    const ok = data.knight.tags.includes(m.tag);
    if (!ok) return { ok: false };
    return { ok: true, flaw: { reasonId, ruleRef: m.rule, hint: { cs: Content.ui(m.hintKey), en: Content.ui(m.hintKey) } } };
  },

  /** Meč nad 120 cm bez průkazu (RZ_ZBROJAK) — objektivně z viditelné délky meče. */
  swordVerdict(data: Encounter, reasonId: string, active: Set<string>): { ok: boolean; flaw?: Flaw } | null {
    if (reasonId !== 'RZ_ZBROJAK' || !active.has('R03')) return null;
    let maxCm = 0;
    for (const e of data.knight.equipment) {
      if (!/meč|šavle/i.test(e)) continue;
      const m = e.match(/(\d+)\s*cm/);
      if (m) maxCm = Math.max(maxCm, Number(m[1]));
    }
    if (maxCm <= 120) return { ok: false }; // meč není dlouhý → zamítnutí za délku je chyba
    return {
      ok: true,
      flaw: { reasonId, ruleRef: 'R03', hint: { cs: Content.ui('swordHint'), en: Content.ui('swordHint') } },
    };
  },

  /** Má rytíř v (viditelné) výstroji zbraň / koně / zbroj? */
  hasGear(equipment: string[], cat: 'weapon' | 'horse' | 'armour'): boolean {
    const RE: Record<typeof cat, RegExp> = {
      weapon: /meč|šavle|kopí|luk|kuše|seker|halapart|dýk|tesák|palcát|cep|řemdih|srp|kladiv|zbraň|meč/i,
      horse: /kůň|kobyl|oř\b|oře|kon[iě]/i,
      armour: /brn|plát|krun|drátěn|přilb|helm|štít|zbroj/i,
    };
    return equipment.some((e) => RE[cat].test(e) && !/žádn|bez /i.test(e));
  },

  /** Má encounter vůbec nějakou platnou chybu? (čisté papíry => ne) */
  hasValidFlaw(enc: ActiveEncounter, day: number): boolean {
    const active = this.activeRuleIds(day);
    return [...enc.data.flaws, ...enc.syntheticFlaws].some((f) => active.has(f.ruleRef));
  },

  /** Důvody, kterými LZE TEĎ tohoto rytíře zamítnout (aktivní + ještě nepoužité). */
  solvableReasons(data: Encounter, day: number): string[] {
    const active = this.activeRuleIds(day);
    const out = new Set<string>();
    for (const f of data.flaws) {
      if (active.has(f.ruleRef) && !GameState.usedReasons.has(f.reasonId)) out.add(f.reasonId);
    }
    for (const id of ['RZ_CHYBI_ZBRAN', 'RZ_CHYBI_KUN', 'RZ_CHYBI_ZBROJ']) {
      if (!GameState.usedReasons.has(id) && this.chibiVerdict(data, id, active)?.ok) out.add(id);
    }
    for (const id of ['RZ_VOUS_DLOUHY', 'RZ_BRYLE', 'RZ_KALICH', 'RZ_URAZKA_VACLAV']) {
      if (!GameState.usedReasons.has(id) && this.tagReasonVerdict(data, id, active)?.ok) out.add(id);
    }
    if (!GameState.usedReasons.has('RZ_ZBROJAK') && this.swordVerdict(data, 'RZ_ZBROJAK', active)?.ok) out.add('RZ_ZBROJAK');
    return [...out];
  },

  /** Lze encounter TEĎ zamítnout (aspoň jeden nepoužitý platný důvod)? */
  rejectableNow(data: Encounter, day: number): boolean {
    return this.solvableReasons(data, day).length > 0;
  },

  /** Lze rytíře TEĎ krýt dekretem? (tag match + nepoužitý dekret + zbývá rozpočet) */
  decreeCoverable(data: Encounter): boolean {
    if (GameState.decreesLeft <= 0) return false;
    const tags = new Set(data.knight.tags);
    return Content.all.decrees.some((d) => tags.has(d.appliesIf.knightTag) && !GameState.issuedDecrees.includes(d.id));
  },

  /** Dekrety použitelné na tohoto rytíře (tag match + zbývající kusy). */
  applicableDecrees(enc: ActiveEncounter): Decree[] {
    if (GameState.decreesLeft <= 0) return [];
    const tags = new Set(enc.data.knight.tags);
    return Content.all.decrees.filter(
      (d) => tags.has(d.appliesIf.knightTag) && !GameState.issuedDecrees.includes(d.id),
    );
  },

  /** Vydání dekretu: odečte kus, aktivuje dekret a vstříkne flaw do encounteru. */
  issueDecree(enc: ActiveEncounter, decree: Decree): boolean {
    if (!GameState.useDecree(decree.id)) return false;
    enc.syntheticFlaws.push({
      reasonId: decree.injectsReason,
      ruleRef: decree.id,
      hint: decree.text,
    });
    return true;
  },
};
