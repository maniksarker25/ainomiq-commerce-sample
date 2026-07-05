import { NextRequest } from 'next/server';
import { isDemoTenant } from '@/lib/demo';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { graphError, graphUrl, resolveFacebookPage, handleMetaApiError } from '@/lib/cs-social';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    return Response.json({ comments: [] });
  }

  const connection = await resolveFacebookPage(tenantId);
  if (!connection?.accessToken || !connection.pageId) {
    return Response.json({
      error: 'Facebook is connected, but no Page comments source was found. Reconnect Facebook Messaging from Support Settings.',
      comments: [],
    }, { status: 400 });
  }

  try {
    const postsRes = await fetch(graphUrl(`${connection.pageId}/posts`, {
      fields: 'id,message,created_time,permalink_url,full_picture,comments.summary(true).limit(25){id,message,from,created_time,like_count,comments{id,message,from,created_time,like_count}},likes.summary(true)',
      limit: 20,
      access_token: connection.accessToken,
    }), { cache: 'no-store' });

    if (!postsRes.ok) {
      const errData = await postsRes.json().catch(() => null);
      if (errData) {
        await handleMetaApiError(tenantId, errData);
      }
      const errMsg = graphError(errData, `Facebook API ${postsRes.status}`);
      console.error('[fb-comments] API error:', errMsg);
      return Response.json({ error: errMsg, comments: [] }, { status: 502 });
    }

    const postsData = await postsRes.json();
    const comments = (postsData.data || []).map((post: any) => {
      const postComments = (post.comments?.data || []).map((comment: any) => {
        const commentReplies = (comment.comments?.data || []).map((r: any) => ({
          id: r.id,
          from: r.from?.name || 'Unknown',
          message: r.message || '',
          createdTime: r.created_time || '',
          likeCount: r.like_count || 0,
        }));
        return {
          id: comment.id,
          from: comment.from?.name || 'Unknown',
          message: comment.message || '',
          createdTime: comment.created_time || '',
          likeCount: comment.like_count || 0,
          replies: commentReplies,
        };
      });

      return {
        id: post.id,
        content: post.message || '',
        createdTime: post.created_time || '',
        permalink: post.permalink_url || '',
        picture: post.full_picture || '',
        commentCount: post.comments?.summary?.total_count || postComments.length,
        likeCount: post.likes?.summary?.total_count || 0,
        comments: postComments,
      };
    });

    return Response.json({ comments });
  } catch (err: any) {
    console.error('[fb-comments] Error:', err);
    return Response.json({ error: err.message || 'Failed to fetch Facebook comments', comments: [] }, { status: 500 });
  }
}
