// Hardcoded tenant data (temporary)
// In production, this will come from database

export interface Tenant {
  id: string;
  email: string;
  name: string;
  organization: string;
  modules: string[];
}

// Demo tenant for testing
export const DEMO_TENANT: Tenant = {
  id: 'demo',
  email: 'demo@ainomiq.com',
  name: 'Demo User',
  organization: 'Demo Company',
  modules: ['stock', 'cs', 'ads', 'email'],
};

// Module definitions
export const MODULES = {
  stock: {
    name: 'Stock Management',
    href: '/dashboard/stock',
    icon: 'S',
    description: 'Inventory tracking and automation',
  },
  cs: {
    name: 'Intelli Support',
    href: '/dashboard/cs',
    icon: 'C',
    description: 'Customer support inbox',
  },
  ads: {
    name: 'Logic Ads',
    href: '/dashboard/ads',
    icon: 'A',
    description: 'Ad strategy, creative generation and performance monitoring',
  },
  analytics: {
    name: 'Analytics',
    href: '/dashboard/analytics',
    icon: '📊',
    description: 'Performance analytics',
  },
  performance: {
    name: 'Performance',
    href: '/dashboard/performance',
    icon: 'P',
    description: 'Ad performance across platforms',
  },
  automations: {
    name: 'Automations',
    href: '/dashboard/automations',
    icon: 'A',
    description: 'Automation modules for purchase',
  },
} as const;

// Get navigation items for a tenant/session
export function getNavigationForTenant(tenant: { modules: string[] }) {
  // Performance and Automations always shown
  const alwaysModules = ['performance', 'automations'];
  const filteredModules = tenant.modules.filter(m => !alwaysModules.includes(m));
  const items = [
    { name: 'Overview', href: '/dashboard', icon: 'O', always: true },
    ...alwaysModules.map(moduleId => ({
      name: MODULES[moduleId as keyof typeof MODULES]?.name || moduleId,
      href: MODULES[moduleId as keyof typeof MODULES]?.href || `/dashboard/${moduleId}`,
      icon: MODULES[moduleId as keyof typeof MODULES]?.icon || '?',
      always: true,
    })),
    ...filteredModules.map((moduleId) => ({
      name: MODULES[moduleId as keyof typeof MODULES]?.name || moduleId,
      href: MODULES[moduleId as keyof typeof MODULES]?.href || `/dashboard/${moduleId}`,
      icon: MODULES[moduleId as keyof typeof MODULES]?.icon || '?',
      always: false,
    })),
    { name: 'Settings', href: '/dashboard/settings', icon: '⚙', always: true },
  ];
  return items;
}

// Hardcoded stock data (temporary)
export interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  variants: Variant[];
}

export interface Variant {
  id: string;
  name: string;
  sku: string;
  stock: number;
  retailPrice: number;
  costPrice: number;
}

export const STOCK_DATA: StockItem[] = [
  {
    id: '1',
    sku: 'BJ-001',
    name: 'Classic Jeans',
    category: 'Bottoms',
    variants: [
      { id: '1-1', name: 'Blue / 30', sku: 'BJ-001-B30', stock: 45, retailPrice: 89.99, costPrice: 35.00 },
      { id: '1-2', name: 'Blue / 32', sku: 'BJ-001-B32', stock: 32, retailPrice: 89.99, costPrice: 35.00 },
      { id: '1-3', name: 'Black / 30', sku: 'BJ-001-K30', stock: 12, retailPrice: 89.99, costPrice: 35.00 },
    ],
  },
  {
    id: '2',
    sku: 'BJ-002',
    name: 'Premium Shirt',
    category: 'Tops',
    variants: [
      { id: '2-1', name: 'White / S', sku: 'BJ-002-WS', stock: 78, retailPrice: 49.99, costPrice: 18.00 },
      { id: '2-2', name: 'White / M', sku: 'BJ-002-WM', stock: 56, retailPrice: 49.99, costPrice: 18.00 },
      { id: '2-3', name: 'Blue / S', sku: 'BJ-002-BS', stock: 23, retailPrice: 49.99, costPrice: 18.00 },
    ],
  },
  {
    id: '3',
    sku: 'BJ-003',
    name: 'Leather Jacket',
    category: 'Outerwear',
    variants: [
      { id: '3-1', name: 'Black / M', sku: 'BJ-003-BM', stock: 5, retailPrice: 249.99, costPrice: 120.00 },
      { id: '3-2', name: 'Brown / L', sku: 'BJ-003-BRL', stock: 3, retailPrice: 249.99, costPrice: 120.00 },
    ],
  },
];

// Calculate KPIs
export function getKPIs() {
  let totalSKUs = 0;
  let totalUnits = 0;
  let retailValue = 0;
  let costValue = 0;

  STOCK_DATA.forEach(item => {
    item.variants.forEach(variant => {
      totalSKUs++;
      totalUnits += variant.stock;
      retailValue += variant.retailPrice * variant.stock;
      costValue += variant.costPrice * variant.stock;
    });
  });

  return {
    totalSKUs,
    totalUnits,
    retailValue: `$${retailValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    costValue: `$${costValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  };
}
