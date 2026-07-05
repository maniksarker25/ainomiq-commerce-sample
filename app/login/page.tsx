"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AuthLayout from "../../components/AuthLayout";
import PasswordInput from "../../components/PasswordInput";
import {
  fetchSession,
  getSession,
  cacheSession,
  clearSessionCache,
} from "../../lib/session";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteMode, setInviteMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get("return") || "";
    const creativeOsLogin =
      params.get("force") === "1" ||
      returnUrl === "/dashboard/creative-os" ||
      params.has("invite");
    const forceLogin = creativeOsLogin || params.get("switch") === "1";
    const invitedEmail = params.get("email") || "";
    setInviteMode(creativeOsLogin);
    if (invitedEmail) setEmail(invitedEmail);
    if (forceLogin) {
      clearSessionCache();
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
      return;
    }

    // Check if already logged in via JWT cookie
    const cached = getSession();
    if (cached) {
      // Redirect to return URL if provided, otherwise dashboard
      const returnUrl = params.get("return");
      window.location.href = returnUrl || "/dashboard";
      return;
    }
    // Also check server-side (cookie might exist but sessionStorage is empty)
    fetchSession().then((session) => {
      if (session) {
        window.location.href = params.get("return") || "/dashboard";
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          creativeOsInviteLogin: inviteMode,
        }),
        credentials: "same-origin",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid email or password");
        setLoading(false);
        return;
      }

      // Cache session data for UI (JWT cookie is already set by the server)
      cacheSession({
        tenantId: data.user.id,
        email: data.user.email,
        name: data.user.name,
        organization: data.user.organization || "",
        modules: data.user.modules || ["performance"],
        accessMode: data.user.accessMode || "customer",
      });

      // Redirect to return URL if provided, otherwise dashboard
      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get("return");
      window.location.href = returnUrl || "/dashboard";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {inviteMode ? "Open Creative OS" : "Welcome back"}
        </h1>
        <p className="mt-2" style={{ color: "#6b7280", fontSize: "14px" }}>
          {inviteMode
            ? "Sign in with the invited email. Existing dashboard sessions are ignored for this invite."
            : "Sign in to your dashboard"}
        </p>
      </div>

      {error && (
        <div
          className="p-4 mb-6 rounded-xl"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.2)",
            color: "#b91c1c",
            fontSize: "14px",
          }}
        >
          <div>{error}</div>
          {inviteMode ? (
            <Link
              href={`/register?email=${encodeURIComponent(email)}&force=1&return=${encodeURIComponent("/dashboard/creative-os")}`}
              style={{
                display: "inline-block",
                marginTop: 8,
                color: "#2563eb",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              No account yet? Create one for this invite.
            </Link>
          ) : null}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-5">
          <label
            htmlFor="email"
            className="block mb-2"
            style={{ fontSize: "13px", fontWeight: 500, color: "#6b7280" }}
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@company.com"
            required
          />
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="password"
              style={{ fontSize: "13px", fontWeight: 500, color: "#6b7280" }}
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              style={{
                fontSize: "13px",
                color: "#3b82f6",
                textDecoration: "none",
              }}
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary"
          style={{ padding: "12px", fontSize: "14px" }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div
        className="mt-8 text-center"
        style={{ fontSize: "14px", color: "#6b7280" }}
      >
        Don&apos;t have an account?{" "}
        <Link
          href={
            inviteMode
              ? `/register?email=${encodeURIComponent(email)}&force=1&return=${encodeURIComponent("/dashboard/creative-os")}`
              : "/register"
          }
          style={{ color: "#3b82f6", fontWeight: 600, textDecoration: "none" }}
        >
          Sign up
        </Link>
      </div>
    </AuthLayout>
  );
}
