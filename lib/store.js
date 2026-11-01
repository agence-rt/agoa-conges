'use strict';
/*
 * Stockage du calendrier dans un seul fichier JSON, pensé pour un dossier
 * Dropbox partagé entre plusieurs postes.
 *
 * - Chaque fiche (collaborateur ou absence) porte un identifiant et une date
 *   de dernière modification (updatedAt, en millisecondes).
 * - Une suppression laisse une « pierre tombale » { id, deleted: true } pendant
 *   90 jours, pour que la suppression se propage aux autres postes.
 * - Chaque enregistrement relit le fichier avant d'écrire et fusionne fiche par
 *   fiche (la plus récente gagne) : deux postes qui modifient des fiches
 *   différentes ne s'écrasent pas.
 * - Les copies en conflit créées par Dropbox sont fusionnées puis renommées en
 *   « .fusionne » (jamais supprimées).
 */
const fs = require('fs');
const path = require('path');

const FILE_NAME = 'agoa-conges.json';
const TOMBSTONE_MS = 90 * 24 * 3600 * 1000;
const CONFLICT_RE = /^agoa-conges \(.*(conflict|conflit).*\)\.json$/i;
const MAX_RECORDS = 20000;

function emptyData() {
  return { version: 1, people: [], leaves: [], closures: [] };
}

function cleanList(list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const r of list) {
    if (r && typeof r === 'object' && typeof r.id === 'string' && r.id && r.id.length <= 100) out.push(r);
  }
  return out;
}

function normalize(d) {
  const src = d && typeof d === 'object' ? d : {};
  return { version: 1, people: cleanList(src.people), leaves: cleanList(src.leaves), closures: cleanList(src.closures) };
}

function fileFor(dir) {
  return path.join(dir, FILE_NAME);
}

function readFile(file) {
  let txt;
  try {
    txt = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return emptyData();
    throw e;
  }
  txt = txt.replace(/^﻿/, '');
  if (!txt.trim()) return emptyData();
  let parsed;
  try {
    parsed = JSON.parse(txt);
  } catch (e) {
    throw new Error('Le fichier de données est illisible (' + path.basename(file) + '). Il n’a pas été modifié.');
  }
  return normalize(parsed);
}

function stamp(r) {
  return typeof r.updatedAt === 'number' ? r.updatedAt : 0;
}

function mergeLists(a, b) {
  const m = new Map();
  for (const r of a || []) m.set(r.id, r);
  for (const r of b || []) {
    const cur = m.get(r.id);
    if (!cur || stamp(r) >= stamp(cur)) m.set(r.id, r);
  }
  return Array.from(m.values());
}

function mergeData(a, b) {
  return { version: 1, people: mergeLists(a.people, b.people), leaves: mergeLists(a.leaves, b.leaves), closures: mergeLists(a.closures, b.closures) };
}

function applyPatch(data, patch, now) {
  const p = patch && typeof patch === 'object' ? patch : {};
  const out = { version: 1, people: data.people.slice(), leaves: data.leaves.slice(), closures: data.closures.slice() };
  for (const key of ['people', 'leaves', 'closures']) {
    const incoming = cleanList(p[key]);
    const byId = new Map(out[key].map((r) => [r.id, r]));
    for (const r of incoming) {
      const rec = r.deleted ? { id: r.id, deleted: true, updatedAt: now } : Object.assign({}, r, { updatedAt: now });
      byId.set(r.id, rec);
    }
    out[key] = Array.from(byId.values());
  }
  return out;
}

function purge(data, now) {
  const keep = (r) => !(r.deleted && stamp(r) < now - TOMBSTONE_MS);
  return { version: 1, people: data.people.filter(keep), leaves: data.leaves.filter(keep), closures: data.closures.filter(keep) };
}

function sleep(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (e) {
    /* ignore */
  }
}

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const json = JSON.stringify(data, null, 1);
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, json, 'utf8');
  let lastErr = null;
  for (let i = 0; i < 6; i++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (e) {
      lastErr = e;
      sleep(80 * (i + 1));
    }
  }
  try {
    fs.writeFileSync(file, json, 'utf8');
    fs.rmSync(tmp, { force: true });
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw lastErr || e;
  }
}

function listConflicts(dir) {
  try {
    return fs.readdirSync(dir).filter((n) => CONFLICT_RE.test(n));
  } catch (e) {
    return [];
  }
}

