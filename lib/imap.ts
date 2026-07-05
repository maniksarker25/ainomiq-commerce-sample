import { ImapFlow } from "imapflow";

export interface ImapCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  secure?: boolean;
}

export interface FetchedEmail {
  subject: string;
  to: string;
  body: string;
}

/**
 * Connect to an IMAP server, read recent sent emails, and return them.
 * Tries common Sent folder names: "Sent", "INBOX.Sent", "[Gmail]/Sent Mail", etc.
 */
export async function fetchSentEmails(
  creds: ImapCredentials,
  maxEmails = 25,
  maxAgeDays = 30,
): Promise<FetchedEmail[]> {
  const client = new ImapFlow({
    host: creds.host,
    port: creds.port,
    secure: creds.secure ?? creds.port === 993,
    auth: { user: creds.user, pass: creds.password },
    logger: false,
  });

  try {
    await client.connect();

    // Find the Sent folder
    const sentPath = await findSentFolder(client);
    if (!sentPath) {
      throw new Error("Could not find Sent folder. Check your IMAP settings.");
    }

    const lock = await client.getMailboxLock(sentPath);
    const emails: FetchedEmail[] = [];

    try {
      const since = new Date();
      since.setDate(since.getDate() - maxAgeDays);

      // Search for recent messages
      const searchResult = await client.search({ since }, { uid: true });
      const uids = Array.isArray(searchResult) ? searchResult : [];
      if (!uids.length) return [];

      // Take the most recent N
      const recentUids = uids.slice(-maxEmails);

      for await (const msg of client.fetch(recentUids, {
        uid: true,
        envelope: true,
        source: true,
      })) {
        try {
          const subject = msg.envelope?.subject || "";
          const to =
            msg.envelope?.to
              ?.map((a: { address?: string }) => a.address)
              .filter(Boolean)
              .join(", ") || "";

          // Parse body from source
          let body = "";
          if (msg.source) {
            const raw = msg.source.toString("utf-8");
            body = extractTextFromRaw(raw);
          }

          if (body.trim()) {
            emails.push({ subject, to, body: body.trim() });
          }
        } catch {
          // Skip individual parse errors
        }
      }
    } finally {
      lock.release();
    }

    return emails;
  } finally {
    await client.logout().catch(() => {});
  }
}

/**
 * Try to find the Sent mailbox by checking special-use flags and common names.
 */
async function findSentFolder(client: ImapFlow): Promise<string | null> {
  const mailboxes = await client.list();

  // First: look for \Sent special-use flag
  for (const mb of mailboxes) {
    if (mb.specialUse === "\\Sent") return mb.path;
  }

  // Fallback: common sent folder names
  const sentNames = [
    "sent",
    "sent mail",
    "sent items",
    "sent messages",
    "inbox.sent",
    "[gmail]/sent mail",
  ];
  for (const mb of mailboxes) {
    if (sentNames.includes(mb.path.toLowerCase())) return mb.path;
  }

  return null;
}

/**
 * Extract plain-text body from a raw email message.
 * Handles multipart MIME by extracting text/plain parts.
 */
function extractTextFromRaw(raw: string): string {
  // Split headers from body
  const headerEnd = raw.indexOf("\r\n\r\n");
  if (headerEnd === -1) return "";

  const headers = raw.slice(0, headerEnd).toLowerCase();
  const body = raw.slice(headerEnd + 4);

  // Check content-type
  const ctMatch = headers.match(/content-type:\s*([^\r\n;]+)/);
  const contentType = ctMatch?.[1]?.trim() || "text/plain";

  // Check transfer encoding
  const teMatch = headers.match(/content-transfer-encoding:\s*([^\r\n]+)/);
  const encoding = teMatch?.[1]?.trim().toLowerCase() || "7bit";

  if (contentType.startsWith("text/plain")) {
    return decodeBody(body.split("\r\n\r\n")[0] || body, encoding);
  }

  if (contentType.startsWith("text/html")) {
    return stripHtml(decodeBody(body, encoding));
  }

  if (contentType.startsWith("multipart/")) {
    // Extract boundary
    const boundaryMatch = raw
      .slice(0, headerEnd)
      .match(/boundary="?([^"\r\n;]+)"?/i);
    if (!boundaryMatch) return "";

    const boundary = boundaryMatch[1];
    const parts = body.split(`--${boundary}`);

    // Prefer text/plain, fallback to text/html
    let plainText = "";
    let htmlText = "";

    for (const part of parts) {
      const partHeaderEnd = part.indexOf("\r\n\r\n");
      if (partHeaderEnd === -1) continue;

      const partHeaders = part.slice(0, partHeaderEnd).toLowerCase();
      const partBody = part.slice(partHeaderEnd + 4);

      const partCtMatch = partHeaders.match(/content-type:\s*([^\r\n;]+)/);
      const partCt = partCtMatch?.[1]?.trim() || "";

      const partTeMatch = partHeaders.match(
        /content-transfer-encoding:\s*([^\r\n]+)/,
      );
      const partEncoding = partTeMatch?.[1]?.trim().toLowerCase() || "7bit";

      if (partCt.startsWith("text/plain") && !plainText) {
        plainText = decodeBody(partBody, partEncoding);
      } else if (partCt.startsWith("text/html") && !htmlText) {
        htmlText = stripHtml(decodeBody(partBody, partEncoding));
      } else if (partCt.startsWith("multipart/")) {
        // Recursive - extract from nested multipart
        const nested = extractTextFromRaw(part);
        if (nested && !plainText) plainText = nested;
      }
    }

    return plainText || htmlText;
  }

  return "";
}

function decodeBody(body: string, encoding: string): string {
  if (encoding === "base64") {
    try {
      return Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf-8");
    } catch {
      return body;
    }
  }
  if (encoding === "quoted-printable") {
    return body
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      );
  }
  return body;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
