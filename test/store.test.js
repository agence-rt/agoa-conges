'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../lib/store');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agoa-cg-'));
}

test('un dossier vide donne des listes vides', () => {
  const d = tmp();
  assert.deepStrictEqual(store.load(d), { version: 1, people: [], leaves: [], closures: [] });
});

test('save ajoute des fiches et les date', () => {
  const d = tmp();
  const out = store.save(d, { people: [{ id: 'p1', name: 'Camille Roux', color: 0 }] }, 1000);
  assert.strictEqual(out.people.length, 1);
  assert.strictEqual(out.people[0].updatedAt, 1000);
  assert.strictEqual(store.load(d).people[0].name, 'Camille Roux');
});

test('save remplace la fiche au même identifiant', () => {
  const d = tmp();
  store.save(d, { people: [{ id: 'p1', name: 'Camille', color: 0, demo: true }] }, 1000);
  const out = store.save(d, { people: [{ id: 'p1', name: 'Camille Roux', color: 2 }] }, 2000);
  assert.strictEqual(out.people.length, 1);
  assert.strictEqual(out.people[0].name, 'Camille Roux');
  assert.strictEqual(out.people[0].demo, undefined);
});

test('deux postes qui modifient des fiches différentes ne s’écrasent pas', () => {
  const d = tmp();
  store.save(d, { people: [{ id: 'a', name: 'A', color: 0 }] }, 1000);
  /* le poste 2 écrit après avoir relu le fichier du poste 1 */
  store.save(d, { people: [{ id: 'b', name: 'B', color: 1 }] }, 1100);
  const out = store.save(d, { leaves: [{ id: 'l1', personId: 'a', start: '2026-11-02', end: '2026-11-04', type: 'RTT' }] }, 1200);
  assert.deepStrictEqual(out.people.map((p) => p.id).sort(), ['a', 'b']);
  assert.strictEqual(out.leaves.length, 1);
});

test('une suppression laisse une pierre tombale puis disparaît après 90 jours', () => {
  const d = tmp();
  const t0 = 1_000_000;
  store.save(d, { leaves: [{ id: 'l1', personId: 'a', start: '2026-11-02', end: '2026-11-02', type: 'RTT' }] }, t0);
  let out = store.save(d, { leaves: [{ id: 'l1', deleted: true }] }, t0 + 10);
  assert.strictEqual(out.leaves.length, 1);
  assert.strictEqual(out.leaves[0].deleted, true);
  out = store.save(d, {}, t0 + 91 * 24 * 3600 * 1000);
  assert.strictEqual(out.leaves.length, 0);
});

test('mergeData garde la fiche la plus récente', () => {
  const a = { people: [{ id: 'p', name: 'Ancien', updatedAt: 1 }], leaves: [] };
  const b = { people: [{ id: 'p', name: 'Nouveau', updatedAt: 2 }], leaves: [] };
  assert.strictEqual(store.mergeData(a, b).people[0].name, 'Nouveau');
  assert.strictEqual(store.mergeData(b, a).people[0].name, 'Nouveau');
});

test('une copie en conflit Dropbox est fusionnée puis renommée', () => {
  const d = tmp();
  store.save(d, { people: [{ id: 'a', name: 'A', color: 0 }] }, 1000);
  const conflict = path.join(d, 'agoa-conges (copie en conflit de Poste 2 2026-11-01).json');
  fs.writeFileSync(conflict, JSON.stringify({ version: 1, people: [{ id: 'b', name: 'B', color: 1, updatedAt: 1500 }], leaves: [] }));
  const out = store.load(d);
  assert.deepStrictEqual(out.people.map((p) => p.id).sort(), ['a', 'b']);
  assert.ok(!fs.existsSync(conflict));
  assert.ok(fs.existsSync(conflict + '.fusionne'));
  assert.strictEqual(store.load(d).people.length, 2);
});

test('un fichier illisible n’est jamais écrasé', () => {
  const d = tmp();
  const file = store.fileFor(d);
  fs.writeFileSync(file, '{ pas du json');
  assert.throws(() => store.save(d, { people: [{ id: 'a', name: 'A' }] }), /illisible/);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '{ pas du json');
});

