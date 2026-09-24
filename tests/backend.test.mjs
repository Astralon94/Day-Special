import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  cpSync,
  rmSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer, connect } from 'node:net';
import { DatabaseSync } from 'node:sqlite';

function isolatedApp() {
  const dir = mkdtempSync(join(tmpdir(), 'day-special-test-'));
  mkdirSync(join(dir, 'server'));
  mkdirSync(join(dir, 'src/shared'), { recursive: true });
  for (const file of [
    'server.js',
    'package.json',
    'server/db.js',
    'server/documents.js',
    'server/updater.js',
    'src/shared/docKeys.js',
  ]) {
    copyFileSync(new URL('../' + file, import.meta.url), join(dir, file));
  }
  cpSync(new URL('../server/domain/', import.meta.url), join(dir, 'server/domain'), {
    recursive: true,
  });
  return dir;
}

test('backup consistente con lettore WAL aperto e fallimento recuperabile', async () => {
  const dir = isolatedApp();
  const previous = process.env.DS_DB;
  process.env.DS_DB = join(dir, 'test.db');
  let db, reader;
  try {
    const module = await import(pathToFileURL(join(dir, 'server/db.js')));
    db = module.db;
    db.exec(`INSERT INTO documents VALUES ('ds_checklist','{"items":[]}','old',1)`);
    assert.ok(module.backupDb({ force: true }));
    reader = new DatabaseSync(process.env.DS_DB);
    reader.exec('BEGIN');
    reader.prepare('SELECT * FROM documents').all();
    db.exec(`UPDATE documents SET value='{"items":[{"id":"nuovo"}]}', rev=2`);
    const snapshotPath = module.backupDb({ force: true });
    assert.ok(snapshotPath);
    const snapshot = new DatabaseSync(snapshotPath);
    try {
      assert.equal(snapshot.prepare('SELECT rev FROM documents').get().rev, 2);
      assert.equal(snapshot.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally {
      snapshot.close();
    }
    reader.exec('ROLLBACK');
    reader.close();
    reader = null;
    const backups = join(dir, 'data/backups');
    assert.equal(readdirSync(backups).filter((x) => x.endsWith('.db')).length, 2);
    rmSync(backups, { recursive: true });
    writeFileSync(backups, 'ostacolo');
    assert.equal(module.backupDb({ force: true }), null);
    rmSync(backups);
    mkdirSync(backups);
    assert.ok(module.backupDb({ force: true }));
  } finally {
    reader?.close();
    db?.close();
    if (previous === undefined) delete process.env.DS_DB;
    else process.env.DS_DB = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('HTTP: comandi transazionali, client precedenti bloccati e URL malformato non fatale', async () => {
  const dir = isolatedApp();
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(process.execPath, ['--experimental-sqlite', join(dir, 'server.js')], {
    env: { ...process.env, DS_DB: ':memory:', DS_UPDATE_URL: '', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (d) => {
    logs += d;
  });
  child.stderr.on('data', (d) => {
    logs += d;
  });
  const exited = once(child, 'exit');
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(logs || 'Avvio scaduto')), 5000);
      child.stdout.on('data', () => {
        if (logs.includes('http://localhost:')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once('exit', () => {
        clearTimeout(timer);
        reject(new Error(logs));
      });
    });
    const base = `http://127.0.0.1:${port}`;
    const put = (body) =>
      fetch(base + '/api/documents/ds_checklist', { method: 'PUT', body: JSON.stringify(body) });
    assert.equal((await put({ value: { items: [] }, expected_rev: 0 })).status, 410);
    const initial = await (await fetch(base + '/api/state')).json();
    assert.equal(initial.protocol, 2);
    const expected = Object.fromEntries(
      Object.entries(initial.documents).map(([key, d]) => [key, d.rev]),
    );
    const send = (id, value) =>
      fetch(base + '/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, operation: 'budget.total', input: { value }, expected }),
      });
    const stream = await fetch(base + '/api/stream');
    const reader = stream.body.getReader();
    await reader.read(); // Primo commento SSE.
    const results = await Promise.all([send('request_a', 100), send('request_b', 200)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const event = new TextDecoder().decode((await reader.read()).value);
    assert.match(event, /event: invalidate/);
    assert.doesNotMatch(event, /"value"/);
    await reader.cancel();
    const winner = results[0].status === 200 ? 'request_a' : 'request_b';
    const replay = await send(winner, winner === 'request_a' ? 100 : 200);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).replayed, true);
    const received = await new Promise((resolve, reject) => {
      let text = '';
      const socket = connect(port, '127.0.0.1', () =>
        socket.write('GET http://[ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n'),
      );
      socket.setTimeout(3000, () => socket.destroy(new Error('Timeout HTTP')));
      socket.on('data', (d) => {
        text += d;
      });
      socket.on('end', () => resolve(text));
      socket.on('error', reject);
    });
    assert.match(received, /^HTTP\/1.1 400/);
    assert.equal((await fetch(base + '/api/health')).status, 200);
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    await exited;
    rmSync(dir, { recursive: true, force: true });
  }
});


test('ricevuta e dati persistono dopo riavvio senza duplicare un comando', () => {
  const dir = isolatedApp();
  try {
    const script = `
      import { execute, state } from './server/domain/service.js';
      import { db } from './server/db.js';
      const response = execute({ id: 'restart_request', operation: 'budget.save',
        input: { values: { descrizione: 'Persistente', preventivo: 100 } },
        expected: { ds_budget: 0 } });
      console.log(JSON.stringify({ replayed: response.replayed,
        items: state().documents.ds_budget.value.voci }));
      db.close();
    `;
    const run = () => {
      const child = spawnSync(process.execPath,
        ['--experimental-sqlite', '--input-type=module', '-e', script],
        { cwd: dir, env: { ...process.env, DS_DB: join(dir, 'persist.db') }, encoding: 'utf8' });
      assert.equal(child.status, 0, child.stderr);
      return JSON.parse(child.stdout.trim());
    };
    const first = run(), second = run();
    assert.equal(first.replayed, false);
    assert.equal(second.replayed, true);
    assert.equal(second.items.length, 1);
    assert.deepEqual(second.items, first.items);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
