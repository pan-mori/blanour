# Hlasy hecklerů — autorství

Namluvené hlášky rozzlobených rytířů. Soubory jsou v `public/assets/audio/heckle/`,
autor je přímo v názvu: `heckle_<ID>_<autor><n>.<přípona>`.

- **mori** = Pan Mori — `.m4a`
- **vojta** = Vojta — `.m4a`
- **dixi** = Dixi — `.mp3`

Hra u každé hlášky náhodně vybere jednu z dostupných variant (`src/scenes/Preload.ts`
→ `HECKLE_VOICES`), takže se hlas rytíře střídá.

## Pozn. k Dixiho řadě
Dixi očísloval nahrávky 1–25 postupně, ale skutečná ID hlášek mají mezery
(neexistuje H15, H16, H23, H24, H29, H30). Jeho řada je proto **přemapovaná podle
pořadí hlášek** na správná ID — tabulka (Dixiho label → skutečné ID):

| Dixi | ID  | | Dixi | ID  | | Dixi | ID  |
|------|-----|-|------|-----|-|------|-----|
| 01   | H01 | | 10   | H10 | | 19   | H21 |
| 02   | H02 | | 11   | H11 | | 20   | H22 |
| 03   | H03 | | 12   | H12 | | 21   | H25 |
| 04   | H04 | | 13   | H13 | | 22   | H26 |
| 05   | H05 | | 14   | H14 | | 23   | H27 |
| 06   | H06 | | 15   | H17 | | 24   | H28 |
| 07   | H07 | | 16   | H18 | | 25   | H31 |
| 08   | H08 | | 17   | H19 | |      |     |
| 09   | H09 | | 18   | H20 | |      |     |

## Pokrytí
- **H05** má hlas jen od Dixiho (Mori ani Vojta nenahráli).
- **H25** má Mori + Dixi (Vojta nenahrál).
- Ostatní ID mají Mori + Vojta + Dixi (H01/H03/H26 navíc dva Vojtovy záběry).

Zdrojové (původně pojmenované) nahrávky jsou zazálohované v `audio-src/heckle_vojta/`
a `audio-src/heckle_dixi/` (mimo build).
