# TODO — „Ještě není tak zle!" (živý stav)

## Dávka 15 (3. 10., Opus) — zadání z konverzace
- [x] #1 LAB: přidán **tajný test vyhlášek** (⑤ v rozcestníku + `?start=Lab&lab=rules`) — seznam VŠECH 28 vyhlášek ve 3 sloupcích; klik **přehodí na URL** `?start=Office&day=D&enc=…` (u R27 `&wax=1`, u R28 `&archive=1`), kde se vyhláška rovnou otestuje. **Ověřeno screenshotem.**
- [x] #2a Nová vyhláška **R28 „Patent 28/1620 (spisový řád)"** (den 2, reasonId RZ_ARCHIV = procesní, vyfiltrován ze skříně): zamítnutí se vyhotovuje ve **dvou stejnopisech**. Aktivuje archivační tok (gate `enactedRules.has('R28')` nebo `?archive=1`).
- [x] #2b **Minihra na kopírování**: po orazítkování prvopisu se schová, vysune se blank DRUHOPIS → opis **brkem** (tah odkrývá text) → **razítko se MUSÍ přitisknout znovu** (plná StampSystem fáze na kopii).
- [x] #2c **Odevzdání předěláno**: pečetidlo „Předat vojákovi" → nově jen „✓ Hotovo s razítkem"; pak **drag&drop** orazítkované žádosti (i s otisky) **na portrét rytíře** — žádost i rytíř odejdou společně (fade dolů). Fallback snap-back mimo zónu.
- [x] #2d Při archivaci se **druhopis drag&dropne do spisovny** (knihovny vpravo nahoře, generózní drop-zóna `LIBRARY_RECT`), teprve pak se předá prvopis rytíři.
- [x] #2e **Grafika knihovny se svitky** (SPISOVNA) pod svíčkou vpravo nahoře — dřevěná skříň se 3 policemi svitků v Backdropu. **Ověřeno screenshotem.**

> Stav ověření: `tsc --noEmit`, `npm run build` i `npm run validate` zelené. Statika (knihovna, seznam vyhlášek) ověřena headless screenshotem. **Interaktivní toky (opis/re-razítko/drag odevzdání/archivace) jsou code-complete + typechecked, ale živý screenshot se nepodařil** — WSL↔Windows interop (spouštění Edge/Chrome) během session spadl (vsock accept4 110). Rychlé ruční ověření: `?start=Office&day=1&demo=auto` (odevzdání) a `…&demo=auto&archive=1` (archivace) — debug hák `?demo=auto` sám dojede k zamítnutí+razítku. Dev screenshot sink `/shot` přidán do vite.config (dev-only).

## Dávka 14 (3. 10., Opus) — feedback z hraní 4 — HOTOVO ✅
- [x] #1 Číslo na šuplíku podpultových vyhlášek odstraněno (matoucí vs. počet nabídek) — rozpočet je v HUD „Vyhlášky k vydání" a v pickeru
- [x] #2 Vyhláška o světle/ohni (V_POCHODEN): po vydání vtipné „upsík" okno (zavře klik myší), pak teprve zhasne svíčka + celá hra ztmavne o 40 % — ověřeno (ENC_062)
- [x] #3 Vyhláška o decibelech (V_POLNICE): ztiší hudbu na polovinu (Music.setVolumeFactor)
- [x] #4 Otisky razítka se na formuláři HROMADÍ (vizuální bordel) — ověřeno (6 přes sebe)
- [x] #5 „Pustit jak je" → kulaté voskové pečetidlo dole u svíčky „Předat dokument vojákovi" — ověřeno

## Dávka 13b (3. 10., Opus) — vyjasnění „3 vyhlášky vs 1 na výběr"
- [x] Není to chyba: 3 = kolik vyhlášek smíš za hru VYDAT (rozpočet), picker ukazuje jen ty, co sednou na daného rytíře (obvykle 1). Vyjasněno v UI: HUD „Vyhlášky k vydání: 3", badge šuplíku „3×", picker podtitul „Nabízejí se jen vyhlášky, které sednou na tohoto rytíře. Zbývá ti vydání: 3×"

