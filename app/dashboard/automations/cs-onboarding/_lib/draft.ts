"use client";

import { getSession } from "@/lib/session";

export function onboardingDraftKey() {
  return `ainomiq_cs_onboarding_draft_v1:${getSession()?.email || "anon"}`;
}

export function readOnboardingDraft(): Record<string, any> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(onboardingDraftKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function patchOnboardingDraft(patch: Record<string, any>) {
  if (typeof window === "undefined") return;
  try {
    const current = readOnboardingDraft();
    localStorage.setItem(
      onboardingDraftKey(),
      JSON.stringify({ ...current, ...patch }),
    );
  } catch {
    // ignore localStorage failures
  }
}

export function clearOnboardingDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(onboardingDraftKey());
  } catch {
    // ignore localStorage failures
  }
}
