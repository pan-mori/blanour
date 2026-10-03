#!/usr/bin/env node
/**
 * Validátor obsahu — merge gate pro content agenty.
 * Kontroluje tvar souborů v public/content/ + referenční integritu.
 * Spuštění: npm run validate
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, 'public/content');

const FILES = {
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

const errors = [];
const warnings = [];
const err = (f, id, msg) => errors.push(`✖ [${f}${id ? ` → ${id}` : ''}] ${msg}`);
const warn = (f, id, msg) => warnings.push(`⚠ [${f}${id ? ` → ${id}` : ''}] ${msg}`);

function loadFile(name) {
  const path = resolve(DIR, name);
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    err(name, null, `soubor chybí (${path})`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    err(name, null, `neplatný JSON: ${e.message}`);
    return null;
  }
}

function isLString(v) {
  return v && typeof v === 'object' && typeof v.cs === 'string' && v.cs.trim() !== '' &&
    (v.en === undefined || typeof v.en === 'string');
}

function requireLString(file, id, obj, key, optional = false) {
  const v = obj[key];
  if (v === undefined) {
    if (!optional) err(file, id, `chybí pole "${key}" (LString {cs, en?})`);
    return;
  }
  if (!isLString(v)) err(file, id, `pole "${key}" musí být {cs: "…", en?: "…"} s neprázdným cs`);
}

// ---- načtení ----
const data = {};
for (const [key, name] of Object.entries(FILES)) {
  const file = loadFile(name);
  if (!file) continue;
  if (file.version !== 1) warn(name, null, `očekávána "version": 1`);
  if (file.items === undefined) {
    err(name, null, `chybí "items"`);
    continue;
  }
  data[key] = file.items;
}

if (errors.length === 0) {
  const { eras = [], rules = [], reasons = [], docTemplates = [], encounters = [], news = [], decrees = [], infographics = [], strings = {} } = data;

  const ruleIds = new Set(rules.map((r) => r.id));
  const decreeIds = new Set(decrees.map((d) => d.id));
  const reasonIds = new Set(reasons.map((r) => r.id));
  const templateIds = new Set(docTemplates.map((t) => t.id));

  const dupCheck = (file, items) => {
    const seen = new Set();
    for (const it of items) {
      if (seen.has(it.id)) err(file, it.id, 'duplicitní id');
      seen.add(it.id);
    }
  };
  dupCheck('rules.json', rules);
  dupCheck('reasons.json', reasons);
  dupCheck('doc-templates.json', docTemplates);
  dupCheck('encounters.json', encounters);
  dupCheck('news.json', news);
  dupCheck('decrees.json', decrees);
  dupCheck('infographics.json', infographics);

  // eras: dny 1..5 kompletní
  for (let d = 1; d <= 5; d++) {
    if (!eras.some((e) => e.day === d)) err('eras.json', null, `chybí era pro den ${d}`);
  }
  for (const e of eras) {
    if (typeof e.year !== 'number') err('eras.json', `day ${e.day}`, 'year musí být číslo');
    requireLString('eras.json', `day ${e.day}`, e, 'label');
    requireLString('eras.json', `day ${e.day}`, e, 'masthead');
  }

  // rules
  for (const r of rules) {
    if (typeof r.day !== 'number' || r.day < 1 || r.day > 5) err('rules.json', r.id, 'day musí být 1–5');
    requireLString('rules.json', r.id, r, 'cislo');
    requireLString('rules.json', r.id, r, 'text');
    if (!reasonIds.has(r.reasonId)) err('rules.json', r.id, `reasonId "${r.reasonId}" neexistuje v reasons.json`);
  }

  // reasons: ruleRef smí mířit na vyhlášku NEBO dekret
  for (const r of reasons) {
    requireLString('reasons.json', r.id, r, 'label');
    if (!ruleIds.has(r.ruleRef) && !decreeIds.has(r.ruleRef)) {
      err('reasons.json', r.id, `ruleRef "${r.ruleRef}" není ani vyhláška, ani dekret`);
    }
    if (r.itemKeys !== undefined && (!Array.isArray(r.itemKeys) || r.itemKeys.some((k) => typeof k !== 'string'))) {
      err('reasons.json', r.id, 'itemKeys musí být pole stringů');
    }
    const CATS = ['formular', 'poplatek', 'papiry', 'pecet', 'vira', 'kun', 'vystroj', 'chybi', 'dekret'];
    if (r.category !== undefined && !CATS.includes(r.category)) {
      err('reasons.json', r.id, `category musí být jedna z: ${CATS.join(', ')}`);
    }
  }

  // hádanky: flaw s předmětovým důvodem vyžaduje, aby rytíř předmět měl
  const ITEM_KW = { mec: /meč|šavle/i, stit: /štít/i, kun: /kůň|kobyl|oř/i, podkovy: /podkov/i, srp: /srp/i, kladivo: /kladiv/i, vesta: /vest/i, boty: /bot|obuv/i, kopi: /kopí/i, panev: /pánev|pánv/i };
  for (const e of encounters) {
    for (const f of e.flaws ?? []) {
      const keys = reasons.find((r) => r.id === f.reasonId)?.itemKeys;
      if (!keys?.length) continue;
      const eq = (e.knight?.equipment ?? []).join(' ');
      if (!keys.some((k) => ITEM_KW[k]?.test(eq))) {
        err('encounters.json', e.id, `flaw ${f.reasonId} je schovaný za předmětem (${keys.join('/')}), ale rytíř žádný takový nemá v equipment`);
      }
    }
  }

  // doc templates
  for (const t of docTemplates) {
    requireLString('doc-templates.json', t.id, t, 'title');
    if (!Array.isArray(t.fields) || t.fields.length === 0) err('doc-templates.json', t.id, 'fields nesmí být prázdné');
    else for (const f of t.fields) {
      if (!f.key) err('doc-templates.json', t.id, 'field bez key');
      requireLString('doc-templates.json', `${t.id}.${f.key}`, f, 'label');
    }
    if (t.sealType !== undefined && !['K', 'E', 'V'].includes(t.sealType)) {
      err('doc-templates.json', t.id, 'sealType musí být K|E|V');
    }
    if (!Array.isArray(t.size) || t.size.length !== 2) err('doc-templates.json', t.id, 'size musí být [w, h]');
    if (!Array.isArray(t.stampZone) || t.stampZone.length !== 4) err('doc-templates.json', t.id, 'stampZone musí být [x, y, w, h]');
  }

  // encounters
  for (const e of encounters) {
    if (typeof e.minDay !== 'number') err('encounters.json', e.id, 'chybí minDay');
    if (e.day !== undefined && e.day < e.minDay) err('encounters.json', e.id, 'day < minDay');
    if (!e.knight) { err('encounters.json', e.id, 'chybí knight'); continue; }
    requireLString('encounters.json', e.id, e.knight, 'intro');
    if (!Array.isArray(e.knight.tags)) err('encounters.json', e.id, 'knight.tags musí být pole');
    if (!Array.isArray(e.documents) || e.documents.length === 0) err('encounters.json', e.id, 'documents nesmí být prázdné');
    else {
      for (const d of e.documents) {
        if (!templateIds.has(d.template)) err('encounters.json', e.id, `template "${d.template}" neexistuje`);
        else {
          const tmpl = docTemplates.find((t) => t.id === d.template);
          for (const key of Object.keys(d.fields ?? {})) {
            if (!tmpl.fields.some((f) => f.key === key)) {
              warn('encounters.json', e.id, `dokument ${d.template}: pole "${key}" není v šabloně`);
            }
          }
        }
      }
    }
    for (const rr of e.requiresRules ?? []) {
      if (!ruleIds.has(rr)) err('encounters.json', e.id, `requiresRules: "${rr}" neexistuje`);
    }
    if (!Array.isArray(e.flaws)) { err('encounters.json', e.id, 'flaws musí být pole (klidně prázdné)'); continue; }
    for (const f of e.flaws) {
      if (!reasonIds.has(f.reasonId)) err('encounters.json', e.id, `flaw.reasonId "${f.reasonId}" neexistuje`);
      if (!ruleIds.has(f.ruleRef) && !decreeIds.has(f.ruleRef)) err('encounters.json', e.id, `flaw.ruleRef "${f.ruleRef}" neexistuje`);
      requireLString('encounters.json', e.id, f, 'hint');
      // flaw musí být odhalitelný nejpozději v den encounteru
      const rule = rules.find((r) => r.id === f.ruleRef);
      if (rule) {
        const firstDay = e.day ?? e.minDay;
        if (rule.day > firstDay) {
          err('encounters.json', e.id, `flaw dle ${f.ruleRef} (den ${rule.day}) by v den ${firstDay} nebyl platný — přidej do requiresRules nebo zvyš minDay`);
        }
      }
      if (f.doc && !templateIds.has(f.doc)) err('encounters.json', e.id, `flaw.doc "${f.doc}" neexistuje`);
    }
    // soulad reasonId <-> ruleRef
    for (const f of e.flaws) {
      const reason = reasons.find((r) => r.id === f.reasonId);
      if (reason && reason.ruleRef !== f.ruleRef) {
        err('encounters.json', e.id, `flaw ${f.reasonId}: ruleRef "${f.ruleRef}" nesouhlasí s reasons.json ("${reason.ruleRef}")`);
      }
    }
  }

  // news
  for (const n of news) {
    if (typeof n.minDay !== 'number') err('news.json', n.id, 'chybí minDay');
    if (n.maxDay !== undefined && n.maxDay < n.minDay) err('news.json', n.id, 'maxDay < minDay');
    if (!['serious', 'absurd'].includes(n.tone)) err('news.json', n.id, 'tone musí být serious|absurd');
    requireLString('news.json', n.id, n, 'headline');
    if (n.body !== undefined) requireLString('news.json', n.id, n, 'body', true);
  }

  // decrees
  for (const d of decrees) {
    if (!d.appliesIf?.knightTag) err('decrees.json', d.id, 'chybí appliesIf.knightTag');
    requireLString('decrees.json', d.id, d, 'text');
    if (!reasonIds.has(d.injectsReason)) err('decrees.json', d.id, `injectsReason "${d.injectsReason}" neexistuje`);
    else {
      const reason = reasons.find((r) => r.id === d.injectsReason);
      if (reason.ruleRef !== d.id) err('decrees.json', d.id, `reason ${d.injectsReason} musí mít ruleRef "${d.id}"`);
    }
    const tagExists = encounters.some((e) => e.knight?.tags?.includes(d.appliesIf.knightTag));
    if (!tagExists) warn('decrees.json', d.id, `tag "${d.appliesIf.knightTag}" nemá žádný rytíř — dekret je nepoužitelný`);
  }

  // infographics
  for (const i of infographics) {
    if (!['facka', 'dayend', 'heckle'].includes(i.kind)) err('infographics.json', i.id, 'kind musí být facka|dayend|heckle');
    requireLString('infographics.json', i.id, i, 'text');
  }

  // strings
  for (const [key, v] of Object.entries(strings)) {
    if (!isLString(v)) err('strings.json', key, 'hodnota musí být {cs, en?}');
  }

  // čisté papíry musí mít únikovou cestu: aspoň 1 tag krytý dekretem
  const decreeTags = new Set(decrees.map((d) => d.appliesIf?.knightTag));
  for (const e of encounters) {
    if (Array.isArray(e.flaws) && e.flaws.length === 0 && e.knight?.tags) {
      if (!e.knight.tags.some((t) => decreeTags.has(t))) {
        err('encounters.json', e.id, 'čisté papíry bez dekretem krytého tagu — hráč nemá legální tah');
      }
    }
  }

  // dosažitelnost: každý den 1–5 musí mít dost encounterů
  for (let d = 1; d <= 5; d++) {
    const avail = encounters.filter((e) => (e.day === d) || (e.day === undefined && e.minDay <= d));
    if (avail.length < 1) err('encounters.json', null, `den ${d}: žádný dostupný encounter`);
    else if (avail.length < 3) warn('encounters.json', null, `den ${d}: jen ${avail.length} encounterů v poolu (cíl: 4+)`);
  }
}

// ---- výsledek ----
for (const w of warnings) console.warn(w);
if (errors.length > 0) {
  for (const e of errors) console.error(e);
  console.error(`\n✖ VALIDACE SELHALA: ${errors.length} chyb, ${warnings.length} varování`);
  process.exit(1);
}
console.log(`✔ Obsah validní (${warnings.length} varování)`);
