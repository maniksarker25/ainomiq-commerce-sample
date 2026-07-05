// Realistic fake data for the demo tenant (mid-size ecommerce store)

// ── Stock ──────────────────────────────────────────────────────────

export function getDemoStockStats() {
  return {
    totalProducts: 18,
    totalInventory: 1247,
    lowStockCount: 4,
    outOfStockCount: 2,
  };
}

export function getDemoStockProducts() {
  const products = [
    {
      id: '8001', title: 'Classic Straight Jeans', status: 'active',
      image: null,
      variants: [
        { id: '80011', title: 'W28 / Blue Wash', sku: 'CSJ-28-BW', price: '89.00', inventory: 34 },
        { id: '80012', title: 'W30 / Blue Wash', sku: 'CSJ-30-BW', price: '89.00', inventory: 52 },
        { id: '80013', title: 'W32 / Blue Wash', sku: 'CSJ-32-BW', price: '89.00', inventory: 7 },
        { id: '80014', title: 'W34 / Blue Wash', sku: 'CSJ-34-BW', price: '89.00', inventory: 41 },
      ],
    },
    {
      id: '8002', title: 'Relaxed Fit Cargo Pants', status: 'active',
      image: null,
      variants: [
        { id: '80021', title: 'S / Olive', sku: 'RFC-S-OLV', price: '79.00', inventory: 18 },
        { id: '80022', title: 'M / Olive', sku: 'RFC-M-OLV', price: '79.00', inventory: 0 },
        { id: '80023', title: 'L / Olive', sku: 'RFC-L-OLV', price: '79.00', inventory: 23 },
        { id: '80024', title: 'XL / Olive', sku: 'RFC-XL-OLV', price: '79.00', inventory: 11 },
      ],
    },
    {
      id: '8003', title: 'Oversized Cotton Tee', status: 'active',
      image: null,
      variants: [
        { id: '80031', title: 'S / White', sku: 'OCT-S-WHT', price: '39.00', inventory: 87 },
        { id: '80032', title: 'M / White', sku: 'OCT-M-WHT', price: '39.00', inventory: 64 },
        { id: '80033', title: 'L / White', sku: 'OCT-L-WHT', price: '39.00', inventory: 45 },
        { id: '80034', title: 'S / Black', sku: 'OCT-S-BLK', price: '39.00', inventory: 71 },
        { id: '80035', title: 'M / Black', sku: 'OCT-M-BLK', price: '39.00', inventory: 53 },
        { id: '80036', title: 'L / Black', sku: 'OCT-L-BLK', price: '39.00', inventory: 38 },
      ],
    },
    {
      id: '8004', title: 'Wide Leg Trousers', status: 'active',
      image: null,
      variants: [
        { id: '80041', title: 'W28 / Charcoal', sku: 'WLT-28-CHR', price: '99.00', inventory: 22 },
        { id: '80042', title: 'W30 / Charcoal', sku: 'WLT-30-CHR', price: '99.00', inventory: 31 },
        { id: '80043', title: 'W32 / Charcoal', sku: 'WLT-32-CHR', price: '99.00', inventory: 5 },
      ],
    },
    {
      id: '8005', title: 'Heavyweight Hoodie', status: 'active',
      image: null,
      variants: [
        { id: '80051', title: 'S / Grey Marl', sku: 'HWH-S-GRY', price: '69.00', inventory: 29 },
        { id: '80052', title: 'M / Grey Marl', sku: 'HWH-M-GRY', price: '69.00', inventory: 42 },
        { id: '80053', title: 'L / Grey Marl', sku: 'HWH-L-GRY', price: '69.00', inventory: 16 },
        { id: '80054', title: 'XL / Grey Marl', sku: 'HWH-XL-GRY', price: '69.00', inventory: 8 },
      ],
    },
    {
      id: '8006', title: 'Slim Chinos', status: 'active',
      image: null,
      variants: [
        { id: '80061', title: 'W30 / Sand', sku: 'SCH-30-SND', price: '74.00', inventory: 37 },
        { id: '80062', title: 'W32 / Sand', sku: 'SCH-32-SND', price: '74.00', inventory: 19 },
        { id: '80063', title: 'W34 / Sand', sku: 'SCH-34-SND', price: '74.00', inventory: 44 },
      ],
    },
    {
      id: '8007', title: 'Cropped Denim Jacket', status: 'active',
      image: null,
      variants: [
        { id: '80071', title: 'S / Light Wash', sku: 'CDJ-S-LW', price: '119.00', inventory: 14 },
        { id: '80072', title: 'M / Light Wash', sku: 'CDJ-M-LW', price: '119.00', inventory: 9 },
        { id: '80073', title: 'L / Light Wash', sku: 'CDJ-L-LW', price: '119.00', inventory: 3 },
      ],
    },
    {
      id: '8008', title: 'Ribbed Tank Top', status: 'active',
      image: null,
      variants: [
        { id: '80081', title: 'S / Off White', sku: 'RTT-S-OW', price: '29.00', inventory: 102 },
        { id: '80082', title: 'M / Off White', sku: 'RTT-M-OW', price: '29.00', inventory: 78 },
        { id: '80083', title: 'L / Off White', sku: 'RTT-L-OW', price: '29.00', inventory: 56 },
      ],
    },
    {
      id: '8009', title: 'Distressed Skinny Jeans', status: 'active',
      image: null,
      variants: [
        { id: '80091', title: 'W28 / Washed Black', sku: 'DSJ-28-WB', price: '94.00', inventory: 0 },
        { id: '80092', title: 'W30 / Washed Black', sku: 'DSJ-30-WB', price: '94.00', inventory: 12 },
        { id: '80093', title: 'W32 / Washed Black', sku: 'DSJ-32-WB', price: '94.00', inventory: 21 },
      ],
    },
    {
      id: '8010', title: 'Linen Blend Shirt', status: 'active',
      image: null,
      variants: [
        { id: '80101', title: 'S / Ecru', sku: 'LBS-S-ECR', price: '59.00', inventory: 33 },
        { id: '80102', title: 'M / Ecru', sku: 'LBS-M-ECR', price: '59.00', inventory: 27 },
        { id: '80103', title: 'L / Ecru', sku: 'LBS-L-ECR', price: '59.00', inventory: 15 },
      ],
    },
    {
      id: '8011', title: 'Fleece Joggers', status: 'active',
      image: null,
      variants: [
        { id: '80111', title: 'S / Navy', sku: 'FJG-S-NVY', price: '54.00', inventory: 46 },
        { id: '80112', title: 'M / Navy', sku: 'FJG-M-NVY', price: '54.00', inventory: 38 },
        { id: '80113', title: 'L / Navy', sku: 'FJG-L-NVY', price: '54.00', inventory: 22 },
      ],
    },
    {
      id: '8012', title: 'Corduroy Overshirt', status: 'active',
      image: null,
      variants: [
        { id: '80121', title: 'M / Rust', sku: 'COS-M-RST', price: '84.00', inventory: 11 },
        { id: '80122', title: 'L / Rust', sku: 'COS-L-RST', price: '84.00', inventory: 6 },
      ],
    },
    {
      id: '8013', title: 'Puffer Vest', status: 'active',
      image: null,
      variants: [
        { id: '80131', title: 'S / Black', sku: 'PFV-S-BLK', price: '109.00', inventory: 19 },
        { id: '80132', title: 'M / Black', sku: 'PFV-M-BLK', price: '109.00', inventory: 25 },
        { id: '80133', title: 'L / Black', sku: 'PFV-L-BLK', price: '109.00', inventory: 13 },
      ],
    },
    {
      id: '8014', title: 'Tailored Blazer', status: 'active',
      image: null,
      variants: [
        { id: '80141', title: 'M / Dark Grey', sku: 'TBL-M-DGR', price: '149.00', inventory: 8 },
        { id: '80142', title: 'L / Dark Grey', sku: 'TBL-L-DGR', price: '149.00', inventory: 5 },
      ],
    },
    {
      id: '8015', title: 'Canvas Tote Bag', status: 'active',
      image: null,
      variants: [
        { id: '80151', title: 'One Size / Natural', sku: 'CTB-OS-NAT', price: '34.00', inventory: 67 },
      ],
    },
    {
      id: '8016', title: 'Woven Belt', status: 'active',
      image: null,
      variants: [
        { id: '80161', title: 'S-M / Tan', sku: 'WBT-SM-TAN', price: '24.00', inventory: 43 },
        { id: '80162', title: 'L-XL / Tan', sku: 'WBT-LXL-TAN', price: '24.00', inventory: 39 },
      ],
    },
    {
      id: '8017', title: 'Knit Beanie', status: 'active',
      image: null,
      variants: [
        { id: '80171', title: 'One Size / Cream', sku: 'KBN-OS-CRM', price: '22.00', inventory: 4 },
        { id: '80172', title: 'One Size / Black', sku: 'KBN-OS-BLK', price: '22.00', inventory: 51 },
      ],
    },
    {
      id: '8018', title: 'Graphic Sweatshirt', status: 'draft',
      image: null,
      variants: [
        { id: '80181', title: 'M / Washed Blue', sku: 'GSW-M-WBL', price: '64.00', inventory: 0 },
        { id: '80182', title: 'L / Washed Blue', sku: 'GSW-L-WBL', price: '64.00', inventory: 0 },
      ],
    },
  ];
  return { products };
}

