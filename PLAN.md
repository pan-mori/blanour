# Plán hry pro game jam: „Ještě není tak zle!" (48 hodin)

## Kontext

Game jam s tématem **„Tradice/folklor trošku jinak"**, zbývá **48 hodin**, tým = **sólo + AI agenti**. Hra staví na legendě o blanických rytířích, ale obráceně: rytíři vyjet CHTĚJÍ, a hráč je **úředník Odboru blanických výjezdů**, který je byrokracií drží v hoře, protože nechce přijít o teplé místečko. Inspirace: *Papers, Please*. Jazyk: **česky + anglicky** (CZ primárně, EN překlad na konci). Platforma: **desktop, myš**. Deploy: **Vercel**. Repo: `gamejam` (GitHub `pan-mori/blanour` - SSH push už funguje).

**Engine (rozhodnuto): Phaser 3 (latest stable) + TypeScript + Vite** - největší ekosystém, vestavěný drag&drop/tweeny/pixelArt mód, oficiální vite-ts šablona, triviální statický deploy na Vercel. (Excalibur zavržen: hezčí TS API, ale malá komunita = riziko na jamu.)

## Název (kandidáti)

1. **„Ještě není tak zle!"** ⭐ doporučeno - přímo punchline legendy i celé hry; EN: *"Not Bad Enough Yet"*příde

## Hra v kostce

