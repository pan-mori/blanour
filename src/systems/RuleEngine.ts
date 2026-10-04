import { TUNING } from '../config';
import type { Decree, Encounter, Flaw, Reason, Rule } from '../content/schemas';
import { beardLen, type BeardLen } from '../ui/KnightPortrait';
import { Content } from './Content';
import { GameState } from './GameState';

/** Vyhlášky o vousech - nikdy nesmí být v platnosti všechny 3 naráz (jinak není legální
 *  žádná délka vousu). Hlídá to večerní legislativa i „jiní úředníci". */
const BEARD_RULE_IDS = new Set(['R23', 'R29', 'R30']);

/** Encounter rozehraný na stole - vestavěné flaws + flaws vstříknuté dekrety. */
export interface ActiveEncounter {
  data: Encounter;
  syntheticFlaws: Flaw[];
}

/**
 * Ground truth je autorsky zapsaná v encounter.flaws; tady se jen vyhodnocuje.
 * reason.ruleRef smí odkazovat na vyhlášku (R…) NEBO dekret (V…) - dekretové
 * důvody se aktivují vydáním dekretu (GameState.issuedDecrees).
 */
// Kolek (R01) a formulář (R02) jsou základní vyhlášky platné VÝHRADNĚ na směně 1.
// Od směny 2 se deaktivují, aby rytíře šlo zamítat jen na dobové vyhlášky a ne pořád
// na tyhle dvě základní. Zůstávají v GameState.enactedRules (ať se znovu nenabízejí
// ve večerní legislativě), jen je tady podle aktuální směny vyřadíme z aktivních.
const DAY1_ONLY_RULES = ['R01', 'R02'];

