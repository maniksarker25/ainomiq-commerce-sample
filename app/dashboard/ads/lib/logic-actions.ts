import type { Campaign, CreativeLibraryAsset, DbRow, MetaAdPerformance } from "../types";
import { formatCurrency } from "../utils";
import { recommendationLabel } from "../components/ReviewComponents";

export type LogicActionCard = {
  id: string;
  title: string;
  detail: string;
  metric: string;
  severity: 'info' | 'warning' | 'success' | 'critical';
  action: string;
  category: string;
  evidence: string;
  score: number;
  prompt: string;
};

export type LogicActionGroup = {
  id: string;
  title: string;
  summary: string;
  severity: LogicActionCard['severity'];
  cards: LogicActionCard[];
};

const LOGIC_ACTION_GROUPS: Array<{ id: string; title: string; categories: string[]; summary: string }> = [
  { id: 'profit-leaks', title: 'Profit leaks', categories: ['Stop loss', 'Profit leak', 'Budget allocation'], summary: 'Spend that should be killed, capped or rebalanced first.' },
  { id: 'conversion-leaks', title: 'Conversion leaks', categories: ['Conversion leak'], summary: 'Traffic is clicking, but the offer, page or product match is not converting enough.' },
  { id: 'creative-fatigue', title: 'Creative fatigue', categories: ['Creative fatigue', 'Ad fatigue'], summary: 'High repetition or declining response that needs fresh hooks, formats or first frames.' },
  { id: 'creative-pull', title: 'Creative pull', categories: ['Creative pull', 'Auction'], summary: 'Signals where the ad is expensive to show or click because the creative/audience fit is weak.' },
  { id: 'scale-winners', title: 'Scale winners', categories: ['Scale', 'Ad-level scale'], summary: 'Winners worth scaling carefully or turning into sibling creatives.' },
  { id: 'pipeline', title: 'Creative pipeline', categories: ['Creative pipeline', 'Creative QA'], summary: 'Assets and generated creatives that can feed the next batch.' },
  { id: 'setup', title: 'Setup', categories: ['Setup', 'Saved signal', 'Health'], summary: 'Account setup, saved recommendations and general health signals.' },
];

function severityRank(severity: LogicActionCard['severity']) {
  if (severity === 'critical') return 4;
  if (severity === 'warning') return 3;
  if (severity === 'success') return 2;
  return 1;
}

export function groupLogicActionCards(cards: LogicActionCard[]): LogicActionGroup[] {
  const groups = LOGIC_ACTION_GROUPS
    .map(group => ({
      ...group,
      cards: cards.filter(card => group.categories.includes(card.category)),
    }))
    .filter(group => group.cards.length)
    .map(group => {
      const sortedCards = [...group.cards].sort((a, b) => b.score - a.score);
      const severity = sortedCards.reduce<LogicActionCard['severity']>((highest, card) => (
        severityRank(card.severity) > severityRank(highest) ? card.severity : highest
      ), 'info');
      return { id: group.id, title: group.title, summary: group.summary, severity, cards: sortedCards };
    });
  const assignedCategories = new Set(LOGIC_ACTION_GROUPS.flatMap(group => group.categories));
  const other = cards.filter(card => !assignedCategories.has(card.category));
  if (other.length) {
    groups.push({
      id: 'other',
      title: 'Other signals',
      summary: 'Additional useful actions that do not fit the main buckets yet.',
      severity: other.reduce<LogicActionCard['severity']>((highest, card) => (
        severityRank(card.severity) > severityRank(highest) ? card.severity : highest
      ), 'info'),
      cards: [...other].sort((a, b) => b.score - a.score),
    });
  }
  return groups.sort((a, b) => {
    const severityDiff = severityRank(b.severity) - severityRank(a.severity);
    if (severityDiff) return severityDiff;
    return (b.cards[0]?.score || 0) - (a.cards[0]?.score || 0);
  });
}

