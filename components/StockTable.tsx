'use client';

import React, { useState } from 'react';

interface StockItem {
  category: string;
  sku: string;
  name: string;
  stock: number;
  retailPrice: number;
  costPrice: number;
  variants?: StockItem[];
}

const stockData: StockItem[] = [
  {
    category: 'Apparel',
    sku: 'APP-001',
    name: 'Premium T-Shirt',
    stock: 120,
    retailPrice: 29.99,
    costPrice: 12.50,
    variants: [
      { category: 'Apparel', sku: 'APP-001-S', name: 'Premium T-Shirt (S)', stock: 30, retailPrice: 29.99, costPrice: 12.50 },
      { category: 'Apparel', sku: 'APP-001-M', name: 'Premium T-Shirt (M)', stock: 45, retailPrice: 29.99, costPrice: 12.50 },
      { category: 'Apparel', sku: 'APP-001-L', name: 'Premium T-Shirt (L)', stock: 25, retailPrice: 29.99, costPrice: 12.50 },
      { category: 'Apparel', sku: 'APP-001-XL', name: 'Premium T-Shirt (XL)', stock: 20, retailPrice: 29.99, costPrice: 12.50 },
    ],
  },
  {
    category: 'Accessories',
    sku: 'ACC-005',
    name: 'Leather Wallet',
    stock: 56,
    retailPrice: 49.99,
    costPrice: 22.00,
    variants: [
      { category: 'Accessories', sku: 'ACC-005-BLK', name: 'Leather Wallet (Black)', stock: 28, retailPrice: 49.99, costPrice: 22.00 },
      { category: 'Accessories', sku: 'ACC-005-BRN', name: 'Leather Wallet (Brown)', stock: 28, retailPrice: 49.99, costPrice: 22.00 },
    ],
  },
  {
    category: 'Home',
    sku: 'HOM-012',
    name: 'Ceramic Mug',
    stock: 200,
    retailPrice: 19.99,
    costPrice: 8.50,
    variants: [],
  },
];

export default function StockTable() {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (sku: string) => {
    setExpandedRows(prev => ({ ...prev, [sku]: !prev[sku] }));
  };

  const totalItems = stockData.reduce((sum, item) => sum + item.stock, 0);
  const totalValue = stockData.reduce((sum, item) => sum + (item.stock * item.retailPrice), 0);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Stock Management</h2>
        <div className="flex gap-4">
          <div className="text-right">
            <div className="text-sm text-gray-600">Total Units</div>
            <div className="text-2xl font-bold">{totalItems}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Retail Value</div>
            <div className="text-2xl font-bold">€ {totalValue.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">SKU</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Stock</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Retail Price</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Cost Price</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stockData.map((item) => (
              <React.Fragment key={item.sku}>
                <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-4">{item.category}</td>
                  <td className="py-3 px-4 font-mono text-sm">{item.sku}</td>
                  <td className="py-3 px-4 font-medium">{item.name}</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-sm ${item.stock < 20 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {item.stock} units
                    </span>
                  </td>
                  <td className="py-3 px-4">€ {item.retailPrice.toFixed(2)}</td>
                  <td className="py-3 px-4">€ {item.costPrice.toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleRow(item.sku)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      {expandedRows[item.sku] ? 'Collapse' : 'Expand'}
                    </button>
                  </td>
                </tr>
                {expandedRows[item.sku] && item.variants && item.variants.map(variant => (
                  <tr key={variant.sku} className="bg-gray-50/30">
                    <td className="py-2 px-4 pl-10 text-gray-500">{variant.category}</td>
                    <td className="py-2 px-4 font-mono text-sm">{variant.sku}</td>
                    <td className="py-2 px-4">{variant.name}</td>
                    <td className="py-2 px-4">
                      <span className={`px-3 py-1 rounded-full text-sm ${variant.stock < 20 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {variant.stock} units
                      </span>
                    </td>
                    <td className="py-2 px-4">€ {variant.retailPrice.toFixed(2)}</td>
                    <td className="py-2 px-4">€ {variant.costPrice.toFixed(2)}</td>
                    <td className="py-2 px-4">
                      <button className="text-blue-600 hover:text-blue-800">Edit</button>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}