/* Lit le fichier du dossier et fusionne d'éventuelles copies en conflit. */
function load(dir) {
  const file = fileFor(dir);
  let data = readFile(file);
  const conflicts = listConflicts(dir);
  let merged = false;
  for (const name of conflicts) {
    const cf = path.join(dir, name);
    let other;
    try {
      other = readFile(cf);
    } catch (e) {
      continue; /* copie illisible : on la laisse telle quelle */
    }
    data = mergeData(data, other);
    try {
      fs.renameSync(cf, cf + '.fusionne');
    } catch (e) {
      /* ignore */
    }
    merged = true;
  }
  if (merged) writeAtomic(file, data);
  return data;
}

function save(dir, patch, now) {
  const t = typeof now === 'number' ? now : Date.now();
  const file = fileFor(dir);
  const current = load(dir);
  const next = purge(applyPatch(current, patch, t), t);
  if (next.people.length + next.leaves.length + next.closures.length > MAX_RECORDS) {
    throw new Error('Trop de fiches dans le fichier de données.');
  }
  /* Version précédente conservée à côté du fichier (agoa-conges.json.bak). */
  try {
    if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
  } catch (e) {
    /* la sauvegarde ne doit jamais empêcher d'enregistrer */
  }
  writeAtomic(file, next);
  try {
    dailySnapshot(dir, next, t);
  } catch (e) {
    /* idem */
  }
  return next;
}

/* ---------- sauvegardes ---------- */
const BACKUP_DIR = 'sauvegardes';
const DAILY_RE = /^agoa-conges-\d{4}-\d\d-\d\d\.json$/;
const KEEP_DAILY = 30;

function backupDir(dir) {
  return path.join(dir, BACKUP_DIR);
}

const p2 = (n) => String(n).padStart(2, '0');
function dayStamp(t) {
  const d = new Date(t);
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}
function timeStamp(t) {
  const d = new Date(t);
  return p2(d.getHours()) + p2(d.getMinutes());
}
function countRecords(data) {
  return data.people.length + data.leaves.length + data.closures.length;
}

/* Garde les 30 sauvegardes quotidiennes les plus récentes (les autres sont conservées). */
function pruneDaily(dir) {
  const names = fs.readdirSync(backupDir(dir)).filter((n) => DAILY_RE.test(n)).sort();
  while (names.length > KEEP_DAILY) fs.rmSync(path.join(backupDir(dir), names.shift()), { force: true });
}

/* Une sauvegarde par jour, créée au premier enregistrement ou à la première ouverture. */
function dailySnapshot(dir, data, now) {
  if (!countRecords(data)) return null;
  const name = 'agoa-conges-' + dayStamp(now) + '.json';
  const target = path.join(backupDir(dir), name);
  if (fs.existsSync(target)) return null;
  writeAtomic(target, data);
  pruneDaily(dir);
  return name;
}

/* Sauvegarde à la demande (ou avant une restauration). */
function manualSnapshot(dir, data, now, suffix) {
  const name = 'agoa-conges-' + dayStamp(now) + '-' + timeStamp(now) + (suffix || '') + '.json';
  writeAtomic(path.join(backupDir(dir), name), data);
  return name;
}

/* Remplace le calendrier par une sauvegarde. Le calendrier actuel est sauvegardé d'abord.
   Les fiches de la sauvegarde sont datées de maintenant, et celles qui n'y figurent pas
   deviennent des suppressions : ainsi les autres postes ne ressuscitent rien. */
function restore(dir, backup, now) {
  const t = typeof now === 'number' ? now : Date.now();
  const current = load(dir);
  const safety = manualSnapshot(dir, current, t, '-avant-restauration');
  const out = { version: 1 };
  for (const key of ['people', 'leaves', 'closures']) {
    const restored = backup[key].map((r) => Object.assign({}, r, { updatedAt: t }));
    const ids = new Set(restored.map((r) => r.id));
    const gone = current[key].filter((r) => !r.deleted && !ids.has(r.id)).map((r) => ({ id: r.id, deleted: true, updatedAt: t }));
    out[key] = restored.concat(gone);
  }
  writeAtomic(fileFor(dir), out);
  return { data: out, safety };
}

module.exports = {
  FILE_NAME, BACKUP_DIR, emptyData, normalize, fileFor, backupDir, readFile, mergeData, applyPatch, purge,
  writeAtomic, load, save, dailySnapshot, manualSnapshot, restore,
};
