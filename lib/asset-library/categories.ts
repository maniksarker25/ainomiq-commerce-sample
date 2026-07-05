export type AssetLibraryCategory =
  | 'source_material'
  | 'review_delivery'
  | 'approved_creative'
  | 'brand_asset'
  | 'project_asset'
  | 'archive';

export const ASSET_LIBRARY_CATEGORY_LABELS: Record<AssetLibraryCategory, string> = {
  source_material: 'Source material',
  review_delivery: 'Review deliveries',
  approved_creative: 'Approved creative',
  brand_asset: 'Brand assets',
  project_asset: 'Project assets',
  archive: 'Archive',
};

export const ASSET_LIBRARY_INTEGRATION_ID = 'asset_library' as const;
export const ASSET_LIBRARY_LABEL = 'Ainomiq Library';
