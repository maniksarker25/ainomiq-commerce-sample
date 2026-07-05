import type { SourceCreative } from "../types";

export function isGoogleHostedSource(value: string | undefined) {
  if (!value) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return (
      host === "drive.google.com" ||
      host === "docs.google.com" ||
      host.endsWith(".googleusercontent.com")
    );
  } catch {
    return /drive\.google\.com|docs\.google\.com|googleusercontent\.com/i.test(
      value,
    );
  }
}

export function extractGoogleDriveId(value: string, kind: "file" | "folder") {
  const input = String(value || "").trim();
  if (!input) return "";
  const pathMatch =
    kind === "folder"
      ? input.match(/\/folders\/([a-zA-Z0-9_-]+)/)
      : input.match(
          /\/(?:file|document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/,
        ) || input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  const idParamMatch = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch?.[1]) return idParamMatch[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input)) return input;
  return "";
}

export function isGoogleDriveFolderLink(value: string) {
  return Boolean(extractGoogleDriveId(value, "folder"));
}

export function isGoogleDriveFileLink(value: string) {
  return (
    Boolean(extractGoogleDriveId(value, "file")) &&
    !isGoogleDriveFolderLink(value)
  );
}

export function driveLinkMatches(
  value: string,
  candidate: string | undefined,
  kind: "file" | "folder",
) {
  const cleanValue = String(value || "").trim();
  const cleanCandidate = String(candidate || "").trim();
  if (!cleanValue || !cleanCandidate) return false;
  if (
    cleanValue.includes(cleanCandidate) ||
    cleanCandidate.includes(cleanValue)
  )
    return true;
  const valueId = extractGoogleDriveId(cleanValue, kind);
  const candidateId = extractGoogleDriveId(cleanCandidate, kind);
  return Boolean(valueId && candidateId && valueId === candidateId);
}

export function sourceLibraryUrl(
  source: Pick<SourceCreative, "creator" | "backendFolderUrl" | "assetUrl">,
) {
  const backendUrl = String(source.backendFolderUrl || "").trim();
  if (backendUrl && !isGoogleHostedSource(backendUrl)) return backendUrl;
  const assetUrl = String(source.assetUrl || "").trim();
  if (
    source.creator === "Ainomiq Library Upload" &&
    assetUrl &&
    !isGoogleHostedSource(assetUrl)
  )
    return assetUrl;
  return "";
}

export function isAinomiqStoredSource(
  source: Pick<SourceCreative, "creator" | "backendFolderUrl" | "assetUrl">,
) {
  return Boolean(sourceLibraryUrl(source));
}

export function sourceMatchesUrl(source: SourceCreative, url: string) {
  const value = url.trim();
  if (!value) return false;
  return [
    source.assetUrl,
    source.originalAssetUrl,
    source.importUrl,
    source.importSourceUrl,
    source.driveFileId,
    source.originalDriveFileId,
  ]
    .filter(Boolean)
    .some((candidate) => driveLinkMatches(value, String(candidate), "file"));
}

export function sourceMatchesFolderUrl(source: SourceCreative, url: string) {
  const value = url.trim();
  if (!value) return false;
  return [
    source.backendFolderUrl,
    source.backendFolderId,
    source.importUrl,
    source.importSourceUrl,
  ]
    .filter(Boolean)
    .some((candidate) => driveLinkMatches(value, String(candidate), "folder"));
}

function librarySourceFolderLabel(source: SourceCreative) {
  if (source.sourceFolderPath) return source.sourceFolderPath;
  const importName = (source.importName || "").trim();
  if (importName.includes("/")) return importName.split("/")[0]?.trim() || "";
  if (importName) return importName;
  if (source.creator === "Catalog import") return "Legacy catalog source";
  if (isAinomiqStoredSource(source)) return "Ainomiq Library import";
  if (source.creator === "Ainomiq Library") return "External source reference";
  return source.name || "Source import";
}

export function librarySourceOptions(sources: SourceCreative[]) {
  const byUrl = new Map<string, { value: string; label: string }>();
  sources.forEach((source) => {
    const value = sourceLibraryUrl(source);
    if (!value) return;
    const folder = librarySourceFolderLabel(source);
    const label = [source.name || "Library file", folder]
      .filter(Boolean)
      .join(" - ");
    if (!byUrl.has(value)) byUrl.set(value, { value, label });
  });
  return [...byUrl.values()];
}
