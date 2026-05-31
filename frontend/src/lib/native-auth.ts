/**
 * Native (iOS Capacitor) Google sign-in bridge.
 *
 * Google refuses OAuth inside an embedded WKWebView (`disallowed_useragent`),
 * so on native we open the consent flow in the system browser
 * (SFSafariViewController via @capacitor/browser). The system browser has its
 * own cookie jar, so the `hive_auth` cookie set during the callback never
 * reaches the WKWebView. The backend bridges this with a short-lived handoff
 * token delivered over a custom-scheme deep link (`hive://auth/callback?ht=…`).
 * We catch that deep link with @capacitor/app, close the browser, and navigate
 * the WebView to /api/auth/google/exchange?ht=… which mints the real session
 * cookie from inside the WebView's cookie jar.
 *
 * On web, all of this is a no-op and the caller falls back to a normal
 * `<a href="/api/auth/google">` navigation.
 */
import { Capacitor } from "@capacitor/core";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Open Google's consent screen in the system browser (native only). */
export async function startGoogleSignIn(): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  const url = `${window.location.origin}/api/auth/google?platform=ios`;
  await Browser.open({ url });
}

/**
 * Register the deep-link listener that completes the native OAuth round-trip.
 * Returns a cleanup function. Idempotent-safe to call once on mount.
 */
export async function registerAuthDeepLink(): Promise<() => void> {
  const { App } = await import("@capacitor/app");
  const { Browser } = await import("@capacitor/browser");

  const handle = await App.addListener("appUrlOpen", async ({ url }) => {
    // Expected: hive://auth/callback?ht=<handoff token>
    if (!url || !url.startsWith("hive://auth/callback")) return;

    let handoff: string | null = null;
    try {
      handoff = new URL(url).searchParams.get("ht");
    } catch {
      // Some custom-scheme URLs don't parse cleanly; fall back to a regex.
      const m = url.match(/[?&]ht=([^&]+)/);
      handoff = m ? decodeURIComponent(m[1]) : null;
    }

    // Dismiss the system browser before returning focus to the WebView.
    try {
      await Browser.close();
    } catch {
      /* browser may already be closed */
    }

    if (handoff) {
      // Navigate the WKWebView itself so the session cookie lands in its jar.
      window.location.href = `${window.location.origin}/api/auth/google/exchange?ht=${encodeURIComponent(handoff)}`;
    }
  });

  return () => {
    handle.remove();
  };
}
