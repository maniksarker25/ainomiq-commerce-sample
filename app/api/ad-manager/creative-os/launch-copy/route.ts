import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clean(value: unknown, max = 1200) {
  return String(value || "")
    .replace(/[\u2013\u2014]/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeJsonParse(raw: string) {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeCopy(value: unknown, fallback: { primaryText: string; headline: string }) {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const primaryText = clean(candidate.primaryText, 300) || fallback.primaryText;
  const headline = clean(candidate.headline, 80) || fallback.headline;
  return {
    primaryText,
    headline: headline.replace(/^persona\s*\d+\s*:\s*/i, "").trim() || fallback.headline,
  };
}

function personaFromContext(body: Record<string, unknown>) {
  const task = body.task && typeof body.task === "object" ? body.task as Record<string, unknown> : {};
  const launchItem = body.launchItem && typeof body.launchItem === "object" ? body.launchItem as Record<string, unknown> : {};
  const text = [
    clean(task.brief, 160),
    clean(task.notes, 600),
    clean(launchItem.approvedCreative, 240),
  ].join(" ");
  return (
    text.match(/persona\s*\d+\s*:\s*([^.\n-]+)/i)?.[1]?.trim() ||
    text.match(/target persona:\s*([^.\n]+)/i)?.[1]?.trim() ||
    clean(task.brief, 80).replace(/^persona\s*\d+\s*:\s*/i, "") ||
    "the most relevant shopper"
  );
}

function fallbackCopy(body: Record<string, unknown>) {
  const product = body.product && typeof body.product === "object" ? body.product as Record<string, unknown> : {};
  const task = body.task && typeof body.task === "object" ? body.task as Record<string, unknown> : {};
  const launchItem = body.launchItem && typeof body.launchItem === "object" ? body.launchItem as Record<string, unknown> : {};
  const productName = clean(product.name, 80) || "this product";
  const persona = personaFromContext(body);
  const approvedCreative = clean(launchItem.approvedCreative, 220);
  const angle = clean(launchItem.angle || task.angle || approvedCreative.split(" - ")[0], 120);
  const hook = clean(launchItem.hook || task.hook || approvedCreative.split(" - ").slice(1).join(" - "), 140);
  const lower = `${productName} ${persona} ${angle} ${hook} ${clean(task.notes, 500)}`.toLowerCase();
  if (/waist|belt|jeans|gap|loose|fit/.test(lower)) {
    return {
      primaryText: `${hook || "Fix the waist gap without a bulky belt."} A cleaner way to make your jeans fit flatter and feel easier to style.`,
      headline: "Fix loose jeans without a bulky belt",
    };
  }
  return {
    primaryText: `${hook || angle || productName} A simple reason for ${persona} to try ${productName}.`,
    headline: angle || `Try ${productName}`,
  };
}

async function generateWithOpenRouter(prompt: string) {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return null;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_TEXT_MODEL || "openai/gpt-4o-mini",
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You write concise Meta ad copy. Return strict JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return safeJsonParse(String(data?.choices?.[0]?.message?.content || ""));
}

async function generateWithOpenAi(prompt: string) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You write concise Meta ad copy. Return strict JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return safeJsonParse(String(data?.choices?.[0]?.message?.content || ""));
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
    await requireAuth(request, clean(body.tenant_id, 160));
  } catch (error) {
    return handleAuthError(error);
  }

  const fallback = fallbackCopy(body);
  const product = body.product && typeof body.product === "object" ? body.product as Record<string, unknown> : {};
  const task = body.task && typeof body.task === "object" ? body.task as Record<string, unknown> : {};
  const launchItem = body.launchItem && typeof body.launchItem === "object" ? body.launchItem as Record<string, unknown> : {};
  const edit = body.edit && typeof body.edit === "object" ? body.edit as Record<string, unknown> : {};
  const persona = personaFromContext(body);
  const prompt = `Create Meta ad launch copy for this approved Creative OS ad.

Product: ${clean(product.name, 120)}
Landing page: ${clean(product.url, 500)}
Persona: ${persona}
Brief: ${clean(task.brief, 240)}
Format: ${clean(task.format, 80)}
Instructions: ${clean(task.notes, 1000)}
Angle/hook: ${clean(launchItem.approvedCreative, 300)}
Delivered edit summary: ${clean(edit.briefSummary, 300)}

Return JSON:
{
  "primaryText": "1-2 short sentences, product-specific, written to the persona pain/desire, no unsupported claims",
  "headline": "short benefit headline, max 55 characters, never use the persona label as the headline"
}`;

  const generated = await generateWithOpenRouter(prompt) || await generateWithOpenAi(prompt);
  const copy = normalizeCopy(generated, fallback);
  return Response.json({
    ok: true,
    source: generated ? "ai" : "fallback",
    persona,
    ...copy,
  });
}
