import { TUNING } from '../config';

export type EndingType = 'survived' | 'beaten' | 'released';
export type Lang = 'cs' | 'en';

/** Co má scéna udělat po herní události. */
export type Transition = 'continue' | 'cutaway' | 'ending:beaten' | 'ending:released' | 'ending:survived' | 'newspaper';

export interface RunStats {
  rejected: number;
  rejectedWrong: number;
  decreesUsed: number;
  coffees: number; // čistě komická statistika
}

/**
 * Jediný zdroj pravdy o běhu hry. Prostý singleton modul (žádný Phaser registry)
 * - typová bezpečnost, testovatelnost. Scény čtou/mění přes metody, které vracejí
 * Transition, takže logika toku hry žije tady a ne po scénách.
 */
class GameStateImpl {
  lang: Lang = 'cs';
  /** Ztlumení zvuku - NASTAVENÍ (ne stav běhu). Zdroj pravdy je tady (in-memory),
   *  takže restart scény (např. přepnutí jazyka) hodnotu nepřehodí. */
  audioMuted: boolean = this.readMuted();
  day = 1;
  /** Životy (facky). Normálně TUNING.lives, finále (sv. Václav) je dočasně zvedne na 5,
   *  proto explicitní number (ne literál z TUNING). */
  lives: number = TUNING.lives;
  decreesLeft = TUNING.decrees;
  endingType: EndingType | null = null;
  stats: RunStats = this.freshStats();
  /** Vyhlášky vydané hráčem během hry (decree ids) - platí do konce běhu. */
  issuedDecrees: string[] = [];
  /** Vyhlášky, které úředník uvedl v platnost (R…). Rostou každý den - od mála po mnoho. */
  enactedRules = new Set<string>();
  /** Vyhlášky zvolené ve večerním úřadování (R…), které ještě NEJSOU v platnosti -
   *  čekají v šuplíku „Podpultové vyhlášky" a hráč je musí aktivně zahrát na rytíře. */
  pendingRules: string[] = [];
  /** Důvody zamítnutí už SPOTŘEBOVANÉ v tomto runu (legendární razítko + důvod, který
   *  ve finále přebil kníže). Razítko zmizí ze skříně. Běžná razítka se NESPOTŘEBOVÁVAJÍ -
   *  zůstávají v sadě a hráč je používá opakovaně (buduje si sbírku vyhlášek). */
  usedReasons = new Set<string>();
  /** Kolik rytířů v tomto runu už DÁVKOVAČ naplánoval na danou vyhlášku (ruleRef) jako
   *  zamýšlené řešení. Strop je TUNING.maxSameRulePerRun - víc rytířů „na stejnou věc"
   *  (groše, formulář, délka meče…) se za run nevygeneruje, aby průchod nebyl stejný.
   *  NEOVLIVŇUJE hráčova razítka - jen to, na co se rytíři generují. */
  ruleSchedule = new Map<string, number>();
  seenEncounterIds = new Set<string>();
  seenNewsIds = new Set<string>();
  /** Razítka (reasonId), která už hráč ve skříni VIDĚL. „NOVÁ" se zvýrazní jen razítko
   *  nově dostupné (po uvedení vyhlášky/dekretu v platnost), dokud ho hráč v zásuvce
   *  neotevře - pak zvýraznění zmizí. Dřív se za „nové" značily jen dekrety, a to napořád,
   *  takže zvýraznění působilo náhodně. */
  seenReasons = new Set<string>();

  /** Úřední podmínky dvou základních vyhlášek (R01 kolek, R02 formulář), které se
   *  mění startem každého období (dne) - hodnota kolku a typ platného formuláře. */
  reqKolek = 30;
  reqFormular = 'B-1448';

  /** Startovní (málo) vyhlášek - s těmi se úřaduje první den. Kolek+formulář (R01/R02)
   *  platí VÝHRADNĚ na směně 1 - o deaktivaci od směny 2 rozhoduje RuleEngine.activeRuleIds. */
  static readonly BASE_RULES = ['R01', 'R02'];
  /** Možné hodnoty kolku (grošů) a platných formulářů - losuje se každé období. */
  static readonly KOLEK_POOL = [10, 20, 30];
  static readonly FORM_POOL = ['B-1448', 'C-1500', 'R-1627', 'K-1850', 'D-1969', 'E-2026'];

  private freshStats(): RunStats {
    return { rejected: 0, rejectedWrong: 0, decreesUsed: 0, coffees: 0 };
  }

  private readMuted(): boolean {
    try { return localStorage.getItem('blanour:mute') === '1'; } catch { return false; }
  }

