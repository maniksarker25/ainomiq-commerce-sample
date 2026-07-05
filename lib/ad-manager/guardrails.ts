export const AD_MANAGER_CTA_ALLOWLIST = ['SHOP_NOW', 'LEARN_MORE', 'GET_OFFER', 'SIGN_UP', 'CONTACT_US'] as const;

export type PublishGateInput = {
  planStatus?: string | null;
  planVersionApproved?: boolean;
  creativesApproved?: boolean;
  selectedCopyCount?: number;
  expectedAdCount?: number;
  validDestinationCount?: number;
};

export function validatePublishGate(input: PublishGateInput) {
  const blockers: string[] = [];
  const expected = Math.max(0, input.expectedAdCount || 0);

  if (input.planStatus !== 'approved') blockers.push('Plan is not approved.');
  if (!input.planVersionApproved) blockers.push('Exact plan version has not been approved.');
  if (!input.creativesApproved) blockers.push('One or more creatives are not approved.');
  if ((input.selectedCopyCount || 0) < expected) blockers.push('Every ad needs selected copy.');
  if ((input.validDestinationCount || 0) < expected) blockers.push('Every ad needs a valid destination URL.');

  return { allowed: blockers.length === 0, blockers };
}

export function validateCopyVariant(input: { primaryText: string; headline: string; cta: string }) {
  const blockers: string[] = [];
  const primaryText = input.primaryText.trim();
  const headline = input.headline.trim();

  if (primaryText.length > 125) blockers.push('Primary text should stay under 125 characters.');
  if (headline.length > 40) blockers.push('Headline should stay under 40 characters.');
  if (!AD_MANAGER_CTA_ALLOWLIST.includes(input.cta as any)) blockers.push('CTA is not in the allowlist.');
  if (/guaranteed|100%|best in the world/i.test(`${primaryText} ${headline}`)) blockers.push('Copy contains a blocked guarantee claim.');
  if (/\byou\b/i.test(primaryText)) blockers.push('Copy uses direct you-targeting.');

  return { allowed: blockers.length === 0, blockers };
}

export function validateBudgetChange(input: { currentBudgetCents?: number | null; nextBudgetCents: number; lastScaledAt?: string | null }) {
  const blockers: string[] = [];
  const next = input.nextBudgetCents;

  if (next < 1000 || next > 2000) blockers.push('New test adsets must default to EUR 10-20 per day unless explicitly approved.');

  if (input.currentBudgetCents && input.currentBudgetCents > 0) {
    const max = Math.floor(input.currentBudgetCents * 1.2);
    if (next > max) blockers.push('Scale change is above the 20 percent max.');
  }

  if (input.lastScaledAt) {
    const last = new Date(input.lastScaledAt).getTime();
    if (Number.isFinite(last) && Date.now() - last < 48 * 60 * 60 * 1000) blockers.push('Scale cooldown is 48 hours.');
  }

  return { allowed: blockers.length === 0, blockers };
}