// ── Customer Service ───────────────────────────────────────────────

export function getDemoCsStats() {
  return {
    received: 47,
    unread: 8,
    handled: 39,
    sentToday: 6,
    escalated: 2,
    avgResponseTime: '2h 14m',
  };
}

export function getDemoCsEmails() {
  const now = Date.now();
  const hour = 3600000;
  const emails = [
    { id: 'demo-e1', threadId: 'demo-t1', subject: 'Where is my order #4821?', from: 'lisa.vanderberg@gmail.com', to: 'support@demo-store.com', date: new Date(now - 2 * hour).toISOString(), snippet: 'Hi, I placed my order 5 days ago and haven\'t received any shipping confirmation yet...', isUnread: true, labels: ['INBOX', 'UNREAD'], deliveredTo: 'support@demo-store.com', internalDate: String(Date.now()) },
    { id: 'demo-e2', threadId: 'demo-t2', subject: 'Return request - wrong size', from: 'mark.dejong@outlook.com', to: 'support@demo-store.com', date: new Date(now - 5 * hour).toISOString(), snippet: 'I ordered the Classic Straight Jeans in W32 but they run way too large. Can I exchange for W30?', isUnread: true, labels: ['INBOX', 'UNREAD'], deliveredTo: 'support@demo-store.com', internalDate: String(Date.now()) },
    { id: 'demo-e3', threadId: 'demo-t3', subject: 'Discount code not working', from: 'sarah.klein@gmail.com', to: 'support@demo-store.com', date: new Date(now - 8 * hour).toISOString(), snippet: 'I received an email with code SPRING20 but it says invalid at checkout. Can you help?', isUnread: true, labels: ['INBOX', 'UNREAD'], deliveredTo: 'support@demo-store.com', internalDate: String(Date.now()) },
    { id: 'demo-e4', threadId: 'demo-t4', subject: 'Product question - Heavyweight Hoodie', from: 'tom.bakker@hotmail.com', to: 'support@demo-store.com', date: new Date(now - 12 * hour).toISOString(), snippet: 'What\'s the weight of the fabric? Is it suitable for autumn or more of a winter piece?', isUnread: false, labels: ['INBOX'], deliveredTo: 'support@demo-store.com', internalDate: String(Date.now()) },
    { id: 'demo-e5', threadId: 'demo-t5', subject: 'Missing item in my package', from: 'emma.visser@gmail.com', to: 'support@demo-store.com', date: new Date(now - 18 * hour).toISOString(), snippet: 'I ordered 3 items but only received 2. The Ribbed Tank Top is missing from my shipment.', isUnread: true, labels: ['INBOX', 'UNREAD'], deliveredTo: 'support@demo-store.com', internalDate: String(Date.now()) },
    { id: 'demo-e6', threadId: 'demo-t6', subject: 'Re: Wholesale inquiry', from: 'purchasing@boutique-nord.de', to: 'support@demo-store.com', date: new Date(now - 24 * hour).toISOString(), snippet: 'Thanks for the catalog. We\'d be interested in placing a sample order of 50 units across...', isUnread: false, labels: ['INBOX'], deliveredTo: 'support@demo-store.com', internalDate: String(Date.now()) },
    { id: 'demo-e7', threadId: 'demo-t7', subject: 'Shipping to Portugal?', from: 'ana.costa@sapo.pt', to: 'support@demo-store.com', date: new Date(now - 30 * hour).toISOString(), snippet: 'Do you ship to Portugal? And if so, what are the estimated delivery times and costs?', isUnread: true, labels: ['INBOX', 'UNREAD'], deliveredTo: 'support@demo-store.com', internalDate: String(Date.now()) },
    { id: 'demo-e8', threadId: 'demo-t8', subject: 'Great quality!', from: 'james.murphy@yahoo.com', to: 'support@demo-store.com', date: new Date(now - 36 * hour).toISOString(), snippet: 'Just wanted to say the Wide Leg Trousers are amazing. Best fit I\'ve found online. Will be ordering more.', isUnread: false, labels: ['INBOX'], deliveredTo: 'support@demo-store.com', internalDate: String(Date.now()) },
    { id: 'demo-e9', threadId: 'demo-t9', subject: 'Re: Refund status update', from: 'nina.schmidt@web.de', to: 'support@demo-store.com', date: new Date(now - 48 * hour).toISOString(), snippet: 'I still haven\'t received my refund. It\'s been 10 business days now. Order #4756.', isUnread: true, labels: ['INBOX', 'UNREAD'], deliveredTo: 'support@demo-store.com', internalDate: String(Date.now()) },
    { id: 'demo-e10', threadId: 'demo-t10', subject: 'Collaboration proposal', from: 'hello@streetstyle-blog.com', to: 'support@demo-store.com', date: new Date(now - 60 * hour).toISOString(), snippet: 'We\'d love to feature your brand in our upcoming spring lookbook. We have 85k followers on IG...', isUnread: false, labels: ['INBOX'], deliveredTo: 'support@demo-store.com', internalDate: String(Date.now()) },
    { id: 'demo-e11', threadId: 'demo-t11', subject: 'Damaged item received', from: 'peter.willems@telenet.be', to: 'support@demo-store.com', date: new Date(now - 72 * hour).toISOString(), snippet: 'The Cropped Denim Jacket arrived with a rip on the left pocket. I\'ve attached photos.', isUnread: true, labels: ['INBOX', 'UNREAD'], deliveredTo: 'support@demo-store.com', internalDate: String(Date.now()) },
    { id: 'demo-e12', threadId: 'demo-t12', subject: 'Do you offer gift wrapping?', from: 'sophie.duval@orange.fr', to: 'support@demo-store.com', date: new Date(now - 84 * hour).toISOString(), snippet: 'I want to order the Tailored Blazer as a birthday gift. Is there an option for gift wrapping?', isUnread: false, labels: ['INBOX'], deliveredTo: 'support@demo-store.com', internalDate: String(Date.now()) },
    { id: 'demo-e13', threadId: 'demo-t13', subject: 'Restock notification - Distressed Skinny Jeans W28', from: 'lucia.romano@libero.it', to: 'support@demo-store.com', date: new Date(now - 96 * hour).toISOString(), snippet: 'The W28 in Washed Black has been out of stock for weeks. When will it be available again?', isUnread: true, labels: ['INBOX', 'UNREAD'], deliveredTo: 'support@demo-store.com', internalDate: String(Date.now()) },
  ];
  return { emails, total: emails.length };
}

