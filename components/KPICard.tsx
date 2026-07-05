import React from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
}

export default function KPICard({ title, value, change, trend, description }: KPICardProps) {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';

  return (
    <div className="glass rounded-2xl p-6 flex flex-col">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        {change && (
          <div className={`text-sm font-semibold ${trendColor}`}>
            {trendIcon} {change}
          </div>
        )}
      </div>
      {description && (
        <p className="text-sm text-gray-500 mt-4">{description}</p>
      )}
    </div>
  );
}