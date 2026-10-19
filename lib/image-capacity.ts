// Bound memory-heavy image processing across requests in this Node process.
const state = globalThis as typeof globalThis & { floralImageBusy?: boolean };
export function acquireImageSlot() {
  if (state.floralImageBusy) return null;
  state.floralImageBusy = true;
  return () => { state.floralImageBusy = false; };
}
