import { getTenantConfig, setTenantConfig } from "./db";
import { CREDIT_COSTS, type CreditAction } from "./credit-costs";

export { CREDIT_COSTS, type CreditAction } from "./credit-costs";

/**
 * Ainomiq platform billing (Nomi credits / Logic Ads plans).
 * Not Shopify App Store billing - the Shopify listing is a free data connector.
 * Charges apply when merchants run paid AI content/automation actions, not for viewing synced Shopify data.
 */

export type BillingPlanId = "launch" | "growth" | "scale";

export type CreditLedgerEntry = {
  id: string;
  at: string;
  type: "grant" | "spend" | "topup" | "refund";
  action?: CreditAction;
  amount: number;
  balance_after: number;
  label: string;
  meta?: Record<string, unknown>;
};

export type CreditAccount = {
  plan: BillingPlanId;
  balance: number;
  monthly_grant_claimed_for?: string;
  monthly_grant_amount_claimed?: number;
  ledger: CreditLedgerEntry[];
  updated_at: string;
};

export const BILLING_PLANS: Record<
  BillingPlanId,
  {
    id: BillingPlanId;
    name: string;
    price: number;
    monthlyCredits: number;
    logicChat: boolean;
    description: string;
  }
> = {
  launch: {
    id: "launch",
    name: "Launch",
    price: 0,
    monthlyCredits: 25,
    logicChat: false,
    description: "Free starter plan for setup, Brand Data and small tests.",
  },
  growth: {
    id: "growth",
    name: "Growth",
    price: 149,
    monthlyCredits: 150,
    logicChat: true,
    description: "Paid plan for regular creative generation and Logic Chat.",
  },
  scale: {
    id: "scale",
    name: "Scale",
    price: 449,
    monthlyCredits: 600,
    logicChat: true,
    description:
      "Full Logic Ads workflow with strategist chat and higher monthly credits.",
  },
};

const CREDIT_ACCOUNT_KEY = "billing_credit_account";

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function entry(
  type: CreditLedgerEntry["type"],
  amount: number,
  balance: number,
  label: string,
  action?: CreditAction,
  meta?: Record<string, unknown>,
): CreditLedgerEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    type,
    action,
    amount,
    balance_after: balance,
    label,
    meta,
  };
}

function sanitizePlan(value: unknown): BillingPlanId {
  return value === "scale" || value === "growth" || value === "launch"
    ? value
    : "launch";
}

function parseAccount(raw: string | null): CreditAccount {
  if (!raw) {
    const plan = "launch";
    return {
      plan,
      balance: BILLING_PLANS[plan].monthlyCredits,
      monthly_grant_claimed_for: monthKey(),
      monthly_grant_amount_claimed: BILLING_PLANS[plan].monthlyCredits,
      ledger: [
        entry(
          "grant",
          BILLING_PLANS[plan].monthlyCredits,
          BILLING_PLANS[plan].monthlyCredits,
          `${BILLING_PLANS[plan].name} monthly credits`,
        ),
      ],
      updated_at: new Date().toISOString(),
    };
  }
  try {
    const parsed = JSON.parse(raw);
    const plan = sanitizePlan(parsed?.plan);
    const claimedMonth = String(parsed?.monthly_grant_claimed_for || "");
    const parsedClaimedAmount = Math.max(
      0,
      Math.floor(Number(parsed?.monthly_grant_amount_claimed) || 0),
    );
    return {
      plan,
      balance: Math.max(0, Math.floor(Number(parsed?.balance) || 0)),
      monthly_grant_claimed_for: claimedMonth,
      monthly_grant_amount_claimed:
        parsedClaimedAmount ||
        (claimedMonth === monthKey() ? BILLING_PLANS[plan].monthlyCredits : 0),
      ledger: Array.isArray(parsed?.ledger) ? parsed.ledger.slice(-80) : [],
      updated_at: String(parsed?.updated_at || new Date().toISOString()),
    };
  } catch {
    return parseAccount(null);
  }
}

async function saveAccount(tenantId: string, account: CreditAccount) {
  await setTenantConfig(
    tenantId,
    CREDIT_ACCOUNT_KEY,
    JSON.stringify({
      ...account,
      ledger: account.ledger.slice(-120),
      updated_at: new Date().toISOString(),
    }),
  );
}

