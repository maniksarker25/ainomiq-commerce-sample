/** Client-safe credit constants (no DB). Server billing logic lives in `lib/credits.ts`. */

export type CreditAction =
  | "ai_creative"
  | "ai_personas"
  | "logic_chat"
  | "brand_scan"
  | "drive_scan"
  | "ai_copy";

export const CREDIT_COSTS: Record<CreditAction, number> = {
  ai_creative: 8,
  ai_personas: 2,
  logic_chat: 3,
  brand_scan: 5,
  drive_scan: 2,
  ai_copy: 1,
};
