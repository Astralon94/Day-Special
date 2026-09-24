import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fetchBuffer } from '../server/updater.js';
test('download interrotto: rifiuta la promise anche dopo gli header HTTP', async () => {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Length': '1000' });
    res.write('parziale');
    setTimeout(() => res.destroy(), 10);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await assert.rejects(
      fetchBuffer(`http://127.0.0.1:${server.address().port}`, { timeoutMs: 500 }),
      /interrotto|aborted|reset/i,
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
});