## Dávka 13 (3. 10., Opus) — feedback z hraní 3 — HOTOVO ✅
- [x] #1 Podpultové vyhlášky: šuplík je dostupný VŽDY dokud decreesLeft > 0 (i když na rytíře nic nesedí → picker to srozumitelně vysvětlí)
- [x] #2 Po vydání nové vyhlášky je v ZAMÍTNOUT zvýrazněná: zelená zásuvka s „⚡ NOVÁ VYHLÁŠKA" + zelená karta s mini útržkem (pečeť) a popiskem „⚡ NOVÁ VYHLÁŠKA"

## Dávka 12 (3. 10., Opus) — feedback z hraní 2 — HOTOVO ✅
- [x] #1 Vosková pečeť se zapne až po enactnutí NOVÉ vyhlášky **R27** (Patent č. 27/1620 o pečetění) — ne od začátku (ověřeno: den 1 bez vosku, den 2 s voskem)
- [x] #2 Vzorník úředních pečetí (K/E/V) se zobrazí taky až s R27
- [x] #3 „Další rytíř →" vytaženo z info boxu do hlavního okna vpravo dole; info box se zavře klikem myši kamkoliv
- [x] #4 V razítkovníku „✓ Pustit jak je" místo „Setřít" — bez auto-dokončení; zpackaný otisk (mimo kroužek/křivě/bledý/suchý) = facka s vysvětlením
- [x] #5 Kategorie „Čerstvé vyhlášky" zrušena — 13 dekretových důvodů přeřazeno do pravých kategorií (vystroj/kun/vira); šuplík „Podpultové vyhlášky" dostal § znak + obrázek útržku vyhlášky

## Dávka 11 (3. 10., Opus) — feedback z hraní
**Bugy**
- [x] #B1 Změna jazyka už nepřehazuje zvuk — mute je zdroj pravdy v `GameState.audioMuted` (in-memory, přežije restart scény)
**Texty / nápověda / font**
- [x] #2 Tutorial bod 3 zjednodušen (VYDAT VYHLÁŠKU vytvoří chybu; pozn. nechal jsem **3×** = tolik jich ve hře je, napsals 2×)
- [x] #3 Tutorial bod 4 zjednodušen (namoč → srovnej → podrž → přitlač)
- [x] #4/#5 Font sjednocen na **2 fonty**: nadpisy = Jersey 10 (čitelný pixel, latin-ext), vše ostatní = IBM Plex Mono. VT323 i Pixelify Sans vyhozeny.
- [x] #6 Nápověda/Razítko: kroky 1. 2. 3. pod sebe
- [x] #7 Nápověda/Čisté papíry: vysvětleno, že VYDAT VYHLÁŠKU vyrobí chybu šitou na tělo
- [x] #8 Tlačítko „Platné vyhlášky" v úřadu zvětšeno (velký štítek § s počtem vpravo)
**Razítkování**
- [x] #9 Tolerance úhlu zvětšena (15° → 32°) — úředník razítkuje ledabyle
- [x] #10 Tlačítko „⌫ Setřít otisky" v razítkovníku (smaže rozdělané otisky)
- [x] #12 Po úspěšném razítku tlačítko „Srozuměno — další rytíř →" (bez auto-timeoutu)
- [x] #15 Facka VŽDY se zlatým rámečkem „Proč facka: …" (chybná vada nebo čisté papíry)
**Konec dne**
- [x] #11 Statistiky konce dne do dvou řad
**Mechaniky / design**
- [x] #13 Správně použitá BĚŽNÁ razítka zůstávají v sadě (znovupoužitelná — hráč si buduje nástroje); legendární se po použití spotřebuje
- [x] #16 Vzácnost razítek: zlatá karta + „★ LEGENDÁRNÍ" (RZ_UREDNIK/ZDRAVY/PRAXE); legendární = univerzální (platí na kohokoli); po použití okno „bylo to o fous…"
- [ ] #14 „Opravit tuhle vyhlášku" — **čekám na upřesnění, kterou**

