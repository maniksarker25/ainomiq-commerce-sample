'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Headphones, Layers3, LucideIcon, Package, PenTool, Star, Tag, Users, Wand2 } from 'lucide-react';
import { fetchSession, getSession, type Session } from '../../../lib/session';
import { isBrandProfileReady } from '@/lib/brand-profile';

interface AutomationCard {
  id: string;
  title: string;
  description: string;
  features: string[];
  icon: LucideIcon;
  active: boolean;
  onboardingUrl?: string;
  dashboardUrl?: string;
  comingSoon: boolean;
}

const AUTOMATION_ICONS: Record<string, LucideIcon> = {
  ads: BarChart3,
  cs: Headphones,
  stock: Package,
  performance: BarChart3,
  content: PenTool,
  'creative-os': Layers3,
  review: Star,
  affiliate: Users,
  pricing: Tag,
  custom: Wand2,
};

function AutomationIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="w-10 h-10 rounded-xl border border-blue-100 bg-blue-50 text-blue-700 flex items-center justify-center mb-4">
      <Icon size={20} strokeWidth={1.7} />
    </div>
  );
}

export default function AutomationsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(() => getSession());
  const activeModules = session?.modules || [];
  const [brandReady, setBrandReady] = useState<boolean | null>(null);

  useEffect(() => {
    fetchSession().then(fresh => {
      if (fresh) setSession(fresh);
    });
  }, []);

  useEffect(() => {
    const ids = [session?.tenantId, session?.email].filter(Boolean) as string[];
    const uniqueIds = Array.from(new Set(ids));
    if (!uniqueIds.length) return;
    Promise.all(uniqueIds.map(id =>
      fetch(`/api/settings/brand-profile?tenant_id=${encodeURIComponent(id)}`, { cache: 'no-store' })
        .then(res => res.ok ? res.json() : { profile: null })
        .catch(() => ({ profile: null }))
    ))
      .then(results => setBrandReady(results.some(data => isBrandProfileReady(data.profile))))
      .catch(() => setBrandReady(false));
  }, [session?.tenantId, session?.email]);

  const automationCards: AutomationCard[] = [
    {
      id: 'ai-ad-manager',
      title: 'Logic Ads',
      description: 'Ad strategy, creative generation, and performance decisions',
      icon: AUTOMATION_ICONS.ads,
      features: [
        'Automated ad creation from your content',
        'Dynamic A/B testing and optimization',
        'AI-driven kill/scale decisions',
        'Creative rotation to combat fatigue',
        'Performance forecasting',
      ],
      active: activeModules.includes('ads'),
      onboardingUrl: '/dashboard/meta-setup?module=ads&next=/dashboard/ads',
      dashboardUrl: '/dashboard/ads',
      comingSoon: false,
    },
    {
      id: 'ai-customer-service',
      title: 'Intelli Support',
      description: 'Train AI on your inbox, policies, and brand voice. Start with email, then add Facebook and Instagram.',
      icon: AUTOMATION_ICONS.cs,
      features: [
        'Uses your saved Brand Data and support history',
        'Email triage, labels, and suggested replies',
        'Order, shipping, and return context for better answers',
        'Escalation rules for sensitive customer cases',
        'Optional Facebook and Instagram support channels',
      ],
      active: activeModules.includes('cs'),
      onboardingUrl: '/dashboard/automations/cs-onboarding',
      dashboardUrl: '/dashboard/cs',
      comingSoon: false,
    },
    {
      id: 'smart-inventory',
      title: 'Smart Inventory',
      description: 'Automated reorder alerts, supplier management, and demand forecasting',
      icon: AUTOMATION_ICONS.stock,
      features: [
        'Real-time stock level monitoring',
        'Automated reorder triggers',
        'Supplier performance tracking',
        'Demand forecasting based on sales trends',
        'Purchase order automation',
      ],
      active: activeModules.includes('stock'),
      comingSoon: false,
    },
    {
      id: 'performance',
      title: 'Performance',
      description: 'Revenue, profit, ROAS, orders, CAC and blended store performance in one view',
      icon: AUTOMATION_ICONS.performance,
      features: [
        'Revenue and profit overview',
        'Blended ROAS and CAC tracking',
        'Orders, AOV and margin trends',
        'Platform connection health',
        'Performance breakdowns by channel',
      ],
      active: true,
      dashboardUrl: '/dashboard/performance',
      comingSoon: false,
    },
    {
      id: 'content-pipeline',
      title: 'Content Studio',
      description: 'AI turns your content sources into posts, ads, and planning',
      icon: AUTOMATION_ICONS.content,
      features: [
        'Ainomiq Library content ingestion',
        'AI-powered ad copy generation',
        'Image and video asset optimization',
        'Content calendar and scheduling',
        'Performance-based creative selection',
      ],
      active: activeModules.includes('content'),
      onboardingUrl: '/dashboard/automations/content-pipeline',
      comingSoon: false,
    },
    {
      id: 'creative-os',
      title: 'Creative OS',
      description: 'Standalone creative production for products, source assets, briefs, reviews and launch handoff',
      icon: AUTOMATION_ICONS['creative-os'],
      features: [
        'Product-based creative workflow',
        'Source asset and catalog organization',
        'Editor task assignment',
        'Review and approval queue',
        'Launch and learning loop',
      ],
      active: activeModules.includes('creative-os') || activeModules.includes('ads'),
      dashboardUrl: '/dashboard/creative-os',
      onboardingUrl: '/dashboard/creative-os',
      comingSoon: false,
    },
    {
      id: 'review-management',
      title: 'Review Management',
      description: 'Automated review collection, response, and social proof optimization',
      icon: AUTOMATION_ICONS.review,
      features: [
        'Post-purchase review request automation',
        'AI-powered review response drafts',
        'Negative review escalation alerts',
        'Social proof widget for product pages',
        'Review sentiment analytics',
      ],
      active: false,
      comingSoon: true,
    },
    {
      id: 'affiliate-creator-program',
      title: 'Affiliate & Creator Program',
      description: 'Recruit creators, track partner sales, and scale profitable influencer revenue.',
      icon: AUTOMATION_ICONS.affiliate,
      features: [
        'Creator onboarding and link generation',
        'Commission and payout tracking',
        'Partner performance leaderboard',
        'Fraud and abuse detection',
        'Automated monthly payout exports',
      ],
      active: false,
      comingSoon: true,
    },
    {
      id: 'pricing-optimization',
      title: 'Dynamic Pricing',
      description: 'AI-driven pricing strategies based on demand, competition, and margins',
      icon: AUTOMATION_ICONS.pricing,
      features: [
        'Competitor price monitoring',
        'Margin-aware dynamic pricing rules',
        'Bundle and discount optimization',
        'Demand-based price adjustments',
        'A/B testing on pricing strategies',
      ],
      active: false,
      comingSoon: true,
    },
  ];

  const handleContactSales = () => {
    window.location.href = 'mailto:info@ainomiq.com?subject=Automation%20Module%20Inquiry';
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
        <p className="text-gray-600 text-sm mt-1">Powerful automation modules to scale your business</p>
      </div>

      {activeModules.length === 0 && brandReady === false && (
        <div className="glass rounded-2xl p-5 border border-blue-100 bg-blue-50 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="font-bold text-blue-950">Set up Brand Data first</h2>
            <p className="text-sm text-blue-800 mt-1">Scan and review the company profile once. Every automation can reuse it instead of asking the same questions again.</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/settings?tab=brand-data')}
            className="px-5 py-3 bg-gray-950 text-white font-semibold rounded-xl whitespace-nowrap"
          >
            Open Brand Data
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {automationCards.map(card => (
          <div
            key={card.id}
            className={`glass rounded-2xl p-6 border transition-colors relative flex flex-col ${card.id === 'ai-customer-service' ? 'border-blue-200 bg-linear-to-b from-white to-blue-50/35 hover:border-blue-400 shadow-sm' : 'border-gray-200 hover:border-blue-300'}`}
          >
            {card.active && (
              <div className="absolute top-4 right-4 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                Active
              </div>
            )}
            <AutomationIcon icon={card.icon} />
            <h3 className="text-xl font-bold text-gray-900 mb-2">{card.title}</h3>
            <p className="text-gray-700 mb-4">{card.description}</p>
            <ul className="space-y-2 mb-6 flex-1">
              {card.features.map((feature, idx) => (
                <li key={idx} className="flex items-start text-sm text-gray-600">
                  <svg className="w-4 h-4 text-blue-500 mr-2 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            {card.active && card.dashboardUrl ? (
              <a
                href={card.dashboardUrl}
                className="block w-full py-3 bg-gray-950 hover:bg-gray-800 text-white font-semibold rounded-lg transition-colors text-center"
              >
                Open
              </a>
            ) : card.active ? (
              <div className="text-center py-3 bg-gray-100 text-gray-700 rounded-lg font-medium">
                Already Active
              </div>
            ) : card.onboardingUrl ? (
              <a
                href={card.onboardingUrl}
                className="block w-full py-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold rounded-lg transition-colors text-center"
              >
                Set Up
              </a>
            ) : card.comingSoon ? (
              <div className="text-center py-3 bg-black text-white rounded-lg font-medium">
                Coming Soon
              </div>
            ) : (
              <button
                onClick={handleContactSales}
                className="w-full py-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold rounded-lg transition-colors"
              >
                Set Up
              </button>
            )}
          </div>
        ))}

        {/* Custom Request card */}
        <div className="glass rounded-2xl p-6 border border-dashed border-gray-300 hover:border-gray-400 transition-colors relative flex flex-col">
          <div className="flex-1">
            <AutomationIcon icon={AUTOMATION_ICONS.custom} />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Custom Request</h3>
            <p className="text-gray-700 mb-4">Need something specific? We build bespoke automations tailored to your workflow.</p>
            <ul className="space-y-2 mb-6">
              {['Niche platform integrations', 'Custom data pipelines', 'Workflow-specific automation', 'Dedicated implementation support'].map((f, i) => (
                <li key={i} className="flex items-start text-sm text-gray-600">
                  <svg className="w-4 h-4 text-gray-400 mr-2 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={handleContactSales}
            className="w-full py-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold rounded-lg transition-colors"
          >
            Contact Sales
          </button>
        </div>
      </div>
    </div>
  );
}
