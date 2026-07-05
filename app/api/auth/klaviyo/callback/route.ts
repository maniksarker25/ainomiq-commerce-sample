import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";

import { getEnv } from "@/lib/oauth-config";
import { validateOAuthState, upsertIntegration } from "@/lib/db";
import { oauthRedirect } from "@/lib/oauth-redirect";
import {
  settingsRedirectUrl,
  callbackRedirectUrl,
} from "@/lib/oauth-return-url";

function basicAuth() {
  const id = getEnv("KLAVIYO_CLIENT_ID");
  const secret = getEnv("KLAVIYO_CLIENT_SECRET");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function exchangeToken(
  code: string,
  redirectUri: string,
  codeVerifier?: string,
) {
  const body: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  };
  if (codeVerifier) body.code_verifier = codeVerifier;

  const res = await fetch("https://a.klaviyo.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(),
    },
    body: new URLSearchParams(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${errText}`);
  }
  return res.json();
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const isTestFlow = state?.startsWith("klaviyo-test-");

  if (error) {
    if (isTestFlow) {
      return oauthRedirect(
        `${origin}/auth/klaviyo/success?error=${encodeURIComponent(error)}`,
      );
    }
    return oauthRedirect(settingsRedirectUrl(request, { error }));
  }

  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  // Test flow
  if (isTestFlow) {
    try {
      const tokens = await exchangeToken(
        code,
        `${origin}/api/auth/klaviyo/callback`,
      );
      const params = new URLSearchParams();
      if (tokens.access_token) params.set("access_token", tokens.access_token);
      if (tokens.refresh_token)
        params.set("refresh_token", tokens.refresh_token);
      if (tokens.expires_in)
        params.set("expires_in", String(tokens.expires_in));
      if (tokens.scope) params.set("scope", tokens.scope);
      return oauthRedirect(
        `${origin}/auth/klaviyo/success?${params.toString()}`,
      );
    } catch (err: any) {
      console.error("Klaviyo test OAuth error:", err.message);
      return oauthRedirect(
        `${origin}/auth/klaviyo/success?error=${encodeURIComponent(err.message || "unknown")}`,
      );
    }
  }

  // Production flow
  const stateData = await validateOAuthState(state);
  if (!stateData || stateData.provider !== "klaviyo") {
    return oauthRedirect(
      settingsRedirectUrl(request, { error: "invalid_state" }),
    );
  }

  try {
    const tokens = await exchangeToken(
      code,
      getEnv("KLAVIYO_REDIRECT_URI"),
      stateData.codeVerifier,
    );
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;
    await upsertIntegration(
      stateData.tenantId,
      "klaviyo",
      tokens.access_token,
      tokens.refresh_token || null,
      expiresAt,
      tokens.scope || null,
      null,
      null,
    );
    return oauthRedirect(
      settingsRedirectUrl(request, { connected: "klaviyo" }),
    );
  } catch (err: any) {
    console.error("Klaviyo OAuth error:", err.message);
    return oauthRedirect(
      settingsRedirectUrl(request, {
        error: "token_exchange_failed",
        detail: (err.message?.slice(0, 200) || "unknown"),
      }),
    );
  }
}
