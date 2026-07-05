import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── Well-known provider settings ────────────────────────────────

interface MailSettings {
  imapHost: string;
  imapPort: string;
  smtpHost: string;
  smtpPort: string;
  provider: string;
}

const KNOWN_PROVIDERS: Record<string, MailSettings> = {
  // Google
  'google': { imapHost: 'imap.gmail.com', imapPort: '993', smtpHost: 'smtp.gmail.com', smtpPort: '587', provider: 'Google Workspace' },
  'gmail.com': { imapHost: 'imap.gmail.com', imapPort: '993', smtpHost: 'smtp.gmail.com', smtpPort: '587', provider: 'Gmail' },
  'googlemail.com': { imapHost: 'imap.gmail.com', imapPort: '993', smtpHost: 'smtp.gmail.com', smtpPort: '587', provider: 'Gmail' },
  // Microsoft
  'outlook.com': { imapHost: 'outlook.office365.com', imapPort: '993', smtpHost: 'smtp.office365.com', smtpPort: '587', provider: 'Outlook' },
  'hotmail.com': { imapHost: 'outlook.office365.com', imapPort: '993', smtpHost: 'smtp.office365.com', smtpPort: '587', provider: 'Hotmail' },
  'live.com': { imapHost: 'outlook.office365.com', imapPort: '993', smtpHost: 'smtp.office365.com', smtpPort: '587', provider: 'Microsoft' },
  'microsoft': { imapHost: 'outlook.office365.com', imapPort: '993', smtpHost: 'smtp.office365.com', smtpPort: '587', provider: 'Microsoft 365' },
  // Yahoo
  'yahoo.com': { imapHost: 'imap.mail.yahoo.com', imapPort: '993', smtpHost: 'smtp.mail.yahoo.com', smtpPort: '587', provider: 'Yahoo' },
  'yahoo.co.uk': { imapHost: 'imap.mail.yahoo.com', imapPort: '993', smtpHost: 'smtp.mail.yahoo.com', smtpPort: '587', provider: 'Yahoo' },
  // Zoho
  'zoho.com': { imapHost: 'imap.zoho.com', imapPort: '993', smtpHost: 'smtp.zoho.com', smtpPort: '587', provider: 'Zoho' },
  'zoho.eu': { imapHost: 'imap.zoho.eu', imapPort: '993', smtpHost: 'smtp.zoho.eu', smtpPort: '587', provider: 'Zoho EU' },
  // iCloud
  'icloud.com': { imapHost: 'imap.mail.me.com', imapPort: '993', smtpHost: 'smtp.mail.me.com', smtpPort: '587', provider: 'iCloud' },
  'me.com': { imapHost: 'imap.mail.me.com', imapPort: '993', smtpHost: 'smtp.mail.me.com', smtpPort: '587', provider: 'iCloud' },
  // ProtonMail Bridge
  'protonmail.com': { imapHost: '127.0.0.1', imapPort: '1143', smtpHost: '127.0.0.1', smtpPort: '1025', provider: 'ProtonMail (Bridge)' },
  'proton.me': { imapHost: '127.0.0.1', imapPort: '1143', smtpHost: '127.0.0.1', smtpPort: '1025', provider: 'ProtonMail (Bridge)' },
  // Fastmail
  'fastmail.com': { imapHost: 'imap.fastmail.com', imapPort: '993', smtpHost: 'smtp.fastmail.com', smtpPort: '587', provider: 'Fastmail' },
  // Dutch providers
  'ziggo.nl': { imapHost: 'imap.ziggo.nl', imapPort: '993', smtpHost: 'smtp.ziggo.nl', smtpPort: '587', provider: 'Ziggo' },
  'kpnmail.nl': { imapHost: 'imap.kpnmail.nl', imapPort: '993', smtpHost: 'smtp.kpnmail.nl', smtpPort: '587', provider: 'KPN' },
  // Namecheap / Privateemail
  'privateemail.com': { imapHost: 'mail.privateemail.com', imapPort: '993', smtpHost: 'mail.privateemail.com', smtpPort: '465', provider: 'Namecheap Private Email' },
  // Hostnet
  'hostnet': { imapHost: 'imap.hostnet.nl', imapPort: '993', smtpHost: 'smtp.hostnet.nl', smtpPort: '587', provider: 'Hostnet' },
  // Strato
  'strato.de': { imapHost: 'imap.strato.de', imapPort: '993', smtpHost: 'smtp.strato.de', smtpPort: '587', provider: 'Strato' },
  // TransIP
  'transip.email': { imapHost: 'imap.transip.email', imapPort: '993', smtpHost: 'smtp.transip.email', smtpPort: '587', provider: 'TransIP' },
  // one.com
  'one.com': { imapHost: 'imap.one.com', imapPort: '993', smtpHost: 'send.one.com', smtpPort: '587', provider: 'one.com' },
  // Hostinger
  'hostinger': { imapHost: 'imap.hostinger.com', imapPort: '993', smtpHost: 'smtp.hostinger.com', smtpPort: '465', provider: 'Hostinger' },
  // Titan (used by many domain registrars)
  'titan': { imapHost: 'imap.titan.email', imapPort: '993', smtpHost: 'smtp.titan.email', smtpPort: '465', provider: 'Titan Email' },
};

