"use client";

import { useState } from "react";

const SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/analytics.readonly",
];

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  "openid": "Associate you with your personal info",
  "https://www.googleapis.com/auth/userinfo.email": "See your primary Google Account email address",
  "https://www.googleapis.com/auth/userinfo.profile": "See your personal info",
  "https://www.googleapis.com/auth/calendar": "See, edit, share and delete all calendars",
  "https://www.googleapis.com/auth/calendar.events": "View and edit events on all calendars",
  "https://www.googleapis.com/auth/gmail.send": "Send email on your behalf",
  "https://www.googleapis.com/auth/contacts.readonly": "See and download your contacts",
  "https://www.googleapis.com/auth/tasks": "Create, edit, organise and delete all tasks",
  "https://www.googleapis.com/auth/analytics.readonly": "See and download Google Analytics data",
};

export default function AuthTestPage() {
  const [selectedScopes, setSelectedScopes] = useState<string[]>(SCOPES);

  const handleConnect = () => {
    const clientId = "510580966859-6oqd56b8f1voo0keebcr0s6vf10fdmke.apps.googleusercontent.com";
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scope = selectedScopes.join(" ");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope,
      access_type: "offline",
      prompt: "consent",
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#000",
      color: "#fff",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 560, width: "100%", padding: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", marginBottom: 8 }}>
          ainomiq
        </h1>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 32 }}>
          Connect your Google account to enable AI-powered business tools.
          Ainomiq uses these permissions to manage your calendar, send emails,
          track tasks, read analytics, and sync contacts on your behalf.
        </p>

        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>Permissions requested</h2>
          {SCOPES.map((scope) => (
            <label
              key={scope}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid #222",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={selectedScopes.includes(scope)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedScopes([...selectedScopes, scope]);
                  } else {
                    setSelectedScopes(selectedScopes.filter((s) => s !== scope));
                  }
                }}
                style={{ marginTop: 3 }}
              />
              <div>
                <div style={{ fontSize: 14, color: "#fff" }}>
                  {SCOPE_DESCRIPTIONS[scope] || scope}
                </div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                  {scope.replace("https://www.googleapis.com/auth/", "")}
                </div>
              </div>
            </label>
          ))}
        </div>

        <button
          onClick={handleConnect}
          style={{
            width: "100%",
            padding: "14px 24px",
            background: "#fff",
            color: "#000",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Connect Google Account
        </button>

        <p style={{ color: "#555", fontSize: 11, marginTop: 16, lineHeight: 1.5 }}>
          By connecting, you agree to let Ainomiq access the selected Google services.
          You can revoke access at any time from your Google Account settings.
        </p>
      </div>
    </div>
  );
}