## Dávka 10 (3. 10., Opus) — HOTOVO ✅
- [x] **DEBUG LAB** — samostatná scéna s rozcestníkem miniher pro izolované testování: ① razítko ZAMÍTNUTO, ② razítko SCHVÁLENO, ③ vosková pečeť + razítko, ④ provázek (rozvázání balíku). Každá má „↻ Znovu" a „◀ Seznam".
- [x] V hlavním menu **vlevo dole brouček 🐞 LAB** → otevře rozcestník miniher
- [x] Rychlé spuštění z URL: `?start=Lab&lab=stamp|approve|wax|wrap` (ověřeno screenshotem: menu brouček, rozcestník, vosk, provázek)

## Dávka 9 (3. 10., Opus) — HOTOVO ✅
- [x] #1 Víc předmětů u rytíře + ke každému vlastní „podpultová vyhláška": **polnice** (hluk/netopýři V_POLNICE), **pochodeň** (požární řád V_POCHODEN), **soudek medoviny** (spotřební daň V_SUD), **mapa cest** (státní tajemství V_MAPA), **ostruhy** (ochrana zvířat V_OSTRUHY), **sedlo** (inventární štítek V_SEDLO) — ikony + reason + 6 encounterů ENC_061–066
- [x] #2 Razítková skříň po otevření ukazuje **všechny kategorie najednou** (9 zásuvek 4×N); prázdné mají v závorce **(0)** a jsou ztlumené; klik na prázdnou vysvětlí, že se plní vydáváním vyhlášek; dekrety přibývají do zásuvky „Čerstvé vyhlášky"
- [x] #3 Otisk ZAMÍTNUTO má pod sebou menším písmem **číslo směrnice** (kompaktní „§ č. 5/1968") — vykreslí se jen při skutečném tisku

## Dávka 8 (3. 10., Opus) — HOTOVO ✅
- [x] #1 Den 4 = **1968** „Bratrská pomoc" (+ přečíslovány vyhlášky R05/R10/R11/R17/R20 na 1968)
- [x] #2 Absurdní vyhláška R26: 10 let praxe v kybernetické bezpečnosti (obor dosud nevynalezen) + ENC_059/060
- [x] #3 Na konci dne se vybírají **přesně 2** vyhlášky (ne víc, ne míň)
- [x] #4 Pod červeným otiskem ZAMÍTNUTO je i **§ číslo paragrafu** (vejde se do rámečku)
- [x] #5 BUG opraven: délka meče je teď **objektivní** (meč ≤120 cm → zamítnutí za délku dá facku; dlouhý → projde). Příčina: starý inspekt nabízel délkový důvod u každého meče.
- [x] #6 Klik na předmět = **jen popis** (bez razítka); zamítá se z razítkové skříně, kde jsou **všechny kategorie najednou s počtem** použitelných razítek (výstrojní důvody přesunuty do boxu)
- [x] Vlajky CZ/UK v menu u výběru jazyka — klikací, přepínají jazyk, aktivní má zlatý rámeček

## AUDIT POŽADAVKŮ (3. 10.) — VÝSLEDEK
> Dva nezávislí agenti prošli VŠECHNY tvé požadavky z konverzace proti kódu:
> **Mechaniky: 13/13 ✅ · Vizuál/obsah/UI: 12/12 ✅ — žádná vyžádaná funkce nechybí.**
> Otevřené body (ne chybějící funkce, ale rozhodnutí / polish / deploy):
- [ ] **1968 vs 1952** (tvé rozhodnutí): den 4 je „1952", ale srp+kladivo/„rudá armáda" sedí k **1968**. Buď přejmenovat den 4 na 1968, nebo nechat. → čekám na tebe
- [ ] **Reálná grafika** — zadání v `ART_ASSETS.md`; zatím procedurální placeholdery (nahrávat postupně, nic neblokuje).
- [ ] **Deploy** Vercel + itch.io — na konci ty (base './' připraveno).
- [i] *By design (OK, jen pro info):* „rozmluvit" (srp+kladivo) se ukáže, jen když na den 4 enactneš vyhlášku o výzbroji R17 — hráčská volba, záměrně negarantováno. Provázek je taky rule-gated (funguje, přijde někdy).
- [i] *Drobnost:* mrtvé konstanty `patienceMs`/`patienceWarnMs` v config.ts (po zrušení časovače) — neškodí, lze smazat.

