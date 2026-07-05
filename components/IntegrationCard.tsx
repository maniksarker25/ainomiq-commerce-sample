'use client';

import { DEMO_TENANT } from '../lib/data';

interface IntegrationCardProps {
  platform: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected';
  connectedSince?: string;
}

export default function IntegrationCard({
  platform,
  description,
  icon,
  status,
  connectedSince,
}: IntegrationCardProps) {
  const tenantEmail = DEMO_TENANT.email;

  const platformSlug = platform.toLowerCase().replace(' ', '');
  const platformMap: Record<string, string> = {
    'shopify': 'shopify',
    'meta ads': 'meta',
    'klaviyo': 'klaviyo',
    'google': 'google',
  };
  const slug = platformMap[platform.toLowerCase()] || platform.toLowerCase();

  const handleConnect = () => {
    // Redirect to OAuth connect endpoint
    window.location.href = `/api/auth/${slug}/connect?tenant_id=${encodeURIComponent(tenantEmail)}`;
  };

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${platform}?`)) return;

    try {
      const response = await fetch(`/api/auth/${slug}/disconnect?tenant_id=${encodeURIComponent(tenantEmail)}`, {
        method: 'POST',
      });

      if (response.ok) {
        alert(`${platform} disconnected successfully. Refresh the page to see changes.`);
      } else {
        alert(`Failed to disconnect ${platform}. Please try again.`);
      }
    } catch (error) {
      alert(`Error disconnecting ${platform}. Check console for details.`);
      console.error(error);
    }
  };

  return (
    <div className="glass rounded-2xl p-6 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-gray-300 to-gray-500 flex items-center justify-center">
            <span className="text-xl font-bold text-white">{icon}</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{platform}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
          status === 'connected'
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
        }`}>
          {status === 'connected' ? 'Connected' : 'Not Connected'}
        </div>
      </div>

      {status === 'connected' && connectedSince && (
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Connected since <span className="font-medium">{connectedSince}</span>
          </p>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-gray-100">
        {status === 'connected' ? (
          <div className="flex gap-3">
            <button
              onClick={() => window.location.href = `/dashboard/${slug}`}
              className="flex-1 py-2 px-4 border border-gray-300 text-gray-900 rounded-xl hover:bg-gray-50 transition"
            >
              Dashboard
            </button>
            <button
              onClick={handleDisconnect}
              className="flex-1 py-2 px-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="w-full py-3 px-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition"
          >
            Connect {platform}
          </button>
        )}
      </div>
    </div>
  );
}