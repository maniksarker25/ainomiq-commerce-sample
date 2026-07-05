import { NextRequest } from 'next/server';
import { isDemoTenant } from '@/lib/demo';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { graphError, graphUrl, resolveInstagramBusinessAccount, handleMetaApiError } from '@/lib/cs-social';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    const { getDemoIgComments } = await import('@/lib/demo-data');
    return Response.json(getDemoIgComments());
  }

  const connection = await resolveInstagramBusinessAccount(tenantId);
  if (!connection?.accessToken || !connection.igAccountId) {
    return Response.json({
      error: 'Meta is connected, but no Instagram Business account was found. Reconnect Instagram/Facebook Messaging from Support Settings.',
      comments: [],
    }, { status: 400 });
  }

  try {
    const mediaRes = await fetch(graphUrl(`${connection.igAccountId}/media`, {
      fields: 'id,caption,timestamp,permalink,thumbnail_url,media_url,media_type,comments_count,like_count',
      limit: 20,
      access_token: connection.accessToken,
    }), { cache: 'no-store' });

    if (!mediaRes.ok) {
      const errData = await mediaRes.json().catch(() => null);
      if (errData) {
        await handleMetaApiError(tenantId, errData);
      }
      const errMsg = graphError(errData, `Instagram API ${mediaRes.status}`);
      console.error('[ig-comments] Media API error:', errMsg);
      return Response.json({ error: errMsg, comments: [] }, { status: 502 });
    }

    const mediaData = await mediaRes.json();
    const posts = mediaData.data || [];

    // Step 2: For each post with comments, fetch the comments
    const postsWithComments = await Promise.all(
      posts
        .filter((p: any) => (p.comments_count || 0) > 0)
        .slice(0, 10) // Limit to 10 posts to avoid rate limits
        .map(async (post: any) => {
          try {
            const commentsRes = await fetch(graphUrl(`${post.id}/comments`, {
              fields: 'id,text,username,timestamp,like_count,replies{id,text,username,timestamp,like_count}',
              limit: 25,
              access_token: connection.accessToken,
            }), { cache: 'no-store' });

            let comments: any[] = [];
            if (commentsRes.ok) {
              const commentsData = await commentsRes.json();
              comments = (commentsData.data || []).map((c: any) => {
                const commentReplies = (c.replies?.data || []).map((r: any) => ({
                  id: r.id,
                  from: r.username || 'Unknown',
                  message: r.text || '',
                  createdTime: r.timestamp || '',
                  likeCount: r.like_count || 0,
                }));
                return {
                  id: c.id,
                  from: c.username || 'Unknown',
                  message: c.text || '',
                  createdTime: c.timestamp || '',
                  likeCount: c.like_count || 0,
                  replies: commentReplies,
                };
              });
            } else {
              const errData = await commentsRes.json().catch(() => null);
              if (errData) {
                await handleMetaApiError(tenantId, errData);
              }
            }

            return {
              id: post.id,
              content: post.caption || '',
              createdTime: post.timestamp || '',
              permalink: post.permalink || '',
              picture: post.thumbnail_url || post.media_url || '',
              commentCount: post.comments_count || 0,
              likeCount: post.like_count || 0,
              comments,
            };
          } catch (err) {
            console.error(`[ig-comments] Error fetching comments for post ${post.id}:`, err);
            return null;
          }
        })
    );

    return Response.json({
      comments: postsWithComments.filter(Boolean),
    });
  } catch (err: any) {
    console.error('[ig-comments] Error:', err);
    return Response.json({ error: err.message || 'Failed to fetch Instagram comments', comments: [] }, { status: 500 });
  }
}
