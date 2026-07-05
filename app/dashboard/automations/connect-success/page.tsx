'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const AUTOMATION_LABELS: Record<string, string> = {
  'content-pipeline': 'Content Studio',
  'ai-customer-service': 'Intelli Support',
  'ai-ad-manager': 'AI Ad Manager',
  performance: 'Performance',
  'smart-inventory': 'Smart Inventory',
};

const DEFAULT_RETURN_TO: Record<string, string> = {
  'content-pipeline': '/dashboard/automations/content-pipeline',
  'ai-customer-service': '/dashboard/cs',
  performance: '/dashboard/performance',
  'smart-inventory': '/dashboard/stock',
};

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function safePath(path: string | null, fallback: string) {
  if (!path || !path.startsWith('/dashboard/')) return fallback;
  return path;
}

export default function AutomationConnectSuccessPage() {
  const searchParams = useSearchParams();
  const automation = searchParams.get('automation') || 'content-pipeline';
  const provider = titleCase(searchParams.get('provider') || 'connection');
  const automationTitle = AUTOMATION_LABELS[automation] || titleCase(automation);
  const fallbackReturnTo = DEFAULT_RETURN_TO[automation] || '/dashboard/automations';
  const returnTo = safePath(searchParams.get('returnTo'), fallbackReturnTo);

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl glass rounded-[32px] border border-blue-100 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <svg className="h-7 w-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 mb-3">Connected</div>
        <h1 className="text-3xl font-bold text-gray-950">{automationTitle} now connected</h1>
        <p className="text-gray-600 mt-3 max-w-xl mx-auto">
          {provider} is saved and {automationTitle} is now active for this workspace.
        </p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href={returnTo} className="px-5 py-3 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold text-sm text-center">
            Open {automationTitle}
          </Link>
          <Link href="/dashboard/automations" className="px-5 py-3 rounded-xl bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 font-semibold text-sm text-center">
            View Automations
          </Link>
        </div>
      </div>
    </div>
  );
}
