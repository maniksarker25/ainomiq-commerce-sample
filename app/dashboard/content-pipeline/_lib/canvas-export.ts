function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });
}

async function fetchUrlAsDataUrl(url: string, init?: RequestInit): Promise<string | null> {
  const response = await fetch(url, init);
  if (!response.ok) return null;
  const blob = await response.blob();
  if (!blob.size) return null;
  return blobToDataUrl(blob);
}

function isSameOrigin(url: string) {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

export async function fetchImageAsDataUrl(
  url: string,
  tenantId: string,
): Promise<string | null> {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return trimmed;

  if (trimmed.startsWith("blob:")) {
    try {
      return await fetchUrlAsDataUrl(trimmed);
    } catch {
      return null;
    }
  }

  if (isSameOrigin(trimmed)) {
    try {
      const dataUrl = await fetchUrlAsDataUrl(trimmed, { credentials: "include" });
      if (dataUrl) return dataUrl;
    } catch {
      // fall through to proxy
    }
  }

  try {
    const dataUrl = await fetchUrlAsDataUrl(trimmed, { mode: "cors", credentials: "omit" });
    if (dataUrl) return dataUrl;
  } catch {
    // fall through to proxy
  }

  if (!tenantId) return null;

  const proxyUrl = `/api/content/export-image-proxy?tenant_id=${encodeURIComponent(tenantId)}&url=${encodeURIComponent(trimmed)}`;
  const response = await fetch(proxyUrl, { credentials: "include" });
  if (!response.ok) return null;

  const payload = (await response.json()) as { success?: boolean; dataUrl?: string };
  const dataUrl = payload?.dataUrl;
  return typeof dataUrl === "string" && dataUrl.startsWith("data:") ? dataUrl : null;
}

export async function inlineImagesForExport(
  root: HTMLElement,
  tenantId: string,
): Promise<() => void> {
  const restores: Array<() => void> = [];
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;

      const dataUrl = await fetchImageAsDataUrl(src, tenantId);
      if (!dataUrl) return;

      const previous = src;
      img.src = dataUrl;
      img.removeAttribute("srcset");
      restores.push(() => {
        img.src = previous;
      });
    }),
  );

  return () => {
    for (const restore of restores) restore();
  };
}
