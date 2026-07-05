"use client";

import type { ComponentProps, ReactNode } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MagicButtonProps = ComponentProps<typeof Button> & {
  loading?: boolean;
  showSparkles?: boolean;
  tone?: "gradient" | "soft";
  children: ReactNode;
};

export function MagicButton({
  loading = false,
  showSparkles = true,
  tone = "gradient",
  className,
  disabled,
  children,
  ...props
}: MagicButtonProps) {
  return (
    <Button
      type="button"
      disabled={disabled || loading}
      className={cn(
        tone === "gradient"
          ? "ai-action border-0 text-white hover:brightness-[1.03] disabled:opacity-70"
          : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10",
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" />
      ) : showSparkles ? (
        <Sparkles />
      ) : null}
      {children}
    </Button>
  );
}

/** Default shadcn primary button for operational commits. */
export function WorkflowButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return <Button className={cn("rounded-xl", className)} {...props} />;
}
