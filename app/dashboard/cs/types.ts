export interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  deliveredTo: string;
  date: string;
  snippet: string;
  labels: string[];
  isUnread: boolean;
  internalDate: string;
}

export interface EmailDetail extends Email {
  body: string;
  htmlBody?: string;
  thread: Array<{
    id: string;
    from: string;
    date: string;
    snippet: string;
    subject: string;
    isSent: boolean;
  }>;
}

export interface Stats {
  received: number;
  unread: number;
  handled: number;
  sentToday: number;
  escalated: number;
  avgResponseTime: string;
  calls?: number;
}

export interface CallItem {
  callSid: string;
  from: string;
  to: string;
  direction: string;
  status: string;
  durationSec: number;
  recordingUrl: string;
  createdAt: string;
}

export interface TranscriptLine {
  speaker: 'caller' | 'agent' | 'system';
  message: string;
  createdAt: string;
}

export type Category = 'all' | 'shipping' | 'returns' | 'product' | 'other';

export type EmailStatus = 'handled' | 'pending' | 'escalated';

export interface SendAs {
  email: string;
  name: string;
  isDefault: boolean;
  isPrimary: boolean;
}

export interface AutoReplyConfig {
  email: boolean;
  instagram: boolean;
  facebook: boolean;
}

export interface CSConfig {
  auto_reply?: AutoReplyConfig | null;
  escalation_contact: string | null;
  vip: { influencers?: string; wholesale?: string } | null;
  safety: {
    max_refund_per_action?: string;
    max_refunds_per_customer_month?: number;
    daily_refund_budget?: string;
    monthly_refund_budget?: string;
    min_delivery_window_days?: number;
    mode?: string;
    fraud_flags?: string[];
  } | null;
  bot_scope: {
    allowed?: string[];
    auto_escalate?: string[];
  } | null;
  schedule: { frequency?: string; active_hours?: string } | null;
  fulfillment_email: string | null;
  tone: string | null;
  hard_rules: string | null;
}
