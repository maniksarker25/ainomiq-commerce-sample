import React from "react";

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-1 text-[14px] text-(--ai-text-muted)">{description}</p>
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  badge,
  className = "mb-6",
}: {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {badge}
      </div>
      {description && (
        <SectionDescription className="mt-1">{description}</SectionDescription>
      )}
    </div>
  );
}

export function SectionDescription({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-[13px] text-(--ai-text-muted) leading-relaxed ${className}`}
    >
      {children}
    </p>
  );
}

export function PlatformLogo({ logo, name }: { logo: string; name: string }) {
  if (logo === "gmail-icon") {
    return (
      <svg width="28" height="28" viewBox="0 0 48 36" aria-label={name}>
        <path fill="#4285F4" d="M43.6 36H36V11.3l7.6-5.7z" />
        <path fill="#34A853" d="M12 36H4.4V5.6l7.6 5.7z" />
        <path
          fill="#FBBC04"
          d="M24 19.3 4.4 5.6 8.6 0 24 10.8 39.4 0l4.2 5.6z"
        />
        <path fill="#EA4335" d="M24 19.3 12 11.3V36h24V11.3z" />
      </svg>
    );
  }
  if (logo === "asset-library-icon") {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label={name}>
        <path d="M12 3 4 7l8 4 8-4-8-4Z" />
        <path d="m4 12 8 4 8-4" />
        <path d="m4 17 8 4 8-4" />
      </svg>
    );
  }
  if (logo === "google-calendar-icon") {
    return (
      <svg width="28" height="28" viewBox="0 0 48 48" aria-label={name}>
        <path fill="#fff" d="M13 13h22v22H13z" />
        <path fill="#1a73e8" d="M35 5H13a4 4 0 0 0-4 4v4h30V9a4 4 0 0 0-4-4z" />
        <path fill="#188038" d="M9 35a4 4 0 0 0 4 4h22a4 4 0 0 0 4-4V13H9z" />
        <path fill="#fff" d="M13 17h22v18H13z" />
        <path
          fill="#1a73e8"
          d="M18.8 30.6c1.8 0 3.1-.9 3.1-2.3 0-1.1-.8-1.8-1.8-2v-.1c.9-.3 1.5-1 1.5-1.9 0-1.3-1.1-2.1-2.7-2.1-1.5 0-2.5.7-3.1 1.6l1.1 1.c.5-.6 1-1 1.9-1 .8 0 1.3.4 1.3 1.1 0 .8-.7 1.2-1.7 1.2h-.7v1.4h.8c1.2 0 1.9.4 1.9 1.2 0 .8-.7 1.3-1.7 1.3-.9 0-1.6-.4-2.1-1.1l-1.2 1c.7 1 1.8 1.7 3.4 1.7zm6.5-.2h1.7v-7.9h-1.4l-2.3 1.6.8 1.2 1.2-.8z"
        />
      </svg>
    );
  }
  if (logo === "linkedin-blue") {
    return (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="#0A66C2"
        aria-label={name}
      >
        <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.61 0 4.27 2.38 4.27 5.47v6.27zM5.32 7.43a2.06 2.06 0 110-4.12 2.06 2.06 0 010 4.12zM7.1 20.45H3.54V9H7.1v11.45zM22.22 0H1.77C.8 0 0 .78 0 1.74v20.52C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.74V1.74C24 .78 23.2 0 22.22 0z" />
      </svg>
    );
  }
  if (logo === "custom-question") {
    return (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#6b7280"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={name}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  const isReferenceGoogleLogo =
    logo === "/logos/google-workspace-v3.png" ||
    logo === "/logos/google-drive-v3.png" ||
    logo === "/logos/google-ads-v3.png";
  return (
    <img
      src={logo}
      alt={name}
      style={{
        width: isReferenceGoogleLogo ? 40 : 28,
        height: isReferenceGoogleLogo ? 40 : 28,
        objectFit: "contain",
        display: "block",
      }}
    />
  );
}
