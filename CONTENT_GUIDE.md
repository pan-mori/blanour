# CONTENT_GUIDE — příručka pro content agenty

Veškerý herní obsah žije v `public/content/*.json`. **Needitujte žádný TypeScript.**
Po každé změně spusťte `npm run validate` — musí projít bez chyb (✖). Varování (⚠) opravte, pokud můžete.

## Pravidla hry (kontext pro psaní)

Hráč = úředník v hoře Blaník, který hledá v papírech rytířů **skutečnou chybu**, aby mohl zamítnout výjezd. Každá chyba (flaw) se opírá o konkrétní vyhlášku. Čisté papíry = `flaws: []` — pak je každé zamítnutí hráčova chyba (facka).

**5 dní = 5 epoch** (eras.json): 1448 středověk → 1620 po Bílé hoře → 1848 jaro národů → 1952 socialismus → 2026 současnost. Obsah dne MUSÍ sedět do epochy (jazyk, reálie, humor).

**Tón:** mix filozoficky vážného a absurdního. Český folklor × byrokracie. Vtip má být v reáliích (výjezdní doložka, GDPR koně, kolek), ne v náhodné crazy komice.

## Formát souborů

Každý soubor: `{ "version": 1, "items": [...] }` (strings.json má `items` jako objekt).
Všechny texty jsou **LString**: `{ "cs": "povinné", "en": "smí být prázdné — doplní překladový agent" }`.

## Slovník id (konvence)

| Prefix | Soubor | Příklad |
|--------|--------|---------|
| `R##` | rules.json | `R07` |
| `RZ_*` | reasons.json | `RZ_KOLEK` |
| `ENC_###` | encounters.json | `ENC_012` |
| `N_###` | news.json | `N_031` |
| `V_*` | decrees.json | `V_VOUS` |
| `IG_###` | infographics.json | `IG_004` |

## Jak spolu soubory drží (KRITICKÉ)

1. **rule.reasonId** → musí existovat v reasons.json
2. **reason.ruleRef** → míří na vyhlášku (R…) NEBO dekret (V…)
3. **encounter.flaws[].reasonId + ruleRef** → oba musí existovat a `ruleRef` musí souhlasit s `reason.ruleRef`
4. **Flaw musí být platný v den encounteru**: vyhláška `ruleRef` musí mít `day <= (encounter.day ?? minDay)`. Jinak přidej vyhlášku do `requiresRules` a zvyš `minDay`.
5. **decree.injectsReason** → reason s `ruleRef` = id dekretu
6. **decree.appliesIf.knightTag** → alespoň jeden rytíř musí tag mít (`knight.tags`)
7. **document.template** → musí existovat v doc-templates.json; klíče `fields` musí odpovídat šabloně

## Encounter — anatomie

```jsonc
{
  "id": "ENC_012",
  "minDay": 3,            // od kdy smí přijít (= epocha!)
  "day": 3,               // VOLITELNÉ: přišpendlit na konkrétní den (skriptované momenty)
  "weight": 2,            // volitelná váha náhodného výběru
  "requiresRules": ["R07"],
  "knight": {
    "name": "Ctirad z Kouřimi",
    "sprite": "knight_03",             // zatím placeholder, art přijde později
    "tags": ["vous", "mec"],           // pro dekrety
    "equipment": ["meč", "přilba"],    // co má VIDITELNĚ na sobě (čeština, zobrazuje se)
    "intro": { "cs": "…", "en": "" }   // hláška u přepážky, ideálně cituje zprávy dne
  },
  "documents": [
    { "template": "zadost", "fields": { "jmeno": "…", "kolek": "20" },
      "wrapped": true,                 // volitelné: převázán provázkem (minihra)
      "seal": "pecet_vaclav" }         // volitelné: pečeť ("broken" = zlomená)
  ],
  "flaws": [ /* prázdné = ČISTÉ PAPÍRY (nutí hráče použít dekret) */
    { "reasonId": "RZ_KOLEK", "ruleRef": "R01", "doc": "zadost", "field": "kolek",
      "hint": { "cs": "Kolek za 20, vyhláška žádá 30.", "en": "" } }
  ],
  "outcomes": {
    "rejectOk":  { "cs": "co se stane při správném zamítnutí", "en": "" },
    "rejectBad": { "cs": "hláška rytíře při neprávem zamítnutí", "en": "" },
    "approve":   { "cs": "volitelné", "en": "" }
  }
}
```

