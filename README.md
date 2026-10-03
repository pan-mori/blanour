# Ještě není tak zle! (blanour)

Stack: **Phaser 3 + TypeScript + Vite**, virtuální rozlišení 1920×1080, bez backendu.

---

## Požadavky

- **Node.js 18+** (doporučeno 20 nebo 22 LTS) a **npm**
- Jakýkoli moderní prohlížeč (Chrome/Edge/Firefox)

Ověření, že máš Node:

```bash
node -v
npm -v
```

---

## Rychlý start

Ve složce projektu:

```bash
npm install     # jen poprvé (nebo po git pull, když přibyly balíčky)
npm run dev
```

Pak otevři v prohlížeči:

```
http://localhost:5173
```

Vite má hot-reload — po úpravě kódu nebo obsahu (`public/content/*.json`) se stránka
obnoví sama; když ne, dej **F5**.

> Na Windows funguje `npm run dev` stejně v PowerShellu i CMD. Ve WSL taky.

---

## Příkazy

| Příkaz | Co dělá |
|---|---|
| `npm run dev` | Vývojový server na http://localhost:5173 (hot-reload) |
| `npm run build` | Typecheck + produkční build do `dist/` |
| `npm run preview` | Lokální náhled produkčního buildu z `dist/` |
| `npm run validate` | Kontrola obsahu v `public/content/` (viz níže) |

---

## DEBUG LAB (testování miniher)

V hlavním menu je **vlevo dole brouček 🐞 LAB** — otevře rozcestník, kde jde každou
minihru spustit samostatně: razítko (ZAMÍTNUTO/SCHVÁLENO), vosková pečeť a provázek.
Rychlé spuštění z URL viz parametr `lab` níže.

---

## Debug parametry (URL)

Přidej za adresu, např. `http://localhost:5173/?start=Office&day=3`:

| Parametr | Příklad | Význam |
|---|---|---|
| `start` | `?start=Office` | Skok do scény (`Menu`/`Newspaper`/`Office`/`DayEnd`/`Ending`/`Lab`) |
| `day` | `?start=Office&day=4` | Nastaví herní den 1–5 (aktivuje vyhlášky dané epochy) |
| `enc` | `?start=Office&enc=ENC_061` | Vynutí konkrétní encounter (QA obsahu) |
| `lab` | `?start=Lab&lab=wax` | Rovnou spustí minihru v LABu (`stamp`/`approve`/`wax`/`wrap`) |
| `lang` | `?lang=en` | Jazyk `cs`/`en` |
| `wax` | `?wax=1` / `?wax=0` | Vynutí / vypne voskovou pečeť |
| `tags` | `?tags=stit_lev1.srp_kladivo` | Vynutí vizuální tagy portrétu (tečkou oddělené) |
| `heckle` | `?heckle=1` | Rytíř hecuje hned (test pokřiků) |
| `ending` | `?start=Ending&ending=released` | Vynutí typ konce |

---

## Struktura projektu

```
public/content/     obsah hry (JSON) — encountery, vyhlášky, důvody, zprávy…
src/scenes/         Boot, Preload, Menu, Newspaper, Office (jádro), DayEnd, Ending, Lab (debug)
src/systems/        GameState, Content/i18n, EncounterManager, RuleEngine, StampSystem
src/ui/             procedurální pixel-art (portréty, ikony předmětů, pozadí)
src/content/        schemas.ts — kontrakt mezi kódem a obsahem
scripts/            validate-content.mjs — validátor obsahu
```