// MX patterns → provider key
const MX_PATTERNS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /google\.com|googlemail\.com|smtp\.google/i, key: 'google' },
  { pattern: /outlook\.com|office365|microsoft/i, key: 'microsoft' },
  { pattern: /yahoodns|yahoo\.com/i, key: 'yahoo.com' },
  { pattern: /zoho\.(com|eu)/i, key: 'zoho.com' },
  { pattern: /icloud|me\.com/i, key: 'icloud.com' },
  { pattern: /privateemail\.com/i, key: 'privateemail.com' },
  { pattern: /transip/i, key: 'transip.email' },
  { pattern: /mimecast/i, key: 'microsoft' },  // Mimecast usually fronts O365
  { pattern: /hostnet\.nl/i, key: 'hostnet' },
  { pattern: /one\.com/i, key: 'one.com' },
  { pattern: /hostinger/i, key: 'hostinger' },
  { pattern: /titan\.email|titanmail/i, key: 'titan' },
];

// ─── MX Lookup via DNS-over-HTTPS ────────────────────────────────

async function lookupMX(domain: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.Answer) return [];
    return data.Answer
      .filter((a: { type: number }) => a.type === 15)
      .map((a: { data: string }) => {
        // MX data format: "10 mx1.example.com."
        const parts = a.data.split(/\s+/);
        return (parts[1] || parts[0] || '').replace(/\.$/, '').toLowerCase();
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ─── Mozilla Autoconfig ──────────────────────────────────────────

async function tryMozillaAutoconfig(domain: string): Promise<MailSettings | null> {
  const urls = [
    `https://autoconfig.thunderbird.net/v1.1/${domain}`,
    `https://autoconfig.${domain}/mail/config-v1.1.xml?emailaddress=test@${domain}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const xml = await res.text();

      const imapHost = xml.match(/<incomingServer[^>]*type="imap"[^>]*>[\s\S]*?<hostname>(.*?)<\/hostname>/)?.[1];
      const imapPort = xml.match(/<incomingServer[^>]*type="imap"[^>]*>[\s\S]*?<port>(.*?)<\/port>/)?.[1];
      const smtpHost = xml.match(/<outgoingServer[^>]*type="smtp"[^>]*>[\s\S]*?<hostname>(.*?)<\/hostname>/)?.[1];
      const smtpPort = xml.match(/<outgoingServer[^>]*type="smtp"[^>]*>[\s\S]*?<port>(.*?)<\/port>/)?.[1];

      if (imapHost && smtpHost) {
        return {
          imapHost,
          imapPort: imapPort || '993',
          smtpHost,
          smtpPort: smtpPort || '587',
          provider: `Autoconfig (${domain})`,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

// ─── Common host-pattern guess ───────────────────────────────────

function guessFromDomain(domain: string): MailSettings {
  return {
    imapHost: `mail.${domain}`,
    imapPort: '993',
    smtpHost: `mail.${domain}`,
    smtpPort: '587',
    provider: domain,
  };
}

// ─── Main handler ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email') || '';
  const atIdx = email.indexOf('@');
  if (atIdx < 0) {
    return Response.json({ error: 'Invalid email' }, { status: 400 });
  }

  const domain = email.slice(atIdx + 1).toLowerCase().trim();
  if (!domain || domain.length < 3 || !domain.includes('.')) {
    return Response.json({ error: 'Invalid domain' }, { status: 400 });
  }

  // 1. Exact domain match
  if (KNOWN_PROVIDERS[domain]) {
    return Response.json({ ...KNOWN_PROVIDERS[domain], source: 'known', domain });
  }

  // 2. MX lookup → match against known patterns
  const mxRecords = await lookupMX(domain);
  if (mxRecords.length > 0) {
    for (const mx of mxRecords) {
      for (const { pattern, key } of MX_PATTERNS) {
        if (pattern.test(mx)) {
          const settings = KNOWN_PROVIDERS[key];
          if (settings) {
            return Response.json({ ...settings, source: 'mx', domain, mx: mxRecords });
          }
        }
      }
    }
  }

  // 3. Mozilla autoconfig
  const autoconfig = await tryMozillaAutoconfig(domain);
  if (autoconfig) {
    return Response.json({ ...autoconfig, source: 'autoconfig', domain, mx: mxRecords });
  }

  // 4. Fallback: guess mail.domain
  const guess = guessFromDomain(domain);
  return Response.json({ ...guess, source: 'guess', domain, mx: mxRecords });
}
