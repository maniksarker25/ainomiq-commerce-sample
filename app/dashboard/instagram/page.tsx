'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSession } from '../../../lib/session';
import AppSettingsPanel from '../../../components/AppSettingsPanel';

type TabKey = 'messages' | 'comments' | 'publishing' | 'account';

interface IgConversation {
  id: string;
  participantName: string;
  lastMessage: string;
  updatedTime: string;
  status?: string;
  followerCount?: number;
  url?: string;
}

interface ConversationMessage {
  id: string;
  from: string;
  text: string;
  createdAt: string;
  direction: 'incoming' | 'outgoing';
}

interface IgComment {
  id: string;
  from: string;
  message: string;
  createdTime: string;
  likeCount?: number;
}

interface IgPost {
  id: string;
  content: string;
  createdTime: string;
  permalink?: string;
  picture?: string;
  commentCount: number;
  likeCount: number;
  comments: IgComment[];
}

interface IgAccountStatus {
  connected: boolean;
  username: string | null;
  accountId: string | null;
  permissions: string[];
  connectedAt?: string | null;
}

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Not available';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString();
}

function formatFollowers(count?: number): string {
  if (count == null) return '';
  return `${count.toLocaleString()} followers`;
}

function initials(name?: string): string {
  const safe = String(name || '?').trim();
  return safe.charAt(0).toUpperCase() || '?';
}

