import { NextRequest } from "next/server";
import {
  validateTenantIdFromBody,
  checkRateLimit,
  ValidationError,
} from "@/lib/validate-tenant";
import { verifyJwt, COOKIE_NAME, clearCookieHeader } from "@/lib/jwt";
import { isDemoTenant } from "@/lib/demo";
import { deleteAllTenantData } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const jwt = await verifyJwt(token);
  if (!jwt) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let tenantId: string;
  try {
    const body = await request.json();
    tenantId = validateTenantIdFromBody(body);
    checkRateLimit(tenantId, "account/delete");
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    throw err;
  }

  if (jwt.email !== tenantId && jwt.tenantId !== tenantId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isDemoTenant(tenantId)) {
    return Response.json(
      { error: "Cannot delete demo account" },
      { status: 403 },
    );
  }

  try {
    await deleteAllTenantData(tenantId);

    return Response.json(
      {
        success: true,
        message: "All account data has been deleted",
      },
      {
        headers: {
          "Set-Cookie": clearCookieHeader(),
        },
      },
    );
  } catch (err) {
    console.error("[Account Delete]", err);
    return Response.json(
      { error: "Failed to delete account data" },
      { status: 500 },
    );
  }
}
