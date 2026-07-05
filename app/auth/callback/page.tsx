"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CallbackContent() {
  const params = useSearchParams();
  const code = params.get("code");
  const error = params.get("error");

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
      <div style={{ maxWidth: 480, width: "100%", padding: 32, textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 16 }}>ainomiq</h1>
        {error ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#10060;</div>
            <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Connection Failed</h2>
            <p style={{ color: "#888", fontSize: 14 }}>
              Error: {error}. Please try again or contact support.
            </p>
          </>
        ) : code ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#9989;</div>
            <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Connected Successfully</h2>
            <p style={{ color: "#888", fontSize: 14 }}>
              Your Google account has been connected. Ainomiq can now access
              the authorized services on your behalf.
            </p>
            <p style={{ color: "#555", fontSize: 12, marginTop: 16 }}>
              Authorization code received. You can close this window.
            </p>
          </>
        ) : (
          <p style={{ color: "#888" }}>Processing...</p>
        )}
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#000" }} />}>
      <CallbackContent />
    </Suspense>
  );
}