export const RuleEngine = {
  activeRuleIds(day: number = GameState.day): Set<string> {
    // aktivní jsou vyhlášky, které úředník uvedl v platnost + jím vydané dekrety
    const ids = new Set(GameState.enactedRules);
    for (const d of GameState.issuedDecrees) ids.add(d);
    // kolek + formulář platí jen na směně 1
    if (day > 1) for (const id of DAY1_ONLY_RULES) ids.delete(id);
    return ids;
  },

  /** Množina vyhlášek, se kterými se dá den SESTAVIT: aktivní + ty, které čekají
   *  v šuplíku (pendingRules). Dávkovač (EncounterManager) díky tomu smí naplánovat
   *  i rytíře řešitelného teprve po zahrání čekající vyhlášky - jinak by byl den po
   *  večerní legislativě skoro prázdný (vyhláška vstupuje v platnost až zahráním). */
  schedulableRuleIds(day: number = GameState.day): Set<string> {
    const ids = this.activeRuleIds(day);
    for (const id of GameState.pendingRules) {
      if (day > 1 && DAY1_ONLY_RULES.includes(id)) continue;
      ids.add(id);
    }
    return ids;
  },

  /** ruleRef pro daný důvod (společný slovník z reasons.json). */
  reasonRule(reasonId: string): string | undefined {
    return Content.all.reasons.find((r) => r.id === reasonId)?.ruleRef;
  },

  /** Nezavedl by tenhle enact 3. vyhlášku o vousech? (to se nesmí - viz BEARD_RULE_IDS) */
  wouldBreakBeard(id: string): boolean {
    if (!BEARD_RULE_IDS.has(id)) return false;
    const active = [...GameState.enactedRules, ...GameState.pendingRules].filter((x) => BEARD_RULE_IDS.has(x)).length;
    return active >= 2;
  },

  /**
   * „Jiní úředníci": vyhlášky, které si hráč nevzal, může úřad vydat SÁM.
   *  1) Pevné termíny (TUNING.externalDeadlines) - vyhlášku vynutí nejpozději v daný den
   *     (pečetění R27 nejpozději v půlce hry, pokud si ji hráč nevybral).
   *  2) Náhodná eskalace - šance roste se dnem; občas vydá jednu nepřijatou vyhlášku.
   *  Vrací vyhlášky uvedené v platnost TEĎ (pro oznámení hráči). Volá se na začátku dne.
   */
  rollOtherOfficials(day: number): Rule[] {
    const enactedNow: Rule[] = [];
    const isTaken = (id: string): boolean =>
      GameState.enactedRules.has(id) || GameState.pendingRules.includes(id);
    const enact = (r: Rule): void => { GameState.enactRule(r.id); enactedNow.push(r); };

    // 1) pevné termíny (např. pečetění)
    for (const [id, deadline] of Object.entries(TUNING.externalDeadlines)) {
      if (day < deadline || isTaken(id) || this.wouldBreakBeard(id)) continue;
      const r = Content.all.rules.find((x) => x.id === id);
      if (r) enact(r);
    }

    // 2) náhodná eskalace - jedna nepřijatá vyhláška, šance roste se dnem
    const p = Math.min(TUNING.externalEscalationCap, TUNING.externalEscalation * (day - 1));
    if (p > 0 && Math.random() < p) {
      const pool = Content.all.rules.filter(
        (r) => r.day <= day && !isTaken(r.id) && !this.wouldBreakBeard(r.id),
      );
      if (pool.length > 0) enact(pool[Math.floor(Math.random() * pool.length)]);
    }
    return enactedNow;
  },

  /** Smí se důvod TEĎ nabídnout/použít? Razítko zůstává v sadě (žádný strop na hráče),
   *  jen spotřebovaná (legendární/knížetem přebitá) razítka zmizí. `budget` používá
   *  POUZE dávkovač dne: hlídá, kolik rytířů se smí naplánovat na stejnou vyhlášku. */
  reasonUsable(
    reasonId: string,
    ruleId: string | undefined,
    active: Set<string>,
    budget?: Map<string, number> | null,
  ): boolean {
    if (!ruleId || !active.has(ruleId)) return false;
    if (GameState.usedReasons.has(reasonId)) return false;
    if (budget && (budget.get(ruleId) ?? 0) <= 0) return false;
    return true;
  },

  /** Důvody, které hráč SMÍ TEĎ použít: aktivní vyhláška + razítko není spotřebované.
   *  Běžná razítka zůstávají ve skříni napořád (budování sbírky). */
  availableReasons(day: number): Reason[] {
    const active = this.activeRuleIds(day);
    return Content.all.reasons.filter((r) => active.has(r.ruleRef) && !GameState.usedReasons.has(r.id));
  },

  /** Je důvod legendární (univerzální „vyhnutí se čemukoli")? */
  isLegendary(reasonId: string): boolean {
    return Content.all.reasons.find((r) => r.id === reasonId)?.rarity === 'legendary';
  },

  /** Je to důvod vstříknutý právě vydaným dekretem? (zvýraznění „NOVÁ" ve skříni) */
  isIssuedDecreeReason(reasonId: string): boolean {
    return Content.all.decrees.some((d) => GameState.issuedDecrees.includes(d.id) && d.injectsReason === reasonId);
  },

  /** Legendární razítko platí na KOHOKOLI (dokud je jeho vyhláška v platnosti). */
  legendaryVerdict(reasonId: string, active: Set<string>): { ok: boolean; flaw?: Flaw } | null {
    const r = Content.all.reasons.find((x) => x.id === reasonId);
    if (!r || r.rarity !== 'legendary' || !active.has(r.ruleRef)) return null;
    return { ok: true, flaw: { reasonId, ruleRef: r.ruleRef, hint: { cs: Content.ui('legendaryUsed'), en: Content.ui('legendaryUsed') } } };
  },

  /** Je zvolený důvod správný pro tento encounter? */
  validateRejection(enc: ActiveEncounter, reasonId: string, day: number): { ok: boolean; flaw?: Flaw } {
    const active = this.activeRuleIds(day);
    // legendární razítko je univerzální - platí na kohokoli
    const leg = this.legendaryVerdict(reasonId, active);
    if (leg) return leg;
    // „Chybí do boje" (R21) se posuzuje OBJEKTIVNĚ z výstroje - platí u každého,
    // komu daná věc fakticky chybí, ne jen tam, kde to autor vepsal do flaws.
    const chibi = this.chibiVerdict(enc.data, reasonId, active);
    if (chibi) return chibi;
    // vizuální prohřešky na portrétu (brýle/kalich/urážka) - objektivně dle tagu
    const tagV = this.tagReasonVerdict(enc.data, reasonId, active);
    if (tagV) return tagV;
    // vyhlášky o vousech (3 délky) - objektivně z vykreslené délky vousu
    const beardV = this.beardVerdict(enc.data, reasonId, active);
    if (beardV) return beardV;
    // délka meče (RZ_ZBROJAK) - objektivně z viditelné délky, ne jen z autorského flawu
    const sword = this.swordVerdict(enc.data, reasonId, active);
    if (sword) return sword;
    // kolek a formulář - objektivně proti aktuální úřední podmínce (mění se každé období)
    const kolekV = this.kolekVerdict(enc.data, reasonId, active);
    if (kolekV) return kolekV;
    const formV = this.formVerdict(enc.data, reasonId, active);
    if (formV) return formV;
    // co rytíř říká (hanobení knížete) a důvod výjezdu - objektivně z textu
    const speechV = this.speechVerdict(enc.data, reasonId, active);
    if (speechV) return speechV;
    const duvodV = this.reasonFieldVerdict(enc.data, reasonId, active);
    if (duvodV) return duvodV;
    const flaw = [...enc.data.flaws, ...enc.syntheticFlaws].find(
      (f) => f.reasonId === reasonId && active.has(f.ruleRef),
    );
    return { ok: !!flaw, flaw };
  },

  /** Vyhláška o výstroji do boje (zbraň + kůň + zbroj) a mapování kategorie →
   *  {důvod zamítnutí, náhradní kousek do výstroje}. Jediná „gear" vyhláška ve hře. */
  GEAR_RULE: 'R21',
  GEAR_CATS: [
    { cat: 'weapon' as const, reason: 'RZ_CHYBI_ZBRAN', item: 'meč (90 cm)' },
    { cat: 'horse' as const, reason: 'RZ_CHYBI_KUN', item: 'kůň hnědý' },
    { cat: 'armour' as const, reason: 'RZ_CHYBI_ZBROJ', item: 'brnění' },
  ],

  /**
   * „Rytíři si dávají pozor": když je v platnosti (nebo ve frontě) vyhláška o výstroji,
   * dovyzbrojí rytíře, kteří NEJSOU zamýšlený gotcha „chybí výstroj". Bez toho by šla
   * zamítnout skoro půlka rytířů jedním razítkem („chybí kůň"), protože objektivní
   * verdikt R21 bere chybějící kousek u KOHOKOLI - i když autor jeho skutečnou chybu
   * zamýšlel jinde (kolek, formulář, vous…). Takhle zůstane „chybí výstroj" vzácné:
   * jen autorské gotcha kousky, které dávkovač drží na stropu TUNING.maxSameRulePerRun.
   * Vrací KLON (sdílený Content se nemění) jen když je co dovybavit, jinak originál.
   */
  complyGear(data: Encounter, day: number, activeSet?: Set<string>): Encounter {
    const active = activeSet ?? this.activeRuleIds(day);
    if (!active.has(this.GEAR_RULE)) return data;
    if (data.knight.tags.includes('svatozar')) return data; // světec gear nepotřebuje
    const authorMissing = new Set(data.flaws.map((f) => f.reasonId)); // zamýšlené chybějící kousky
    const add: string[] = [];
    for (const g of this.GEAR_CATS) {
      if (authorMissing.has(g.reason)) continue; // zamýšlený gotcha → nech chybět
      if (this.hasGear(data.knight.equipment, g.cat)) continue; // už má
      add.push(g.item);
    }
    if (add.length === 0) return data;
    return { ...data, knight: { ...data.knight, equipment: [...data.knight.equipment, ...add] } };
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
    // světec (svatozář) do boje gear nepotřebuje - chrání finále se sv. Václavem
    if (data.knight.tags.includes('svatozar')) return { ok: false };
    const has = this.hasGear(data.knight.equipment, cat);
    if (has) return { ok: false };
    const hintKey = { weapon: 'chibiHintZbran', horse: 'chibiHintKun', armour: 'chibiHintZbroj' }[cat];
    return { ok: true, flaw: { reasonId, ruleRef: 'R21', hint: { cs: Content.ui(hintKey), en: Content.ui(hintKey) } } };
  },

  /** Objektivní verdikt pro vizuální prohřešky vázané na tag portrétu. */
  tagReasonVerdict(data: Encounter, reasonId: string, active: Set<string>): { ok: boolean; flaw?: Flaw } | null {
    const MAP: Record<string, { tag: string; rule: string; hintKey: string }> = {
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

  /** Mapování vousových důvodů → zakázaná délka vousu + jejich vyhláška. */
  BEARD_REASONS: {
    RZ_VOUS_ZADNY: { len: 'none' as BeardLen, rule: 'R30', hintKey: 'tagHintVousZadny' },
    RZ_VOUS_KRATKY: { len: 'short' as BeardLen, rule: 'R29', hintKey: 'tagHintVousKratky' },
    RZ_VOUS_DLOUHY: { len: 'long' as BeardLen, rule: 'R23', hintKey: 'tagHintVousDlouhy' },
  } as Record<string, { len: BeardLen; rule: string; hintKey: string }>,

  /** Objektivní verdikt pro vyhlášky o vousech (3 délky). Čte délku vousu
   *  přesně tak, jak ji vykresluje portrét (společná funkce beardLen). */
  beardVerdict(data: Encounter, reasonId: string, active: Set<string>): { ok: boolean; flaw?: Flaw } | null {
    const m = this.BEARD_REASONS[reasonId];
    if (!m || !active.has(m.rule)) return null;
    const ok = beardLen(data.knight.sprite, data.knight.tags) === m.len;
    if (!ok) return { ok: false };
    return { ok: true, flaw: { reasonId, ruleRef: m.rule, hint: { cs: Content.ui(m.hintKey), en: Content.ui(m.hintKey) } } };
  },

  /** Meč nad 120 cm bez průkazu (RZ_ZBROJAK) - objektivně z viditelné délky meče. */
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

  /** Doklady, jejichž platnost se posuzuje OBJEKTIVNĚ proti aktuální úřední podmínce
   *  (ne z autorského flawu, protože podmínka se mění každé období). */
  OBJECTIVE_DOC_REASONS: new Set(['RZ_KOLEK', 'RZ_FORMULAR']),

  /** Najdi primární žádost (má pole kolek/formular). */
  zadostDoc(data: Encounter): { fields: Record<string, string> } | undefined {
    return data.documents.find((d) => d.template.startsWith('zadost'));
  },

  /** Kolek neodpovídá aktuálně požadované hodnotě (R01) - objektivně z pole „kolek".
   *  Baseline „30" se zobrazuje jako aktuální požadavek, takže je vždy správně;
   *  jiná (nižší/chybějící) hodnota je neplatná. */
  kolekVerdict(data: Encounter, reasonId: string, active: Set<string>): { ok: boolean; flaw?: Flaw } | null {
    if (reasonId !== 'RZ_KOLEK' || !active.has('R01')) return null;
    const doc = this.zadostDoc(data);
    if (!doc) return null;
    const raw = String(doc.fields.kolek ?? '').trim();
    const effStr = raw === '30' ? String(GameState.reqKolek) : raw;
    const n = parseInt(effStr.replace(/[^0-9]/g, ''), 10);
    const have = Number.isFinite(n) ? n : -1; // „-" / nečíslo = chybí
    if (have === GameState.reqKolek) return { ok: false };
    const shown = raw === '30' ? String(GameState.reqKolek) : raw;
    return {
      ok: true,
      flaw: { reasonId, ruleRef: 'R01', hint: {
        cs: `Kolek „${shown}", vyhláška žádá ${GameState.reqKolek} grošů.`,
        en: `Duty stamp "${shown}", decree requires ${GameState.reqKolek} groschen.`,
      } },
    };
  },

  /** Formulář neodpovídá aktuálně platnému (R02) - objektivně z pole „formular".
   *  Výchozí „B-1448" je baseline a ve hře se zobrazuje jako právě platný formulář,
   *  takže je vždy v pořádku; jiné (dobové/husitské) formuláře jsou neplatné. */
  formVerdict(data: Encounter, reasonId: string, active: Set<string>): { ok: boolean; flaw?: Flaw } | null {
    if (reasonId !== 'RZ_FORMULAR' || !active.has('R02')) return null;
    const doc = this.zadostDoc(data);
    if (!doc) return null;
    const raw = String(doc.fields.formular ?? '');
    const eff = raw === 'B-1448' ? GameState.reqFormular : raw;
    if (eff === GameState.reqFormular) return { ok: false };
    return {
      ok: true,
      flaw: { reasonId, ruleRef: 'R02', hint: {
        cs: `Formulář „${eff}", vyhláška žádá „${GameState.reqFormular}".`,
        en: `Form "${eff}", decree requires "${GameState.reqFormular}".`,
      } },
    };
  },

  /** Hanobení knížete (R31) - objektivně z toho, co rytíř ŘÍKÁ (jeho hláška). */
  speechVerdict(data: Encounter, reasonId: string, active: Set<string>): { ok: boolean; flaw?: Flaw } | null {
    if (reasonId !== 'RZ_HANA_KNIZE' || !active.has('R31')) return null;
    const t = `${data.knight.intro.cs} ${data.knight.intro.en}`.toLowerCase();
    const bad = /spáč|pytel ovsa|ať si spí|líná hora|přežran|sleeper|sack of oats|lazy mountain/.test(t);
    if (!bad) return { ok: false };
    return { ok: true, flaw: { reasonId, ruleRef: 'R31', hint: { cs: Content.ui('hanaKnizeHint'), en: Content.ui('hanaKnizeHint') } } };
  },

  /** Důvod výjezdu se neslučuje s vyhláškou (R32) - objektivně z pole „duvod". */
  reasonFieldVerdict(data: Encounter, reasonId: string, active: Set<string>): { ok: boolean; flaw?: Flaw } | null {
    if (reasonId !== 'RZ_DUVOD' || !active.has('R32')) return null;
    const d = String(this.zadostDoc(data)?.fields.duvod ?? '').toLowerCase();
    const bad = /pivo|horko|počasí|beer/.test(d);
    if (!bad) return { ok: false };
    return { ok: true, flaw: { reasonId, ruleRef: 'R32', hint: { cs: Content.ui('duvodHint'), en: Content.ui('duvodHint') } } };
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
    // autorské flaws (kromě dokladů posuzovaných objektivně - ty se mění každé období)
    if ([...enc.data.flaws, ...enc.syntheticFlaws]
      .some((f) => !this.OBJECTIVE_DOC_REASONS.has(f.reasonId) && active.has(f.ruleRef))) return true;
    if (this.kolekVerdict(enc.data, 'RZ_KOLEK', active)?.ok) return true;
    if (this.formVerdict(enc.data, 'RZ_FORMULAR', active)?.ok) return true;
    return false;
  },

  /**
   * Důvody, kterými LZE tohoto rytíře zamítnout. `active` = platné vyhlášky (default
   * aktivní; dávkovač posílá schedulable = aktivní + čekající). `budget` = denní
   * rozpočet použití vyhlášek (dávkovač); bez něj se počítá proti stropu runu.
   * Důvod projde, jen když jeho vyhlášce ještě zbývá použití (ruleAvail).
   */
  solvableReasons(
    data: Encounter,
    day: number,
    activeSet?: Set<string>,
    budget: Map<string, number> | null = null,
  ): string[] {
    const active = activeSet ?? this.activeRuleIds(day);
    const out = new Set<string>();
    const add = (reasonId: string, ruleId: string | undefined): void => {
      if (this.reasonUsable(reasonId, ruleId, active, budget)) out.add(reasonId);
    };
    for (const f of data.flaws) {
      // kolek/formulář řešíme objektivně níže (autorský flaw by s měnící se podmínkou lhal)
      if (this.OBJECTIVE_DOC_REASONS.has(f.reasonId)) continue;
      add(f.reasonId, f.ruleRef);
    }
    if (this.kolekVerdict(data, 'RZ_KOLEK', active)?.ok) add('RZ_KOLEK', 'R01');
    if (this.formVerdict(data, 'RZ_FORMULAR', active)?.ok) add('RZ_FORMULAR', 'R02');
    if (this.speechVerdict(data, 'RZ_HANA_KNIZE', active)?.ok) add('RZ_HANA_KNIZE', 'R31');
    if (this.reasonFieldVerdict(data, 'RZ_DUVOD', active)?.ok) add('RZ_DUVOD', 'R32');
    for (const id of ['RZ_CHYBI_ZBRAN', 'RZ_CHYBI_KUN', 'RZ_CHYBI_ZBROJ']) {
      if (this.chibiVerdict(data, id, active)?.ok) add(id, 'R21');
    }
    for (const id of ['RZ_BRYLE', 'RZ_KALICH', 'RZ_URAZKA_VACLAV']) {
      const m = { RZ_BRYLE: 'R24', RZ_KALICH: 'R22', RZ_URAZKA_VACLAV: 'R25' }[id]!;
      if (this.tagReasonVerdict(data, id, active)?.ok) add(id, m);
    }
    for (const id of ['RZ_VOUS_ZADNY', 'RZ_VOUS_KRATKY', 'RZ_VOUS_DLOUHY']) {
      if (this.beardVerdict(data, id, active)?.ok) add(id, this.BEARD_REASONS[id]?.rule);
    }
    if (this.swordVerdict(data, 'RZ_ZBROJAK', active)?.ok) add('RZ_ZBROJAK', 'R03');
    // legendární razítka platí univerzálně - dokud je aktivní a nespotřebované, řeší kohokoli
    for (const r of Content.all.reasons) {
      if (r.rarity === 'legendary') add(r.id, r.ruleRef);
    }
    return [...out];
  },

  /**
   * DEBUG (nápověda W+H): co je na rytíři „špatně" a jakou vyhláškou to legálně zamítnout.
   * Vrací každý použitelný důvod proti SCHEDULABLE množině (aktivní + čekající ve šuplíku),
   * ať nápověda ukáže i řešení, které se odemkne teprve zahráním čekající vyhlášky.
   * `active=false` znamená „vyhláška je zatím jen ve šuplíku - nejdřív ji zahraj".
   * Legendární (univerzální) razítka se vypouští - platí na kohokoli a jen by zašuměla.
   */
  debugFindings(enc: ActiveEncounter, day: number = GameState.day): {
    reasonId: string; ruleRef: string; active: boolean;
  }[] {
    const activeNow = this.activeRuleIds(day);
    const sched = this.schedulableRuleIds(day);
    return this.solvableReasons(enc.data, day, sched)
      .filter((id) => !this.isLegendary(id))
      .map((reasonId) => {
        const ruleRef = this.reasonRule(reasonId) ?? '?';
        return { reasonId, ruleRef, active: activeNow.has(ruleRef) };
      });
  },

  /** Lze encounter zamítnout (aspoň jeden platný důvod s volným použitím)? */
  rejectableNow(
    data: Encounter,
    day: number,
    activeSet?: Set<string>,
    budget: Map<string, number> | null = null,
  ): boolean {
    return this.solvableReasons(data, day, activeSet, budget).length > 0;
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
