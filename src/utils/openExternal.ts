import { Capacitor } from '@capacitor/core';

/**
 * Opens an external URL (Stripe checkout, billing portal, …) reliably from both
 * the web build and the native Capacitor app. A plain `<a target="_blank">` /
 * `window.open` is unreliable inside a bare Android WebView (no guarantee it
 * escapes to the system browser), so native platforms use `@capacitor/browser`
 * instead, which always opens a proper in-app browser tab / system browser.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
