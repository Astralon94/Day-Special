import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inlineEditor } from '../src/ui/inlineEditor.js';
function fixture() {
  const listeners = new Map(), saves = [], queued = [];
  let rev = 1, renders = 0;
  const container = {
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  };
  const editor = inlineEditor({ container, revisions: () => ({ ds_budget: rev }),
    save: async (target, expected) => saves.push({ value: target.value, expected }),
    render: () => { if (!editor.deferRender()) renders++; },
    schedule: callback => queued.push(callback),
  });
  const target = { dataset: { act: 'desc' }, value: 'Originale', tagName: 'INPUT' };
  return { editor, target, saves, queued, listeners, setRevision: value => { rev = value; },
    get renders() { return renders; },
    emit: name => listeners.get(name)?.({ target }),
  };
}
test('render remoto non provoca salvataggi e il blur conserva la revisione di inizio modifica', async () => {
  const f = fixture();
  f.emit('focusin'); f.target.value = 'Bozza A'; f.setRevision(2);
  assert.equal(f.editor.deferRender(), true);
  assert.equal(f.saves.length, 0);
  await f.emit('blur');
  assert.deepEqual(f.saves, [{ value: 'Bozza A', expected: { ds_budget: 1 } }]);
  assert.equal(f.renders, 0);
  f.queued.forEach(fn => fn());
  assert.equal(f.renders, 1);
});
test('uscita da campo invariato non invia comandi e lascia completare il clic', async () => {
  const f = fixture();
  f.emit('focusin');
  f.editor.deferRender();
  await f.emit('blur');
  assert.equal(f.saves.length, 0);
  assert.equal(f.renders, 0);
  f.queued.forEach(fn => fn());
  assert.equal(f.renders, 1);
});
test('change e blur di un select inviano una sola modifica; cleanup annulla render differiti', async () => {
  const f = fixture(); f.target.tagName = 'SELECT';
  f.emit('focusin'); f.editor.deferRender(); f.target.value = 'saldato';
  await f.emit('change'); await f.emit('blur');
  assert.equal(f.saves.length, 1);
  f.editor.dispose(); f.queued.forEach(fn => fn());
  assert.equal(f.renders, 0); assert.equal(f.listeners.size, 0);
});

test('i pulsanti delle righe non trattengono il render remoto', () => {
  const f = fixture(); f.target.tagName = 'BUTTON'; f.target.dataset.act = 'edit';
  f.emit('focusin');
  assert.equal(f.editor.deferRender(), false);
});
