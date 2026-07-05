"use client";

import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UrlInputStep({
  onSubmit,
  loading,
}: {
  onSubmit: (url: string) => void;
  loading: boolean;
}) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) onSubmit(url.trim());
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Zap className="size-7 text-primary" strokeWidth={1.5} />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Set up Intelli Support
        </h1>
        <p className="mx-auto mb-8 max-w-md text-sm text-muted-foreground">
          Enter your webshop URL and we&apos;ll automatically extract your
          products, policies, and contact information to train your AI agent.
        </p>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourstore.com"
            className="h-11 flex-1 rounded-xl"
            required
            disabled={loading}
            autoFocus
          />
          <Button
            type="submit"
            disabled={loading || !url.trim()}
            className="h-11 rounded-xl px-6"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              "Scan store"
            )}
          </Button>
        </form>

        <p className="mt-4 text-[11px] text-muted-foreground">
          We&apos;ll scan your public pages — no login or API keys required.
        </p>
      </div>
    </div>
  );
}