export function buildLogicActionCards(input: {
  campaigns: Campaign[];
  ads: MetaAdPerformance[];
  recommendations: DbRow[];
  creativeAssets: CreativeLibraryAsset[];
  latestCreatives: DbRow[];
  productCount: number;
  metaConnected: boolean;
  googleDriveConnected: boolean;
}): LogicActionCard[] {
  const cards: LogicActionCard[] = [];
  const breakEvenRoas = 1.44;
  const campaigns = input.campaigns.filter(campaign => Number(campaign.spend || 0) > 0 || Number(campaign.impressions || 0) > 0);
  const ads = input.ads.filter(ad => Number(ad.spend || 0) > 0 || Number(ad.impressions || 0) > 0);
  const active = input.campaigns.filter(campaign => [campaign.status, campaign.effective_status].some(status => String(status || '').toUpperCase().includes('ACTIVE')));
  const totalSpend = campaigns.reduce((sum, campaign) => sum + Number(campaign.spend || 0), 0);
  const totalClicks = campaigns.reduce((sum, campaign) => sum + Number(campaign.clicks || 0), 0);
  const totalImpressions = campaigns.reduce((sum, campaign) => sum + Number(campaign.impressions || 0), 0);
  const totalPurchases = campaigns.reduce((sum, campaign) => sum + Number(campaign.purchases || 0), 0);
  const accountCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const accountCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const accountCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const accountCpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
  const minMeaningfulSpend = Math.max(25, totalSpend * 0.015);
  const minScaleSpend = Math.max(50, totalSpend * 0.02);

  function add(card: LogicActionCard) {
    if (cards.some(existing => existing.id === card.id)) return;
    cards.push(card);
  }

  function campaignCpa(campaign: Campaign) {
    return campaign.purchases > 0 ? campaign.spend / campaign.purchases : 0;
  }

  function conversionRate(clicks: number, purchases: number) {
    return clicks > 0 ? (purchases / clicks) * 100 : 0;
  }

  function campaignPrompt(cardTitle: string, entityName: string, evidence: string) {
    return `${cardTitle}: diagnose ${entityName}. Use spend, ROAS, CPA, CTR, CPC, CPM, frequency and purchases. Give me a clear kill/scale/refresh action, why, and the next exact step. Evidence: ${evidence}`;
  }

  for (const row of input.recommendations.slice(0, 6)) {
    add({
      id: `db-${String(row.id || row.title)}`,
      title: String(row.title || 'Review recommendation'),
      detail: recommendationLabel(row.recommendation_type),
      metric: recommendationLabel(row.severity || 'open'),
      severity: String(row.severity || '').toLowerCase().includes('high') ? 'warning' : 'info',
      action: 'See details',
      category: 'Saved signal',
      evidence: String(row.reasoning || row.created_at || 'Saved recommendation'),
      score: String(row.severity || '').toLowerCase().includes('high') ? 74 : 42,
      prompt: `Review this saved recommendation and turn it into a concrete action: ${String(row.title || '')}`,
    });
  }

  const wasteCampaigns = campaigns
    .filter(campaign => campaign.spend >= minMeaningfulSpend && campaign.purchases === 0)
    .sort((a, b) => b.spend - a.spend)[0];
  if (wasteCampaigns) {
    const evidence = `${formatCurrency(wasteCampaigns.spend)} spend, ${wasteCampaigns.clicks} clicks, ${wasteCampaigns.purchases} purchases, ${Number(wasteCampaigns.ctr || 0).toFixed(2)}% CTR.`;
    add({
      id: `campaign-waste-${wasteCampaigns.id}`,
      title: 'Kill or cap spend with no purchases',
      detail: `${wasteCampaigns.name} is spending without purchase signal. Treat this as a stop-loss candidate.`,
      metric: `${formatCurrency(wasteCampaigns.spend)} waste`,
      severity: 'critical',
      action: 'Diagnose kill/cap',
      category: 'Stop loss',
      evidence,
      score: 120 + wasteCampaigns.spend / 10,
      prompt: campaignPrompt('Kill or cap spend with no purchases', wasteCampaigns.name, evidence),
    });
  }

  campaigns
    .filter(campaign => campaign.spend >= minMeaningfulSpend && campaign.purchases > 0 && campaign.roas > 0 && campaign.roas < breakEvenRoas)
    .sort((a, b) => (b.spend - a.spend))
    .slice(0, 2)
    .forEach(campaign => {
      const cpa = campaignCpa(campaign);
      const evidence = `${formatCurrency(campaign.spend)} spend, ${campaign.roas.toFixed(2)}x ROAS, ${formatCurrency(cpa)} CPA, ${campaign.purchases} purchases.`;
      add({
        id: `campaign-low-roas-${campaign.id}`,
        title: 'Kill or reduce low-ROAS campaign',
        detail: `${campaign.name} is below break-even after meaningful spend. Do not let budget drift into this without a reason.`,
        metric: `${campaign.roas.toFixed(2)}x ROAS`,
        severity: 'critical',
        action: 'Find what to pause',
        category: 'Profit leak',
        evidence,
        score: 112 + campaign.spend / 15,
        prompt: campaignPrompt('Kill or reduce low-ROAS campaign', campaign.name, evidence),
      });
    });

  const winner = campaigns
    .filter(campaign => campaign.purchases >= 3 && campaign.spend >= minScaleSpend && campaign.roas >= Math.max(2, breakEvenRoas * 1.35))
    .sort((a, b) => (b.roas || 0) - (a.roas || 0))[0];
  if (winner) {
    const evidence = `${winner.roas.toFixed(2)}x ROAS, ${winner.purchases} purchases, ${formatCurrency(winner.spend)} spend, ${Number(winner.frequency || 0).toFixed(2)} frequency.`;
    add({
      id: `campaign-winner-${winner.id}`,
      title: 'Scale high-return campaign',
      detail: `${winner.name} has enough purchase signal to justify controlled scaling and more creative variations.`,
      metric: `${winner.roas.toFixed(2)}x ROAS`,
      severity: 'success',
      action: 'Scale winner',
      category: 'Scale',
      evidence,
      score: 92 + winner.roas * 8 + winner.purchases,
      prompt: campaignPrompt('Scale high-return campaign', winner.name, evidence),
    });
  }

  campaigns
    .filter(campaign => Number(campaign.frequency || 0) >= 3 && campaign.spend >= minMeaningfulSpend && (campaign.roas < breakEvenRoas || (accountCtr > 0 && Number(campaign.ctr || 0) < accountCtr * 0.85)))
    .sort((a, b) => Number(b.frequency || 0) - Number(a.frequency || 0))
    .slice(0, 2)
    .forEach(campaign => {
      const evidence = `${Number(campaign.frequency || 0).toFixed(2)} frequency, ${Number(campaign.ctr || 0).toFixed(2)}% CTR, ${campaign.roas.toFixed(2)}x ROAS.`;
      add({
        id: `campaign-fatigue-${campaign.id}`,
        title: 'Refresh fatigued creative',
        detail: `${campaign.name} is showing repetition pressure. High frequency with weaker response usually needs new hooks, formats or angles.`,
        metric: `${Number(campaign.frequency || 0).toFixed(2)} frequency`,
        severity: 'warning',
        action: 'Create fresh angles',
        category: 'Creative fatigue',
        evidence,
        score: 88 + Number(campaign.frequency || 0) * 6,
        prompt: campaignPrompt('Refresh fatigued creative', campaign.name, evidence),
      });
    });

  campaigns
    .filter(campaign => campaign.spend >= minMeaningfulSpend && Number(campaign.cpc || 0) > Math.max(0.75, accountCpc * 1.2) && Number(campaign.ctr || 0) < Math.max(0.9, accountCtr * 0.85))
    .sort((a, b) => Number(b.cpc || 0) - Number(a.cpc || 0))
    .slice(0, 2)
    .forEach(campaign => {
      const evidence = `${formatCurrency(Number(campaign.cpc || 0))} CPC vs account ${formatCurrency(accountCpc)}, ${Number(campaign.ctr || 0).toFixed(2)}% CTR.`;
      add({
        id: `campaign-expensive-clicks-${campaign.id}`,
        title: 'Fix expensive clicks',
        detail: `${campaign.name} has high CPC and weak CTR. The hook/visual is probably not earning cheap attention.`,
        metric: `${formatCurrency(Number(campaign.cpc || 0))} CPC`,
        severity: 'warning',
        action: 'Rewrite hook',
        category: 'Creative pull',
        evidence,
        score: 82 + Number(campaign.cpc || 0) * 8,
        prompt: campaignPrompt('Fix expensive clicks', campaign.name, evidence),
      });
    });

  campaigns
    .filter(campaign => campaign.clicks >= 40 && Number(campaign.ctr || 0) >= Math.max(1.4, accountCtr * 1.1) && (campaign.purchases === 0 || campaign.roas < breakEvenRoas))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 2)
    .forEach(campaign => {
      const cvr = conversionRate(campaign.clicks, campaign.purchases);
      const evidence = `${Number(campaign.ctr || 0).toFixed(2)}% CTR, ${campaign.clicks} clicks, ${cvr.toFixed(2)}% click-to-purchase, ${campaign.roas.toFixed(2)}x ROAS.`;
      add({
        id: `campaign-traffic-no-sales-${campaign.id}`,
        title: 'Traffic is interested, conversion is weak',
        detail: `${campaign.name} gets clicks but does not convert well. Check offer, landing page, product match and post-click friction.`,
        metric: `${cvr.toFixed(2)}% CVR`,
        severity: 'warning',
        action: 'Audit offer/page',
        category: 'Conversion leak',
        evidence,
        score: 86 + campaign.clicks / 20,
        prompt: campaignPrompt('Traffic is interested, conversion is weak', campaign.name, evidence),
      });
    });

  campaigns
    .filter(campaign => campaign.spend >= minMeaningfulSpend && Number(campaign.cpm || 0) > Math.max(12, accountCpm * 1.25) && Number(campaign.ctr || 0) < Math.max(0.9, accountCtr * 0.9))
    .sort((a, b) => Number(b.cpm || 0) - Number(a.cpm || 0))
    .slice(0, 1)
    .forEach(campaign => {
      const evidence = `${formatCurrency(Number(campaign.cpm || 0))} CPM vs account ${formatCurrency(accountCpm)}, ${Number(campaign.ctr || 0).toFixed(2)}% CTR.`;
      add({
        id: `campaign-auction-pressure-${campaign.id}`,
        title: 'Auction pressure with weak response',
        detail: `${campaign.name} is paying premium CPMs without enough engagement. Broaden input, refresh creative or review placements.`,
        metric: `${formatCurrency(Number(campaign.cpm || 0))} CPM`,
        severity: 'warning',
        action: 'Review audience/creative',
        category: 'Auction',
        evidence,
        score: 76 + Number(campaign.cpm || 0) / 2,
        prompt: campaignPrompt('Auction pressure with weak response', campaign.name, evidence),
      });
    });

  const topAdSpend = ads[0]?.spend || 0;
  const totalAdSpend = ads.reduce((sum, ad) => sum + Number(ad.spend || 0), 0);
  if (ads.length >= 4 && totalAdSpend > 0 && topAdSpend / totalAdSpend > 0.45 && (ads[0]?.roas || 0) < breakEvenRoas) {
    const ad = ads[0];
    const evidence = `${Math.round((topAdSpend / totalAdSpend) * 100)}% of inspected ad spend is in ${ad.name}, with ${ad.roas.toFixed(2)}x ROAS.`;
    add({
      id: `budget-concentration-${ad.id}`,
      title: 'Budget is concentrated in a weak ad',
      detail: `${ad.name} is taking a large share of spend without enough return. This needs a kill/cap decision before more budget leaks.`,
      metric: `${Math.round((topAdSpend / totalAdSpend) * 100)}% spend share`,
      severity: 'critical',
      action: 'Rebalance spend',
      category: 'Budget allocation',
      evidence,
      score: 118 + topAdSpend / 10,
      prompt: `Diagnose ad spend concentration. ${evidence} Tell me whether to kill, cap or isolate this ad and where budget should go instead.`,
    });
  }

  ads
    .filter(ad => ad.verdict === 'KILL')
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 3)
    .forEach(ad => {
      const evidence = `${formatCurrency(ad.spend)} spend, ${ad.roas.toFixed(2)}x ROAS, ${ad.purchases} purchases, ${formatCurrency(ad.cpc)} CPC, ${ad.ctr.toFixed(2)}% CTR.`;
      add({
        id: `ad-kill-${ad.id}`,
        title: 'Kill this ad',
        detail: `${ad.name} is failing the stop-loss rules. Pause, cap or isolate it unless there is delayed attribution you trust.`,
        metric: `${ad.roas.toFixed(2)}x ROAS`,
        severity: 'critical',
        action: 'Confirm kill',
        category: 'Ad-level kill',
        evidence,
        score: 110 + ad.spend / 8,
        prompt: `Kill this ad? Evidence: ${evidence}. Give me the exact action and what replacement creative angle to create.`,
      });
    });

  ads
    .filter(ad => ad.verdict === 'SCALE')
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 3)
    .forEach(ad => {
      const evidence = `${ad.roas.toFixed(2)}x ROAS, ${ad.purchases} purchases, ${formatCurrency(ad.spend)} spend, ${ad.ctr.toFixed(2)}% CTR.`;
      add({
        id: `ad-scale-${ad.id}`,
        title: 'Scale this ad concept',
        detail: `${ad.name} is a proven winner. Make sibling ads from the same promise before scaling spend too aggressively.`,
        metric: `${ad.roas.toFixed(2)}x ROAS`,
        severity: 'success',
        action: 'Build variants',
        category: 'Ad-level scale',
        evidence,
        score: 90 + ad.roas * 8 + ad.purchases,
        prompt: `Scale this ad concept. Evidence: ${evidence}. Give me 5 sibling creative angles and a controlled scale plan.`,
      });
    });

  ads
    .filter(ad => ad.frequency >= 3 && ad.spend >= 20 && (ad.roas < breakEvenRoas || ad.ctr < Math.max(0.9, accountCtr * 0.85)))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 2)
    .forEach(ad => {
      const evidence = `${ad.frequency.toFixed(2)} frequency, ${ad.ctr.toFixed(2)}% CTR, ${ad.roas.toFixed(2)}x ROAS.`;
      add({
        id: `ad-fatigue-${ad.id}`,
        title: 'Creative is wearing out',
        detail: `${ad.name} has repetition pressure at ad level. Refresh the first frame, headline, format or offer angle.`,
        metric: `${ad.frequency.toFixed(2)} frequency`,
        severity: 'warning',
        action: 'Refresh ad',
        category: 'Ad fatigue',
        evidence,
        score: 84 + ad.frequency * 7,
        prompt: `This ad may be fatigued. Evidence: ${evidence}. Tell me how to refresh it without losing the winning idea.`,
      });
    });

  if (!input.metaConnected) {
    add({ id: 'connect-meta', title: 'Connect Meta Ads first', detail: 'Logic Ads needs ad account data to answer performance questions and detect wasted budget.', metric: 'Setup', severity: 'warning', action: 'Set up Meta Ads', category: 'Setup', evidence: 'Meta is not connected.', score: 100, prompt: 'Help me connect Meta Ads and explain what performance signals Logic Ads will use afterwards.' });
  }
  if (!input.productCount) {
    add({ id: 'scan-brand-data', title: 'Analyze business to load products', detail: 'Catalog products are needed before Logic Ads can build product-specific personas and ads.', metric: 'Brand Data', severity: 'info', action: 'Analyze business', category: 'Setup', evidence: 'No product catalog loaded.', score: 58, prompt: 'Help me set up Brand Data so Logic Ads can build product-specific actions and creatives.' });
  }
  if (!input.googleDriveConnected && input.productCount > 0) {
    add({ id: 'connect-drive', title: 'Add Library assets', detail: 'Library photos and videos make the creative refresh flow stronger.', metric: 'Assets', severity: 'info', action: 'Add assets', category: 'Setup', evidence: 'No Library assets connected.', score: 46, prompt: 'Help me add Library assets and decide which product folders matter first.' });
  }
  if (!active.length && input.metaConnected) {
    add({ id: 'no-active-campaigns', title: 'No active campaigns in this range', detail: 'Use Logic Ads to inspect paused campaigns, pick a product and create the next test structure.', metric: '0 active', severity: 'info', action: 'Plan next test', category: 'Setup', evidence: 'No active campaigns returned for this date range.', score: 52, prompt: 'No active campaigns are visible. Help me plan the next clean test structure.' });
  }
  if (input.creativeAssets.length) {
    add({ id: 'review-assets', title: 'Turn saved assets into new angles', detail: `${input.creativeAssets.length} library assets are available for creative refreshes and new angle prompts.`, metric: `${input.creativeAssets.length} assets`, severity: 'info', action: 'Build from assets', category: 'Creative pipeline', evidence: `${input.creativeAssets.length} saved assets available.`, score: 38 + input.creativeAssets.length, prompt: 'Use my saved assets to suggest new ad angles and which existing winners they should support.' });
  }
  if (input.latestCreatives.length >= 5 && active.length) {
    add({ id: 'creative-review-loop', title: 'Review generated creatives against spend signals', detail: `${input.latestCreatives.length} generated creatives can be matched to winners, fatigue signals and stop-loss ads.`, metric: `${input.latestCreatives.length} creatives`, severity: 'info', action: 'Review creative fit', category: 'Creative QA', evidence: `${input.latestCreatives.length} generated creatives and ${active.length} active campaigns.`, score: 35 + input.latestCreatives.length / 2, prompt: 'Review my generated creatives against the current performance signals and tell me which to use, revise or ignore.' });
  }
  if (!cards.length && active.length) {
    add({ id: 'healthy', title: 'No urgent issues found', detail: `Account-level signals are stable: ${formatCurrency(totalSpend)} spend, ${totalPurchases} purchases, ${accountCpa ? `${formatCurrency(accountCpa)} CPA` : 'CPA unavailable'}.`, metric: `${active.length} active campaigns`, severity: 'success', action: 'Ask Logic Ads', category: 'Health', evidence: `${active.length} active campaigns, ${totalPurchases} purchases.`, score: 20, prompt: 'No urgent issues were found. Give me the best next test to improve performance anyway.' });
  }
  if (!cards.length) {
    add({ id: 'starter', title: 'Start with a Logic Ads question', detail: 'Connect data, ask about performance or build the first product-specific ad test.', metric: 'Ready', severity: 'info', action: 'Ask Logic Ads', category: 'Setup', evidence: 'No performance data available yet.', score: 10, prompt: 'Help me start with the right Logic Ads setup and first useful action.' });
  }
  return cards
    .sort((a, b) => b.score - a.score)
    .slice(0, 14);
}
