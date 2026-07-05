export type SettingsTab = 'integrations' | 'brand-data' | 'notifications' | 'account';

export type BrandProfile = {
  brand_name: string;
  website: string;
  what_you_sell: string;
  ideal_customer: string;
  customer_problem: string;
  main_offer: string;
  proof_points: string;
  competitors: string;
  brand_purpose: string;
  brand_tone: string;
  visual_style: string;
  content_goals: string;
  logo_url?: string;
  icon_url?: string;
  full_logo_url?: string;
  status?: string;
  updated_at?: string;
  source_summary?: { 
    platform?: string; 
    products?: number; 
    collections?: number; 
    policies?: number; 
    faq?: number; 
    markets?: number; 
    contact?: boolean; 
    confidence?: number; 
    technologies?: string[]; 
    brand_colors?: string[]; 
    logo?: string | null; 
    icon?: string | null; 
    favicon?: string | null; 
    logo_candidates?: string[]; 
    icon_candidates?: string[]; 
    purpose_clues?: string[]; 
    social_channels?: string[]; 
    social_links?: Record<string, string>; 
    page_count?: number; 
    key_pages?: string[]; 
    top_products?: Array<{ title?: string; price?: string; url?: string }>; 
    product_catalog?: Array<{ title?: string; price?: string; url?: string; image_url?: string }>; 
    collection_catalog?: Array<{ title?: string; url?: string; image_url?: string; product_count?: number }>; 
    contact_email?: string; 
    contact_phone?: string; 
    site_title?: string; 
    site_description?: string; 
    scraped_at?: string 
  } | null;
};

export interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  time: string;
  links?: { label: string; href: string }[];
  suggestions?: string[];
  rated?: 'up' | 'down' | null;
}

export interface IntegrationDef {
  id: string;
  group: string;
  name: string;
  desc: string;
  logo: string;
  comingSoon: boolean;
  isRequest?: boolean;
  builtIn?: boolean;
}

export interface IntegrationStatus extends IntegrationDef {
  connected: boolean;
  email: string;
  connectedProvider: string;
  providerAccountId?: string;
}
