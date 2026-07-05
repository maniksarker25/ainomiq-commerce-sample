'use client';

import { useState, useEffect, useCallback } from 'react';
import ConnectionStatus from '../../../components/ConnectionStatus';
import RefreshButton from '../../../components/RefreshButton';
import ChangeRequestModal from '../../../components/ChangeRequestModal';
import { getSession, getSessionTenantId } from '../../../lib/session';
import { buildShopifyConnectHref, SHOPIFY_RETURN_PATHS } from '../../../lib/shopify-oauth';
import AppSettingsPanel from '../../../components/AppSettingsPanel';

interface Variant {
  id: string;
  title: string;
  sku: string;
  price: string;
  inventory: number;
}

interface Product {
  id: string;
  title: string;
  status: string;
  image: string | null;
  variants: Variant[];
}

interface StockStats {
  totalProducts: number;
  totalInventory: number;
  lowStockCount: number;
  outOfStockCount: number;
}

function GearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: '#6b7280',
        cursor: 'pointer',
        padding: '4px',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
      }}
      title="Request changes"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    </button>
  );
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<StockStats | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changeModal, setChangeModal] = useState<{ section: string; fields: Array<{ label: string; placeholder: string; key: string; type?: 'text' | 'textarea' }> } | null>(null);

  const getTenantId = () => getSessionTenantId(getSession());

  const fetchProducts = useCallback(async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/stock/products?tenant_id=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setProducts(data.products || []);
      setError(null);
    } catch {
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/stock/stats?tenant_id=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      if (!data.error) setStats(data);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchStats();
  }, [fetchProducts, fetchStats]);

  const handleRefresh = useCallback(() => {
    fetchProducts();
    fetchStats();
  }, [fetchProducts, fetchStats]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('connected')) return;
    handleRefresh();
    window.history.replaceState({}, '', '/dashboard/stock');
  }, [handleRefresh]);

  const filteredProducts = products.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.variants.some(v =>
      v.sku.toLowerCase().includes(search.toLowerCase()) ||
      v.title.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <ConnectionStatus connections={[{platform:'shopify', required:true}]}>
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Management</h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>Monitor and manage your inventory</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GearButton onClick={() => setChangeModal({
            section: 'Stock Alert Settings',
            fields: [
              { label: 'Low stock threshold', placeholder: 'e.g. 10', key: 'threshold' },
              { label: 'Notification emails', placeholder: 'e.g. team@company.com', key: 'emails' },
              { label: 'Additional notes', placeholder: 'Any other changes...', key: 'notes', type: 'textarea' },
            ],
          })} />
          <RefreshButton onRefresh={handleRefresh} intervalMs={30000} />
        </div>
      </div>

      <AppSettingsPanel
        appName="Stock Management"
        appKey="stock"
        directory="/dashboard/stock"
        integrations={[{ provider: 'shopify', label: 'Shopify inventory', required: true, href: buildShopifyConnectHref({ tenantId: getTenantId(), returnTo: SHOPIFY_RETURN_PATHS.stock }) }]}
        settingsName="Stock settings"
        description="Stock has its own product directory, reorder settings, supplier notes, and inventory preferences."
      />

      {error && (
        <div className="glass rounded-2xl mb-6" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#ef4444', fontSize: '14px' }}>{error}</span>
          {error.includes('reconnect') || error.includes('401') ? (
            <a href={buildShopifyConnectHref({ tenantId: getTenantId(), returnTo: SHOPIFY_RETURN_PATHS.stock })} className="btn-primary" style={{ textDecoration: 'none', padding: '8px 16px', fontSize: '13px' }}>
              Reconnect Shopify
            </a>
          ) : (
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}>x</button>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        {[
          { label: 'Total Products', value: loading ? '-' : String(stats?.totalProducts ?? products.length), color: '#1a1a2e' },
          { label: 'Total Inventory', value: loading ? '-' : String(stats?.totalInventory ?? 0), color: '#1a1a2e' },
          { label: 'Low Stock', value: loading ? '-' : String(stats?.lowStockCount ?? 0), color: '#facc15' },
          { label: 'Out of Stock', value: loading ? '-' : String(stats?.outOfStockCount ?? 0), color: '#f87171' },
        ].map((kpi, i) => (
          <div key={i} className="kpi-card">
            <div className="label">{kpi.label}</div>
            <div className="value" style={{ fontSize: '24px', color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Search + Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          style={{ maxWidth: '100%' }}
        />
        <button className="btn-secondary shrink-0">Export</button>
      </div>

      {/* Product list */}
      {loading ? (
        <div className="glass rounded-2xl" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: 24, height: 24, border: '2px solid #d1d5db', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '16px' }}>Loading products from Shopify...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="glass rounded-2xl" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            {search ? 'No products match your search' : 'No products found in your Shopify store'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {filteredProducts.map((product) => {
            const totalStock = product.variants.reduce((s, v) => s + v.inventory, 0);
            return (
              <div key={product.id} className="glass rounded-2xl overflow-hidden">
                <div
                  className="p-4 md:p-5 cursor-pointer flex items-center justify-between gap-3"
                  onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                  style={{ transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f2f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {product.image && (
                      <img
                        src={product.image}
                        alt={product.title}
                        style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                      />
                    )}
                    <div>
                      <h4 className="font-semibold text-gray-900">{product.title}</h4>
                      <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                        {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''}
                        {product.status !== 'active' && (
                          <span style={{
                            marginLeft: 8,
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                            background: 'rgba(107,114,128,0.1)',
                            color: '#6b7280',
                          }}>
                            {product.status}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 md:gap-6 shrink-0">
                    <span style={{ fontSize: '14px', color: '#1a1a2e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {totalStock} units
                    </span>
                    {totalStock === 0 ? (
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                        Out of Stock
                      </span>
                    ) : totalStock < 10 ? (
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: 'rgba(250,204,21,0.1)', color: '#ca8a04' }}>
                        Low Stock
                      </span>
                    ) : null}
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8b9e" strokeWidth="2"
                      style={{ transition: 'transform 0.2s', transform: expandedProduct === product.id ? 'rotate(180deg)' : 'none' }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {expandedProduct === product.id && (
                  <div style={{ borderTop: '1px solid #e2e6ef', overflowX: 'auto' }}>
                    <table className="data-table" style={{ minWidth: 540 }}>
                      <thead>
                        <tr>
                          <th>Variant</th>
                          <th>SKU</th>
                          <th>Stock</th>
                          <th>Price</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.variants.map((v) => (
                          <tr key={v.id}>
                            <td className="text-gray-900 font-medium">{v.title}</td>
                            <td style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '13px' }}>{v.sku || '-'}</td>
                            <td style={{ color: v.inventory < 10 ? '#f87171' : '#1a1a2e', fontWeight: 600 }}>{v.inventory}</td>
                            <td style={{ color: '#6b7280' }}>${parseFloat(v.price).toFixed(2)}</td>
                            <td>
                              <span style={{
                                display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
                                fontSize: '12px', fontWeight: 500,
                                background: v.inventory === 0 ? 'rgba(248,113,113,0.1)' : v.inventory < 10 ? 'rgba(250,204,21,0.1)' : 'rgba(74,222,128,0.1)',
                                color: v.inventory === 0 ? '#f87171' : v.inventory < 10 ? '#ca8a04' : '#16a34a',
                              }}>
                                {v.inventory === 0 ? 'Out of Stock' : v.inventory < 10 ? 'Low Stock' : 'In Stock'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom grid */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-6">
            <h4 className="text-gray-900 font-semibold mb-4">Stock Alerts</h4>
            <div className="space-y-3">
              {products.flatMap(p =>
                p.variants.filter(v => v.inventory > 0 && v.inventory < 10).map(v => ({
                  product: p.title, variant: v.title, stock: v.inventory,
                }))
              ).sort((a, b) => a.stock - b.stock).slice(0, 10).map((alert, i) => (
                <div key={i} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid #f0f2f5' }}>
                  <div>
                    <p className="text-sm text-gray-900 font-medium">{alert.product}</p>
                    <p className="text-xs" style={{ color: '#6b7280' }}>{alert.variant}</p>
                  </div>
                  <span style={{ color: '#f87171', fontWeight: 600, fontSize: '14px' }}>{alert.stock}</span>
                </div>
              ))}
              {products.flatMap(p => p.variants.filter(v => v.inventory > 0 && v.inventory < 10)).length === 0 && (
                <p style={{ color: '#6b7280', fontSize: '13px' }}>No low stock alerts</p>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <h4 className="text-gray-900 font-semibold mb-4">Quick Actions</h4>
            <div className="space-y-3">
              <button className="btn-primary w-full">Reorder Low Stock</button>
              <button className="btn-secondary w-full">Export Report</button>
              <button className="btn-secondary w-full">Adjust Stock</button>
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <h4 className="text-gray-900 font-semibold mb-4">Summary</h4>
            <div className="space-y-3">
              {[
                { label: 'Total Products', value: stats?.totalProducts ?? products.length, color: '#1a1a2e' },
                { label: 'Total Variants', value: products.reduce((s, p) => s + p.variants.length, 0), color: '#1a1a2e' },
                { label: 'Out of Stock', value: products.flatMap(p => p.variants).filter(v => v.inventory === 0).length, color: '#f87171' },
                { label: 'Low Stock (<10)', value: products.flatMap(p => p.variants).filter(v => v.inventory > 0 && v.inventory < 10).length, color: '#ca8a04' },
              ].map((row, i) => (
                <div key={i} className="flex justify-between py-2" style={{ borderBottom: '1px solid #f0f2f5' }}>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>{row.label}</span>
                  <span style={{ color: row.color, fontWeight: 600, fontSize: '14px' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {changeModal && (
        <ChangeRequestModal
          section={changeModal.section}
          fields={changeModal.fields}
          onClose={() => setChangeModal(null)}
        />
      )}
    </div>
    </ConnectionStatus>
  );
}
