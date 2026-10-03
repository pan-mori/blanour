# Zadání pro grafika - „Ještě není tak zle!"

Pixel-artová byrokratická komedie o úředníkovi v hoře Blaník (5 epoch: **1448 středověk → 1620 po Bílé hoře → 1848 c. k. → 1952 socialismus → 2026 současnost**). Vše je teď kreslené kódem (placeholdery) - tohle je seznam, co by bylo fajn nahradit opravdovou grafikou.

## Obecné
- **Styl:** pixel art, tlumená „medieval/sépie" paleta (viz pozadí menu - olivová, hnědá, šedomodrá, zlatavé akcenty `#d4a017`, papír `#f0e6c8`).
- **Virtuální plátno hry:** 1920×1080, `pixelArt: true` (nearest-neighbor). Předměty se zobrazují ~100–150 px.
- **Formát dodání:** PNG s průhledným pozadím (RGBA), ideálně pixel-perfect v nativní malé velikosti (viz návrhy rozměrů) - hra je zvětší celočíselně.
- **Pojmenování:** `<kategorie>_<nazev>[_varianta].png` (např. `item_mec_dlouhy.png`, `knight_body_01.png`).

---

## 1) PORTRÉTY RYTÍŘŮ (nejvyšší priorita)
Busta rytíře v rámečku ~330×412 px. Teď skládané z vrstev - ideální je **modulární systém** (tělo + hlava + doplňky), ať jde míchat jako „NFT opice". Navrhovaný základ ~192×240 px.

**Základ (tělo + hlava):**
- 6 odstínů kůže, 7 barev vlasů
- varianty obličeje: obočí (normální/huňaté/zvednuté), nos (normální/velký), úsměv, znaménko, knír

**Pokrývky hlavy (4+):**
- klobouková přilba (kettle hat), bascinet s lícnicemi, kroužková kukla, bez helmy (vlasy)
- knížecí čapka s křížkem (sv. Václav)

**Vousy (3 délky):** bez vousů · plnovous · dlouhý vous až na varkoč

**Doplňky na portrét (vrstvy, vážou se na herní vyhlášky):**
- `brýle` (kulaté obroučky přes oči)
- `svatozář` (zlatý kruh nad hlavou - sv. Václav)
- `kalich` (husitský kalich na varkoči - zapovězený po Bílé hoře)
- `růženec` (šňůra korálků s křížkem u krku - katolík)
- `odznak / medaile` (na hrudi - úderník 1952)
- `srp a kladivo` v rukou (místo zbraně - 1952)
- `reflexní vesta` (neonová přes varkoč - BOZP vtip)
- varkoč s křížem (základní znak na hrudi)

**Štít na hrudi (znak + barva):**
- barvy: červená, modrá, zelená, černá, žlutá (min. 3)
- znaky: **lev se DVĚMA ocasy** (správný), **lev s JEDNÍM ocasem** (vada!), **prázdný štít** (vada), **orlice** (svatováclavská)

> Pozn.: rozdíl „jeden vs. dva ocasy lva" a „lev vs. orlice" je HERNÍ informace - musí být jasně rozeznatelný.

---

## 2) PŘEDMĚTY NA STOLE (vysoká priorita)
Výstroj rytíře vyskládaná na stole, klikací. Teď pixel ikony ~100×150 px. Navrhovaný rozměr ~96×96 až 96×160 px.

**Zbraně:**
- meč - **VÍC DÉLEK** (krátký ~80 cm, běžný ~110, dlouhý ~130, obouruční ~150); délka je herní info!
- kopí, šavle, luk (+ tětiva), sekera/halapartna, dýka, palcát (s hroty), srp, kladivo, pánev (vtipná „zbraň")

**Zbroj/výstroj:**
- přilba, štít (viz znaky+barvy výše, i jako samostatný předmět), brnění plátové, boty (pracovní obuv - BOZP), podkovy (propadlé), reflexní vesta

**Kůň (barvy):** bílý, vraný/černý, hnědý, (obecný)

**Ostatní:**
- praporec / korouhev, kalich, růženec, mošna s listinami, odznak/medaile, svíčka (na stole)

---

## 3) DOKUMENTY A PAPÍRY (vysoká priorita)
Žádosti a přílohy - papírové listy s textem (text generuje hra, grafika řeší **podklad/šablonu**). ~640×800 px (žádost), ~470×300 px (přílohy). Nakloněné ±10°.

- **Žádost o výjezd** - 4 varianty dle epochy: středověká (brk, kolek), c. k. 1848 (dvojjazyčná hlavička), uliční výbor 1952 (rudá), datová schránka 2026 (e-gov výtisk)
- Přílohy: výstrojní list, zbrojní průkaz, výjezdní doložka, kádrový posudek, GDPR souhlas koně, osvědčení o víře, potvrzení o bezdlužnosti, atest BAKH, ESG certifikát, evidenční list JZD
- **Kolek** (kolková známka - malá nálepka na dokument)
- **Pečeti:** vosková pečeť s monogramem (K/E/V), **zlomená pečeť** (rozlomené půlky - vada), kroužek/ražba kam patří pečeť
- **Provázek** (balík převázaný provázkem - minihra rozvázání)

---

## 4) RAZÍTKOVACÍ NÁČINÍ (střední priorita)
Minihra razítkování + pečetění. ~200–300 px.

- **Razítko ZAMÍTNUTO** (červené) a **SCHVÁLENO** (zelené) - rukojeť + podušková část, i otisk na papíře
- **Razítková poduška** (inkoustový polštářek)
- **Vosková tyčinka** (červený vosk) - studená i rozehřátá/kapající
- **Svíčka s plamenem** (na nahřívání vosku)
- **Pečetidla K/E/V** (3 kovové pečetní matrice s rukojetí)
- **Vzorník pečetí** (referenční kartička K=konzistoř, E=erár, V=výbor)

---

## 5) POZADÍ (střední priorita)
- **Úřadovna v jeskyni** (přepážka): kamenná zeď, krápníky u stropu, police se šanony/spisy, dřevěný stůl s léty, svíčka. (Menu pozadí = hora, už hotovo fotkou.)

---

## 6) UI PRVKY (nižší priorita - lze dokreslit později)
- **Srdíčka / životy** (plné/prázdné - 3 ks)
- **Tlačítka** a jejich stavy (klid/hover) - dřevěno-pergamenový styl
- **Zásuvky „razítkové skříně"** (dřevěné šuplíky s úchytkou + štítkem kategorie)
- **Šuplík „Podpultové vyhlášky"**
- **Ikona § / dokumentu** (přehled vyhlášek)
- **Bublina s hláškou rytíře** (papírová, s ocáskem)

---

## 7) OBRAZOVKY / INFOGRAFIKY (nižší priorita)
- **FACKA!** cutaway - komický panel, když dostaneš přes hubu (pěst v plátové rukavici)
- Infografická karta (statistiky po facce / na konci dne) - pergamen s úřednickým vtipem
- **Konce hry** (3): „Hora spí dál" (výhra), „Úředník odnesen v koši" (3 facky), „Rytíři vyjeli" (úředníka udupali spolubojovníci)

---

## Priorita shrnutí
1. **Portréty rytířů** (modulární) - nejvíc viditelné, nejvíc variant
2. **Předměty na stole** - hlavní herní mechanika (hledání vad)
3. **Dokumenty + pečeti**
4. Razítkovací náčiní
5. Pozadí jeskyně
6. UI + obrazovky konců

> Vše je teď plně funkční v placeholder grafice - grafiku lze přidávat postupně, nic neblokuje hraní.
