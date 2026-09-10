const KEY = '__fotosnapsModal';
type Entry = { id: string; close: () => void };
const entries: Entry[] = [];
const waiting: Entry[] = [];
const retired = new Set<string>();
let returning = false;
let listening = false;

function marker(): string | undefined { return window.history.state?.[KEY]; }
function drain() {
  if (returning) return;
  for (const entry of waiting.splice(0)) {
    window.history.pushState({ ...window.history.state, [KEY]: entry.id }, '', window.location.href);
    entries.push(entry);
  }
}
function onPopState() {
  returning = false;
  const target = marker();
  // A parent can unmount while a child dialog is still open. Skip its old
  // history entry rather than leaving an invisible extra Back step.
  if (target && retired.has(target)) {
    retired.delete(target);
    returning = true;
    window.history.back();
    return;
  }
  const destination = entries.findIndex(entry => entry.id === marker());
  const closed = entries.splice(destination + 1);
  // Remove first, so React cleanup cannot trigger another history.back().
  for (const entry of closed.reverse()) entry.close();
  // Forward must not reopen a dialog that has already been dismissed.
  if (marker() && destination === -1) {
    const state = { ...window.history.state };
    delete state[KEY];
    window.history.replaceState(state, '', window.location.href);
  }
  drain();
}
function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  const top = entries[entries.length - 1];
  if (!top) return;
  event.preventDefault();
  top.close();
}

export function registerModal(close: () => void): () => void {
  if (!listening) {
    window.addEventListener('popstate', onPopState);
    document.addEventListener('keydown', onKeyDown);
    listening = true;
  }
  const entry = { id: crypto.randomUUID(), close };
  waiting.push(entry);
  drain();
  return () => {
    const pending = waiting.indexOf(entry);
    if (pending !== -1) { waiting.splice(pending, 1); return; }
    const index = entries.indexOf(entry);
    if (index === -1) return;
    entries.splice(index, 1);
    retired.add(entry.id);
    if (marker() === entry.id) {
      returning = true;
      window.history.back();
    }
  };
}
