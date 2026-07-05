import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import {
  apiSuccess,
  badRequest,
  apiError,
  ErrorCode,
  withErrorHandler,
  handleStructuredAuthError,
} from "@/lib/api-response";

export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0") {
    return true;
  }
  if (host.startsWith("127.")) return true;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  const match = /^172\.(\d+)\./.exec(host);
  if (match) {
    const second = Number(match[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function isAllowedImageUrl(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  if (isPrivateHost(parsed.hostname)) return false;
  return true;
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  try {
    await requireAuth(request);
  } catch (err) {
    return handleStructuredAuthError(err);
  }

  const url = String(request.nextUrl.searchParams.get("url") || "").trim();
  if (!url) {
    return badRequest("Missing url.", ErrorCode.MISSING_FIELD);
  }
  if (!isAllowedImageUrl(url)) {
    return badRequest("URL is not allowed.", ErrorCode.VALIDATION_ERROR);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "Ainomiq-ContentStudio/1.0",
      },
    });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Could not fetch image.",
      ErrorCode.SCRAPE_ERROR,
      502,
    );
  }

  if (!response.ok) {
    return apiError(`Image fetch failed (${response.status}).`, ErrorCode.SCRAPE_ERROR, 502);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    return badRequest("Image is empty.", ErrorCode.VALIDATION_ERROR);
  }
  if (buffer.length > MAX_BYTES) {
    return badRequest("Image is too large to export.", ErrorCode.VALIDATION_ERROR);
  }

  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  if (!contentType.startsWith("image/")) {
    return badRequest("URL did not return an image.", ErrorCode.VALIDATION_ERROR);
  }

  const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
  return apiSuccess({ dataUrl });
});
