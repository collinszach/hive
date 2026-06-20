"use client";

import { useEffect } from "react";
import { isNative, registerAuthDeepLink } from "@/lib/native-auth";

/**
 * Mounts once at the app root. On native (iOS) it registers the
 * `hive://auth/callback` deep-link listener that completes the Google OAuth
 * round-trip (system browser → handoff token → /exchange). No-op on web.
 */
export default function CapacitorAuthBridge() {
  useEffect(() => {
    if (!isNative()) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    registerAuthDeepLink().then((fn) => {
      // If we unmounted before registration resolved, tear the listener
      // down immediately so it never leaks or double-registers.
      if (cancelled) fn();
      else cleanup = fn;
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
