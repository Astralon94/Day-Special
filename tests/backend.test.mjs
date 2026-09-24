import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, connect } from 'node:net';
import { DatabaseSync } from 'node:sqlite';

function isolatedApp() {
  const dir = mkdtempSync(join(tmpdir(), 'day-special-test-'));
  mkdirSync(join(dir, 'server')); mkdirSync(join(dir, 'src/shared'), { recursive: true });
  for (const file of ['server.js', 'package.json', 'server/db.js', 'server/documents.js', 'server/updater.js', 'src/shared/docKeys.js']) {
    copyFileSync(new URL('../' + file, import.meta.url), join(dir, file));
  }
  return dir;
}

test('backup consistente con lettore WAL aperto e fallimento recuperabile', async () => {
  const dir = isolatedApp(); const previous = process.env.DS_DB;
  process.env.DS_DB = join(dir, 'test.db');
  let db, reader;
  try {
    const module = await import(pathToFileURL(join(dir, 'server/db.js')));
    db = module.db;
    db.exec(`INSERT INTO documents VALUES ('ds_checklist','{"items":[]}','old',1)`);
    assert.ok(module.backupDb({ force: true }));
    reader = new DatabaseSync(process.env.DS_DB);
    reader.exec('BEGIN'); reader.prepare('SELECT * FROM documents').all();
    db.exec(`UPDATE documents SET value='{"items":[{"id":"nuovo"}]}', rev=2`);
    const snapshotPath = module.backupDb({ force: true });
    assert.ok(snapshotPath);
    const snapshot = new DatabaseSync(snapshotPath);
    try {
      assert.equal(snapshot.prepare('SELECT rev FROM documents').get().rev, 2);
      assert.equal(snapshot.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally { snapshot.close(); }
    reader.exec('ROLLBACK'); reader.close(); reader = null;
    const backups = join(dir, 'data/backups');
    assert.equal(readdirSync(backups).filter(x => x.endsWith('.db')).length, 2);
    rmSync(backups, { recursive: true }); writeFileSync(backups, 'ostacolo');
    assert.equal(module.backupDb({ force: true }), null);
    rmSync(backups); mkdirSync(backups);
    assert.ok(module.backupDb({ force: true }));
  } finally {
    reader?.close(); db?.close();
    if (previous === undefined) delete process.env.DS_DB; else process.env.DS_DB = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('HTTP: CAS atomico, client precedenti bloccati e URL malformato non fatale', async () => {
  const dir = isolatedApp();
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['--experimental-sqlite', join(dir, 'server.js')], {
    env: { ...process.env, DS_DB: ':memory:', DS_UPDATE_URL: '', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = ''; child.stdout.on('data', d => { logs += d; }); child.stderr.on('data', d => { logs += d; });
  const exited = once(child, 'exit');
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(logs || 'Avvio scaduto')), 5000);
      child.stdout.on('data', () => { if (logs.includes('http://localhost:')) { clearTimeout(timer); resolve(); } });
      child.once('exit', () => { clearTimeout(timer); reject(new Error(logs)); });
    });
    const base = `http://127.0.0.1:${port}`;
    const put = body => fetch(base + '/api/documents/ds_checklist', { method: 'PUT', body: JSON.stringify(body) });
    assert.equal((await put({ value: { items: [] } })).status, 428);
    assert.equal((await fetch(base + '/api/documents/ds_checklist')).status, 404);
    const first = await put({ value: { items: [] }, expected_rev: 0 });
    assert.equal(first.status, 200); assert.equal((await first.json()).rev, 1);
    const results = await Promise.all(['a', 'b'].map(id => put({ value: { items: [{ id }] }, expected_rev: 1 })));
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    const conflict = await results.find(r => r.status === 409).json();
    assert.equal(conflict.current.rev, 2);
    const current = await (await fetch(base + '/api/documents/ds_checklist')).json();
    assert.deepEqual(current, conflict.current);
    const received = await new Promise((resolve, reject) => {
      let text = '';
      const socket = connect(port, '127.0.0.1', () => socket.write('GET http://[ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n'));
      socket.setTimeout(3000, () => socket.destroy(new Error('Timeout HTTP')));
      socket.on('data', d => { text += d; }); socket.on('end', () => resolve(text)); socket.on('error', reject);
    });
    assert.match(received, /^HTTP\/1.1 400/);
    assert.equal((await fetch(base + '/api/health')).status, 200);
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    await exited; rmSync(dir, { recursive: true, force: true });
  }
});