export async function getCreditAccount(
  tenantId: string,
): Promise<CreditAccount> {
  const account = parseAccount(
    await getTenantConfig(tenantId, CREDIT_ACCOUNT_KEY),
  );
  const plan = BILLING_PLANS[account.plan];
  const currentMonth = monthKey();
  if (account.monthly_grant_claimed_for !== currentMonth) {
    account.balance += plan.monthlyCredits;
    account.monthly_grant_claimed_for = currentMonth;
    account.monthly_grant_amount_claimed = plan.monthlyCredits;
    account.ledger.push(
      entry(
        "grant",
        plan.monthlyCredits,
        account.balance,
        `${plan.name} monthly credits`,
      ),
    );
    await saveAccount(tenantId, account);
  }
  return account;
}

export async function setBillingPlan(tenantId: string, planId: BillingPlanId) {
  const account = await getCreditAccount(tenantId);
  const nextPlan = BILLING_PLANS[planId] ? planId : "launch";
  if (account.plan !== nextPlan) {
    const currentMonth = monthKey();
    const claimedThisMonth =
      account.monthly_grant_claimed_for === currentMonth
        ? Math.max(
            0,
            Math.floor(Number(account.monthly_grant_amount_claimed) || 0),
          )
        : 0;
    const nextMonthlyGrant = BILLING_PLANS[nextPlan].monthlyCredits;
    const grantDelta = Math.max(0, nextMonthlyGrant - claimedThisMonth);
    account.plan = nextPlan;
    account.monthly_grant_claimed_for = monthKey();
    account.monthly_grant_amount_claimed = Math.max(
      claimedThisMonth,
      nextMonthlyGrant,
    );
    if (grantDelta > 0) {
      account.balance += grantDelta;
      account.ledger.push(
        entry(
          "grant",
          grantDelta,
          account.balance,
          `${BILLING_PLANS[nextPlan].name} plan Nomi adjustment`,
          undefined,
          { plan: nextPlan },
        ),
      );
    }
    await saveAccount(tenantId, account);
  }
  return account;
}

export async function addCredits(
  tenantId: string,
  amount: number,
  label = "Credit top-up",
) {
  const account = await getCreditAccount(tenantId);
  const safeAmount = Math.max(
    1,
    Math.min(Math.floor(Number(amount) || 0), 10000),
  );
  account.balance += safeAmount;
  account.ledger.push(entry("topup", safeAmount, account.balance, label));
  await saveAccount(tenantId, account);
  return account;
}

export async function requireCredits(
  tenantId: string,
  action: CreditAction,
  quantity = 1,
) {
  const account = await getCreditAccount(tenantId);
  const amount =
    CREDIT_COSTS[action] * Math.max(1, Math.floor(Number(quantity) || 1));
  if (account.balance < amount) {
    const error = new Error(
      `Not enough Nomi's. This action needs ${amount} Nomi's and you have ${account.balance}.`,
    );
    (error as Error & { status?: number; credits?: unknown }).status = 402;
    (error as Error & { status?: number; credits?: unknown }).credits = {
      required: amount,
      balance: account.balance,
      action,
    };
    throw error;
  }
  return { account, required: amount };
}

export async function spendCredits(
  tenantId: string,
  action: CreditAction,
  quantity = 1,
  label?: string,
  meta?: Record<string, unknown>,
) {
  const { account, required: amount } = await requireCredits(
    tenantId,
    action,
    quantity,
  );
  account.balance -= amount;
  account.ledger.push(
    entry("spend", -amount, account.balance, label || action, action, meta),
  );
  await saveAccount(tenantId, account);
  return { account, charged: amount };
}

export async function requirePlanFeature(
  tenantId: string,
  feature: "logicChat",
) {
  const account = await getCreditAccount(tenantId);
  if (!BILLING_PLANS[account.plan][feature]) {
    const error = new Error(
      "Logic Chat is included on Growth and Scale.",
    );
    (error as Error & { status?: number; credits?: unknown }).status = 402;
    (error as Error & { status?: number; credits?: unknown }).credits = {
      plan: account.plan,
      feature,
    };
    throw error;
  }
  return account;
}

export function creditErrorResponse(err: unknown) {
  const maybe = err as Error & { status?: number; credits?: unknown };
  if (maybe?.status === 402) {
    return Response.json(
      { error: maybe.message, credits: maybe.credits },
      { status: 402 },
    );
  }
  return null;
}