test('les fiches sans identifiant valide sont ignorées', () => {
  const d = tmp();
  const out = store.save(d, { people: [{ name: 'Sans id' }, { id: '', name: 'Vide' }, { id: 'ok', name: 'OK' }] }, 5);
  assert.deepStrictEqual(out.people.map((p) => p.id), ['ok']);
});

test('les jours fériés ajoutés sont enregistrés, fusionnés et supprimables', () => {
  const d = tmp();
  store.save(d, { closures: [{ id: 'c1', start: '2026-11-13', end: '2026-11-13', label: 'Pont' }] }, 1000);
  let out = store.save(d, { closures: [{ id: 'c2', start: '2026-12-24', end: '2026-12-24', label: 'Fermeture' }] }, 1100);
  assert.deepStrictEqual(out.closures.map((c) => c.id).sort(), ['c1', 'c2']);
  out = store.save(d, { closures: [{ id: 'c1', deleted: true }] }, 1200);
  assert.strictEqual(out.closures.find((c) => c.id === 'c1').deleted, true);
  assert.strictEqual(store.load(d).closures.length, 2);
});

test('un ancien fichier sans jours fériés ajoutés reste lisible', () => {
  const d = tmp();
  fs.writeFileSync(store.fileFor(d), JSON.stringify({ version: 1, people: [{ id: 'a', name: 'A' }], leaves: [] }));
  const out = store.load(d);
  assert.deepStrictEqual(out.closures, []);
  assert.strictEqual(out.people.length, 1);
});

test('save garde la version précédente dans un fichier .bak', () => {
  const d = tmp();
  store.save(d, { people: [{ id: 'a', name: 'A' }] }, 1000);
  store.save(d, { people: [{ id: 'b', name: 'B' }] }, 2000);
  const bak = JSON.parse(fs.readFileSync(store.fileFor(d) + '.bak', 'utf8'));
  assert.deepStrictEqual(bak.people.map((p) => p.id), ['a']);
});

test('une seule sauvegarde quotidienne par jour, 30 jours conservés', () => {
  const d = tmp();
  const day = 24 * 3600 * 1000;
  const t0 = new Date(2026, 0, 1, 10).getTime();
  store.save(d, { people: [{ id: 'a', name: 'A' }] }, t0);
  store.save(d, { people: [{ id: 'b', name: 'B' }] }, t0 + 1000);
  assert.strictEqual(fs.readdirSync(store.backupDir(d)).length, 1);
  for (let i = 1; i <= 40; i++) store.save(d, { people: [{ id: 'a', name: 'A' + i }] }, t0 + i * day);
  const names = fs.readdirSync(store.backupDir(d)).filter((n) => /^agoa-conges-\d{4}-\d\d-\d\d\.json$/.test(n));
  assert.strictEqual(names.length, 30);
});

test('pas de sauvegarde quotidienne pour un calendrier vide', () => {
  const d = tmp();
  assert.strictEqual(store.dailySnapshot(d, store.emptyData(), Date.now()), null);
});

test('restore remplace le calendrier, garde une copie de sécurité et propage les suppressions', () => {
  const d = tmp();
  store.save(d, { people: [{ id: 'a', name: 'A' }] }, 1000);
  const backup = store.load(d);
  store.save(d, { people: [{ id: 'b', name: 'B' }], leaves: [{ id: 'l', personId: 'b', start: '2026-11-02', end: '2026-11-02', type: 'CP' }] }, 2000);
  const r = store.restore(d, backup, 3000);
  assert.match(r.safety, /avant-restauration/);
  const safe = JSON.parse(fs.readFileSync(path.join(store.backupDir(d), r.safety), 'utf8'));
  assert.deepStrictEqual(safe.people.map((p) => p.id).sort(), ['a', 'b']);
  const now = store.load(d);
  assert.strictEqual(now.people.find((p) => p.id === 'a').deleted, undefined);
  assert.strictEqual(now.people.find((p) => p.id === 'b').deleted, true);
  assert.strictEqual(now.leaves.find((l) => l.id === 'l').deleted, true);
});
