import Phaser from 'phaser';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { LString } from '../content/schemas';
import { Content, L } from '../systems/Content';
import { GameState } from '../systems/GameState';
import { Music } from '../systems/Music';
import { makeButton } from '../ui/helpers';

interface Slide {
  /** Klíč textury pozadí (viz Preload). Chybí-li, použije se tmavé pozadí. */
  bg: string;
  heading: LString;
  body: LString;
}

/**
 * Úvodní „slideshow" - příběh Úřadu blanických rytířů a jeho referenta.
 * Spouští se z hlavního menu (tlačítko PŘÍBĚH). Každý slide = pozadí (pixel-art
 * obrázek s pomalým Ken Burns nájezdem) + kartička s nadpisem a textem.
 * Postup: klik / → / mezerník; zpět ←; přeskočit Esc nebo tlačítkem.
 * Posun je VŽDY na klik hráče - nic se neposouvá samo. Na konci se vrací do menu.
 */
const SLIDES: Slide[] = [
  {
    bg: 'menu_bg',
    heading: { cs: 'Úřad blanických rytířů', en: 'The Office of the Blaník Knights' },
    body: {
      cs: 'Blanický magistrát\nodbor Vyjíždění · oddělení Záchrany národa\n\nHluboko pod horou Blaník čeká vojsko rytířů, až bude nejhůř. Až bude národ v koncích, vyjedou a zachrání ho.\n\nNejdřív ale musí dostat razítko.',
      en: "Blaník Magistrate\nDepartment of Departures · Division for Saving the Nation\n\nDeep beneath Blaník mountain an army of knights waits for the darkest hour. When the nation is at its end, they ride out and save it.\n\nBut first they need a stamp.",
    },
  },
  {
    bg: 'table_paper',
    heading: { cs: 'Úřední spis: referent', en: 'Case file: the clerk' },
    body: {
      cs: 'MgP. Křesomil Boruta Razič\nMagistr pečetí · vrchní referent odboru Vyjíždění.\n\nPůvodem z Obory u Loun. Do funkce nastoupil před 31 lety. Své poslání chápe jasně:\n„Služba národu - ale jenom do 13:30."',
      en: 'MgP. Křesomil Boruta Razič\nMaster of Seals · chief clerk of the Department of Departures.\n\nBorn in Obora near Louny. He took the post 31 years ago. His calling is clear:\n"Service to the nation - but only until 1:30 p.m."',
    },
  },
  {
    bg: 'table_paper',
    heading: { cs: 'Škola Libušina soudu', en: 'Schooled at Libuše’s court' },
    body: {
      cs: 'Dřív býval rychtářem u Libušina soudu, kde se věnoval sporům o dědictví. Ty ho naučily vše podstatné:\n\nnikdy nic nerozhodnout - a vždycky vyžadovat další čtyři razítka.',
      en: 'He once served as a magistrate at Libuše’s court, settling inheritance disputes. They taught him everything that matters:\n\nnever decide anything - and always demand four more stamps.',
    },
  },
  {
    bg: 'table_paper',
    heading: { cs: 'Kancelář, co neměla být', en: 'The office that shouldn’t exist' },
    body: {
      cs: 'Jednou za ním přišel společensky unavený rytíř: kde prý tu mají kancelář? Razič odvětil, že žádná není - ale dala by se zřídit. Druhý den ji měl.\n\nMísto mělo sloužit jen „než se situace v zemi zhorší dostatečně". To kritérium ale nikde není definováno - a Razič ho od té doby s láskou neinterpretuje.',
      en: 'One day a socially exhausted knight asked him: where do you keep the office here? Razič replied there was none - but one could be set up. By next morning he had it.\n\nThe post was only meant to last "until things in the land get bad enough." That criterion is defined nowhere - and Razič has lovingly declined to interpret it ever since.',
    },
  },
  {
    bg: 'table_paper',
    heading: { cs: 'Dědictví Přemysla Oráče', en: 'Přemysl the Ploughman’s legacy' },
    body: {
      cs: 'Podle legendy byl prvním úředníkem Blaníku Přemysl Oráč. Ten ale dávno odešel do soukromého sektoru (orba polí, broušení místních žen).\n\nJeho výbavu - jeden pluh a dva volské postroje - Razič dodnes používá coby stojan na lejstra.',
      en: 'Legend says Blaník’s first clerk was Přemysl the Ploughman. But he left for the private sector long ago (ploughing fields, courting the local women).\n\nHis equipment - one plough and two ox harnesses - Razič still uses as a stand for his paperwork.',
    },
  },
  {
    bg: 'menu_bg',
    heading: { cs: 'Proč o místo nechce přijít', en: 'Why he won’t give up the post' },
    body: {
      cs: 'Pět pádných důvodů, sepsaných vlastní rukou referenta.',
      en: 'Five compelling reasons, written in the clerk’s own hand.',
    },
  },
  {
    bg: 'table_paper',
    heading: { cs: 'Teplo   ·   Benefity', en: ' Warmth   ·   Perks' },
    body: {
      cs: 'Uvnitř Blaníku je stálých 18 °C, v zimě i v létě. Razič věří, že „venku je pořád nějaká válka, mor nebo Habsburk".\n\nA ty benefity! Doživotní stravenky (U Kmotra Korleona na Vyšehradě), placené lázně v Teplicích (prý léčí i staré hříchy) a služební polštář s vyšitým dvouocasým lvem.',
      en: 'Inside Blaník it is a steady 18 °C, winter and summer. Razič believes that "outside there is always some war, plague, or Habsburg."\n\nAnd the perks! Lifelong meal vouchers (At Kmotr Korleone’s in Vyšehrad), paid spa stays in Teplice (said to cure even old sins), and an official cushion embroidered with the two-tailed lion.',
    },
  },
  {
    bg: 'table_paper',
    heading: { cs: 'Moc', en: 'Power' },
    body: {
      cs: 'Jediný v celé zemi drží pečeť s nápisem „VYJET / NEVYJET". Politici, králové i poutníci mu chodí nosit dárky.\n\nNejvětší hit: koláčky od Čechové z Chodska.',
      en: 'He alone in the whole land holds the seal reading "RIDE OUT / STAY." Politicians, kings and pilgrims all come bearing gifts.\n\nTop hit: pastries from the Čech family of Chodsko.',
    },
  },
  {
    bg: 'table_paper',
    heading: { cs: 'Setrvačnost   ·   Tajný strach', en: 'Inertia   ·   A secret fear' },
    body: {
      cs: 'Za 31 let napsal 4 217 zamítavých stanovisek - a ani jednou ho nikdo nezažaloval. Důkaz profesionality, myslí si.\n\nA tajný strach: kdyby rytíři opravdu vyjeli a zachránili národ, vyšlo by najevo, že roky blokoval pomoc. Kdyby měl Blaník okna, čekala by ho defenestrace.',
      en: 'In 31 years he wrote 4,217 rejections - and not once was he sued. Proof of professionalism, he thinks.\n\nAnd the secret fear: if the knights truly rode out and saved the nation, it would come to light that he had blocked help for years. If Blaník had windows, a defenestration would await him.',
    },
  },
  {
    bg: 'menu_bg',
    heading: { cs: 'Doma u Raziče', en: 'At the Razič household' },
    body: {
      cs: 'Manželka Božena zásadně „o ničem nemluví a všechno ví".\n\nDcera Libuše studuje politologii a při každé večeři ho ostře kritizuje.',
      en: 'His wife Božena, as a rule, "talks about nothing and knows everything."\n\nTheir daughter Libuše studies political science and sharply criticizes him at every dinner.',
    },
  },
  {
    bg: 'menu_bg',
    heading: { cs: 'Ještě není tak zle!', en: 'Not bad enough yet!' },
    body: {
      cs: 'A tak Razič sedí za přepážkou dál. Pečeť v ruce, národ ať počká.\n\nVždyť - ještě není tak zle.\n\nVítej v první směně, referente.',
      en: 'And so Razič sits behind his counter still. Seal in hand, the nation can wait.\n\nAfter all - it is not bad enough yet.\n\nWelcome to your first shift, clerk.',
    },
  },
];

