import type Phaser from 'phaser';
import { Content } from '../systems/Content';

/**
 * Autotest/demo driver: ?start=Office&day=1&auto=rejectok|rejectbad|decree
 * Odehraje scénář přímo přes metody scény (testuje reálnou herní logiku)
 * a každý krok POSTne jako PNG na /shot (viz hák v main.ts).
 */
export function installAutoTest(game: Phaser.Game, params: URLSearchParams): void {
  const auto = params.get('auto');
  if (!auto) return;

  const shot = (name: string) =>
    new Promise<void>((resolve) => {
      game.renderer.snapshot((img) => {
        void fetch(`/shot?name=${encodeURIComponent(name)}`, {
          method: 'POST',
          body: (img as HTMLImageElement).src,
        }).then(() => resolve(), () => resolve());
      });
    });
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const run = async () => {
    await sleep(5000); // Boot + Preload + skok do Office
    // TS `private` je jen compile-time — pro testy saháme dovnitř záměrně
    const office = game.scene.getScene('Office') as any;
    const enc = office.enc;
    if (!enc) {
      console.error('AUTOTEST: žádný encounter');
      return;
    }
    await shot(`${auto}-1-start`);

    if (auto === 'rejectok' || auto === 'stampfail') {
      office.openReasonPicker();
      await sleep(600);
      await shot(`${auto}-2-reasons`);
      const flaw = enc.data.flaws[0];
      const reason = Content.all.reasons.find((r) => r.id === flaw?.reasonId) ?? Content.all.reasons[0];
      office.resolveReject(reason); // otevře razítkovací fázi
      await sleep(700);
      await shot(`${auto}-3-stampmode`);
      if (auto === 'stampfail') {
        office.stampSys.debugApply(25, 600, true); // křivý otisk
        await sleep(500);
        await shot(`${auto}-4-crooked`);
        office.stampSys.debugApply(0, 100, true); // bledý otisk
        await sleep(500);
        await shot(`${auto}-5-faded`);
        return;
      }
      office.stampSys.debugApply(4, 600, true); // sytý a rovný
      await sleep(900);
      await shot(`${auto}-4-outcome`);
      await sleep(2200);
      await shot(`${auto}-5-next`);
    } else if (auto === 'rejectbad') {
      const valid = new Set(enc.data.flaws.map((f: { reasonId: string }) => f.reasonId));
      const wrong = Content.all.reasons.find((r) => !valid.has(r.id));
      office.resolveReject(wrong); // razítkovací fáze
      await sleep(500);
      office.stampSys.debugApply(2, 600, true); // sytý otisk → teprve teď verdikt
      await sleep(900);
      await shot(`${auto}-2-cutaway`);
    } else if (auto === 'decree') {
      office.openDecreePicker();
      await sleep(600);
      await shot(`${auto}-2-picker`);
    } else if (auto === 'inspect') {
      // klikni na první předmět s předmětovým důvodem (hádanka)
      const { RuleEngine } = await import('../systems/RuleEngine');
      const { GameState } = await import('../systems/GameState');
      const { parseEquipment } = await import('../ui/ItemIcons');
      const itemReasons = RuleEngine.availableReasons(GameState.day).filter(
        (r: any) => r.itemKeys?.length,
      );
      const items = enc.data.knight.equipment
        .map((e: string) => parseEquipment(e, enc.data.knight.tags))
        .filter(Boolean);
      const target = items.find((it: any) => itemReasons.some((r: any) => r.itemKeys.includes(it.key)));
      office.openInspect(target ?? items[0], 300, 820);
      await sleep(500);
      await shot(`${auto}-2-popup`);
    } else if (auto === 'rozmluva') {
      office.openReasonPicker();
      await sleep(400);
      await shot(`${auto}-1-cabinet`);
      office.rozmluvit();
      await sleep(500);
      await shot(`${auto}-2-dialog`);
    } else if (auto === 'imprint') {
      // § pod otiskem ZAMÍTNUTO: vyber platný důvod, orazítkuj, foť otisk PŘED outcome
      const flaw = enc.data.flaws[0];
      const reason = Content.all.reasons.find((r) => r.id === flaw?.reasonId) ?? Content.all.reasons[0];
      office.pendingReason = reason;
      office.enterStampMode('reject');
      await sleep(400);
      office.stampSys.debugApply(2, 600, true);
      await sleep(250); // otisk nakreslen, outcome ještě ne
      await shot(`${auto}-imprint`);
    } else if (auto === 'zbrojakshort') {
      // facka: zamítnutí za délku meče u KRÁTKÉHO meče musí dát facku
      const { RuleEngine } = await import('../systems/RuleEngine');
      const { GameState } = await import('../systems/GameState');
      const r = RuleEngine.availableReasons(GameState.day).find((x: any) => x.id === 'RZ_ZBROJAK')
        ?? Content.all.reasons.find((x) => x.id === 'RZ_ZBROJAK');
      office.pendingReason = r;
      office.enterStampMode('reject');
      await sleep(400);
      office.stampSys.debugApply(2, 600, true);
      await sleep(900);
      await shot(`${auto}-result`);
    } else if (auto === 'accumulate') {
      // otisky se hromadí na formuláři (vizuální bordel) + pečetidlo „Předat vojákovi"
      const flaw = enc.data.flaws[0];
      const reason = Content.all.reasons.find((r) => r.id === flaw?.reasonId) ?? Content.all.reasons[0];
      office.pendingReason = reason;
      office.enterStampMode('reject');
      await sleep(400);
      for (let i = 0; i < 6; i++) office.stampSys.debugStampOnly(Math.random() * 100 - 50, 600);
      await sleep(500);
      await shot(`${auto}-mess`);
    } else if (auto === 'lightdecree') {
      // vyhláška o světle: vydej → vtipné okno → klik → zhasne + ztmavne o 40 %
      const { RuleEngine } = await import('../systems/RuleEngine');
      const d = RuleEngine.applicableDecrees(enc).find((x: { id: string }) => x.id === 'V_POCHODEN');
      if (d) office.doIssueDecree(d);
      await sleep(500);
      await shot(`${auto}-1-popup`);
      (office.overlayLayer.list[0] as any)?.emit?.('pointerdown'); // zavři okno → zhasne
      await sleep(600);
      await shot(`${auto}-2-dark`);
    } else if (auto === 'freshdecree') {
      // #2: vydej dekret → otevři skříň → „⚡ NOVÁ VYHLÁŠKA" v kategorii i na kartě
      const { RuleEngine } = await import('../systems/RuleEngine');
      const ds = RuleEngine.applicableDecrees(enc);
      if (ds.length > 0) RuleEngine.issueDecree(enc, ds[0]);
      office.openReasonPicker();
      await sleep(500);
      await shot(`${auto}-drawers`);
      const reason = Content.all.reasons.find((r) => r.id === ds[0]?.injectsReason);
      office.showCabinetDrawer(reason?.category ?? 'vystroj');
      await sleep(500);
      await shot(`${auto}-card`);
    } else if (auto === 'nextbtn') {
      // #3: úspěch → info box → klik kamkoliv → tlačítko „Další rytíř →" vpravo dole
      const flaw = enc.data.flaws[0];
      const reason = Content.all.reasons.find((r) => r.id === flaw?.reasonId) ?? Content.all.reasons[0];
      office.pendingReason = reason;
      office.enterStampMode('reject');
      await sleep(400);
      office.stampSys.debugApply(2, 600, true); // crisp → úspěch → info box
      await sleep(1000);
      (office.overlayLayer.list[0] as any)?.emit?.('pointerdown'); // zavři box klikem
      await sleep(500);
      await shot(`${auto}-button`);
    } else if (auto === 'botched') {
      // #4: razítko hodně nakřivo → „Pustit jak je" → facka za zpackané razítko
      const flaw = enc.data.flaws[0];
      const reason = Content.all.reasons.find((r) => r.id === flaw?.reasonId) ?? Content.all.reasons[0];
      office.pendingReason = reason;
      office.enterStampMode('reject');
      await sleep(400);
      office.stampSys.debugApply(55, 600, true); // dev > tolerance → crooked → facka
      await sleep(1100);
      await shot(`${auto}-facka`);
    } else if (auto === 'wax') {
      // vynuť vosk přes ?wax=1 v URL; vyber správný flaw a vejdi do razítkování
      const flaw = enc.data.flaws[0];
      const reason = Content.all.reasons.find((r) => r.id === flaw?.reasonId) ?? Content.all.reasons[0];
      office.pendingReason = reason;
      office.enterStampMode('reject');
      await sleep(600);
      await shot(`${auto}-1-waxphase`);
    } else if (auto === 'help') {
      office.openHelp();
      await sleep(500);
      await shot(`${auto}-2-overlay`);
    } else if (auto === 'rules') {
      office.openRules();
      await sleep(500);
      await shot(`${auto}-2-overlay`);
    } else if (auto === 'cabinet') {
      office.openReasonPicker();
      await sleep(500);
      await shot(`${auto}-1-drawers`);
      const cats = office.CATEGORY_ORDER.filter((c: any) =>
        office.cabinetReasons().some((r: any) => (r.category ?? 'vystroj') === c),
      );
      // ?cat=papiry vynutí konkrétní zásuvku (QA legendárních razítek)
      const wantCat = params.get('cat');
      const openCat = wantCat && cats.includes(wantCat) ? wantCat : cats[0];
      if (openCat) {
        office.showCabinetDrawer(openCat);
        await sleep(500);
        await shot(`${auto}-2-stamps`);
      }
    } else if (auto === 'fullday') {
      // odehraje celý den správnými zamítnutími; čisté papíry řeší dekretem
      const { RuleEngine } = await import('../systems/RuleEngine');
      for (let i = 0; i < 8; i++) {
        if (!game.scene.isActive('Office')) break;
        const o = game.scene.getScene('Office') as any;
        const e = o.enc;
        if (!e) break;
        if ([...e.data.flaws, ...e.syntheticFlaws].length === 0) {
          const ds = RuleEngine.applicableDecrees(e);
          if (ds.length > 0) RuleEngine.issueDecree(e, ds[0]);
        }
        const flaw = [...e.data.flaws, ...e.syntheticFlaws][0];
        if (!flaw) {
          console.error('AUTOTEST fullday: encounter bez řešení', e.data.id);
          break;
        }
        const reason = Content.all.reasons.find((r) => r.id === flaw.reasonId);
        o.resolveReject(reason);
        await sleep(400);
        o.stampSys.debugApply(2, 600, true);
        await sleep(1000); // počkej na outcome okno
        // potvrď „Srozuměno" (nahrazuje dřívější auto-timeout) → další rytíř
        if (o.busy) { o.overlayLayer.removeAll(true); o.busy = false; o.nextKnight(); }
        await sleep(700);
      }
      await sleep(800);
      await shot('fullday-end'); // očekáváme DayEnd
    }
    console.log('AUTOTEST hotovo:', auto);
  };

  run().catch((e) => console.error('AUTOTEST selhal:', e));
}
