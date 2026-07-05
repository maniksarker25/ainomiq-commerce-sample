import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";

import { getEnv } from "@/lib/oauth-config";
import { validateOAuthState, upsertIntegration, storeMetaFacebookUserId } from "@/lib/db";
import { oauthRedirect } from "@/lib/oauth-redirect";
import {
  callbackRedirectUrl,
  settingsRedirectUrl,
} from "@/lib/oauth-return-url";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return oauthRedirect(settingsRedirectUrl(request, { error }));
  }
  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  const stateData = await validateOAuthState(state);
  if (!stateData || stateData.provider !== "facebook") {
    return oauthRedirect(
      settingsRedirectUrl(request, { error: "invalid_state" }),
    );
  }

  try {
    const redirectUri = callbackRedirectUrl(request);
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${getEnv("META_APP_ID")}&client_secret=${getEnv("META_APP_SECRET")}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`,
    );
    if (!tokenRes.ok) {
      console.error("Facebook token exchange failed:", await tokenRes.text());
      return oauthRedirect(
        settingsRedirectUrl(request, { error: "token_exchange_failed" }),
      );
    }
    const tokens = await tokenRes.json();
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    // Get user info and page details
    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name,email&access_token=${tokens.access_token}`,
    );
    const me = meRes.ok ? await meRes.json() : {};

    if (me.id) {
      await storeMetaFacebookUserId(stateData.tenantId, String(me.id));
    }

    // Get page name for display
    let pageName = me.name || null;
    try {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name&access_token=${tokens.access_token}`,
      );
      if (pagesRes.ok) {
        const pagesData = await pagesRes.json();
        if (pagesData.data?.[0]?.name) {
          pageName = pagesData.data[0].name;
        }
      }
    } catch (e) {
      console.error("Failed to fetch Facebook pages:", e);
    }

    await upsertIntegration(
      stateData.tenantId,
      "facebook",
      tokens.access_token,
      null,
      expiresAt,
      searchParams.get("scope") || null,
      null,
      pageName || me.email || null,
    );
    return oauthRedirect(
      settingsRedirectUrl(request, { connected: "facebook" }),
    );
  } catch (err) {
    console.error("Facebook OAuth callback error:", err);
    return oauthRedirect(
      settingsRedirectUrl(request, { error: "oauth_failed" }),
    );
  }
}