export default function InstagramInboxPage() {
  const session = getSession();
  const tenantId = session?.tenantId || session?.email || '';

  const [activeTab, setActiveTab] = useState<TabKey>('messages');

  const [conversations, setConversations] = useState<IgConversation[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [threadMessages, setThreadMessages] = useState<ConversationMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [messageReply, setMessageReply] = useState('');
  const [messageReplyLoading, setMessageReplyLoading] = useState(false);
  const [autoRespondLoading, setAutoRespondLoading] = useState(false);
  const [messageError, setMessageError] = useState('');

  const [posts, setPosts] = useState<IgPost[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [expandedPostIds, setExpandedPostIds] = useState<Record<string, boolean>>({});
  const [commentReplies, setCommentReplies] = useState<Record<string, string>>({});
  const [commentReplyLoading, setCommentReplyLoading] = useState<Record<string, boolean>>({});
  const [commentsError, setCommentsError] = useState('');

  const [accountStatus, setAccountStatus] = useState<IgAccountStatus | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [accountError, setAccountError] = useState('');

  const [publishImageUrl, setPublishImageUrl] = useState('');
  const [publishCaption, setPublishCaption] = useState('');
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState<{ mediaId: string; permalink?: string | null } | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  useEffect(() => {
    if (!tenantId) return;

    let cancelled = false;

    async function loadMessages(quiet = false) {
      if (!quiet) setMessagesLoading(true);
      if (!quiet) setMessageError('');
      try {
        const res = await fetch(`/api/cs/social/ig-dms?tenant_id=${encodeURIComponent(tenantId)}&_t=${Date.now()}`);
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to load Instagram messages');
        }
        if (cancelled) return;
        const nextConversations = Array.isArray(data.conversations) ? data.conversations : [];
        setConversations(nextConversations);
        setSelectedConversationId((current) => {
          if (current && nextConversations.some((conversation: IgConversation) => conversation.id === current)) {
            return current;
          }
          return nextConversations[0]?.id || '';
        });
      } catch (err: any) {
        if (!cancelled && !quiet) {
          setConversations([]);
          setSelectedConversationId('');
          setMessageError(err.message || 'Failed to load Instagram messages');
        }
      } finally {
        if (!cancelled && !quiet) setMessagesLoading(false);
      }
    }

    async function loadComments(quiet = false) {
      if (!quiet) setCommentsLoading(true);
      if (!quiet) setCommentsError('');
      try {
        const res = await fetch(`/api/cs/social/ig-comments?tenant_id=${encodeURIComponent(tenantId)}&_t=${Date.now()}`);
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to load Instagram comments');
        }
        if (cancelled) return;
        const nextPosts = Array.isArray(data.comments) ? data.comments : [];
        setPosts(nextPosts);
        setExpandedPostIds((current) => {
          if (Object.keys(current).length > 0) return current;
          const firstPostId = nextPosts[0]?.id;
          return firstPostId ? { [firstPostId]: true } : {};
        });
      } catch (err: any) {
        if (!cancelled && !quiet) {
          setPosts([]);
          setCommentsError(err.message || 'Failed to load Instagram comments');
        }
      } finally {
        if (!cancelled && !quiet) setCommentsLoading(false);
      }
    }

    async function loadAccount() {
      setAccountLoading(true);
      setAccountError('');
      try {
        const res = await fetch(`/api/auth/instagram/status?tenant_id=${encodeURIComponent(tenantId)}`);
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to load Instagram account status');
        }
        if (!cancelled) setAccountStatus(data);
      } catch (err: any) {
        if (!cancelled) {
          setAccountStatus(null);
          setAccountError(err.message || 'Failed to load Instagram account status');
        }
      } finally {
        if (!cancelled) setAccountLoading(false);
      }
    }

    loadMessages(false);
    loadComments(false);
    loadAccount();

    const poll =
      activeTab === 'messages'
        ? window.setInterval(() => {
            if (!cancelled) loadMessages(true);
          }, 8000)
        : activeTab === 'comments'
        ? window.setInterval(() => {
            if (!cancelled) loadComments(true);
          }, 15000)
        : undefined;

    return () => {
      cancelled = true;
      if (poll) window.clearInterval(poll);
    };
  }, [tenantId, activeTab]);

  useEffect(() => {
    if (!tenantId || !selectedConversationId) {
      setThreadMessages([]);
      return;
    }

    let cancelled = false;

    async function loadThread(quiet = false) {
      if (!quiet) setThreadLoading(true);
      if (!quiet) setMessageError('');
      try {
        const res = await fetch(
          `/api/cs/social/conversation?tenant_id=${encodeURIComponent(tenantId)}&id=${encodeURIComponent(selectedConversationId)}&_t=${Date.now()}`
        );
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to load conversation');
        }
        if (!cancelled) {
          setThreadMessages(Array.isArray(data.messages) ? data.messages : []);
        }
      } catch (err: any) {
        if (!cancelled && !quiet) {
          setThreadMessages([]);
          setMessageError(err.message || 'Failed to load conversation');
        }
      } finally {
        if (!cancelled && !quiet) setThreadLoading(false);
      }
    }

    loadThread(false);

    const interval = window.setInterval(() => {
      if (!cancelled) loadThread(true);
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [tenantId, selectedConversationId]);

  async function handleSendMessageReply() {
    if (!tenantId || !selectedConversation || !messageReply.trim() || messageReplyLoading) return;

    const trimmed = messageReply.trim();
    setMessageReplyLoading(true);
    setMessageError('');

    try {
      const res = await fetch('/api/cs/social/ig-dms/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          conversation_id: selectedConversation.id,
          message: trimmed,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to send reply');
      }

      const optimisticMessage: ConversationMessage = {
        id: data.messageId || `local-${Date.now()}`,
        from: 'You',
        text: trimmed,
        createdAt: new Date().toISOString(),
        direction: 'outgoing',
      };

      setThreadMessages((current) => [...current, optimisticMessage]);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? {
                ...conversation,
                lastMessage: trimmed,
                updatedTime: optimisticMessage.createdAt,
              }
            : conversation
        )
      );
      setMessageReply('');
    } catch (err: any) {
      setMessageError(err.message || 'Failed to send reply');
    } finally {
      setMessageReplyLoading(false);
    }
  }

  async function handleAutoRespond() {
    if (!tenantId || !selectedConversation || autoRespondLoading) return;

    setAutoRespondLoading(true);
    setMessageError('');

    // Get the last incoming message to generate a contextual response
    const lastIncoming = [...threadMessages].reverse().find((m) => m.direction === 'incoming');

    try {
      const res = await fetch('/api/cs/social/ig-dms/auto-respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          conversation_id: selectedConversation.id,
          last_message: lastIncoming?.text || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Auto-respond failed');
      }

      const botMessage: ConversationMessage = {
        id: data.messageId || `auto-${Date.now()}`,
        from: '🤖 AI Bot',
        text: data.reply,
        createdAt: new Date().toISOString(),
        direction: 'outgoing',
      };

      setThreadMessages((current) => [...current, botMessage]);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? {
                ...conversation,
                lastMessage: data.reply,
                updatedTime: botMessage.createdAt,
              }
            : conversation
        )
      );
    } catch (err: any) {
      setMessageError(err.message || 'Auto-respond failed');
    } finally {
      setAutoRespondLoading(false);
    }
  }

  async function handleSendCommentReply(postId: string, commentId: string) {
    const currentReply = String(commentReplies[commentId] || '').trim();
    if (!tenantId || !currentReply || commentReplyLoading[commentId]) return;

    setCommentReplyLoading((current) => ({ ...current, [commentId]: true }));
    setCommentsError('');

    try {
      const res = await fetch('/api/cs/social/ig-comments/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          comment_id: commentId,
          message: currentReply,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to send comment reply');
      }

      setCommentReplies((current) => ({ ...current, [commentId]: '' }));
    } catch (err: any) {
      setCommentsError(err.message || 'Failed to send comment reply');
    } finally {
      setCommentReplyLoading((current) => ({ ...current, [commentId]: false }));
    }
  }

  async function handleDisconnect() {
    if (!tenantId || disconnectLoading) return;
    setDisconnectLoading(true);
    setAccountError('');

    try {
      const res = await fetch('/api/auth/instagram/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to disconnect Instagram');
      }
      setAccountStatus({
        connected: false,
        username: null,
        accountId: null,
        permissions: [],
        connectedAt: null,
      });
    } catch (err: any) {
      setAccountError(err.message || 'Failed to disconnect Instagram');
    } finally {
      setDisconnectLoading(false);
    }
  }

  async function handlePublishPost() {
    if (!tenantId || publishLoading) return;
    setPublishLoading(true);
    setPublishError('');
    setPublishSuccess(null);

    try {
      const res = await fetch('/api/cs/social/ig-posts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          image_url: publishImageUrl,
          caption: publishCaption,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to publish Instagram post');
      }
      setPublishSuccess({ mediaId: data.mediaId, permalink: data.permalink });
    } catch (err: any) {
      setPublishError(err.message || 'Failed to publish Instagram post');
    } finally {
      setPublishLoading(false);
    }
  }

  const tabButtonStyle = (tab: TabKey): React.CSSProperties => ({
    padding: '10px 16px',
    borderRadius: '10px',
    border: `1px solid ${activeTab === tab ? '#3b82f6' : '#e2e6ef'}`,
    background: activeTab === tab ? 'rgba(59,130,246,0.08)' : '#ffffff',
    color: activeTab === tab ? '#2563eb' : '#4b5563',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  return (
    <div style={{ padding: '24px', paddingBottom: '96px' }}>
      <style>{`
        @media (max-width: 960px) {
          .instagram-messages-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e6ef',
            borderRadius: '18px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '28px', lineHeight: 1.1, color: '#111827' }}>Instagram Inbox</h1>
              <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: '14px' }}>
                Meta App Review demo for Instagram messages, comments, publishing, and account access.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button type="button" onClick={() => setActiveTab('messages')} style={tabButtonStyle('messages')}>Messages</button>
              <button type="button" onClick={() => setActiveTab('comments')} style={tabButtonStyle('comments')}>Comments</button>
              <button type="button" onClick={() => setActiveTab('publishing')} style={tabButtonStyle('publishing')}>Publishing</button>
              <button type="button" onClick={() => setActiveTab('account')} style={tabButtonStyle('account')}>Account</button>
            </div>
          </div>

          <AppSettingsPanel
            appName="Instagram Inbox"
            appKey="instagram"
            directory="/dashboard/instagram"
            settingsHref="/dashboard/settings?tab=integrations"
            integrations={[{ provider: 'instagram', label: 'Instagram Business', required: true, href: tenantId ? `/api/auth/meta/connect?tenant_id=${encodeURIComponent(tenantId)}&intent=content&force=1&platform=instagram` : '/dashboard/settings?tab=integrations' }]}
            settingsName="Instagram settings"
            description="Instagram keeps its own inbox, comments, publishing, and workflow preferences."
          />

          {!tenantId ? (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e6ef',
                color: '#6b7280',
                fontSize: '14px',
              }}
            >
              No session found. Sign in again to load Instagram data.
            </div>
          ) : null}

          {activeTab === 'messages' ? (
            <div
              className="instagram-messages-layout"
              style={{
                display: 'grid',
                gridTemplateColumns: '360px minmax(0, 1fr)',
                gap: '20px',
                alignItems: 'stretch',
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e6ef',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  minHeight: '640px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid #e2e6ef' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>Messages</div>
                  <div style={{ marginTop: '4px', fontSize: '13px', color: '#6b7280' }}>
                    {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {messagesLoading ? (
                    <div style={{ padding: '32px 20px', color: '#6b7280', fontSize: '14px', textAlign: 'center' }}>Loading conversations...</div>
                  ) : conversations.length === 0 ? (
                    <div style={{ padding: '32px 20px', color: '#6b7280', fontSize: '14px', textAlign: 'center' }}>
                      {messageError || 'No Instagram conversations found.'}
                    </div>
                  ) : (
                    conversations.map((conversation) => {
                      const isActive = conversation.id === selectedConversationId;
                      return (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => setSelectedConversationId(conversation.id)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '16px 18px',
                            border: 'none',
                            borderBottom: '1px solid #eef2f7',
                            background: isActive ? 'rgba(59,130,246,0.08)' : '#ffffff',
                            borderLeft: isActive ? '4px solid #3b82f6' : '4px solid transparent',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', minWidth: 0 }}>{conversation.participantName}</div>
                            <div style={{ fontSize: '12px', color: '#6b7280', flexShrink: 0 }}>{timeAgo(conversation.updatedTime)}</div>
                          </div>
                          <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.4, marginBottom: '10px' }}>{conversation.lastMessage}</div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span
                              style={{
                                padding: '3px 9px',
                                borderRadius: '999px',
                                background: conversation.status === 'escalated' ? 'rgba(249,115,22,0.1)' : 'rgba(59,130,246,0.08)',
                                color: conversation.status === 'escalated' ? '#ea580c' : '#2563eb',
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'capitalize',
                              }}
                            >
                              {conversation.status || 'active'}
                            </span>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>{formatFollowers(conversation.followerCount)}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e6ef',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  minHeight: '640px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {selectedConversation ? (
                  <>
                    <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2e6ef', display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          background: '#dbeafe',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                        }}
                      >
                        {initials(selectedConversation.participantName)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{selectedConversation.participantName}</div>
                        <div style={{ marginTop: '4px', fontSize: '13px', color: '#6b7280' }}>
                          {formatFollowers(selectedConversation.followerCount)}
                          {selectedConversation.followerCount != null ? ' · ' : ''}
                          Updated {timeAgo(selectedConversation.updatedTime)}
                        </div>
                      </div>
                      {selectedConversation.url ? (
                        <a href={selectedConversation.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: '13px', textDecoration: 'none' }}>
                          Open in Instagram
                        </a>
                      ) : null}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#fbfdff' }}>
                      {threadLoading ? (
                        <div style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', paddingTop: '24px' }}>Loading thread...</div>
                      ) : threadMessages.length === 0 ? (
                        <div style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', paddingTop: '24px' }}>
                          {messageError || 'No messages in this conversation yet.'}
                        </div>
                      ) : (
                        threadMessages.map((message) => {
                          const outgoing = message.direction === 'outgoing';
                          return (
                            <div
                              key={message.id}
                              style={{
                                alignSelf: outgoing ? 'flex-end' : 'flex-start',
                                maxWidth: '78%',
                                background: outgoing ? '#3b82f6' : '#ffffff',
                                color: outgoing ? '#ffffff' : '#111827',
                                border: outgoing ? '1px solid #3b82f6' : '1px solid #e2e6ef',
                                borderRadius: outgoing ? '16px 16px 6px 16px' : '16px 16px 16px 6px',
                                padding: '12px 14px',
                                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                              }}
                            >
                              <div style={{ fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{message.text}</div>
                              <div style={{ marginTop: '8px', fontSize: '11px', color: outgoing ? 'rgba(255,255,255,0.78)' : '#6b7280' }}>
                                {message.from} · {timeAgo(message.createdAt)}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid #e2e6ef', padding: '16px', background: '#ffffff' }}>
                      {messageError && threadMessages.length > 0 ? (
                        <div style={{ marginBottom: '10px', color: '#b91c1c', fontSize: '13px' }}>{messageError}</div>
                      ) : null}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <textarea
                          value={messageReply}
                          onChange={(event) => setMessageReply(event.target.value)}
                          placeholder="Reply to this conversation"
                          rows={3}
                          style={{
                            flex: 1,
                            minWidth: '240px',
                            resize: 'vertical',
                            borderRadius: '12px',
                            border: '1px solid #dbe3f0',
                            padding: '12px 14px',
                            fontSize: '14px',
                            color: '#111827',
                            outline: 'none',
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleSendMessageReply}
                          disabled={!messageReply.trim() || messageReplyLoading}
                          style={{
                            height: '44px',
                            padding: '0 18px',
                            borderRadius: '10px',
                            border: '1px solid #3b82f6',
                            background: messageReply.trim() && !messageReplyLoading ? '#3b82f6' : '#bfdbfe',
                            color: '#ffffff',
                            fontSize: '14px',
                            fontWeight: 700,
                            cursor: messageReply.trim() && !messageReplyLoading ? 'pointer' : 'default',
                          }}
                        >
                          {messageReplyLoading ? 'Sending...' : 'Send'}
                        </button>
                        <button
                          type="button"
                          onClick={handleAutoRespond}
                          disabled={autoRespondLoading}
                          style={{
                            height: '44px',
                            padding: '0 18px',
                            borderRadius: '10px',
                            border: '1px solid #8b5cf6',
                            background: autoRespondLoading ? '#c4b5fd' : '#8b5cf6',
                            color: '#ffffff',
                            fontSize: '14px',
                            fontWeight: 700,
                            cursor: autoRespondLoading ? 'default' : 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {autoRespondLoading ? '🤖 Responding...' : '🤖 Auto-Respond'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '14px', padding: '24px' }}>
                    Select a conversation to view the thread.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === 'comments' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {commentsError ? (
                <div style={{ color: '#b91c1c', fontSize: '13px' }}>{commentsError}</div>
              ) : null}
              {commentsLoading ? (
                <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading Instagram comments...</div>
              ) : posts.length === 0 ? (
                <div style={{ color: '#6b7280', fontSize: '14px' }}>No Instagram comments found.</div>
              ) : (
                posts.map((post) => {
                  const expanded = expandedPostIds[post.id] === true;
                  return (
                    <div
                      key={post.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e6ef',
                        borderRadius: '16px',
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedPostIds((current) => ({ ...current, [post.id]: !expanded }))}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: '#ffffff',
                          border: 'none',
                          padding: '18px 20px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', lineHeight: 1.45 }}>{post.content}</div>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '10px', color: '#6b7280', fontSize: '13px' }}>
                              <span>{post.commentCount} comments</span>
                              <span>{post.likeCount} likes</span>
                              <span>Posted {timeAgo(post.createdTime)}</span>
                            </div>
                          </div>
                          <div style={{ color: '#2563eb', fontSize: '13px', fontWeight: 700 }}>{expanded ? 'Hide comments' : 'Show comments'}</div>
                        </div>
                      </button>

                      {expanded ? (
                        <div style={{ borderTop: '1px solid #e2e6ef', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#fbfdff' }}>
                          {post.comments.map((comment) => (
                            <div
                              key={comment.id}
                              style={{
                                border: '1px solid #e2e6ef',
                                borderRadius: '14px',
                                background: '#ffffff',
                                padding: '16px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                <div>
                                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{comment.from}</div>
                                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>
                                    {timeAgo(comment.createdTime)}
                                    {comment.likeCount != null ? ` · ${comment.likeCount} likes` : ''}
                                  </div>
                                </div>
                              </div>
                              <div style={{ marginTop: '12px', fontSize: '14px', color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                {comment.message}
                              </div>
                              <div style={{ marginTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <input
                                  value={commentReplies[comment.id] || ''}
                                  onChange={(event) =>
                                    setCommentReplies((current) => ({ ...current, [comment.id]: event.target.value }))
                                  }
                                  placeholder="Reply to this comment"
                                  style={{
                                    flex: 1,
                                    minWidth: '240px',
                                    borderRadius: '10px',
                                    border: '1px solid #dbe3f0',
                                    padding: '10px 12px',
                                    fontSize: '14px',
                                    color: '#111827',
                                    outline: 'none',
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSendCommentReply(post.id, comment.id)}
                                  disabled={!String(commentReplies[comment.id] || '').trim() || commentReplyLoading[comment.id]}
                                  style={{
                                    height: '40px',
                                    padding: '0 16px',
                                    borderRadius: '10px',
                                    border: '1px solid #3b82f6',
                                    background:
                                      String(commentReplies[comment.id] || '').trim() && !commentReplyLoading[comment.id]
                                        ? '#3b82f6'
                                        : '#bfdbfe',
                                    color: '#ffffff',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    cursor:
                                      String(commentReplies[comment.id] || '').trim() && !commentReplyLoading[comment.id]
                                        ? 'pointer'
                                        : 'default',
                                  }}
                                >
                                  {commentReplyLoading[comment.id] ? 'Sending...' : 'Reply'}
                                </button>
                              </div>
                            </div>
                          ))}
                          {post.comments.length === 0 ? (
                            <div style={{ color: '#6b7280', fontSize: '14px' }}>No comments on this post yet.</div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          ) : null}

          {activeTab === 'publishing' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(260px, 0.8fr)', gap: '16px', alignItems: 'start' }}>
              <div style={{ background: '#ffffff', border: '1px solid #e2e6ef', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>Publish test post</div>
                <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: '14px', lineHeight: 1.5 }}>
                  Use this for Meta App Review: connect an Instagram business account, paste a public HTTPS image URL, add a caption, and publish from Ainomiq.
                </p>
                <div style={{ marginTop: '18px', display: 'grid', gap: '14px' }}>
                  <label style={{ display: 'grid', gap: '7px', color: '#374151', fontSize: '13px', fontWeight: 700 }}>
                    Image URL
                    <input
                      value={publishImageUrl}
                      onChange={(event) => setPublishImageUrl(event.target.value)}
                      placeholder="https://example.com/image.jpg"
                      style={{ borderRadius: '10px', border: '1px solid #dbe3f0', padding: '11px 12px', fontSize: '14px', color: '#111827', outline: 'none' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '7px', color: '#374151', fontSize: '13px', fontWeight: 700 }}>
                    Caption
                    <textarea
                      value={publishCaption}
                      onChange={(event) => setPublishCaption(event.target.value)}
                      rows={5}
                      placeholder="Write the caption that should be published."
                      style={{ borderRadius: '10px', border: '1px solid #dbe3f0', padding: '11px 12px', fontSize: '14px', color: '#111827', outline: 'none', resize: 'vertical' }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handlePublishPost}
                    disabled={!publishImageUrl.trim() || !publishCaption.trim() || publishLoading}
                    style={{ height: '44px', padding: '0 18px', borderRadius: '10px', border: '1px solid #3b82f6', background: publishImageUrl.trim() && publishCaption.trim() && !publishLoading ? '#3b82f6' : '#bfdbfe', color: '#ffffff', fontSize: '14px', fontWeight: 700, cursor: publishImageUrl.trim() && publishCaption.trim() && !publishLoading ? 'pointer' : 'default', justifySelf: 'start' }}
                  >
                    {publishLoading ? 'Publishing...' : 'Publish to Instagram'}
                  </button>
                  {publishError ? <div style={{ color: '#b91c1c', fontSize: '13px' }}>{publishError}</div> : null}
                  {publishSuccess ? (
                    <div style={{ border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.08)', color: '#166534', borderRadius: '12px', padding: '12px 14px', fontSize: '14px' }}>
                      Published. Media ID: {publishSuccess.mediaId}
                      {publishSuccess.permalink ? <><br /><a href={publishSuccess.permalink} target="_blank" rel="noreferrer" style={{ color: '#166534', fontWeight: 700 }}>Open post</a></> : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #e2e6ef', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>Required permission</div>
                <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: '14px', lineHeight: 1.5 }}>
                  This tab needs <strong>instagram_business_content_publish</strong>. If it is missing, reconnect Instagram after adding the permission in Meta.
                </p>
                <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(accountStatus?.permissions || []).map((permission) => (
                    <span key={permission} style={{ padding: '7px 10px', borderRadius: '999px', background: permission === 'instagram_business_content_publish' ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.08)', color: permission === 'instagram_business_content_publish' ? '#15803d' : '#2563eb', fontSize: '12px', fontWeight: 700 }}>{permission}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'account' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px',
              }}
            >
              <div style={{ background: '#ffffff', border: '1px solid #e2e6ef', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>Connection Status</div>
                {accountLoading ? (
                  <div style={{ marginTop: '14px', color: '#6b7280', fontSize: '14px' }}>Loading account...</div>
                ) : (
                  <>
                    <div style={{ marginTop: '14px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          padding: '5px 10px',
                          borderRadius: '999px',
                          background: accountStatus?.connected ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.14)',
                          color: accountStatus?.connected ? '#15803d' : '#64748b',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        {accountStatus?.connected ? 'Connected' : 'Not connected'}
                      </span>
                    </div>
                    <div style={{ marginTop: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {!accountStatus?.connected ? (
                        <a
                          href={`/api/auth/instagram/connect?tenant_id=${encodeURIComponent(tenantId)}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '42px',
                            padding: '0 16px',
                            borderRadius: '10px',
                            background: '#3b82f6',
                            color: '#ffffff',
                            textDecoration: 'none',
                            fontSize: '14px',
                            fontWeight: 700,
                          }}
                        >
                          Connect Instagram
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDisconnect}
                          disabled={disconnectLoading}
                          style={{
                            height: '42px',
                            padding: '0 16px',
                            borderRadius: '10px',
                            border: '1px solid #e2e6ef',
                            background: '#ffffff',
                            color: '#111827',
                            fontSize: '14px',
                            fontWeight: 700,
                            cursor: disconnectLoading ? 'default' : 'pointer',
                          }}
                        >
                          {disconnectLoading ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                      )}
                    </div>
                    {accountError ? <div style={{ marginTop: '12px', color: '#b91c1c', fontSize: '13px' }}>{accountError}</div> : null}
                  </>
                )}
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e6ef', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Account Details</div>
                <div style={{ display: 'grid', gap: '14px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Username</div>
                    <div style={{ marginTop: '4px', fontSize: '14px', color: '#111827', fontWeight: 600 }}>{accountStatus?.username || 'Not available'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Account ID</div>
                    <div style={{ marginTop: '4px', fontSize: '14px', color: '#111827', fontWeight: 600 }}>{accountStatus?.accountId || 'Not available'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Connected At</div>
                    <div style={{ marginTop: '4px', fontSize: '14px', color: '#111827', fontWeight: 600 }}>{formatDateTime(accountStatus?.connectedAt)}</div>
                  </div>
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e6ef', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Permissions</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {accountStatus?.permissions?.length ? (
                    accountStatus.permissions.map((permission) => (
                      <span
                        key={permission}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '999px',
                          background: 'rgba(59,130,246,0.08)',
                          color: '#2563eb',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        {permission}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: '#6b7280', fontSize: '14px' }}>No permissions available.</span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
