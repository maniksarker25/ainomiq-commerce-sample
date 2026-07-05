import { Email, Category, EmailStatus } from './types';

// Get today's midnight in user's local timezone as YYYY/MM/DD
export function getTodayMidnight(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

export function categorizeEmail(subject: string, snippet: string): Category {
  const text = `${subject} ${snippet}`.toLowerCase();
  if (/ship|track|deliver|package|post/.test(text)) return 'shipping';
  if (/return|refund|exchange|money back/.test(text)) return 'returns';
  if (/product|size|color|quality|fit|material/.test(text)) return 'product';
  return 'other';
}

export function getEmailStatus(email: Email): EmailStatus {
  if (email.labels.some(l => l.toLowerCase().includes('escalat'))) return 'escalated';
  if (!email.isUnread && email.labels.includes('INBOX')) return 'handled';
  return 'pending';
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function extractName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return from.split('@')[0];
}

export function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1];
  return from;
}

export function getAlias(email: Email): string {
  if (email.deliveredTo) return email.deliveredTo.toLowerCase();
  if (email.to) {
    const match = email.to.match(/<([^>]+)>/);
    return match ? match[1].toLowerCase() : email.to.toLowerCase();
  }
  return 'unknown';
}

export function groupQuestions(emails: Email[]): Array<{ label: string; count: number }> {
  const groups: Record<string, number> = {
    'Shipping / Tracking': 0,
    'Returns / Refunds': 0,
    'Product / Sizing': 0,
    'Order Status': 0,
    'Other': 0,
  };
  for (const e of emails) {
    const text = `${e.subject} ${e.snippet}`.toLowerCase();
    if (/ship|track|deliver|package|post/.test(text)) groups['Shipping / Tracking']++;
    else if (/return|refund|exchange|money back/.test(text)) groups['Returns / Refunds']++;
    else if (/product|size|color|quality|fit|material/.test(text)) groups['Product / Sizing']++;
    else if (/order|status|where|when/.test(text)) groups['Order Status']++;
    else groups['Other']++;
  }
  return Object.entries(groups)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function timeframePeriodLabel(days: number): string {
  if (days === 0) return 'Today';
  return `Last ${days} days`;
}