export class IntroScene extends Phaser.Scene {
  private index = 0;
  private slideLayer?: Phaser.GameObjects.Container; // aktuální slide (pozadí + karta)
  private dots: Phaser.GameObjects.Arc[] = [];
  private nextBtn?: Phaser.GameObjects.Container;
  /** Čísla slidů (1..11), jejichž namluvený příběh už hrál - aby se neopakoval. */
  private narrated = new Set<number>();
  /** Aktuálně hrající namluvený díl + fronta zbývajících dílů slidu (navazují na sebe). */
  private voice?: Phaser.Sound.BaseSound;
  private voiceQueue: string[] = [];

  constructor() {
    super('Intro');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    // hudba běží přes globální manažer (přežívá scény). Kdyby se Intro otevřelo
    // napřímo (?start=Intro), pustíme playlist také - start() je idempotentní.
    this.sound.mute = GameState.audioMuted;
    const startMusic = () => Music.start(this.sound);
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, startMusic);
    else startMusic();

    this.index = 0;
    this.dots = [];
    this.narrated.clear();
    this.buildChrome();
    this.showSlide(0);

    // namluvený příběh utni, když se ze scény odchází (zvuk běží přes globální
    // manažer, který přežívá scény - jinak by dabing hrál dál i v menu/úřadu)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopVoice());

