import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { isDemoTenant } from '@/lib/demo';
import { replyInstagramComment } from '@/lib/cs-social';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { tenant_id?: string; comment_id?: string; message?: string } = {};
  let tenantId = '';

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

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
    const { getDemoIgCommentReply } = await import('@/lib/demo-data');
    return Response.json(getDemoIgCommentReply());
  }

  try {
    const { replyId } = await replyInstagramComment(tenantId, commentId, message);

    return Response.json({
      success: true,
      replyId,
    });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Failed to send Instagram comment reply' }, { status: 500 });
  }
}

