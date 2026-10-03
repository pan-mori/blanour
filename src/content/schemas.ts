/**
 * KONTRAKT mezi kódem a obsahem (public/content/*.json).
 * Po zmrazení (konec M0) jen aditivní změny! Zrcadlí ho scripts/validate-content.mjs
 * a dokumentuje CONTENT_GUIDE.md.
 */

/** Lokalizovaný text. CS povinné, EN smí být prázdné/chybět (fallback na CS). */
export interface LString {
  cs: string;
  en?: string;
}

/** Epocha dne - každý herní den se odehrává v jiném století. */
export interface Era {
  day: number; // 1..5
  year: number; // např. 1448
  label: LString; // „Pozdní středověk"
  /** Název novin té epochy (hlavička Newspaper scény) */
  masthead: LString;
  /** Krátký flavor text do novin */
  flavor?: LString;
}

/** Vyhláška - aktivuje se daným dnem a platí do konce hry. */
export interface Rule {
  id: string; // R01…
  day: number; // od kterého dne platí
  cislo: LString; // „Vyhláška č. 7/1448"
  text: LString;
  /** Důvod zamítnutí, který tato vyhláška opravňuje */
  reasonId: string;
}

/** Kategorie důvodu - zásuvka v razítkové skříni. */
export type ReasonCategory =
  | 'formular'
  | 'poplatek'
  | 'papiry'
  | 'pecet'
  | 'vira'
  | 'kun'
  | 'vystroj'
  | 'chybi'
  | 'dekret';

/** Vzácnost razítka - barevné odlišení jako v RPG. */
export type ReasonRarity = 'common' | 'legendary';

/** Důvod zamítnutí - položka v nabídce hráče. */
export interface Reason {
  id: string; // RZ_…
  ruleRef: string; // která vyhláška ho kryje
  label: LString;
  /** Zásuvka razítkové skříně, kam důvod patří (default dle heuristiky v kódu). */
  category?: ReasonCategory;
  /**
   * Vzácnost: 'common' (default, bílá) nebo 'legendary' (zlatá) - legendární
   * razítko je univerzální „vyhnutí se čemukoli", ale po použití varuje.
   */
  rarity?: ReasonRarity;
  /**
   * Klíče předmětů (mec, stit, kun…): důvod se NEnabízí v hlavním seznamu,
   * ale objeví se až po kliknutí na odpovídající předmět rytíře (hádanka!).
   */
  itemKeys?: string[];
}

export type FieldRender = 'text' | 'kolek' | 'seal' | 'equipment' | 'photo' | 'signature';

export interface DocField {
  key: string;
  label: LString;
  pos: [number, number]; // px v souřadnicích šablony
  multiline?: boolean;
  render?: FieldRender; // default 'text'
}

/** Šablona dokumentu (layout); konkrétní hodnoty dodá encounter. */
export interface DocTemplate {
  id: string; // 'zadost', 'vystroj'…
  title: LString;
  size: [number, number]; // px
  stampZone: [number, number, number, number]; // x, y, w, h
  bg?: string; // texture key; bez něj kreslíme placeholder papír
  /** Pečeť, kterou musí mít razítko pro TENTO formulář (K/E/V). Bez ní platí mapování dle epochy. */
  sealType?: 'K' | 'E' | 'V';
  fields: DocField[];
}

/** Dokument v konkrétním encounteru. */
export interface EncounterDoc {
  template: string; // DocTemplate.id
  fields: Record<string, string>; // key -> hodnota (zobrazí se CS/EN beze změny)
  /** Převázaný provázkem - hráč ho musí nejdřív rozvázat (M2 minihra) */
  wrapped?: boolean;
  /** Pečeť na dokumentu: id vzoru pečeti, 'broken', nebo chybí */
  seal?: string;
}

export interface Knight {
  name: string;
  sprite: string; // texture key portrétu
  /** Tagy pro decrees.appliesIf (vous, kun_bily, levak…) */
  tags: string[];
  /** Co má viditelně na sobě (ikony u portrétu) */
  equipment: string[];
  intro: LString;
}

/** Autorsky zapsaná chyba - ground truth pro validaci zamítnutí. */
export interface Flaw {
  reasonId: string;
  ruleRef: string;
  doc?: string; // template id, kde je chyba vidět
  field?: string;
  hint: LString; // „Kolek za 20, vyhláška žádá 50."
}

export interface Encounter {
  id: string; // ENC_001…
  /** Pevně přišpendlený den (skriptované momenty, sv. Václav…) */
  day?: number;
  minDay: number;
  weight?: number; // default 1
  requiresRules?: string[];
  knight: Knight;
  documents: EncounterDoc[];
  /** Prázdné pole = papíry čisté => každé zamítnutí je chyba. */
  flaws: Flaw[];
  outcomes?: {
    rejectOk?: LString;
    rejectBad?: LString;
    approve?: LString;
  };
}

export interface NewsItem {
  id: string; // N_001…
  minDay: number;
  maxDay?: number; // epochové zprávy: minDay=maxDay=den epochy
  weight?: number;
  tone: 'serious' | 'absurd';
  headline: LString;
  body?: LString;
}

/** „VYDAT NOVOU VYHLÁŠKU" - nouzový dekret. */
export interface Decree {
  id: string; // V_…
  appliesIf: { knightTag: string };
  text: LString;
  /** Reason, který dekret vstříkne do aktuálního encounteru */
  injectsReason: string;
}

/** Infografika po facce / na konci dne / pokřik netrpělivého rytíře. */
export interface Infographic {
  id: string;
  kind: 'facka' | 'dayend' | 'heckle';
  text: LString;
}

export interface ContentBundle {
  eras: Era[];
  rules: Rule[];
  reasons: Reason[];
  docTemplates: DocTemplate[];
  encounters: Encounter[];
  news: NewsItem[];
  decrees: Decree[];
  infographics: Infographic[];
  strings: Record<string, LString>;
}

/** Soubory v public/content/ -> klíč v ContentBundle */
export const CONTENT_FILES: Record<keyof ContentBundle, string> = {
  eras: 'eras.json',
  rules: 'rules.json',
  reasons: 'reasons.json',
  docTemplates: 'doc-templates.json',
  encounters: 'encounters.json',
  news: 'news.json',
  decrees: 'decrees.json',
  infographics: 'infographics.json',
  strings: 'strings.json',
};
