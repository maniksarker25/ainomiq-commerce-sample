import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

type CreativeOsStateLike = {
  products?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
  sources?: Array<Record<string, unknown>>;
  deliveredEdits?: Array<Record<string, unknown>>;
  reviews?: Array<Record<string, unknown>>;
  chatMessages?: Array<Record<string, unknown>>;
  permissions?: Array<Record<string, unknown>>;
};

type CreativeOsActor = {
  email: string;
  name?: string;
  accessMode?: string;
};

const FROM_EMAIL = 'Ainomiq Creative OS <no-reply@ainomiq.com>';

const BRIEF_TRACKED_FIELDS = [
  'brief',
  'angle',
  'hook',
  'angles',
  'hooks',
  'format',
  'outputCount',
  'dueDate',
  'notes',
  'sourceCreativeId',
  'sourceGroupKey',
  'assignee',
  'scheduleType',
  'recurrenceDay',
] as const;

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value: unknown) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function looksLikeEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asString(value).toLowerCase());
}

function normalizeComparable(value: unknown) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'number') return String(value);
  return asString(value);
}

function resolveEditorEmail(assignee: string, permissions: Array<Record<string, unknown>>) {
  const raw = asString(assignee);
  if (!raw || raw === 'Unassigned') return '';
  if (looksLikeEmail(raw)) return raw.toLowerCase();
  const normalized = raw.toLowerCase();
  for (const permission of permissions) {
    const email = asString(permission.email).toLowerCase();
    const userName = asString(permission.userName).toLowerCase();
    if (email && looksLikeEmail(email) && (email === normalized || userName === normalized)) return email;
    if (userName && looksLikeEmail(userName) && userName === normalized) return userName;
  }
  return '';
}

function briefTaskChangedFields(previous: Record<string, unknown>, next: Record<string, unknown>) {
  return BRIEF_TRACKED_FIELDS.filter(field => normalizeComparable(previous[field]) !== normalizeComparable(next[field]));
}

function sourceMaterialLabel(state: CreativeOsStateLike, task: Record<string, unknown>) {
  const groupName = asString(task.sourceGroupName);
  if (groupName) return groupName;
  const source = sourceFor(state, asString(task.sourceCreativeId));
  return asString(source.name) || asString(source.importName) || 'Source material';
}

function scheduleLabel(task: Record<string, unknown>) {
  const scheduleType = asString(task.scheduleType);
  if (scheduleType === 'returning') {
    const day = asString(task.recurrenceDay) || 'weekly';
    return `Weekly (${day})`;
  }
  const due = asString(task.dueDate);
  return due ? `Due ${due}` : 'One-time brief';
}

function briefChangeSummary(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
  state: CreativeOsStateLike,
) {
  const rawChanged = briefTaskChangedFields(previous, next);
  if (!rawChanged.length) return { labels: [] as string[], details: [] as string[] };

  const labels = new Set<string>();
  const details: string[] = [];
  const rawSet = new Set(rawChanged);

  if (rawSet.has('sourceCreativeId') || rawSet.has('sourceGroupKey')) {
    labels.add('Source material');
    const previousLabel = sourceMaterialLabel(state, previous);
    const nextLabel = sourceMaterialLabel(state, next);
    if (previousLabel !== nextLabel) {
      details.push(`Source material: ${previousLabel} → ${nextLabel}`);
    }
  }

  if (rawSet.has('brief')) {
    labels.add('Brief name');
    details.push(`Brief name: ${asString(previous.brief) || 'Untitled'} → ${asString(next.brief) || 'Untitled'}`);
  }

  if (rawSet.has('assignee')) {
    labels.add('Assigned editor');
    details.push(`Editor: ${asString(previous.assignee) || 'Unassigned'} → ${asString(next.assignee) || 'Unassigned'}`);
  }

  if (rawSet.has('angle') || rawSet.has('angles')) {
    labels.add('Angles');
  }

  if (rawSet.has('hook') || rawSet.has('hooks')) {
    labels.add('Hooks');
  }

  if (rawSet.has('format')) {
    labels.add('Format');
    details.push(`Format: ${asString(previous.format) || '—'} → ${asString(next.format) || '—'}`);
  }

  if (rawSet.has('outputCount')) {
    labels.add('Output count');
    details.push(`Outputs: ${String(previous.outputCount ?? '—')} → ${String(next.outputCount ?? '—')}`);
  }

  if (rawSet.has('dueDate') || rawSet.has('scheduleType') || rawSet.has('recurrenceDay')) {
    labels.add('Schedule');
    details.push(`Schedule: ${scheduleLabel(previous)} → ${scheduleLabel(next)}`);
  }

  if (rawSet.has('notes')) {
    labels.add('Instructions');
  }

  return { labels: [...labels], details };
}

