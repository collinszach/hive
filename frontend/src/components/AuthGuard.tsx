"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const PUBLIC_PATHS = ["/login", "/register", "/privacy"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const [authed, setAuthed] = useState<boolean | null>(isPublic ? true : null);

  useEffect(() => {
    if (isPublic) return;

    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => {
        if (r.ok) {
          setAuthed(true);
        } else {
          router.replace("/login");
        }
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [isPublic, router]);

  if (isPublic) return <>{children}</>;
  if (!authed) return null;

  return <>{children}</>;
}