Hráč sedí za přepážkou v hoře Blaník. Každý den přijdou noviny (zprávy z venku) a nová vyhláška. Rytíři chodí s žádostmi o výjezd („národu je nejhůř!") a hráč musí v jejich dokumentech a výstroji **najít skutečnou chybu**, aby mohl žádost legálně zamítnout. Když je vše v pořádku a zamítne bezdůvodně → **facka** (−1 život ze 3) + komická infografika. Když povolí → rytíři vyjedou (speciální konec). Záchranná brzda: omezený počet **„VYDAT NOVOU VYHLÁŠKU"** - na místě vymyšlený absurdní předpis, který chybu vytvoří.

### Konce
1. **Přežité všechny dny** (výhra): „Hora spí dál. Zle ještě není - zásluhou razítka." + statistiky
2. **3 facky** (prohra): „Rytíři tě vynesli před horu v koši na spisy."
3. **POVOLIT** (tajný/hořkosladký): „Rytíři vyjeli. Bylo tedy nejhůř. Razítka osiřela." >> "byl si mobilizovan, ale po letech uředničity bylo tvoje tělo tak slabé, že ses neani nevyšplahl na koně a uduvali tě tvojí spolubojivnici a jejích koně "

## Mechaniky

### 1. Kontrola dokumentů (jádro)
Na stole leží balík dokumentů (tahatelné papíry, překrývání, zoom na inspekci). Hráč porovnává:
- **dokumenty mezi sebou** (jméno, datum, platnost - např. formulář z roku 1420, „od husitských válek neplatný"),
- **dokumenty vs. aktivní vyhlášky dne** (chybějící příloha, kolek, průkaz),
- **některé dokumenty jsou zabalené v pro provazku a ty myší musíš tahnou směrem provazku od začatku do konce abys to rychle otevřel** 
- **konstrola přečena dopisech**
- **výstrojní list vs. ikony výstroje na portrétu rytíře** (chybí přilba, místo meče pánev, hnědý kůň místo bílého).

měl by tu byt časovy pres od nadrženych rytiřu ktery už už chtěje vyjet když čekaš moc dlouho nebudou tě respektovat pokud jím nedáš duvod 

Zamítnutí vyžaduje **výběr konkrétního důvodu** ze seznamu - validuje se proti ground-truth „flaw tagům" encounteru. Špatný důvod = chyba = facka.

### 2. Razítkování - navržené postupy (progresivní úrovně)
- **Úroveň 0 (MVP):** kliknout na razítko ZAMÍTNUTO/SCHVÁLENO ve stojánku → táhnout → pustit v cílové zóně dokumentu → otisk. (~1–2 h práce)
- **Úroveň 1 - rotace:** razítko se při tažení mírně kýve; kolečkem myši se dorovnává; tolerance ±15°. Křivý otisk = neplatný dokument, razítkovat znovu (komický povzdech, časová penalizace).
- **Úroveň 2 - inkoust:** před otiskem ťuknout na podušku; jedno nabarvení = 2 syté otisky, pak bledne; bledý otisk neplatí.
- **Úroveň 3 - přítlak (stretch):** držet tlačítko 0,4–0,9 s dle ukazatele; krátce = bledé, dlouho = rozmazané.
- **Stretch - vosková pečeť** pro zvláštní dekrety: držením lít vosk (naplnit 80–100 %), do ~1,5 s přitisknout pečetidlo, než ztvrdne.

**Cutline pro 48 h: úroveň 0 v MVP → pak 1 → pak 2. Úroveň 3 a vosk jen zbude-li čas.**

### 3. Nová vyhláška (zdroj)
2 použití na celou hru. Použití vygeneruje absurdní předpis z poolu („Od dnešního dne povinná reflexní vesta pro koně") → vytvoří flaw → legální zamítnutí. Řeší situaci „papíry dokonalé".

### 4. Životy a infografiky
3 životy („facky"). Po chybě: animace rány + infografická karta, např. *„Dne 14. 3. se kolem Blaníku projela skupina historických šermířů. Skóre: Rytíři 1 : 0 Úředník."* Na konci dne statistická infografika (zamítnuto X, povoleno 0, vypito káv 7…).

### 5. Zprávy (data-driven, 20–40 ks)
Ranní noviny: 3–5 zpráv - mix filozoficky vážných a absurdních; rytíři je v dialozích citují jako důvod k výjezdu. Minihra sběru zpráv = **vyřazeno z 48h scope** (předgenerovaný pool dle zadání).

## Schválené rozšíření (z debaty s parťákem, 3. 10.)

**Shody z debaty:** vady primárně vizuální + dokumenty (bez výslechu - scope); humor = vtipné důvody proč NEpustit, někdy zjevné, někdy skryté; rytíři = základní sprite + vrstvené doplňky („NFT opice"); UI simple. Nástroje (lupa…) a výslechová okna = odloženo.

**Balíček A - vizuální vady rytířů** (vrstvy na procedurálním portrétu, tagy: `stit_lev1/lev2/prazdny`, `srp_kladivo`, `vesta`): jednoocasý lev vs. povinné dva ocasy, prázdný štít („nevidím lva - zpátky a opravit"), srp+kladivo 1952, BOZP vesta bez bot („máš to za 500").
**Balíček B - nové vyhlášky:** atest meče BAKH (Kutná Hora, „a nečum"), STK/emise koně, propadlé podkovy (hlučné + bez reflexních prvků → „srazí vás vozová hradba"), bílé koně zabavil Úřad pro přerozdělování ořů (bez reálných jmen).
**Balíček C - Catch-22 vyhlášky:** cirkulární logika („Výjezd smí povolit jen úředník, který už vyjel…").
**Balíček D - stereotypy úředníků:** polední pauza, „přijďte zítra", okénko vedle - flavor.
**Omezení:** svastika jen jako textová narážka bez symbolu („helma po dědovi z východní fronty, prý nosí smůlu").

- **Struktura hry:** MVP 5 dny ( ale každy den je jiné století ktře budou řešit problemu toho letopočtu ) × 4 encountery; plná verze 5 dní × 4–5 (16–22 encounterů).
- **Eskalace vyhlášek** (1 nová denně): den 1 razítko+kolek 30 grošů → den 2 meč nad 120 cm chce zbrojní průkaz kat. H (Historická) → den 3 emisní kontrola koně (metan, třída B+) → den 4 zákaz výjezdu o svátcích sv. Byrokracia → den 5 povinné školení BOZP pro práci s dřevcem.
- **Dokumenty:** Žádost o výjezd, Výstrojní list, Zbrojní průkaz kat. H, Emisní průkaz koně, Potvrzení o bezdlužnosti vůči Hoře, kolek.
- **Speciální encountery:** sv. Václav osobně (den 5, dokonalé papíry - nutí utratit vyhlášku, nebo volbu konce), rytíř-důchodce, kovář co chce jen na výlet.
- **Příklady zpráv** (tón pro autory):
  - *„Anketa: Je národu nejhůř? 47 % říká, že už bylo hůř, 47 % že teprve bude, 6 % se přejmenovalo na Švýcary."*
  - *„Kolem Blaníku projela kolona historických šermířů. Poplach v hoře odvolán po 6 hodinách."*
  - *„Cena piva poprvé překročila cenu benzínu. Sv. Václav prý v noci osedlával koně."*
  - *„Dálnice D1 dokončena! Oprava začne v pondělí."*
  - *„Průzkum: 9 z 10 rytířů v hoře trpí syndromem vyhoření z nevyhoření."*
- **Příklady důvodů zamítnutí:** chybí kolek 30 grošů; brnění bez revize BOZP; praporec porušuje vyhlášku o vizuálním smogu; žádost na formuláři z r. 1420; v hoře probíhá inventura; chybí razítko z Odboru razítek, který razítka vydává jen s razítkem.
- **i18n:** všechny texty v JSON jako `{ "cs": "...", "en": "..." }`; CZ se píše první, EN doplní překladový WP na konci.

## Technika (architektura)

- **Stack:** Phaser 3 + TypeScript + Vite (oficiální `template-vite-ts`), žádný backend, volitelně localStorage pro „Pokračovat".
- **Rozlišení:** virtuální **fullhd**, `Scale.FIT` + `autoCenter`, `pixelArt: true`, `roundPixels: true` - celočíselně škáluje na 720p/1080p a uveze ~70 znaků 8px textu na řádek (textově náročná hra).
- **Fonty (CZ diakritika ověřena):** **VT323** (psací stroj - dokumenty) + **Pixelify Sans** (UI/titulky), obě OFL s latin-ext, self-hosted woff2, načtené přes `document.fonts.load()` v Boot **před** vytvořením prvního textu. M0 spike: pangram „Příliš žluťoučký kůň úpěl ďábelské ódy" na nasazené URL. Bitmap fonty zamítnuty (friction s diakritikou při libovolném obsahu).
- **Struktura:** `public/content/*.json` (obsah - vlastní ho content agenti, needitují TS), `src/scenes/` (Boot, Preload, Menu, Newspaper, Office, DayEnd, Ending), `src/systems/` (GameState, ContentLoader, EncounterManager, RuleEngine, StampSystem), `src/ui/` (Paper, Desk, DecisionPanel, InspectView, Cutaway), `src/content/schemas.ts` + `validate.ts`, `scripts/validate-content.mjs`, `CONTENT_GUIDE.md`, `CREDITS.md`.
- **Tok scén:** Boot → Preload → Menu → Newspaper(den) → Office(den) → DayEnd → další den / Ending (`survived` | `beaten` | `released`). Inspekce, rozhodování, razítkování a cutaway jsou kontejnery/substavy uvnitř Office, ne samostatné scény.

### RuleEngine (srdce hry)
Ground truth se **autorsky zapisuje, nepočítá** - žádný obecný vyhodnocovač predikátů (na jamu sebevražda). Sdílený slovník = **`reasonId`** propojující tři datasety: *vyhláška* (`rules.json`, aktivuje se dnem, odkazuje na `reasonId`), *důvod zamítnutí* (`reasons.json`, nabídka pro hráče) a *flaw v encounteru* (`{reasonId, ruleRef, doc, field, hint}`). Validace: vybraný důvod je správný ⟺ existuje flaw se stejným `reasonId` a aktivní vyhláškou. Čisté papíry = `flaws: []` → každé zamítnutí je chyba. Nabídka důvodů roste s aktivními vyhláškami = přirozená eskalace.
**Nová vyhláška:** pool `decrees.json`, každá s podmínkou `appliesIf: {knightTag}` (např. `vous`, `kun_bily`) - nabízí se jen dekrety pasující na aktuálního rytíře; použití přidá vyhlášku do aktivních (platí do konce hry - komedie se vrství) a vloží syntetický flaw.

### StampSystem
- **„Carry" model místo klasického dragu:** klik na razítko → letí s kurzorem (tlačítko volné), kolečko/Q-E rotace po 5°, **podržení LMB nad papírem = přítlak** (měří se délka), Esc/RMB vrací. Řeší konflikt drag-vs-press.
- **Ink FSM:** `DRY → (přítisk na podušku ≥200 ms) → INKED(náboj=3)`; každý otisk ubírá, alpha otisku = f(náboje).
- **Kvalita otisku:** úhel ≤ ±15° + délka přítlaku v okně → sytý; krátce = bledý, dlouho = rozmazaný (dvojtisk s offsetem). Konstanty v `config.ts`. Ladí se v izolované dev scéně `?scene=stamplab`.
- **Render:** otisk se kreslí do `RenderTexture` vrstvy papíru → je trvalou součástí dokumentu (přežije tahání i zoom). MVP fallback (prostý drag-drop + okamžitý otisk) sdílí API `StampSystem.apply(decision)` - výměna implementace je jednořádková.

### UI papírů
**Phaser Containers, ne DOM** (DOM se pere se Scale.FIT, rozbíjí pixel estetiku a nejde do RenderTexture). Papír = Container (pozadí + texty polí + kolek + razítková vrstva), draggable, `bringToTop` při uchopení. Inspekce = modal se zvětšením téhož kontejneru na 2× proti ztmavenému pozadí.

### Data & kontrakt mezi agenty
Každý JSON: `{ "version": 1, "items": [...] }`. Schémata v `src/content/schemas.ts` se **zmrazí na konci M0**; `scripts/validate-content.mjs` (~200 řádků, bez závislostí) kontroluje typy + referenční integritu (`ruleRef`/`reasonId`/`template` existují, flaws odpovídají aktivním vyhláškám) a běží i v dev Bootu - je to merge gate pro content agenty. **i18n:** textová pole jako `{ "cs": "...", "en": "..." }` od začátku; EN smí být prázdné (fallback na CS) až do WP8.

Ukázka encounteru:
```jsonc
{ "id": "ENC_012", "minDay": 3, "requiresRules": ["R07"],
  "knight": { "name": "Ctirad z Kouřimi", "sprite": "knight_03",
              "tags": ["vous", "mec"], "equipment": ["mec", "pricilba"],
              "intro": { "cs": "Národu je nejhůř. Tak už mě pusťte.", "en": "" } },
  "documents": [ { "template": "zadost",
      "fields": { "jmeno": "Ctirad z Kouřimi", "kolek": "20" } } ],
  "flaws": [ { "reasonId": "RZ_KOLEK", "ruleRef": "R07", "doc": "zadost",
               "field": "kolek", "hint": "Kolek za 20, vyhláška žádá 50." } ] }
```

- **Deploy:** Vercel, preset Vite (`npm run build` → `dist`), zero-config. Propojit GitHub repo `pan-mori/blanour` s Vercelem (akce uživatele, ~2 min) nebo `vercel` CLI. Deploy funkční už v M0.

## Assety

- **Grafika:** minimalistický pixel art. Zdroje: Kenney.nl (CC0 - UI, ikony), itch.io/OpenGameArt free packy (jen CC0/CC-BY, vést `CREDITS.md`). Vlastní: stůl, papíry, razítka, 6–8 portrétů rytířů, úředník, pozadí hory. Nejdřív placeholdery z kódu, art pass až M3.
- **Audio:** hudba - středověký/folk loop zdarma (OpenGameArt CC0, FreePD, Kevin MacLeod CC-BY s kreditem); SFX - razítko, šustění papíru, facka, fanfára (Kenney audio CC0, freesound CC0).

## Harmonogram 48 h + work packages pro agenty

| WP | Co | Kdy (h) | Závislosti | Akceptace |
|----|----|---------|-----------|-----------|
| **M0 - nasaditelná kostra** |||||
| WP0.1 | Scaffold `template-vite-ts`, 640×360 scale config, stub scény s proklikem celého toku, Vercel live | 0–3 | - | Veřejná URL, proklik Menu→Newspaper→Office→DayEnd→Ending |
| WP0.2 | `schemas.ts` (i18n `{cs,en}`), validátor, `CONTENT_GUIDE.md`, vzorový obsah → **zmrazit schémata** | 0–4 ∥ | - | `npm run validate` správně prochází/padá; content agenti startují |
| WP0.3 | Font spike: VT323 + Pixelify Sans woff2, pangram s diakritikou na nasazené URL v 1×/2×/3× | 0–3 ∥ | - | Žádná chybějící diakritika, žádné rozmazání |
| **M1 - MVP core loop** (vše ∥ po M0; kontrakt = schemas.ts + GameState API) |||||
| WP1.1 | GameState + tok scén + 3 konce jako textové obrazovky | 4–10 | M0 | 3 chyby→beaten; POVOLIT→released; 3 dny→survived |
| WP1.2 | Stůl + Paper kontejnery: drag, bringToTop, InspectView zoom | 4–12 | M0 | 3 překrývající se papíry, čitelná pole v zoomu, 60 fps |
| WP1.3 | EncounterManager + RuleEngine + DecisionPanel (důvody dle aktivních vyhlášek) | 6–14 | WP0.2 | Správný/špatný důvod korektně vyhodnocen vč. čistého encounteru |
| WP1.4 | StampSystem MVP (drag-drop → RenderTexture) + Newspaper + DayEnd text | 8–16 | WP1.2 | Razítko rozhoduje, noviny a denní souhrn fungují |
| WPC1 | **Obsah CZ** (content agenti ∥): 12 encounterů (dny 1–3), 20 zpráv, 6 vyhlášek, důvody, 3 šablony dokumentů | 4–20 ∥ | WP0.2 | Validátor zelený, mix vážné/absurdní |
| **→ MVP CUTLINE: konec M1 (~h 16–20) = odevzdatelná hra.** Vše níže lze škrtnout. |||||
| **M2 - feel & podpis hry** |||||
| WP2.1 | Plné razítko: carry model, rotace, ink FSM, přítlak, kvality otisku (`?scene=stamplab`) | 20–28 | WP1.4 | 4 kvality otisku vizuálně odlišné, konstanty v config.ts |
| WP2.2 | VYDAT NOVOU VYHLÁŠKU (decrees + knightTags) + facka Cutaway infografika | 22–28 | WP1.3 | Dekret se nabízí jen když pasuje; vložený flaw jde zamítnout |
| WP2.3 | Art pass (6–8 rytířů, stůl, papíry) + SFX (razítko, papír, facka) + hudební loop | 20–34 ∥ | - | Placeholdery nahrazeny, CREDITS.md kompletní |
| WPC2 | Obsah: dny 4–5, pool dekretů, texty konců, infografiky | 20–32 ∥ | WPC1 | Validátor zelený |
| **M3 - polish** |||||
| WP8 | EN překlad všech JSON + přepínač jazyka v menu | 34–40 | WPC2 | Hra kompletně hratelná v EN |
| WP9 | Balance, juice (tweeny, screen shake u facky), localStorage continue, bugfix, finální deploy, odevzdání | 40–48 | vše | Čistý průchod cizím testerem bez vysvětlování; build na Vercelu bez chyb |

∥ = běží paralelně. Vosková pečeť, art konců a minihra sběru zpráv = **explicitně škrtnutelné stretche** (jen kdyby zbyl čas).

## Verifikace

1. `npm run dev` - lokální playtest po každém WP; `npm run validate` po každé změně obsahu (merge gate pro content agenty, běží i v dev Bootu).
2. Playtest checklist: správné zamítnutí projde; špatný důvod = facka; zamítnutí čistých papírů = facka; 3 facky = konec `beaten`; POVOLIT = konec `released`; přežití všech dnů = `survived`; nová vyhláška se nabízí jen u pasujícího rytíře; EN přepínač.
3. rozjed si aplikaci udělej mě screanshoty a otestuj že ty mechaniky co tam dělaš fugnuje a pokud né iterativně je oprav 



pracuj v fable modelu 
uděj si goal aby si mě netravoval
použij multiagentní přistup 
klidně poauži loop 
## Co ještě potřebujeme od tebe (mimo kód)

1. **Propojit Vercel**  udělám sám na konci až to bude vše hotovo na lokale 
2. **Potvrdit název** (doporučuji „Ještě není tak zle!").
3. Kam se jam odevzdává itch.io 



❯ 1) ano chci 1968
  2) přidej vyhlašku  o tom že potřebuješ zkušenosti 10let v oboru ktery by ještě v té době nebude exitovat
  3) omez ty vyhlašky do šupliku na konci dne vždy si vybere dvě
  4) na razitko které děla ten červeny otisk, chci aby tak pod tim itiskem zamitoni bylo ještě číslo paragragu musí to pořad vejit do ramečku
  5) našel jsem bug byla vyhlaška o delce měčí přesto jsem dostal facku
  6) pokud někdo klikdne na item vyzbroj  chci aby tam byl jen popis té už nechci  aby tam bylo přimo razitko. ty se budou vždy vybirat z krabičky zamitnuto. tam
  chci aby se zobralisi všechny katerorie na jednou  a u každé kategorie bylo čislo kolik vyhleš z toho mužeš využit