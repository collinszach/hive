"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

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

  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar />

      {/* Main content area */}
      <main
        className="flex-1 overflow-y-auto min-h-screen relative"
        style={{
          background: "#13151C",
        }}
      >

        <div className="max-w-[1120px] mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
