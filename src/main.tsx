import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import App from './App.tsx';
import AppErrorBoundary from './components/AppErrorBoundary.tsx';
import './index.css';
import 'katex/dist/katex.min.css';
import './i18n';

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('capacitor-native');
}

// Tryckmarkering. :active syns bara medan fingret ligger kvar, och ett snabbt tryck
// på iPad hann knappt synas. Klassen ligger kvar en kort stund efter släppet.
const PRESS_SELECTOR = 'button:not(:disabled), [role="button"], [role="switch"], a.inline-flex, label[for]';
document.addEventListener('pointerdown', (e) => {
  const el = (e.target as Element | null)?.closest?.(PRESS_SELECTOR);
  if (!(el instanceof HTMLElement)) return;
  el.classList.add('is-pressed');
  const release = () => {
    window.setTimeout(() => el.classList.remove('is-pressed'), 160);
    document.removeEventListener('pointerup', release);
    document.removeEventListener('pointercancel', release);
  };
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
}, { passive: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