  /** Přepne ztlumení, uloží (best-effort) a vrátí nový stav. */
  toggleMuted(): boolean {
    this.audioMuted = !this.audioMuted;
    try { localStorage.setItem('blanour:mute', this.audioMuted ? '1' : '0'); } catch { /* private mode */ }
    return this.audioMuted;
  }

  reset(): void {
    this.day = 1;
    this.lives = TUNING.lives;
    this.decreesLeft = TUNING.decrees;
    this.endingType = null;
    this.stats = this.freshStats();
    this.issuedDecrees = [];
    this.enactedRules = new Set(GameStateImpl.BASE_RULES);
    this.pendingRules = [];
    this.rollEraRules();
    this.usedReasons.clear();
    this.ruleSchedule.clear();
    this.seenEncounterIds.clear();
    this.seenNewsIds.clear();
    this.seenReasons.clear();
  }

  /** Označ razítka za „už viděná" (po otevření zásuvky skříně) - přestanou se značit NOVÁ. */
  markReasonsSeen(ids: string[]): void {
    for (const id of ids) this.seenReasons.add(id);
  }

  /** Přelosuje úřední podmínky (kolek + formulář) pro nové období. */
  rollEraRules(): void {
    const P = GameStateImpl;
    this.reqKolek = P.KOLEK_POOL[Math.floor(Math.random() * P.KOLEK_POOL.length)];
    this.reqFormular = P.FORM_POOL[Math.floor(Math.random() * P.FORM_POOL.length)];
  }

  /** Doplní do textu aktuální úřední hodnoty: {kolek} a {formular}. */
  fillVars(s: string): string {
    return s.replace(/\{kolek\}/g, String(this.reqKolek)).replace(/\{formular\}/g, this.reqFormular);
  }

  enactRule(id: string): void {
    this.enactedRules.add(id);
  }

  /** Večerní volba: vyhláška putuje do šuplíku jako „k zahrání", ne rovnou v platnost. */
  addPendingRule(id: string): void {
    if (!this.enactedRules.has(id) && !this.pendingRules.includes(id)) this.pendingRules.push(id);
  }

  /** Hráč vyhlášku aktivně zahrál ze šuplíku → teprve teď vstupuje v platnost. */
  playPendingRule(id: string): boolean {
    const i = this.pendingRules.indexOf(id);
    if (i < 0) return false;
    this.pendingRules.splice(i, 1);
    this.enactedRules.add(id);
    return true;
  }

  /** Spotřebuj důvod (legendární razítko / kníže ve finále) - zmizí ze skříně. */
  useReason(id: string): void {
    this.usedReasons.add(id);
  }

  /** Kolik rytířů ještě SMÍ dávkovač naplánovat na tuto vyhlášku v rámci runu. */
  scheduleLeft(ruleId: string): number {
    return Math.max(0, TUNING.maxSameRulePerRun - (this.ruleSchedule.get(ruleId) ?? 0));
  }

  /** Zaznamenej, že dávkovač naplánoval dalšího rytíře na tuto vyhlášku. */
  recordSchedule(ruleId: string): void {
    this.ruleSchedule.set(ruleId, (this.ruleSchedule.get(ruleId) ?? 0) + 1);
  }

  /** Správné zamítnutí. */
  recordReject(): Transition {
    this.stats.rejected++;
    return 'continue';
  }

  /** Chyba (špatný/bezdůvodný důvod, vypršelá trpělivost) => facka. `amount` = kolik životů
   *  facka sebere (sv. Václav dává DMG za 2); počet chyb roste vždy o 1. */
  loseLife(amount = 1): Transition {
    this.lives -= amount;
    this.stats.rejectedWrong++;
    if (this.lives <= 0) {
      this.lives = 0;
      this.endingType = 'beaten';
      return 'ending:beaten';
    }
    return 'cutaway';
  }

  /** Hráč orazítkoval SCHVÁLENO - rytíři vyjedou. */
  approve(): Transition {
    this.endingType = 'released';
    return 'ending:released';
  }

  useDecree(id: string): boolean {
    if (this.decreesLeft <= 0) return false;
    this.decreesLeft--;
    this.stats.decreesUsed++;
    this.issuedDecrees.push(id);
    return true;
  }

  /** Konec dne. */
  nextDay(): Transition {
    this.stats.coffees += 2 + Math.floor(Math.random() * 4);
    if (this.day >= TUNING.days) {
      this.endingType = 'survived';
      return 'ending:survived';
    }
    this.day++;
    this.lives = TUNING.lives; // po konci dne se životy doplní do plna
    this.rollEraRules(); // nové období → nová cena kolku a platný formulář
    return 'newspaper';
  }
}

export const GameState = new GameStateImpl();
