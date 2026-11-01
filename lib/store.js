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
  return { version: 1, people: [], leaves: [] };
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
  return { version: 1, people: cleanList(src.people), leaves: cleanList(src.leaves) };
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
  for (const r of a) m.set(r.id, r);
  for (const r of b) {
    const cur = m.get(r.id);
    if (!cur || stamp(r) >= stamp(cur)) m.set(r.id, r);
  }
  return Array.from(m.values());
}

function mergeData(a, b) {
  return { version: 1, people: mergeLists(a.people, b.people), leaves: mergeLists(a.leaves, b.leaves) };
}

function applyPatch(data, patch, now) {
  const p = patch && typeof patch === 'object' ? patch : {};
  const out = { version: 1, people: data.people.slice(), leaves: data.leaves.slice() };
  for (const key of ['people', 'leaves']) {
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
  return { version: 1, people: data.people.filter(keep), leaves: data.leaves.filter(keep) };
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
  const current = load(dir);
  const next = purge(applyPatch(current, patch, t), t);
  if (next.people.length + next.leaves.length > MAX_RECORDS) {
    throw new Error('Trop de fiches dans le fichier de données.');
  }
  writeAtomic(fileFor(dir), next);
  return next;
}

module.exports = { FILE_NAME, emptyData, normalize, fileFor, readFile, mergeData, applyPatch, purge, writeAtomic, load, save };