## Vizuální tagy rytířů (kreslí se na portrét!)

Tyto tagy v `knight.tags` mají VIZUÁLNÍ podobu na portrétu — hráč vadu VIDÍ:

| Tag | Co se vykreslí | Herní význam |
|-----|----------------|--------------|
| `stit_lev2` | štít se **dvouocasým** lvem | SPRÁVNÁ výbava (kontrast pro hledání) |
| `stit_lev1` | štít s **jednoocasým** lvem | VADA dle vyhlášky o dvou ocasech |
| `stit_prazdny` | prázdný štít bez lva | VADA „na štítu nevidím lva" |
| `srp_kladivo` | srp a kladivo v rukou místo zbraně | VADA — neregulérní výzbroj (ideální 1952!) |
| `vesta` | neonová reflexní/BOZP vesta | dle kontextu: splněná vyhláška, NEBO chybí boty… |
| `vous` | plnovous | pro dekret V_VOUS |
| `vous_dlouhy` | DLOUHÝ vous až na varkoč | VADA dle R23 (zákaz dlouhých vousů) — reason RZ_VOUS_DLOUHY |
| `bryle` | brýle přes oči | VADA dle R24 (zákaz brýlí) — reason RZ_BRYLE |
| `kalich` | kališnický kalich na varkoči | VADA dle R22 (po Bílé hoře) — reason RZ_KALICH |
| `stit_orlice` | štít s ORLICÍ | správný znak pro sv. Václava |
| `urazka_vaclav` | (bez vizuálu) rytíř urazí sv. Václava | VADA dle R25 — reason RZ_URAZKA_VACLAV; dej mu i urážku v `intro` nebo lva místo orlice |
| `srp_kladivo` | srp a kladivo místo zbraně | 1952: buď zamítnout (RZ_VYZBROJ), NEBO mu to ve skříni ROZMLUVIT (přezbrojí se, kolo pokračuje) |
| `svatozar` | zlatá svatozář | sv. Václav; dekret V_SVATOZAR; VÝJIMKA z „chybí do boje" |

**POZN. — vizuální prohřešky se validují OBJEKTIVNĚ z tagu** (vous_dlouhy, bryle, kalich, urazka_vaclav) i z výstroje („chybí do boje": chybí zbraň/kůň/zbroj). Nemusíš je psát do `flaws` — stačí dát tag/výstroj. Barvy štítu: do equipment napiš „modrý/zelený/černý/žlutý štít s …" (3+ barev).

Vizuální vada funguje jen ve dvojici s autorským `flaw` + vyhláškou/důvodem — tag sám o sobě nic nevyhodnocuje. Rytíři BEZ vady občas dejte `stit_lev2` (ať má hledání smysl).

## Zásady kvality

- Na každý den **4–6 encounterů** v poolu; z toho ~1 s čistými papíry (tlak na dekrety) a ~1 se 2 dokumenty.
- Chyby dělat **najditelné, ale ne triviální** — hráč musí porovnat dokument s vyhláškou nebo s rytířem.
- `hint` piš jako suché úřední konstatování — zobrazuje se po správném zamítnutí.
- Zprávy: cca půlka `serious` / půlka `absurd`; epochové zprávy přišpendli `minDay == maxDay`.
- Nic nepřejmenovávej a nemaž existující id — jen přidávej (kód na ně může odkazovat).
