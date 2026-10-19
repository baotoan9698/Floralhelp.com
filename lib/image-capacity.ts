// A bounded FIFO queue per Node process; waiting requests do not decode images.
type Waiter = { grant: () => void };
const globalState = globalThis as typeof globalThis & { floralImageQueue?: { active: number; waiting: Waiter[] } };
const state = globalState.floralImageQueue ??= { active: 0, waiting: [] };
export async function acquireImageSlot(signal?: AbortSignal): Promise<(() => void) | null> {
  if (signal?.aborted) return null;
  function releaseOnce() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = state.waiting.shift();
      if (next) next.grant();
      else state.active--;
    };
  }
  if (state.active < 2) { state.active++; return releaseOnce(); }
  if (state.waiting.length >= 20) return null;
  return new Promise((resolve) => {
    const remove = () => {
      const index = state.waiting.indexOf(waiter);
      if (index < 0) return;
      state.waiting.splice(index, 1); cleanup(); resolve(null);
    };
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", remove); };
    const waiter: Waiter = { grant: () => { cleanup(); resolve(releaseOnce()); } };
    const timer = setTimeout(remove, 15000);
    state.waiting.push(waiter);
    signal?.addEventListener("abort", remove, { once: true });
    if (signal?.aborted) remove();
  });
}