## Dávka 7 (3. 10. noc, Opus) — HOTOVO ✅
- [x] Progresivní vyhlášky: start jen 2 (base), DayEnd „VEČERNÍ ÚŘADOVÁNÍ" — enactni ≥2 nové (panika byrokrata „však si je sám dodržuj"); hromada roste do konce (den 5 ~10)
- [x] Chytří rytíři: každý důvod/razítko jen JEDNOU za run (usedReasons) — po použití mizí z boxu, další rytíři ten flaw nemají; fronta se po použití pročistí (pruneUnsolvable)
- [x] Řešitelnost GARANTOVÁNA: budget-aware dekrety, distinktní důvody/den, Václav finále = schválit platné; 200 simulovaných runů vždy dohratelných
- [x] Noviny ukazují rostoucí „Platné vyhlášky (N)" + flavor „Hora tone v papírech. A ty v nich s ní."
- [x] Bugfix: svíčka/nahřátí z wax fáze už neleakuje dalšímu rytíři (cleanupVisuals)
- [x] 🤖 obsah: 12 encounterů (vousy/brýle/Václav/barevné štíty/srp+kladivo) ENC_047–058
- [ ] Obrázek hory na pozadí menu (menu_bg.png) — **kód hotov, čeká na soubor od tebe**

## Dávka 6 (3. 10. noc, Opus) — KÓD HOTOV ✅
- [x] Vousy 3 varianty: bez / plnovous / dlouhý vous (tag vous_dlouhy) na portrétu + vyhláška R23
- [x] Brýle na portrétu (tag bryle) + vyhláška R24
- [x] „Podpultové vyhlášky": ikona šuplíku místo tlačítka; decrees 2→3 na run; nabízí se dle tagů rytíře
- [x] Štíty ≥3 barvy (hash) + druhy znaku; sv. Václav má ORLICI (portrét i stůl) — ověřeno
- [x] Razítko „Urážka Václava" (R25): platí přes tag urazka_vaclav (lev místo orlice / urážka v introu) — objektivní validace
- [x] Lev 1 ocas → R14 „musí mít dva" (už bylo, potvrzeno funkční)
- [x] Srp+kladivo (den 4): zelený šuplík ROZMLUVIT ve skříni → dialog (rudá armáda, přezbroj se) → rytíř se přezbrojí, kolo pokračuje s TÍMŽE rytířem — ověřeno
- [x] Vizuální/válečné prohřešky validovány OBJEKTIVNĚ (tag/výstroj) — konzistentní u všech rytířů; řešitelnost ověřena pro dny 1–5
- [ ] 🤖 obsah: ~12 encounterů (vousy/brýle/Václav/barevné štíty/srp+kladivo) — **běží**

## Razítkování 3.0 + UI (3. 10. odpoledne) — HOTOVO ✅
- [x] Hecování VŽDY otřese obrazovkou; při razítkování navíc kopne do úhlu razítka (záměr: občas to zkazí)
- [x] Tlačítko „✕ Zvolit jiný důvod" — ukončit razítkování a vrátit se k rozhodnutí
- [x] Rekapitulace nad minihrou: „ZAMÍTÁŠ: <důvod>"
- [x] Ikona dokumentu § vpravo v 1/3 výšky → overlay se všemi vyhláškami; v „?" zůstaly jen mechaniky
- [x] Žádost větší + náhodný náklon ±(8–30)°
- [x] Kroužek pečeti: náhodná volná pozice v dolním pruhu žádosti + náhodný úhel se zářezem; kontrola NA kroužek (dist) + VE SMĚRU (odchylka od zářezu)
- [x] Rotace razítka zpět na Q/E + kolečko

