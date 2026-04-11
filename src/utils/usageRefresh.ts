const EVT = 'foraldrahjalpen:usage-refresh';

export function bumpUsageRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVT));
}

export function subscribeUsageRefresh(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}
