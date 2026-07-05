"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { fetchSession } from "../../lib/session";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authorized, setAuthorized] = useState(false);
  const [accessMode, setAccessMode] = useState<"customer" | "creative-editor">(
    "customer",
  );
  const pathname = usePathname();

  useEffect(() => {
    // Always fetch from the server so module visibility follows current account config.
    fetchSession().then((session) => {
      if (session) {
        if (
          session.accessMode === "creative-editor" &&
          !pathname.startsWith("/dashboard/creative-os")
        ) {
          window.location.href = "/dashboard/creative-os";
          return;
        }
        setAccessMode(session.accessMode || "customer");
        setAuthorized(true);
      } else {
        window.location.href = "/login";
      }
    });
  }, [pathname]);

  if (!authorized) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f7fb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            border: "2px solid #e2e6ef",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (accessMode === "creative-editor") {
    return (
      <main className="min-w-0 min-h-screen p-4 pb-24 overflow-x-hidden bg-slate-50 md:p-6 xl:p-8">
        {children}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-24 transition-[margin-left] duration-200 md:ml-[var(--dashboard-sidebar-width)] md:p-6 md:pb-8 xl:p-8">
        {children}
      </main>
    </div>
  );
}
