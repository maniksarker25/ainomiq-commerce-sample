import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";

import { validateOAuthState, upsertIntegration } from "@/lib/db";
import { getEnv } from "@/lib/oauth-config";
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
    console.error(
      "[ig-callback] OAuth error:",
      error,
      searchParams.get("error_description"),
    );
    return oauthRedirect(settingsRedirectUrl(request, { error }));
  }
  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  const stateData = await validateOAuthState(state);
  if (!stateData || stateData.provider !== "instagram") {
    return oauthRedirect(
      settingsRedirectUrl(request, { error: "invalid_state" }),
    );
  }

  try {
    const redirectUri = callbackRedirectUrl(request);
    const appId = getEnv("INSTAGRAM_APP_ID");
    const appSecret = getEnv("INSTAGRAM_APP_SECRET");

    // Step 1: Exchange code for short-lived token via Instagram business login.
    console.log(
      "[ig-callback] Exchanging code via Instagram API, appId:",
      appId,
      "secretLen:",
      appSecret.length,
    );
    const tokenRes = await fetch(
      "https://api.instagram.com/oauth/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        }),
      },
    );
    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      console.error(
        "[ig-callback] Token exchange failed:",
        tokenRes.status,
        tokenText,
      );
      const detail = `Token exchange ${tokenRes.status}: ${tokenText.slice(0, 200)}`;
      return oauthRedirect(settingsRedirectUrl(request, { error: detail }));
    }
    const tokens = JSON.parse(tokenText);
    const shortLivedToken = tokens.access_token;
    const userId = tokens.user_id;
    console.log("[ig-callback] Got short-lived token for user:", userId);

    // Step 2: Exchange for long-lived token.
    const longLivedRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortLivedToken}`,
    );
    const longLivedData = await longLivedRes.json();
    const accessToken = longLivedData.access_token || shortLivedToken;
    console.log(
      "[ig-callback] Long-lived token obtained, expires_in:",
      longLivedData.expires_in,
    );

    // Step 3: Get Instagram profile info.
    const profileRes = await fetch(
      `https://graph.instagram.com/v21.0/me?fields=user_id,username,name,profile_picture_url,account_type&access_token=${accessToken}`,
    );
    const profileData = await profileRes.json();
    console.log("[ig-callback] Profile:", JSON.stringify(profileData));

    const igAccountId = profileData.user_id || String(userId);
    const igAccountName = profileData.username
      ? `@${profileData.username}`
      : profileData.name || `IG ${igAccountId}`;

    const scopes =
      "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish";
    const expiresAt = longLivedData.expires_in
      ? new Date(Date.now() + longLivedData.expires_in * 1000)
      : null;

    await upsertIntegration(
      stateData.tenantId,
      "instagram",
      accessToken,
      shortLivedToken,
      expiresAt,
      scopes,
      igAccountId,
      igAccountName,
    );
    console.log(
      "[ig-callback] Integration saved for tenant:",
      stateData.tenantId,
      "IG ID:",
      igAccountId,
      "Name:",
      igAccountName,
    );

    return oauthRedirect(
      settingsRedirectUrl(request, { connected: "instagram" }),
    );
  } catch (err) {
    console.error("[ig-callback] Error:", err);
    return oauthRedirect(
      settingsRedirectUrl(request, { error: "oauth_failed" }),
    );
  }
}
