import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { isDemoTenant } from '@/lib/demo';
import { replyFacebookComment } from '@/lib/cs-social';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { tenant_id?: string; comment_id?: string; message?: string } = {};

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let tenantId: string;
  try {
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  const commentId = String(body.comment_id || '').trim();
  const message = String(body.message || '').trim();

  if (!commentId || !message) {
    return Response.json({ error: 'Missing comment_id or message' }, { status: 400 });
  }

  if (isDemoTenant(tenantId)) {
    return Response.json({
      success: true,
      replyId: `demo-fb-comment-reply-${Date.now()}`,
      demo: true,
    });
  }

  try {
    const result = await replyFacebookComment(tenantId, commentId, message);
    return Response.json({
      success: true,
      replyId: result.replyId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send Facebook comment reply';
    return Response.json({ error: msg }, { status: 502 });
  }
}