function isVideoDelivery(edit: Record<string, unknown>, state: CreativeOsStateLike) {
  const previewUrl = asString(edit.previewUrl).toLowerCase();
  if (!previewUrl) return false;
  if (/\.(mp4|mov|webm|m4v|mkv)(\?|#|$)/i.test(previewUrl)) return true;
  if (/\/video\//i.test(previewUrl) || /video%2f/i.test(previewUrl)) return true;
  const task = taskFor(state, asString(edit.taskId));
  const format = asString(task.format).toLowerCase();
  if (format.includes('video') || format.includes('vsl')) return true;
  return false;
}

function baseUrl(request: NextRequest) {
  const configured = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  return 'https://app.ainomiq.com';
}

function creativeOsUrl(request: NextRequest, email?: string) {
  const returnPath = '/dashboard/creative-os';
  if (!email) return `${baseUrl(request)}${returnPath}`;
  return `${baseUrl(request)}/login?force=1&email=${encodeURIComponent(email)}&return=${encodeURIComponent(returnPath)}`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Email service not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Email send failed: ${res.status} ${text.slice(0, 180)}`);
  }
}

async function ensureNotificationStore() {
  await db.execute(`CREATE TABLE IF NOT EXISTS creative_os_notifications (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    event_key TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME
  )`);
}

function productFor(state: CreativeOsStateLike, productId: string) {
  return (state.products || []).find(product => asString(product.id) === productId) || {};
}

function taskFor(state: CreativeOsStateLike, taskId: string) {
  return (state.tasks || []).find(task => asString(task.id) === taskId) || {};
}

function sourceFor(state: CreativeOsStateLike, sourceId: string) {
  return (state.sources || []).find(source => asString(source.id) === sourceId) || {};
}

function reviewForEdit(state: CreativeOsStateLike, editId: string) {
  return (state.reviews || []).find(review => asString(review.deliveredEditId) === editId) || {};
}

function deliveredEditForReview(state: CreativeOsStateLike, review: Record<string, unknown>) {
  return (state.deliveredEdits || []).find(edit => asString(edit.id) === asString(review.deliveredEditId)) || {};
}

function briefName(task: Record<string, unknown>, product: Record<string, unknown>) {
  return asString(task.brief) || asString(product.name) || 'Creative OS brief';
}

function emailShell(title: string, body: string, button: { label: string; href: string }, secondaryButton?: { label: string; href: string }) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;padding:34px 20px;color:#0f172a">
      <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#2563eb;margin-bottom:12px">Ainomiq Creative OS</div>
      <h1 style="font-size:28px;line-height:1.15;margin:0 0 14px;color:#0f172a">${escapeHtml(title)}</h1>
      <div style="color:#475569;font-size:15px;line-height:1.65;margin:0 0 24px">${body}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin:20px 0 26px">
        <a href="${escapeHtml(button.href)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:13px 18px;border-radius:14px;font-weight:800">${escapeHtml(button.label)}</a>
        ${secondaryButton ? `<a href="${escapeHtml(secondaryButton.href)}" style="display:inline-block;background:#eff6ff;color:#1d4ed8;text-decoration:none;padding:13px 18px;border-radius:14px;font-weight:800;border:1px solid #bfdbfe">${escapeHtml(secondaryButton.label)}</a>` : ''}
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.45;margin:0">This notification was sent because this workspace uses Creative OS task handoff.</p>
    </div>
  `;
}

async function tenantOwnerEmail(tenantId: string) {
  const result = await db.execute({
    sql: `SELECT email FROM tenants WHERE id = ? OR email = ? LIMIT 1`,
    args: [tenantId, tenantId],
  });
  return asString(result.rows[0]?.email) || (looksLikeEmail(tenantId) ? tenantId : '');
}

async function sendDedupedNotification(params: {
  tenantId: string;
  eventKey: string;
  eventType: string;
  to: string;
  subject: string;
  html: string;
}) {
  await ensureNotificationStore();
  const id = randomUUID();
  const inserted = await db.execute({
    sql: `INSERT OR IGNORE INTO creative_os_notifications (id, tenant_id, event_key, event_type, recipient_email, subject, status)
          VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    args: [id, params.tenantId, params.eventKey, params.eventType, params.to, params.subject],
  });
  if (Number(inserted.rowsAffected || 0) === 0) {
    const existing = await db.execute({
      sql: `SELECT status FROM creative_os_notifications WHERE event_key = ? LIMIT 1`,
      args: [params.eventKey],
    });
    if (String(existing.rows[0]?.status || '') !== 'failed') return;
    await db.execute({
      sql: `UPDATE creative_os_notifications
            SET status = 'pending', recipient_email = ?, subject = ?, error = NULL
            WHERE event_key = ? AND status = 'failed'`,
      args: [params.to, params.subject, params.eventKey],
    });
  }

  try {
    await sendEmail(params.to, params.subject, params.html);
    await db.execute({
      sql: `UPDATE creative_os_notifications SET status = 'sent', sent_at = CURRENT_TIMESTAMP, error = NULL WHERE event_key = ?`,
      args: [params.eventKey],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Notification email failed';
    await db.execute({
      sql: `UPDATE creative_os_notifications SET status = 'failed', error = ? WHERE event_key = ?`,
      args: [message.slice(0, 500), params.eventKey],
    });
    console.warn('[Creative OS notification failed]', { eventKey: params.eventKey, to: params.to, error: message });
  }
}

async function notifyEditorBriefPosted(
  request: NextRequest,
  tenantId: string,
  state: CreativeOsStateLike,
  task: Record<string, unknown>,
) {
  const permissions = state.permissions || [];
  const editorEmail = resolveEditorEmail(asString(task.assignee), permissions);
  if (!looksLikeEmail(editorEmail)) return;
  const productId = asString(task.productId);
  const product = productFor(state, productId);
  const brief = briefName(task, product);
  const openBriefUrl = creativeOsUrl(request, editorEmail);
  const subject = `New Creative OS brief: ${brief}`;
  const body = `
    <p style="margin:0 0 12px">A new brief was posted for you.</p>
    <p style="margin:0 0 8px"><strong>Brief:</strong> ${escapeHtml(brief)}</p>
    <p style="margin:0 0 8px"><strong>Product:</strong> ${escapeHtml(asString(product.name) || 'Product')}</p>
    ${asString(task.dueDate) ? `<p style="margin:0 0 8px"><strong>Due:</strong> ${escapeHtml(task.dueDate)}</p>` : ''}
    ${asString(task.format) ? `<p style="margin:0 0 8px"><strong>Format:</strong> ${escapeHtml(task.format)}</p>` : ''}
    ${asString(task.outputCount) ? `<p style="margin:0 0 8px"><strong>Outputs:</strong> ${escapeHtml(task.outputCount)}</p>` : ''}
  `;
  await sendDedupedNotification({
    tenantId,
    eventKey: `brief-posted:${tenantId}:${asString(task.id)}:${editorEmail}`,
    eventType: 'brief_posted',
    to: editorEmail,
    subject,
    html: emailShell('New brief assigned', body, { label: 'Open brief', href: openBriefUrl }),
  });
}

async function notifyEditorBriefUpdated(
  request: NextRequest,
  tenantId: string,
  state: CreativeOsStateLike,
  task: Record<string, unknown>,
  previousTask: Record<string, unknown>,
) {
  const { labels: changedLabels, details: changeDetails } = briefChangeSummary(previousTask, task, state);
  if (!changedLabels.length) return;
  const permissions = state.permissions || [];
  const editorEmail = resolveEditorEmail(asString(task.assignee), permissions);
  if (!looksLikeEmail(editorEmail)) return;
  const product = productFor(state, asString(task.productId));
  const brief = briefName(task, product);
  const openBriefUrl = creativeOsUrl(request, editorEmail);
  const revision = changedLabels.slice().sort().join('|');
  const subject = `Creative OS brief updated: ${brief}`;
  const changeList = changeDetails.length
    ? `<ul style="margin:8px 0 0;padding-left:20px;color:#475569;font-size:15px;line-height:1.6">${changeDetails.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
  const body = `
    <p style="margin:0 0 12px">The owner updated a brief assigned to you.</p>
    <p style="margin:0 0 8px"><strong>Brief:</strong> ${escapeHtml(brief)}</p>
    <p style="margin:0 0 8px"><strong>Product:</strong> ${escapeHtml(asString(product.name) || 'Product')}</p>
    <p style="margin:0 0 8px"><strong>What changed:</strong> ${escapeHtml(changedLabels.join(', '))}</p>
    ${changeList}
  `;
  await sendDedupedNotification({
    tenantId,
    eventKey: `brief-updated:${tenantId}:${asString(task.id)}:${editorEmail}:${revision}`,
    eventType: 'brief_updated',
    to: editorEmail,
    subject,
    html: emailShell('Brief updated', body, { label: 'Open brief', href: openBriefUrl }),
  });
}

async function notifyFounderDeliverySubmitted(
  request: NextRequest,
  tenantId: string,
  state: CreativeOsStateLike,
  edit: Record<string, unknown>,
  actor: CreativeOsActor,
) {
  if (actor.accessMode !== 'creative-editor') return;
  if (!isVideoDelivery(edit, state)) return;
  const ownerEmail = await tenantOwnerEmail(tenantId);
  if (!looksLikeEmail(ownerEmail)) return;
  const task = taskFor(state, asString(edit.taskId));
  const product = productFor(state, asString(edit.productId));
  const review = reviewForEdit(state, asString(edit.id));
  const brief = briefName(task, product);
  const editorLabel = asString(actor.email) || asString(edit.editor) || 'An editor';
  const subject = `Finished video submitted for review: ${brief}`;
  const body = `
    <p style="margin:0 0 12px">${escapeHtml(editorLabel)} submitted a finished video for review.</p>
    <p style="margin:0 0 8px"><strong>Brief:</strong> ${escapeHtml(brief)}</p>
    <p style="margin:0 0 8px"><strong>Product:</strong> ${escapeHtml(asString(product.name) || 'Product')}</p>
    ${asString(edit.previewUrl) ? `<p style="margin:0 0 8px"><strong>Finished video:</strong> <a href="${escapeHtml(edit.previewUrl)}" style="color:#2563eb">Open preview</a></p>` : ''}
  `;
  await sendDedupedNotification({
    tenantId,
    eventKey: `delivery-submitted:${tenantId}:${asString(edit.id)}:${asString(review.id)}`,
    eventType: 'delivery_submitted',
    to: ownerEmail,
    subject,
    html: emailShell('Finished video ready for review', body, { label: 'Review submission', href: creativeOsUrl(request) }, asString(edit.previewUrl) ? { label: 'Open finished video', href: asString(edit.previewUrl) } : undefined),
  });
}

async function notifyEditorRevisionRequested(request: NextRequest, tenantId: string, state: CreativeOsStateLike, review: Record<string, unknown>) {
  const permissions = state.permissions || [];
  const editorEmail = resolveEditorEmail(asString(review.editor), permissions) || asString(review.editor).toLowerCase();
  if (!looksLikeEmail(editorEmail)) return;
  const edit = deliveredEditForReview(state, review);
  const task = taskFor(state, asString(edit.taskId));
  const product = productFor(state, asString(review.productId) || asString(edit.productId));
  const brief = briefName(task, product);
  const feedback = asString(review.feedback) || 'The owner requested changes. Open Creative OS to review the revision request.';
  const subject = `Revision requested: ${brief}`;
  const body = `
    <p style="margin:0 0 12px">The owner requested changes on your submitted ad.</p>
    <p style="margin:0 0 8px"><strong>Brief:</strong> ${escapeHtml(brief)}</p>
    <p style="margin:0 0 8px"><strong>Product:</strong> ${escapeHtml(asString(product.name) || 'Product')}</p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:14px 16px;margin:16px 0;color:#78350f">
      <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Feedback</div>
      <div style="white-space:pre-line;font-size:15px;line-height:1.6">${escapeHtml(feedback)}</div>
    </div>
  `;
  await sendDedupedNotification({
    tenantId,
    eventKey: `revision-requested:${tenantId}:${asString(review.id)}:${asString(review.revisionRequestId) || 'initial'}:${editorEmail}`,
    eventType: 'revision_requested',
    to: editorEmail,
    subject,
    html: emailShell('Revision requested', body, { label: 'Open task', href: creativeOsUrl(request, editorEmail) }, asString(edit.previewUrl) ? { label: 'Open submitted ad', href: asString(edit.previewUrl) } : undefined),
  });
}

export async function notifyCreativeOsStateChanges(params: {
  request: NextRequest;
  tenantId: string;
  actor: CreativeOsActor;
  previousState: CreativeOsStateLike;
  nextState: CreativeOsStateLike;
}) {
  const previousTaskIds = new Set((params.previousState.tasks || []).map(task => asString(task.id)).filter(Boolean));
  const previousTasksById = new Map((params.previousState.tasks || []).map(task => [asString(task.id), task]));
  const previousEditIds = new Set((params.previousState.deliveredEdits || []).map(edit => asString(edit.id)).filter(Boolean));
  const previousReviewsById = new Map((params.previousState.reviews || []).map(review => [asString(review.id), review]));
  const newAssignedTasks = (params.nextState.tasks || []).filter(task => {
    const taskId = asString(task.id);
    return taskId && !previousTaskIds.has(taskId) && asString(task.status) === 'assigned';
  });
  const updatedTasks = (params.nextState.tasks || []).filter(task => {
    const taskId = asString(task.id);
    if (!taskId || !previousTaskIds.has(taskId)) return false;
    const previousTask = previousTasksById.get(taskId);
    if (!previousTask) return false;
    return briefTaskChangedFields(previousTask, task).length > 0;
  });
  const newDeliveredEdits = (params.nextState.deliveredEdits || []).filter(edit => {
    const editId = asString(edit.id);
    return editId && !previousEditIds.has(editId);
  });
  const revisionRequestedReviews = (params.nextState.reviews || []).filter(review => {
    const reviewId = asString(review.id);
    if (!reviewId || asString(review.status) !== 'revision requested') return false;
    const previousReview = previousReviewsById.get(reviewId);
    return asString(previousReview?.status) !== 'revision requested'
      || asString(previousReview?.revisionRequestId) !== asString(review.revisionRequestId);
  });
  await Promise.all([
    ...newAssignedTasks.map(task => notifyEditorBriefPosted(params.request, params.tenantId, params.nextState, task)),
    ...updatedTasks.map(task => {
      const previousTask = previousTasksById.get(asString(task.id));
      if (!previousTask) return Promise.resolve();
      return notifyEditorBriefUpdated(params.request, params.tenantId, params.nextState, task, previousTask);
    }),
    ...newDeliveredEdits.map(edit => notifyFounderDeliverySubmitted(params.request, params.tenantId, params.nextState, edit, params.actor)),
    ...revisionRequestedReviews.map(review => notifyEditorRevisionRequested(params.request, params.tenantId, params.nextState, review)),
  ]);
}