export function getDemoCsEmailDetail(id: string) {
  const emailBodies: Record<string, { subject: string; from: string; to: string; body: string; htmlBody?: string; thread: Array<{ id: string; from: string; date: string; snippet: string; isSent: boolean }> }> = {
    'demo-e1': {
      subject: 'Where is my order #4821?',
      from: 'lisa.vanderberg@gmail.com',
      to: 'support@demo-store.com',
      body: 'Hi,\n\nI placed order #4821 five days ago and still haven\'t received a shipping confirmation. Could you please check the status?\n\nI paid for express shipping so I expected it sooner.\n\nThanks,\nLisa',
      htmlBody: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 10px;">
        <p>Hi,</p>
        <p>I placed order <strong style="color: #3b82f6;">#4821</strong> five days ago and still haven't received a shipping confirmation. Could you please check the status?</p>
        <p>I paid for express shipping so I expected it sooner.</p>
        <div style="margin-top: 20px; padding: 12px; background-color: #f8f9fc; border-left: 4px solid #3b82f6; border-radius: 4px;">
          <strong>Order Summary:</strong><br/>
          Order Date: May 15, 2026<br/>
          Shipping Method: Express Delivery<br/>
          Status: <span style="color: #ea580c; font-weight: 600;">Pending Fulfillment</span>
        </div>
        <p style="margin-top: 20px;">Thanks,<br/><span style="font-weight: 500;">Lisa</span></p>
      </div>`,
      thread: [],
    },
    'demo-e2': {
      subject: 'Return request - wrong size',
      from: 'mark.dejong@outlook.com',
      to: 'support@demo-store.com',
      body: 'Hello,\n\nI ordered the Classic Straight Jeans in W32 but they\'re way too large. I normally wear W32 in other brands.\n\nCould I exchange these for a W30 instead? I still have the tags on.\n\nOrder number: #4798\n\nBest,\nMark',
      htmlBody: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 10px;">
        <p>Hello,</p>
        <p>I ordered the <strong>Classic Straight Jeans</strong> in <span style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 600;">W32</span> but they're way too large. I normally wear W32 in other brands.</p>
        <p>Could I exchange these for a <span style="background-color: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: 600;">W30</span> instead? I still have the tags on.</p>
        <div style="margin-top: 15px; padding: 12px; border: 1px dashed #e2e6ef; border-radius: 8px;">
          <strong>Items to Return:</strong><br/>
          • Classic Straight Jeans (W32 / Blue Wash) - 1x<br/>
          • Order: #4798
        </div>
        <p style="margin-top: 20px;">Best,<br/><span style="font-weight: 500;">Mark</span></p>
      </div>`,
      thread: [],
    },
    'demo-e5': {
      subject: 'Missing item in my package',
      from: 'emma.visser@gmail.com',
      to: 'support@demo-store.com',
      body: 'Hi there,\n\nI just received my order #4812 but the Ribbed Tank Top (Off White, size M) is missing. The packing slip shows 3 items but there were only 2 in the box.\n\nCan you please send the missing item or issue a refund?\n\nThanks,\nEmma',
      htmlBody: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 10px;">
        <p>Hi there,</p>
        <p>I just received my order <strong>#4812</strong> but the <span style="text-decoration: underline;">Ribbed Tank Top (Off White, size M)</span> is missing. The packing slip shows 3 items but there were only 2 in the box.</p>
        <p>Can you please send the missing item or issue a refund?</p>
        <div style="margin-top: 15px; padding: 12px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #991b1b;">
          <strong>Discrepancy Reported:</strong><br/>
          • Ordered: 3 items (Classic Straight Jeans, Oversized Cotton Tee, Ribbed Tank Top)<br/>
          • Received: 2 items (Ribbed Tank Top missing)
        </div>
        <p style="margin-top: 20px;">Thanks,<br/><span style="font-weight: 500;">Emma</span></p>
      </div>`,
      thread: [],
    },
  };

  const detail = emailBodies[id];
  if (detail) {
    const now = Date.now();
    return {
      id,
      threadId: `demo-t${id.replace('demo-e', '')}`,
      ...detail,
      date: new Date(now - 3600000 * 5).toISOString(),
      snippet: detail.body.slice(0, 100),
      isUnread: false,
      labels: ['INBOX'],
      deliveredTo: 'support@demo-store.com',
      internalDate: String(now),
    };
  }

  // Generic fallback for any demo email
  return {
    id,
    threadId: `demo-t-${id}`,
    subject: 'Customer inquiry',
    from: 'customer@example.com',
    to: 'support@demo-store.com',
    date: new Date().toISOString(),
    snippet: 'This is a demo email.',
    body: 'This is a demo email body. Connect your Google account to see real customer emails.',
    htmlBody: `<div style="font-family: sans-serif; font-size: 14px; color: #333; padding: 10px;">
      <p>This is a demo email body.</p>
      <p style="color: #6b7280;">Connect your Google account in settings to see real customer emails.</p>
    </div>`,
    isUnread: false,
    labels: ['INBOX'],
    deliveredTo: 'support@demo-store.com',
    internalDate: String(Date.now()),
    thread: [],
  };
}

export function getDemoCsLabels() {
  return {
    labels: [
      { id: 'INBOX', name: 'INBOX', type: 'system' },
      { id: 'SENT', name: 'SENT', type: 'system' },
      { id: 'TRASH', name: 'TRASH', type: 'system' },
      { id: 'SPAM', name: 'SPAM', type: 'system' },
      { id: 'UNREAD', name: 'UNREAD', type: 'system' },
      { id: 'demo-lbl-1', name: 'Returns', type: 'user' },
      { id: 'demo-lbl-2', name: 'Shipping', type: 'user' },
      { id: 'demo-lbl-3', name: 'Wholesale', type: 'user' },
      { id: 'demo-lbl-4', name: 'Escalated', type: 'user' },
    ],
  };
}

export function getDemoCsSendAs() {
  return {
    sendAs: [
      { email: 'support@demo-store.com', name: 'Demo Store Support', isDefault: true, isPrimary: true },
    ],
  };
}

export function getDemoCsEscalations() {
  const now = Date.now();
  const hour = 3600000;
  return {
    escalations: [
      { id: 'demo-esc-1', subject: 'Missing item in my package', from: 'emma.visser@gmail.com', date: new Date(now - 16 * hour).toISOString(), escalatedTo: 'fulfillment@demo-store.com', status: 'waiting', threadId: 'demo-t5' },
      { id: 'demo-esc-2', subject: 'Re: Refund status update', from: 'nina.schmidt@web.de', date: new Date(now - 48 * hour).toISOString(), escalatedTo: 'manager@demo-store.com', status: 'resolved', threadId: 'demo-t9' },
      { id: 'demo-esc-3', subject: 'Damaged item received', from: 'peter.willems@telenet.be', date: new Date(now - 72 * hour).toISOString(), escalatedTo: 'fulfillment@demo-store.com', status: 'waiting', threadId: 'demo-t11' },
    ],
  };
}

export function getDemoCsConfig() {
  return {
    auto_reply: { email: true, instagram: true, facebook: false },
    escalation_contact: 'manager@demo-store.com',
    vip: { influencers: 'Escalate to nynke@demo-store.com', wholesale: 'Escalate to sales@demo-store.com' },
    safety: { max_refund_per_action: '50.00', max_refunds_per_customer_month: 2, daily_refund_budget: '200.00', monthly_refund_budget: '2000.00', min_delivery_window_days: 7, mode: 'live', fraud_flags: ['Multiple refund requests in 30 days', 'New account + high value order'] },
    bot_scope: { allowed: ['order_status', 'shipping_info', 'product_questions', 'discount_codes', 'returns_policy', 'sizing'], auto_escalate: ['Refund requests over EUR 50', 'Legal complaints or threats', 'Damaged/defective products', 'Influencer/wholesale inquiries'] },
    schedule: null,
    fulfillment_email: 'fulfillment@demo-store.com',
    tone: 'friendly',
    hard_rules: null,
  };
}

// ── CS Sent Emails ─────────────────────────────────────────────────

export function getDemoCsSentEmails() {
  const now = Date.now();
  const hour = 3600000;
  return {
    emails: [
      { id: 'demo-s1', threadId: 'demo-t1', subject: 'Re: Where is my order #4821?', from: 'support@demo-store.com', to: 'lisa.vanderberg@gmail.com', date: new Date(now - 1 * hour).toISOString(), snippet: 'Hi Lisa, I just checked and your order shipped yesterday. Here is your tracking number: NL4821TX...', isUnread: false, labels: ['SENT'], deliveredTo: '', internalDate: String(now - 1 * hour) },
      { id: 'demo-s2', threadId: 'demo-t2', subject: 'Re: Return request - wrong size', from: 'support@demo-store.com', to: 'mark.dejong@outlook.com', date: new Date(now - 4 * hour).toISOString(), snippet: 'Hi Mark, No problem! I have created a return label for you. You can find it attached...', isUnread: false, labels: ['SENT'], deliveredTo: '', internalDate: String(now - 4 * hour) },
      { id: 'demo-s3', threadId: 'demo-t3', subject: 'Re: Discount code not working', from: 'support@demo-store.com', to: 'sarah.klein@gmail.com', date: new Date(now - 7 * hour).toISOString(), snippet: 'Hey Sarah, Sorry about that! The code was case-sensitive. Try SPRING20 (all caps). If that still...', isUnread: false, labels: ['SENT'], deliveredTo: '', internalDate: String(now - 7 * hour) },
      { id: 'demo-s4', threadId: 'demo-t4', subject: 'Re: Product question - Heavyweight Hoodie', from: 'support@demo-store.com', to: 'tom.bakker@hotmail.com', date: new Date(now - 11 * hour).toISOString(), snippet: 'Hi Tom, The Heavyweight Hoodie is 400gsm organic cotton fleece. Perfect for autumn and mild winter...', isUnread: false, labels: ['SENT'], deliveredTo: '', internalDate: String(now - 11 * hour) },
      { id: 'demo-s5', threadId: 'demo-t5', subject: 'Re: Missing item in my package', from: 'support@demo-store.com', to: 'emma.visser@gmail.com', date: new Date(now - 16 * hour).toISOString(), snippet: 'Hi Emma, So sorry about that! We are sending the missing Ribbed Tank Top right away. You should...', isUnread: false, labels: ['SENT'], deliveredTo: '', internalDate: String(now - 16 * hour) },
      { id: 'demo-s6', threadId: 'demo-t7', subject: 'Re: Shipping to Portugal?', from: 'support@demo-store.com', to: 'ana.costa@sapo.pt', date: new Date(now - 28 * hour).toISOString(), snippet: 'Hi Ana, Yes we ship to Portugal! Standard delivery takes 5-7 business days and costs EUR 4.95...', isUnread: false, labels: ['SENT'], deliveredTo: '', internalDate: String(now - 28 * hour) },
      { id: 'demo-s7', threadId: 'demo-t8', subject: 'Re: Great quality!', from: 'support@demo-store.com', to: 'james.murphy@yahoo.com', date: new Date(now - 34 * hour).toISOString(), snippet: 'Thanks so much James! We really appreciate the kind words. Here is a 10% code for your next order: LOYAL10', isUnread: false, labels: ['SENT'], deliveredTo: '', internalDate: String(now - 34 * hour) },
      { id: 'demo-s8', threadId: 'demo-t12', subject: 'Re: Do you offer gift wrapping?', from: 'support@demo-store.com', to: 'sophie.duval@orange.fr', date: new Date(now - 80 * hour).toISOString(), snippet: 'Hi Sophie, Yes! Just add a note at checkout mentioning it is a gift and we will wrap it nicely...', isUnread: false, labels: ['SENT'], deliveredTo: '', internalDate: String(now - 80 * hour) },
    ],
  };
}

// ── CS Social (IG DMs, IG Comments, FB DMs, FB Comments) ──────────

export function getDemoIgDms() {
  const now = Date.now();
  const hour = 3600000;
  return {
    conversations: [
      { id: 'demo-ig-1', participantName: 'Emma Styles', lastMessage: 'Hey! Love the new collection. Do you ship to the UK?', updatedTime: new Date(now - 1 * hour).toISOString(), status: 'active', followerCount: 2340, url: '' },
      { id: 'demo-ig-2', participantName: 'Lucas Kramer', lastMessage: 'Hi, I ordered 2 weeks ago and still nothing. Order #4890', updatedTime: new Date(now - 3 * hour).toISOString(), status: 'active', followerCount: 156, url: '' },
      { id: 'demo-ig-3', participantName: 'Sophie Beaumont', lastMessage: 'Would love to collab! I have 45k followers and do fashion content', updatedTime: new Date(now - 6 * hour).toISOString(), status: 'active', followerCount: 45200, url: '' },
      { id: 'demo-ig-4', participantName: 'Noah van Dijk', lastMessage: 'What size should I get? I am 185cm 80kg', updatedTime: new Date(now - 12 * hour).toISOString(), status: 'active', followerCount: 89, url: '' },
      { id: 'demo-ig-5', participantName: 'Mia Rodriguez', lastMessage: 'The waist knots are genius! Just ordered 3 packs', updatedTime: new Date(now - 18 * hour).toISOString(), status: 'active', followerCount: 1120, url: '' },
      { id: 'demo-ig-6', participantName: 'Streetwear Daily', lastMessage: 'Hey, we would love to feature your brand. DM us for details', updatedTime: new Date(now - 24 * hour).toISOString(), status: 'active', followerCount: 128000, url: '' },
      { id: 'demo-ig-7', participantName: 'Julia Fischer', lastMessage: 'Ist der Versand nach Deutschland kostenlos?', updatedTime: new Date(now - 30 * hour).toISOString(), status: 'active', followerCount: 340, url: '' },
    ],
  };
}

export function getDemoIgComments() {
  const now = Date.now();
  const day = 86400000;
  return {
    comments: [
      {
        id: 'demo-igc-1',
        content: 'New drop alert! These waist knots are about to change your outfit game',
        createdTime: new Date(now - 1 * day).toISOString(),
        permalink: '',
        picture: '',
        commentCount: 24,
        likeCount: 312,
        comments: [
          { id: 'demo-comment-1', from: 'emma.styles', message: 'Obsessed. Are these available in cream too?', createdTime: new Date(now - 22 * 3600000).toISOString(), likeCount: 5 },
          { id: 'demo-comment-2', from: 'fitcheckdaily', message: 'Need this in our next shoot.', createdTime: new Date(now - 20 * 3600000).toISOString(), likeCount: 11 },
        ],
      },
      {
        id: 'demo-igc-2',
        content: 'POV: you finally found the perfect accessory',
        createdTime: new Date(now - 3 * day).toISOString(),
        permalink: '',
        picture: '',
        commentCount: 18,
        likeCount: 247,
        comments: [
          { id: 'demo-comment-3', from: 'lucaskramer', message: 'Can you restock the black one?', createdTime: new Date(now - 62 * 3600000).toISOString(), likeCount: 2 },
        ],
      },
      {
        id: 'demo-igc-3',
        content: 'Summer collection preview. Which color are you going for?',
        createdTime: new Date(now - 5 * day).toISOString(),
        permalink: '',
        picture: '',
        commentCount: 43,
        likeCount: 589,
        comments: [
          { id: 'demo-comment-4', from: 'sophiebeaumont', message: 'The sand tone is unreal.', createdTime: new Date(now - 5 * day + 7200000).toISOString(), likeCount: 9 },
          { id: 'demo-comment-5', from: 'noah.vd', message: 'Do you have sizing details in the caption?', createdTime: new Date(now - 5 * day + 12600000).toISOString(), likeCount: 1 },
          { id: 'demo-comment-6', from: 'mia.rodriguez', message: 'Launching when?', createdTime: new Date(now - 5 * day + 18000000).toISOString(), likeCount: 4 },
        ],
      },
      {
        id: 'demo-igc-4',
        content: 'Behind the scenes at our latest shoot',
        createdTime: new Date(now - 7 * day).toISOString(),
        permalink: '',
        picture: '',
        commentCount: 11,
        likeCount: 178,
        comments: [
          { id: 'demo-comment-7', from: 'streetweardaily', message: 'The set design is clean.', createdTime: new Date(now - 6 * day + 14400000).toISOString(), likeCount: 6 },
        ],
      },
      {
        id: 'demo-igc-5',
        content: 'Customer spotlight: @emmastyles rocking the Classic Straight Jeans',
        createdTime: new Date(now - 10 * day).toISOString(),
        permalink: '',
        picture: '',
        commentCount: 31,
        likeCount: 421,
        comments: [
          { id: 'demo-comment-8', from: 'jul.fischer', message: 'Okay this fit sold me.', createdTime: new Date(now - 9 * day + 3600000).toISOString(), likeCount: 8 },
          { id: 'demo-comment-9', from: 'wardrobeedit', message: 'Would love a link to the jacket too.', createdTime: new Date(now - 9 * day + 5400000).toISOString(), likeCount: 3 },
        ],
      },
    ],
  };
}

export function getDemoFbDms() {
  return { conversations: [] };
}

export function getDemoFbComments() {
  return { comments: [] };
}

export function getDemoConversationMessages(convId: string) {
  const now = Date.now();
  const min = 60000;
  const msgs: Record<string, Array<{ id: string; from: string; text: string; createdAt: string; direction: string }>> = {
    'demo-ig-1': [
      { id: 'm1', from: 'Emma Styles', text: 'Hey! Love the new collection. Do you ship to the UK?', createdAt: new Date(now - 65 * min).toISOString(), direction: 'incoming' },
      { id: 'm2', from: 'You', text: 'Hey Emma! Yes we ship worldwide, UK delivery is usually 5-7 days. Free shipping on orders over EUR 50!', createdAt: new Date(now - 60 * min).toISOString(), direction: 'outgoing' },
      { id: 'm3', from: 'Emma Styles', text: 'Amazing! Ordering now', createdAt: new Date(now - 55 * min).toISOString(), direction: 'incoming' },
    ],
    'demo-ig-2': [
      { id: 'm4', from: 'Lucas Kramer', text: 'Hi, I ordered 2 weeks ago and still nothing. Order #4890', createdAt: new Date(now - 185 * min).toISOString(), direction: 'incoming' },
      { id: 'm5', from: 'You', text: 'Hi Lucas, let me check that for you right away!', createdAt: new Date(now - 180 * min).toISOString(), direction: 'outgoing' },
      { id: 'm6', from: 'You', text: 'Your order shipped 3 days ago, here is the tracking: NL4890TX. It should arrive within 2 days!', createdAt: new Date(now - 178 * min).toISOString(), direction: 'outgoing' },
      { id: 'm7', from: 'Lucas Kramer', text: 'Thanks! That is great news', createdAt: new Date(now - 170 * min).toISOString(), direction: 'incoming' },
    ],
    'demo-ig-3': [
      { id: 'm8', from: 'Sophie Beaumont', text: 'Would love to collab! I have 45k followers and do fashion content', createdAt: new Date(now - 360 * min).toISOString(), direction: 'incoming' },
      { id: 'm9', from: 'You', text: 'Hi Sophie! Thanks for reaching out. We would love to explore a collaboration. Could you email nynke@demo-store.com with your media kit?', createdAt: new Date(now - 355 * min).toISOString(), direction: 'outgoing' },
    ],
    'demo-ig-4': [
      { id: 'm10', from: 'Noah van Dijk', text: 'What size should I get? I am 185cm 80kg', createdAt: new Date(now - 720 * min).toISOString(), direction: 'incoming' },
    ],
  };
  return { messages: msgs[convId] || [] };
}

export function getDemoIgConversationReply() {
  return {
    success: true,
    messageId: `demo-reply-${Math.random().toString(36).slice(2, 10)}`,
  };
}

export function getDemoIgCommentReply() {
  return {
    success: true,
    replyId: `demo-reply-${Math.random().toString(36).slice(2, 10)}`,
  };
}

// ── Ads ────────────────────────────────────────────────────────────

export function getDemoAdsStats() {
  return {
    totalSpend: '2847.32',
    roas: '3.41',
    totalPurchases: 127,
    avgCpc: '0.68',
  };
}

export function getDemoAdsInsights() {
  return {
    week: {
      spend: '2847.32',
      impressions: '184520',
      clicks: '4187',
      cpc: '0.68',
      cpm: '15.43',
      ctr: '2.27',
      actions: [{ action_type: 'purchase', value: '127' }],
      action_values: [{ action_type: 'purchase', value: '9709.35' }],
      purchase_roas: [{ value: '3.41' }],
    },
    today: {
      spend: '412.18',
      impressions: '26840',
      clicks: '614',
      cpc: '0.67',
      cpm: '15.36',
      ctr: '2.29',
      actions: [{ action_type: 'purchase', value: '19' }],
      action_values: [{ action_type: 'purchase', value: '1438.22' }],
      purchase_roas: [{ value: '3.49' }],
    },
  };
}

export function getDemoAdsCampaigns() {
  return {
    campaigns: [
      { id: 'demo-c1', name: 'Spring Collection - Broad', status: 'ACTIVE', objective: 'OUTCOME_SALES', dailyBudget: '150.00', lifetimeBudget: null, startTime: '2026-02-15T10:00:00+0000' },
      { id: 'demo-c2', name: 'Retargeting - Website Visitors', status: 'ACTIVE', objective: 'OUTCOME_SALES', dailyBudget: '80.00', lifetimeBudget: null, startTime: '2026-02-01T10:00:00+0000' },
      { id: 'demo-c3', name: 'Lookalike - Top Purchasers', status: 'ACTIVE', objective: 'OUTCOME_SALES', dailyBudget: '120.00', lifetimeBudget: null, startTime: '2026-02-20T10:00:00+0000' },
      { id: 'demo-c4', name: 'DPA - Dynamic Product Ads', status: 'ACTIVE', objective: 'OUTCOME_SALES', dailyBudget: '60.00', lifetimeBudget: null, startTime: '2026-01-15T10:00:00+0000' },
      { id: 'demo-c5', name: 'Brand Awareness - Video', status: 'PAUSED', objective: 'OUTCOME_AWARENESS', dailyBudget: '40.00', lifetimeBudget: null, startTime: '2026-01-10T10:00:00+0000' },
    ],
  };
}

export function getDemoAdsPersonaStats() {
  return {
    personas: [
      { persona: 'HUMOR', spend: 812.40, revenue: 3105.20, purchases: 41, roas: 3.82, cpa: 19.81, adCount: 8 },
      { persona: 'COMFORT', spend: 694.15, revenue: 2214.50, purchases: 29, roas: 3.19, cpa: 23.94, adCount: 6 },
      { persona: 'FOMO', spend: 578.90, revenue: 1843.70, purchases: 24, roas: 3.18, cpa: 24.12, adCount: 5 },
      { persona: 'CLEAN', spend: 761.87, revenue: 2545.95, purchases: 33, roas: 3.34, cpa: 23.09, adCount: 7 },
    ],
  };
}

export function getDemoAdsAdPerformance() {
  return {
    ads: [
      { id: 'demo-a1', name: 'HUMOR - Spring Jeans Reel', persona: 'HUMOR', status: 'ACTIVE', spend: 342.10, revenue: 1287.50, roas: 3.76, cpa: 19.01, ctr: 2.84, cpc: 0.58, purchases: 18, frequency: 1.6, verdict: 'SCALE' },
      { id: 'demo-a2', name: 'CLEAN - Minimal Lookbook', persona: 'CLEAN', status: 'ACTIVE', spend: 298.45, revenue: 1102.30, roas: 3.69, cpa: 21.32, ctr: 2.41, cpc: 0.64, purchases: 14, frequency: 1.4, verdict: 'SCALE' },
      { id: 'demo-a3', name: 'COMFORT - Hoodie Lifestyle', persona: 'COMFORT', status: 'ACTIVE', spend: 274.80, revenue: 956.40, roas: 3.48, cpa: 22.90, ctr: 2.15, cpc: 0.71, purchases: 12, frequency: 1.8, verdict: null },
      { id: 'demo-a4', name: 'FOMO - Limited Drop Banner', persona: 'FOMO', status: 'ACTIVE', spend: 256.30, revenue: 845.20, roas: 3.30, cpa: 23.30, ctr: 2.67, cpc: 0.62, purchases: 11, frequency: 2.1, verdict: null },
      { id: 'demo-a5', name: 'HUMOR - Cargo Pants TikTok Style', persona: 'HUMOR', status: 'ACTIVE', spend: 218.50, revenue: 752.80, roas: 3.45, cpa: 21.85, ctr: 3.12, cpc: 0.52, purchases: 10, frequency: 1.3, verdict: null },
      { id: 'demo-a6', name: 'CLEAN - Product Flat Lays', persona: 'CLEAN', status: 'ACTIVE', spend: 195.20, revenue: 621.40, roas: 3.18, cpa: 24.40, ctr: 1.98, cpc: 0.75, purchases: 8, frequency: 1.9, verdict: null },
      { id: 'demo-a7', name: 'COMFORT - Cozy Season UGC', persona: 'COMFORT', status: 'ACTIVE', spend: 182.60, revenue: 498.30, roas: 2.73, cpa: 26.09, ctr: 2.05, cpc: 0.69, purchases: 7, frequency: 2.4, verdict: null },
      { id: 'demo-a8', name: 'FOMO - Flash Sale Stories', persona: 'FOMO', status: 'PAUSED', spend: 164.80, revenue: 312.50, roas: 1.90, cpa: 32.96, ctr: 1.72, cpc: 0.82, purchases: 5, frequency: 3.2, verdict: null },
      { id: 'demo-a9', name: 'CLEAN - Blazer Editorial', persona: 'CLEAN', status: 'ACTIVE', spend: 148.90, revenue: 489.60, roas: 3.29, cpa: 24.82, ctr: 2.22, cpc: 0.66, purchases: 6, frequency: 1.5, verdict: null },
      { id: 'demo-a10', name: 'HUMOR - Behind the Scenes', persona: 'HUMOR', status: 'PAUSED', spend: 52.30, revenue: 0, roas: 0, cpa: 0, ctr: 0.84, cpc: 1.12, purchases: 0, frequency: 2.8, verdict: 'KILL' },
    ],
  };
}

export function getDemoAdsAgentStatus() {
  return {
    lastBatch: null,
    contentStats: {
      totalAds: 10,
      activeAds: 8,
      contentUsed: 24,
      contentInQueue: 7,
      newImages: 4,
      newVideos: 3,
      usedImages: 16,
      usedVideos: 8,
      killedCount: 1,
      fatigueAlertCount: 2,
      championsCount: 3,
      driveUpdated: new Date().toISOString(),
    },
    schedule: {
      monday: 'Generate new batch',
      wednesday: 'Midweek check',
      friday: 'Kill / Scale',
      sunday: 'Weekly report',
    },
  };
}

export function getDemoAdsAdAccounts() {
  return {
    accounts: [
      { id: 'act_demo123456', name: 'Demo Store Ads', accountId: 'demo123456', status: 'active', currency: 'EUR', businessName: 'Demo Store BV', timezone: 'Europe/Amsterdam' },
    ],
  };
}

// ── Email Marketing (Klaviyo) ──────────────────────────────────────

export function getDemoEmailStats(days: number = 7) {
  const scale = days / 7;
  return {
    totalSubscribers: 12847,
    avgOpenRate: '42.3',
    avgClickRate: '3.8',
    activeFlows: 6,
    totalFlows: 9,
    emailRevenue: {
      total: 4218.40 * scale,
      campaigns: 2643.20 * scale,
      flows: 1575.20 * scale,
      orders: Math.round(56 * scale),
    },
  };
}

export function getDemoEmailFlows() {
  return {
    flows: [
      { id: 'demo-f1', name: 'Welcome Series', status: 'live', triggerType: 'list', created: '2025-11-01T10:00:00Z', updated: '2026-02-15T14:30:00Z' },
      { id: 'demo-f2', name: 'Abandoned Cart', status: 'live', triggerType: 'metric', created: '2025-11-01T10:00:00Z', updated: '2026-03-01T09:00:00Z' },
      { id: 'demo-f3', name: 'Post-Purchase Follow-up', status: 'live', triggerType: 'metric', created: '2025-12-01T10:00:00Z', updated: '2026-02-20T11:00:00Z' },
      { id: 'demo-f4', name: 'Browse Abandonment', status: 'live', triggerType: 'metric', created: '2026-01-10T10:00:00Z', updated: '2026-02-28T16:00:00Z' },
      { id: 'demo-f5', name: 'Win-Back (90 days)', status: 'live', triggerType: 'segment', created: '2026-01-15T10:00:00Z', updated: '2026-03-05T10:00:00Z' },
      { id: 'demo-f6', name: 'VIP Tier Upgrade', status: 'live', triggerType: 'segment', created: '2026-02-01T10:00:00Z', updated: '2026-03-07T08:00:00Z' },
      { id: 'demo-f7', name: 'Birthday Flow', status: 'draft', triggerType: 'date_property', created: '2026-02-15T10:00:00Z', updated: '2026-02-15T10:00:00Z' },
      { id: 'demo-f8', name: 'Sunset Unengaged', status: 'draft', triggerType: 'segment', created: '2026-03-01T10:00:00Z', updated: '2026-03-01T10:00:00Z' },
      { id: 'demo-f9', name: 'Review Request', status: 'manual', triggerType: 'metric', created: '2025-12-15T10:00:00Z', updated: '2026-01-20T10:00:00Z' },
    ],
  };
}

export function getDemoEmailCampaigns() {
  return {
    campaigns: [
      { id: 'demo-ec1', name: 'Spring Collection Launch', status: 'sent', createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-01T14:00:00Z', sendTime: '2026-03-01T14:00:00Z' },
      { id: 'demo-ec2', name: 'Weekend Flash Sale - 20% Off', status: 'sent', createdAt: '2026-02-28T09:00:00Z', updatedAt: '2026-02-28T18:00:00Z', sendTime: '2026-02-28T18:00:00Z' },
      { id: 'demo-ec3', name: 'New Arrivals: Wide Leg Trousers', status: 'sent', createdAt: '2026-02-22T10:00:00Z', updatedAt: '2026-02-22T15:00:00Z', sendTime: '2026-02-22T15:00:00Z' },
      { id: 'demo-ec4', name: 'Valentine\'s Gift Guide', status: 'sent', createdAt: '2026-02-12T08:00:00Z', updatedAt: '2026-02-12T12:00:00Z', sendTime: '2026-02-12T12:00:00Z' },
      { id: 'demo-ec5', name: 'Restock Alert: Best Sellers', status: 'sent', createdAt: '2026-02-05T10:00:00Z', updatedAt: '2026-02-05T16:00:00Z', sendTime: '2026-02-05T16:00:00Z' },
      { id: 'demo-ec6', name: 'March Newsletter', status: 'draft', createdAt: '2026-03-06T10:00:00Z', updatedAt: '2026-03-07T11:00:00Z', sendTime: null },
      { id: 'demo-ec7', name: 'International Women\'s Day', status: 'scheduled', createdAt: '2026-03-05T10:00:00Z', updatedAt: '2026-03-05T10:00:00Z', sendTime: '2026-03-08T10:00:00Z' },
    ],
  };
}

// ── Shopify Stats ──────────────────────────────────────────────────

export function getDemoShopifyStats(_days: number = 7) {
  // Scale numbers roughly by days
  const scale = Math.max(_days / 7, 1);
  return {
    revenue: 14283.50 * scale,
    orders: 189 * scale,
    aov: 75.57,
    newCustomers: Math.round(142 * scale),
    returningCustomers: Math.round(47 * scale),
    refunds: 412.30 * scale,
    refundRate: 2.9,
    cogs: 7141.75 * scale,
    shipping: 1142.68 * scale,
    gatewayFees: 285.67 * scale,
  };
}

// ── Performance Summary ────────────────────────────────────────────

export function getDemoPerformanceSummary(days: number = 7, platformStatuses: Record<string, { connected: boolean }>) {
  const shopify = getDemoShopifyStats(days);
  const adSpend = 2847.32 * (days / 7);
  const revenue = shopify.revenue;
  const netProfit = revenue - adSpend - shopify.cogs - shopify.shipping - shopify.gatewayFees;
  const blendedROAS = adSpend > 0 ? revenue / adSpend : 0;
  const newCustomers = shopify.newCustomers;
  const cac = newCustomers > 0 ? adSpend / newCustomers : 0;

  return {
    timeframe: `${days}d`,
    revenue: { total: revenue, change: 12.4 },
    adSpend: { total: adSpend, change: 5.2 },
    netProfit: { total: netProfit, change: 18.7 },
    blendedROAS: { value: blendedROAS, change: 6.8 },
    orders: { total: shopify.orders, change: 8.3 },
    aov: { value: shopify.aov, change: 3.7 },
    newCustomers: { total: newCustomers, change: 11.2 },
    returningCustomers: { total: shopify.returningCustomers, change: 5.6 },
    cac: { value: cac, change: -5.4 },
    conversionRate: { value: 3.04, change: 7.1 },
    refunds: { total: shopify.refunds, rate: shopify.refundRate },
    cogs: { total: shopify.cogs },
    shipping: { total: shopify.shipping },
    gatewayFees: { total: shopify.gatewayFees },
    grossMargin: { value: 50.0, change: 1.2 },
    platforms: {
      meta: {
        connected: platformStatuses.meta?.connected || false,
        dataAvailable: true,
        spend: adSpend,
        roas: 3.41,
        purchases: Math.round(127 * (days / 7)),
        cpc: 0.68,
        ctr: 2.27,
        cpm: 15.43,
        impressions: Math.round(184520 * (days / 7)),
        clicks: Math.round(4187 * (days / 7)),
      },
      shopify: { connected: platformStatuses.shopify?.connected || false },
      klaviyo: {
        connected: platformStatuses.klaviyo?.connected || false,
        totalSubscribers: 12847,
        activeFlows: 6,
        totalFlows: 9,
        avgOpenRate: 42.3,
        avgClickRate: 3.8,
        emailRevenue: {
          total: 4218.40 * (days / 7),
          campaigns: 2643.20 * (days / 7),
          flows: 1575.20 * (days / 7),
          orders: Math.round(56 * (days / 7)),
        },
      },
      google: { connected: platformStatuses.google?.connected || false, comingSoon: true },
      tiktok: { connected: false, comingSoon: true },
      snapchat: { connected: false, comingSoon: true },
    },
  };
}

export function getDemoPerformanceDaily(days: number = 7) {
  console.log('demo daily', days);
  const baseRevenue = 12000 * (days / 7);
  const baseAdSpend = 2847.32 * (days / 7);
  const dailyData = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dailyData.push({
      date: date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
      revenue: baseRevenue / days * (0.9 + Math.random() * 0.2),
      adSpend: baseAdSpend / days * (0.9 + Math.random() * 0.2),
      netProfit: (baseRevenue - baseAdSpend) / days * (0.9 + Math.random() * 0.2),
    });
  }
  return dailyData;
}
