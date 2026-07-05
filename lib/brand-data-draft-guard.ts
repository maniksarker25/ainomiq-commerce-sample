export const BRAND_DATA_LEAVE_MESSAGE =
  'You have unsaved brand data. Save before leaving or your changes will be lost.';

export const BRAND_DATA_DIRTY_CHANGED_EVENT =
  'ainomiq:brand-data-draft-dirty-changed';

let brandDataDraftDirty = false;

export function setBrandDataDraftDirty(dirty: boolean) {
  if (typeof window === 'undefined') return;
  if (brandDataDraftDirty === dirty) return;
  brandDataDraftDirty = dirty;
  window.dispatchEvent(
    new CustomEvent(BRAND_DATA_DIRTY_CHANGED_EVENT, { detail: dirty }),
  );
}

export function getBrandDataDraftDirty(): boolean {
  return brandDataDraftDirty;
}

export function confirmLeaveBrandDataDraft(): boolean {
  if (!getBrandDataDraftDirty()) return true;
  return window.confirm(BRAND_DATA_LEAVE_MESSAGE);
}

function normalizePath(href: string): string {
  if (href.startsWith('http')) {
    try {
      return new URL(href).pathname.replace(/\/$/, '') || '/';
    } catch {
      return href.split('?')[0].replace(/\/$/, '') || '/';
    }
  }
  return href.split('?')[0].replace(/\/$/, '') || '/';
}

/** True when sidebar (or similar) navigation should prompt before leaving settings. */
export function shouldConfirmBrandDataSidebarNavigation(
  targetHref: string,
  currentPathname: string,
): boolean {
  if (!getBrandDataDraftDirty()) return false;
  if (!currentPathname.startsWith('/dashboard/settings')) return false;
  const targetPath = normalizePath(targetHref);
  const currentPath = normalizePath(currentPathname);
  if (targetPath === currentPath) return false;
  if (targetPath.startsWith('/dashboard/settings')) return false;
  return true;
}