    // ovládání
    const kb = this.input.keyboard;
    kb?.on('keydown-RIGHT', () => this.next());
    kb?.on('keydown-SPACE', () => this.next());
    kb?.on('keydown-ENTER', () => this.next());
    kb?.on('keydown-LEFT', () => this.prev());
    kb?.on('keydown-ESC', () => this.finish());
    // klik mimo tlačítka/tečky → další slide
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.next();
    });
  }

  /** Trvalé UI (přes všechny slidy): přeskočit, zpět/dál, tečky, nápověda. */
  private buildChrome(): void {
    const cx = GAME_WIDTH / 2;

    makeButton(this, GAME_WIDTH - 150, 64, Content.ui('introSkip'), () => this.finish(), { fontSize: 26 }).setDepth(50);

    makeButton(this, 170, GAME_HEIGHT - 72, Content.ui('introBack'), () => this.prev(), { fontSize: 30, width: 240 })
      .setDepth(50);
    this.nextBtn = makeButton(this, GAME_WIDTH - 180, GAME_HEIGHT - 72, Content.ui('introNext'), () => this.next(), {
      fontSize: 30,
      width: 260,
    }).setDepth(50);

    // tečky postupu (klikatelné - skok na slide)
    const n = SLIDES.length;
    const gap = 36;
    const x0 = cx - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      const dx = x0 + i * gap;
      const dot = this.add.circle(dx, GAME_HEIGHT - 72, 7, COLORS.uiAccent, 0.3).setDepth(50);
      // klikatelnost přes neviditelnou obdélníkovou zónu (spolehlivější hit-area)
      this.add
        .rectangle(dx, GAME_HEIGHT - 72, gap, 36, 0xffffff, 0.001)
        .setDepth(51)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.showSlide(i));
      this.dots.push(dot);
    }

    this.add
      .text(cx, GAME_HEIGHT - 128, Content.ui('introHint'), {
        fontFamily: FONTS.doc,
        fontSize: '22px',
        color: '#bfa978',
        stroke: '#14100c',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(50);
  }

  private showSlide(i: number): void {
    this.index = Phaser.Math.Clamp(i, 0, SLIDES.length - 1);
    const slide = SLIDES[this.index];

    // okamžitá výměna, bez prolínání - statický obrázek
    this.slideLayer?.destroy(true);
    this.slideLayer = this.buildSlide(slide);

    this.updateChrome();
    this.narrate(this.index + 1);
  }

  /**
   * Přehraj namluvený příběh pro daný slide (1..11), ale jen jednou - když se
   * hráč na slide vrátí, už se nespustí. Díly jednoho slidu (např. 7.1 a 7.2)
   * hrají v pořadí, druhý naváže, až první doběhne. Klíče viz STORY_VOICES.
   */
  private narrate(slideNum: number): void {
    this.stopVoice(); // běžící dabing předchozího slidu vždy utni
    if (this.narrated.has(slideNum)) return;

    const keys: string[] = [];
    for (let part = 1; part <= 4; part++) {
      const k = `story:${slideNum}:${part}`;
      if (this.cache.audio.exists(k)) keys.push(k);
    }
    if (keys.length === 0) return;
    this.narrated.add(slideNum);

    const start = () => {
      // mezitím mohl hráč přepnout jinam - pak už nehraj (zámek audia odpadl pozdě)
      if (this.index + 1 !== slideNum) return;
      this.voiceQueue = keys.slice();
      this.playNextPart();
    };
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, start);
    else start();
  }

  /** Spustí další díl z fronty; po jeho dohrání automaticky naváže ten následující. */
  private playNextPart(): void {
    const key = this.voiceQueue.shift();
    if (!key) {
      this.voice = undefined;
      return;
    }
    try {
      this.voice = this.sound.add(key, { volume: 1 });
      this.voice.once(Phaser.Sound.Events.COMPLETE, () => {
        this.voice = undefined;
        this.playNextPart();
      });
      this.voice.play();
    } catch {
      this.playNextPart(); // chybějící/vadný díl přeskoč, příběh jede dál
    }
  }

  private stopVoice(): void {
    this.voiceQueue = [];
    try {
      this.voice?.stop();
      this.voice?.destroy();
    } catch {
      /* ignore */
    }
    this.voice = undefined;
  }

  /** Složí jeden slide: statický obrázek (nativní velikost) + tmavnutí + karta s textem. */
  private buildSlide(s: Slide): Phaser.GameObjects.Container {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const c = this.add.container(0, 0).setDepth(0);

    // vždy tmavé podkladové pozadí (obrázek se na něj vycentruje)
    c.add(this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, COLORS.bg));
    if (this.textures.exists(s.bg)) {
      const bg = this.add.image(cx, cy, s.bg);
      const src = this.textures.get(s.bg).getSourceImage();
      // Jen velké obrázky (menu_bg, table_paper) - roztažené „contain" přes většinu
      // obrazovky (bez ořezu). Malé/nízkokvalitní obrázky se jako pozadí nepoužívají.
      bg.setScale(Math.min(GAME_WIDTH / src.width, GAME_HEIGHT / src.height));
      c.add(bg);
    }
    // lehké ztmavení (čitelnost textu zajišťuje hlavně neprůhledná karta)
    c.add(this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x14100c, 0.3));

    // --- textová karta ---
    const W = 1360;
    const padX = 72;
    const padTop = 54;
    const padBot = 60;
    const divGap = 26;
    const wrap = W - padX * 2;

    const heading = this.add
      .text(0, 0, L(s.heading), {
        fontFamily: FONTS.title,
        fontSize: '70px',
        color: '#f1d98f',
        stroke: '#14100c',
        strokeThickness: 7,
        align: 'center',
        wordWrap: { width: wrap },
      })
      .setOrigin(0.5, 0);
    const body = this.add
      .text(0, 0, L(s.body), {
        fontFamily: FONTS.doc,
        fontSize: '35px',
        color: '#efe4c8',
        align: 'center',
        lineSpacing: 10,
        stroke: '#14100c',
        strokeThickness: 3,
        wordWrap: { width: wrap },
      })
      .setOrigin(0.5, 0);

    const H = padTop + heading.height + divGap + 4 + divGap + body.height + padBot;
    const top = cy - H / 2;

    const panel = this.add.rectangle(cx, cy, W, H, COLORS.uiPanel, 0.84).setStrokeStyle(4, COLORS.uiAccent, 0.9);
    heading.setPosition(cx, top + padTop);
    const divY = top + padTop + heading.height + divGap;
    const div = this.add.rectangle(cx, divY, W * 0.45, 4, COLORS.uiAccent, 0.85);
    body.setPosition(cx, divY + divGap + 4);

    c.add([panel, heading, div, body]);
    return c;
  }

  private updateChrome(): void {
    this.dots.forEach((d, i) => d.setFillStyle(COLORS.uiAccent, i === this.index ? 1 : 0.3));
    // poslední slide: tlačítko „Dál" se změní na „Do úřadu"
    const last = this.index === SLIDES.length - 1;
    const txt = this.nextBtn?.list.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined;
    txt?.setText(last ? Content.ui('introStart') : Content.ui('introNext'));
  }

  private next(): void {
    if (this.index >= SLIDES.length - 1) {
      this.finish();
      return;
    }
    this.showSlide(this.index + 1);
  }

  private prev(): void {
    if (this.index > 0) this.showSlide(this.index - 1);
  }

  private finish(): void {
    this.scene.start('Menu');
  }
}