## Dávka 4 (3. 10. večer, Opus) — KÓD HOTOV ✅
- [x] A) Ikony: +luk, sekera, dýka, palcát, brnění, praporec, kalich, růženec; proměnný počet 1–8, 2 řady když víc (kód); 🤖 obsah dodá rozmanitější výstroj
- [x] B) Nový důvod „Chybí do boje" (R21): bez zbraně/koně/zbroje — kategorie v boxu; 🤖 obsah dodá encountery
- [x] C) Portrét: víc rysů (obočí, nos, úsměv, knír, znaménko, 7 barev vlasů) + doplňky kalich/růženec/odznak; vyhláška R22 (víra 1620); 🤖 obsah dodá kališníky/katolíky
- [x] D) buildDay garantuje řešitelnost: každý rytíř má flaw nebo je krytý dostupným dekretem (max 1 dekretový/den) — ověřeno fullday den 3 i 5
- [x] E) Razítková skříň: 9 kategorií jako zásuvky → karty razítek, každé s § paragrafem (ověřeno screenshotem)

## Dávka 5 (3. 10. večer) — razítkování s voskovou pečetí — HOTOVO ✅
- [x] Vosková pečeť: vzít červený vosk ze stolu → nahřát nad svíčkou (držet LMB nad plamenem, ukazatel) → kápnout na kroužek → přitisknout SPRÁVNÉ pečetidlo K/E/V (špatné = vosk zmařen, nalej znovu); pak razítko ZAMÍTNUTO vedle ve správném směru
- [x] Vosk náhodně (~40 %), debug ?wax=1/0; ověřeno celou cestou vosk→pečetidlo→razítko→výsledek
- [x] 🤖 Audio: +3 CC0 smyčky (Market Day, King's Feast, Minstrel Dance) → playlist 4 skladeb v zamíchané rotaci (systems/Music.ts)
- [x] Náklon formuláře zpět na max 10° (bylo 30°)
- [x] Bublina s hláškou rytíře přímo NAD portrét (bez kolize s dokumenty)
- [ ] Víc hudebních skladeb (playlist), ať nehraje pořád jedna dokola — 🤖 audio agent dohledá 2–3 další CC0 smyčky

## Úkoly z feedbacku (3. 10. dopoledne)
- [x] 1) Hecování: interval 28–48 s (2×) + hláška „Už jsem tam měl být čtyři minuty, ty magore!"
- [x] 2) VYDAT VYHLÁŠKU: víceřádková tlačítka, panel roste podle obsahu
- [x] 3) Razítko 2.0: velký razítkovník, čistě myší (kolečko jemně / PRAVÉ tlačítko po 15°), po namočení náhodné vychýlení (hráč musí znovu srovnat), VÝMĚNNÉ PEČETI K/E/V + okénko v razítku + vodítko-kroužek na formuláři
- [x] 3b) 🤖 4 typy žádostí dle epoch: konzistoř (K, 1448/1620) → C. k. s německými dublety (E, 1848) → uliční výbor (V, 1952) → datovková e-žádost (E, 2026); 24 encounterů přepnuto, ověřeno screenshotem (den 3 chce E)
- [x] Regresní fullday den 4 po všech změnách — zelený
- [x] 4) Nápověda „?" ve hře: 4 kroky s piktogramy + všech 20 vyhlášek ve 3 sloupcích
- [x] 5) Výstroj jako předměty na stole: 15+ procedurálních ikon (meč dle DÉLKY v cm, štít s 1/2ocasým lvem, kůň dle barvy, srp+kladivo, vesta…), klikací
- [x] 6) Předmětové důvody schované za hádankou: klik na předmět → rytíř odpoví („obouruční meč (150 cm). Vše podle předpisu!") → tlačítka ⊘ spouštějí razítkování; v hlavním ZAMÍTNOUT už tyto důvody nejsou
- [x] Bugfix: hover na světlém podkladu nečitelný → neprůhledný hover
- [x] Bugfix: přepínač hudby — label se mění na místě, bez restartu scény

> **GOAL:** Do 48 h odevzdatelná hra na itch.io/Vercel dle PLAN.md.
> **MVP cutline:** konec M1 = hra hratelná od menu po konec. Vše po M1 jde škrtnout.
> Aktualizuju průběžně — tenhle soubor je zdroj pravdy o postupu.

## M0 — nasaditelná kostra  `████████░░ 80 %`
- [x] Scaffold: Phaser 3 + TS + Vite, package.json, configy, index.html
- [x] Fonty VT323 + Pixelify Sans (latin-ext) přes fontsource, Boot čeká na load
- [x] Schémata obsahu `src/content/schemas.ts` (i18n {cs,en})
- [x] GameState, Content/i18n, RuleEngine, EncounterManager
- [x] Scény: Boot, Preload, Menu, Newspaper, Office (jádro!), DayEnd, Ending
- [x] Seed obsah (eras, rules, reasons, encounters, news, decrees, strings…)
- [x] Validátor `scripts/validate-content.mjs` + CONTENT_GUIDE.md
- [x] `npm run build` zelený (TS čistý, fonty latin-ext v bundlu)
- [x] Screenshot ověření (WSL chromium má rozbitý kompozitor → řešení: Windows Edge headless + hra si POSTuje snapshoty sama přes `?shot`/`?auto` debug hák)

## M1 — MVP core loop  `███░░░░░░░ ~30 %` (Office už umí rozhodování)
- [x] Rozhodnutí ZAMÍTNOUT (výběr důvodu) / POVOLIT s validací proti flaws
- [x] Trpělivost rytíře (timeout = facka), 3 životy, cutaway infografika
- [x] VYDAT NOVOU VYHLÁŠKU (dekrety dle tagů rytíře)
- [x] 3 konce (survived / beaten / released)
- [x] 🤖 CONTENT AGENT A: ✅ 25 encounterů, 13 vyhlášek, 20 důvodů, 7 dekretů, 11 šablon dokumentů (validace zelená)
- [x] 🤖 CONTENT AGENT B: ✅ 40 zpráv (20 vážných/20 absurdních, 7 na epochu), 14 infografik
- [x] Playtest mechanik autotestem + screenshoty + opraveny 3 layout bugy (noviny překryv, trpělivost, přetékání polí dokumentů)
- [x] Ověřeno vizuálně: Menu, Noviny 1448 i 1952, Úřad (2 dokumenty), výběr důvodů, FACKA cutaway (−život v HUD), konec `released`
- [x] Projít celý den → DayEnd (autotest `fullday`: 4 zamítnutí + dekret na čisté papíry, statistiky sedí)

## M2 — feel & podpis hry
- [x] Razítkování: carry model (nést → namočit → kolečkem srovnat → přítlak), kvality otisku: sytý/bledý/rozmazaný/křivý/suchý — ověřeno autotestem + screenshoty
- [x] Rozhodnutí se vykonává razítkem (verdikt až PO otisku — víc napětí)
- [x] 🤖 AUDIO AGENT: ✅ 6× CC0 (krčma loop, razítko, papír, facka, fanfára, klik) + CREDITS.md; zapojeno do hry
- [x] Art pass: procedurální pixel-art portréty rytířů (4 typy helem, vousy dle tagů, svatozář, Václavova čapka) — deterministické dle jména
- [ ] Pozadí jeskyně/úřadu (jemný art pass) — stretch
- [ ] Provázek na balících (minihra rozvázání tahem) — stretch
- [ ] Pečeti na dopisech (porovnání se vzorníkem) — stretch
- [ ] Tahatelné papíry + inspekční zoom — stretch (dokumenty teď čitelné přímo)

## M2.5 — schválené balíčky A–D (debata s parťákem)
- [x] Vizuální vrstvy portrétu: lev 1/2 ocasy, prázdný štít, srp+kladivo, reflexní vesta (+ debug `?tags=`)
- [x] Jméno rytíře přesunuto pod portrét (kolize se štítem)
- [x] 🤖 CONTENT AGENT: ✅ balíčky A–D — 7 vyhlášek, 8 důvodů, 11 encounterů (ENC_026–036), šablona BAKH, 6 zpráv, 2 infografiky; CZ+EN rovnou
- [x] Screenshot QA: srp+kladivo (Věnceslav „čerstvě přeškolený"), jednoocasý lev (Vratislav), BOZP vesta (Ing. Patrik) — vše vykresleno správně
- [x] Debug `?enc=ENC_xxx` pro vynucení konkrétního encounteru (QA)
- [x] FIX designová díra: čisté papíry bez dekretem krytého tagu = hráč bez tahu (ENC_028 + nová kontrola ve validátoru)
- [x] Fullday test dne 4 s novým obsahem — zelený průchod

## M3 — polish
- [x] 🤖 EN AGENT: ✅ 151 polí přeloženo, 291 LString kompletních, hříčky lokalizované (validace zelená)
- [x] Nápověda „Jak úřadovat" v menu (CZ/EN) + debug `?lang=en`
- [x] EN verze otestována screenshotem (UI kompletně anglicky)
- [x] Juice: slide-in příchodu rytíře, screen shake u facky, zvuky na akcích
- [x] Finální build zelený (`npm run build` → `dist/`)
- [ ] **TY: propojit Vercel** (Import repo → preset Vite) **+ itch.io upload** (zip obsahu `dist/`, „HTML playable", viewport 1920×1080 nebo fullscreen)
## Feedback od uživatele (3. 10. ráno) — VŠE HOTOVO ✅
- [x] Font špatně čitelný → texty přepnuty na IBM Plex Mono (typewriter, výborná čitelnost) — ověřeno screenshoty
- [x] Texty vyhlášek přes sebe → dvousloupcový výběr důvodů (21 důvodů se vejde) + adaptivní noviny (5 vyhlášek bez překryvu) — ověřeno
- [x] Minihra s razítkem na ZAMÍTNUTO — byla implementovaná; po Ctrl+F5 viditelná (důvod → nést razítko → namočit → srovnat → přitlačit)
- [x] Hudba nehrála (autoplay policy) → start po prvním kliknutí + tlačítko Hudba ZAP/VYP v menu (localStorage)
- [x] ZRUŠENA mechanika času (trpělivost) — facka jen za křivé nařčení
- [x] Místo časovače: rytíři HECUJÍ (8 pokřiků, bublina co ~15–25 s, otřes portrétu, bez trestu)
- [x] Pozadí jeskynního úřadu: krápníky, kamenná zeď, police s šanony, svíčka se září, dřevo s léty, vinětace
- [x] Provázek: balík skrývá obsah, uzel se přetahuje podél šňůry, předčasné puštění = návrat
- [x] Pečeti: voskové placky s monogramem na dokumentech, zlomená = rozlomené půlky s prasklinou; vzorník pečetí v horním pruhu
- [x] Regresní fullday test po všech změnách — zelený

## Poznámky k prostředí
- Screenshoty: WSL chromium nefunkční (kompozitor) → Windows Edge headless + `edgeshot.sh` (sám se ukončí přes `--timeout` a uklidí sirotky — už se nebudou hromadit procesy!)
- Hru si můžeš KDYKOLI pustit sám ve Windows prohlížeči: `npm run dev` běží → http://localhost:5173

## Deník
- ✅ Architektura navržena (Plan agent), plán schválen a upraven uživatelem
- ✅ Kostra hry napsaná (~15 souborů), npm závislosti nainstalované
- ⏳ Píšu seed obsah, pak build test + screenshot, pak vypouštím content agenty
