"use client";

import { useEffect, useState } from "react";
import { UpgradeModal } from "@/components/UpgradeModal";

type GateType = "plaid" | "claude" | "snaptrade" | "plaid_limit" | null;

export function UpgradeModalProvider() {
  const [gate, setGate] = useState<GateType>(null);

  useEffect(() => {
    function handleUpgradeRequired(e: Event) {
      const detail = (e as CustomEvent<{ gate?: string }>).detail;
      const rawGate = detail?.gate ?? "plaid";
      const validGates: GateType[] = ["plaid", "claude", "snaptrade", "plaid_limit"];
      setGate(validGates.includes(rawGate as GateType) ? (rawGate as GateType) : "plaid");
    }

    window.addEventListener("upgrade-required", handleUpgradeRequired);
    return () => window.removeEventListener("upgrade-required", handleUpgradeRequired);
  }, []);

  return <UpgradeModal gate={gate} onClose={() => setGate(null)} />;
}
