// Protegge le bozze inline dai render remoti e conserva la revisione di apertura.
export function inlineEditor({ container, revisions, save, render, schedule = setTimeout }) {
  const edits = new WeakMap();
  let active = null, pending = false, disposed = false;
  const begin = e => {
    const target = e.target;
    if (!target.dataset?.act || !['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
    active = target;
    edits.set(target, { value: target.value, expected: revisions() });
  };
  const finish = async e => {
    const target = e.target, edit = edits.get(target);
    if (!edit) return;
    edits.delete(target);
    active = null;
    if (target.value !== edit.value) await save(target, edit.expected);
    // Il clic che sposta il focus deve terminare prima di ricreare le righe.
    if (pending) schedule(() => { if (!disposed) render(); }, 0);
  };
  const change = e => { if (e.target.tagName === 'SELECT') return finish(e); };
  container.addEventListener('focusin', begin);
  container.addEventListener('blur', finish, true);
  container.addEventListener('change', change);
  return {
    deferRender() {
      if (active) { pending = true; return true; }
      pending = false;
      return false;
    },
    dispose() {
      disposed = true;
      container.removeEventListener('focusin', begin);
      container.removeEventListener('blur', finish, true);
      container.removeEventListener('change', change);
    },
  };
}
