"use client";

import { useEffect, useState } from "react";
import { Layers3 } from "lucide-react";
import CreativeOsWorkspace from "@/app/dashboard/creative-os/components/CreativeOsWorkspace";
import { fetchSession, type Session } from "@/lib/session";
import { Skeleton } from "@/components/ui/skeleton";

export default function CreativeOsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    fetchSession().then((fresh) => {
      if (fresh) setSession(fresh);
      setSessionReady(true);
    });
  }, []);

  const tenantId = session?.tenantId || session?.email || "";
  const isCreativeEditor = session?.accessMode === "creative-editor";

  if (!sessionReady || !tenantId) {
    return (
      <div className="mx-auto w-full max-w-[1500px] min-w-0 space-y-5 2xl:max-w-[1760px] 2xl:space-y-6">
        <Skeleton className="w-64 h-10" />
        <Skeleton className="w-full h-5 max-w-2xl" />
        <Skeleton className="h-[480px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] min-w-0 space-y-4 2xl:max-w-[1760px]">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
          <Layers3 size={26} strokeWidth={1.8} className="text-primary" />
          {isCreativeEditor ? "Creative OS Editor Portal" : "Creative OS"}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {isCreativeEditor
            ? "Your assigned briefs, source material and delivered work. Owner setup, launch and access controls are hidden."
            : "Standalone creative production for products, sources, ad tasks, review, launch and learning."}
        </p>
      </div>
      <CreativeOsWorkspace
        tenantId={tenantId}
        companyName={session?.organization || ""}
        accessMode={session?.accessMode}
        userEmail={session?.email || ""}
        userName={session?.name || ""}
      />
    </div>
  );
}
