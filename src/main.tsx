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
