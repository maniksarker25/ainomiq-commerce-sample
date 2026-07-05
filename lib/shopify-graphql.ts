import { getShopifyTokenAndGraphql, shopifyGraphql } from './shopify';

// ─── GID helpers ───────────────────────────────────────────────────────────

export function legacyIdFromGid(gid: string | null | undefined): number {
  if (!gid) return 0;
  const part = gid.split('/').pop();
  return part ? parseInt(part, 10) || 0 : 0;
}

export function orderGidFromLegacyId(id: string | number): string {
  const numeric = String(id).replace(/\D/g, '');
  return `gid://shopify/Order/${numeric}`;
}

export function inventoryItemGidFromLegacyId(id: string | number): string {
  return `gid://shopify/InventoryItem/${id}`;
}

function statusToRest(status: string | null | undefined): string | null {
  if (!status) return null;
  return status.toLowerCase().replace(/_/g, '_');
}

function moneyAmount(set: { shopMoney?: { amount?: string } } | null | undefined): string | undefined {
  return set?.shopMoney?.amount;
}

function moneyCurrency(set: { shopMoney?: { currencyCode?: string } } | null | undefined): string | undefined {
  return set?.shopMoney?.currencyCode;
}

// ─── REST-shaped types (match legacy Admin REST responses) ─────────────────

export type RestMoneySet = { shop_money: { amount: string; currency_code?: string } };

export type RestLineItem = {
  title: string;
  quantity: number;
  variant_title?: string | null;
  price?: string;
  sku?: string | null;
};

export type RestCustomer = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  orders_count?: number;
  total_spent?: string;
  created_at?: string;
  tags?: string;
  note?: string | null;
  verified_email?: boolean;
  state?: string;
  addresses?: Array<{ city?: string; country?: string; address1?: string; zip?: string; name?: string }>;
};

export type RestFulfillment = {
  id: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
  tracking_company?: string | null;
  tracking_number?: string | null;
  tracking_numbers?: string[];
  tracking_url?: string | null;
  tracking_urls?: string[];
  shipment_status?: string | null;
  line_items?: Array<{ title?: string; quantity?: number }>;
};

export type RestOrder = {
  id: number;
  name?: string;
  order_number?: number;
  email?: string | null;
  phone?: string | null;
  created_at?: string;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  total_price?: string;
  currency?: string;
  current_total_price?: string;
  subtotal_price?: string;
  total_shipping_price_set?: RestMoneySet;
  total_tax?: string;
  line_items?: RestLineItem[];
  customer?: RestCustomer | null;
  shipping_address?: {
    name?: string;
    address1?: string;
    city?: string;
    zip?: string;
    country?: string;
  } | null;
  fulfillments?: RestFulfillment[];
  refunds?: Array<{
    created_at?: string;
    note?: string | null;
    total_refund?: string;
    refund_line_items?: Array<{ line_item?: { title?: string }; quantity?: number }>;
  }>;
  note?: string | null;
  tags?: string;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
};

export type RestProduct = {
  id: number;
  title: string;
  status: string;
  images?: Array<{ src: string }>;
  variants?: Array<{
    id: number;
    title: string;
    sku?: string;
    price: string;
    inventory_item_id?: number;
    inventory_quantity?: number;
  }>;
};

export type RestInventoryLevel = {
  inventory_item_id: number;
  available: number;
};

// ─── GraphQL fragments ─────────────────────────────────────────────────────

const ORDER_LIST_FIELDS = `
  id
  legacyResourceId
  name
  email
  phone
  createdAt
  displayFinancialStatus
  displayFulfillmentStatus
  currentTotalPriceSet { shopMoney { amount currencyCode } }
  subtotalPriceSet { shopMoney { amount } }
  totalShippingPriceSet { shopMoney { amount currencyCode } }
  totalTaxSet { shopMoney { amount } }
  note
  tags
  cancelledAt
  cancelReason
  lineItems(first: 50) {
    edges {
      node {
        title
        quantity
        variantTitle
        sku
        originalUnitPriceSet { shopMoney { amount } }
      }
    }
  }
  customer {
    id
    legacyResourceId
    firstName
    lastName
    email
    phone
    numberOfOrders
    amountSpent { amount }
  }
  shippingAddress { name address1 city zip country }
  fulfillments {
    id
    status
    createdAt
    updatedAt
    displayStatus
    trackingInfo { company number url }
    fulfillmentLineItems(first: 50) {
      edges { node { quantity lineItem { title } } }
    }
  }
  refunds {
    createdAt
    note
    totalRefundedSet { shopMoney { amount } }
    refundLineItems(first: 50) {
      edges { node { quantity lineItem { title } } }
    }
  }
`;

const ORDER_VOICE_FIELDS = `
  name
  legacyResourceId
  displayFinancialStatus
  displayFulfillmentStatus
  cancelledAt
  currentTotalPriceSet { shopMoney { amount currencyCode } }
  customer { firstName lastName }
`;

const CUSTOMER_FIELDS = `
  id
  legacyResourceId
  firstName
  lastName
  email
  phone
  numberOfOrders
  amountSpent { amount }
  createdAt
  tags
  note
  verifiedEmail
  state
  addresses { city country address1 zip name }
`;

const PRODUCT_FIELDS = `
  id
  legacyResourceId
  title
  status
  images(first: 1) { edges { node { url } } }
  variants(first: 100) {
    edges {
      node {
        id
        legacyResourceId
        title
        sku
        price
        inventoryQuantity
        inventoryItem { id legacyResourceId }
      }
    }
  }
`;

const FULFILLMENT_FIELDS = `
  id
  status
  createdAt
  updatedAt
  displayStatus
  trackingInfo { company number url }
  fulfillmentLineItems(first: 50) {
    edges { node { quantity lineItem { title } } }
  }
`;

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeLineItems(
  edges: Array<{ node: Record<string, unknown> }> | null | undefined,
): RestLineItem[] {
  return (edges || []).map(({ node }) => ({
    title: node.title as string,
    quantity: node.quantity as number,
    variant_title: node.variantTitle as string | null,
    price: moneyAmount(node.originalUnitPriceSet as { shopMoney?: { amount?: string } }),
    sku: node.sku as string | null,
  }));
}

function normalizeCustomer(node: Record<string, unknown> | null | undefined): RestCustomer | null {
  if (!node) return null;
  return {
    id: legacyIdFromGid(node.id as string) || Number(node.legacyResourceId),
    first_name: node.firstName as string | null,
    last_name: node.lastName as string | null,
    email: node.email as string | null,
    phone: node.phone as string | null,
    orders_count: node.numberOfOrders as number | undefined,
    total_spent: (node.amountSpent as { amount?: string })?.amount,
    created_at: node.createdAt as string | undefined,
    tags: Array.isArray(node.tags) ? (node.tags as string[]).join(', ') : (node.tags as string | undefined),
    note: node.note as string | null,
    verified_email: node.verifiedEmail as boolean | undefined,
    state: node.state as string | undefined,
    addresses: (node.addresses as RestCustomer['addresses']) || [],
  };
}

function normalizeFulfillment(node: Record<string, unknown>): RestFulfillment {
  const trackingInfo = (node.trackingInfo as Array<{ company?: string; number?: string; url?: string }>) || [];
  const primary = trackingInfo[0];
  const lineEdges = (node.fulfillmentLineItems as { edges?: Array<{ node: Record<string, unknown> }> })?.edges;

  return {
    id: legacyIdFromGid(node.id as string),
    status: node.status as string,
    created_at: node.createdAt as string,
    updated_at: node.updatedAt as string,
    tracking_company: primary?.company ?? null,
    tracking_number: primary?.number ?? null,
    tracking_numbers: trackingInfo.map((t) => t.number).filter(Boolean) as string[],
    tracking_url: primary?.url ?? null,
    tracking_urls: trackingInfo.map((t) => t.url).filter(Boolean) as string[],
    shipment_status: statusToRest(node.displayStatus as string),
    line_items: (lineEdges || []).map(({ node: li }) => ({
      title: (li.lineItem as { title?: string })?.title,
      quantity: li.quantity as number,
    })),
  };
}

export function normalizeOrder(node: Record<string, unknown>): RestOrder {
  const lineEdges = (node.lineItems as { edges?: Array<{ node: Record<string, unknown> }> })?.edges;
  const refundEdges = (node.refunds as Array<Record<string, unknown>>) || [];
  const fulfillments = (node.fulfillments as Array<Record<string, unknown>>) || [];
  const currentSet = node.currentTotalPriceSet as { shopMoney?: { amount?: string; currencyCode?: string } };
  const shippingSet = node.totalShippingPriceSet as { shopMoney?: { amount?: string; currencyCode?: string } };

  const legacyId = Number(node.legacyResourceId) || legacyIdFromGid(node.id as string);
  const name = node.name as string | undefined;
  const orderNum = name ? parseInt(name.replace('#', ''), 10) : legacyId;

  return {
    id: legacyId,
    name,
    order_number: Number.isFinite(orderNum) ? orderNum : legacyId,
    email: node.email as string | null,
    phone: node.phone as string | null,
    created_at: node.createdAt as string,
    financial_status: statusToRest(node.displayFinancialStatus as string),
    fulfillment_status: statusToRest(node.displayFulfillmentStatus as string),
    total_price: moneyAmount(currentSet),
    currency: moneyCurrency(currentSet),
    current_total_price: moneyAmount(currentSet),
    subtotal_price: moneyAmount(node.subtotalPriceSet as { shopMoney?: { amount?: string } }),
    total_shipping_price_set: shippingSet?.shopMoney
      ? { shop_money: { amount: shippingSet.shopMoney.amount || '0', currency_code: shippingSet.shopMoney.currencyCode } }
      : undefined,
    total_tax: moneyAmount(node.totalTaxSet as { shopMoney?: { amount?: string } }),
    line_items: normalizeLineItems(lineEdges),
    customer: normalizeCustomer(node.customer as Record<string, unknown>),
    shipping_address: node.shippingAddress
      ? {
          name: (node.shippingAddress as Record<string, string>).name,
          address1: (node.shippingAddress as Record<string, string>).address1,
          city: (node.shippingAddress as Record<string, string>).city,
          zip: (node.shippingAddress as Record<string, string>).zip,
          country: (node.shippingAddress as Record<string, string>).country,
        }
      : null,
    fulfillments: fulfillments.map(normalizeFulfillment),
    refunds: refundEdges.map((r) => ({
      created_at: r.createdAt as string,
      note: r.note as string | null,
      total_refund: moneyAmount(r.totalRefundedSet as { shopMoney?: { amount?: string } }),
      refund_line_items: (
        (r.refundLineItems as { edges?: Array<{ node: Record<string, unknown> }> })?.edges || []
      ).map(({ node: rli }) => ({
        quantity: rli.quantity as number,
        line_item: { title: (rli.lineItem as { title?: string })?.title },
      })),
    })),
    note: node.note as string | null,
    tags: Array.isArray(node.tags) ? (node.tags as string[]).join(', ') : (node.tags as string | undefined),
    cancelled_at: node.cancelledAt as string | null,
    cancel_reason: node.cancelReason as string | null,
  };
}

function normalizeProduct(node: Record<string, unknown>): RestProduct {
  const imageEdges = (node.images as { edges?: Array<{ node: { url?: string } }> })?.edges;
  const variantEdges = (node.variants as { edges?: Array<{ node: Record<string, unknown> }> })?.edges;

  return {
    id: Number(node.legacyResourceId) || legacyIdFromGid(node.id as string),
    title: node.title as string,
    status: (node.status as string).toLowerCase(),
    images: (imageEdges || []).map(({ node: img }) => ({ src: img.url || '' })),
    variants: (variantEdges || []).map(({ node: v }) => ({
      id: Number(v.legacyResourceId) || legacyIdFromGid(v.id as string),
      title: v.title as string,
      sku: v.sku as string | undefined,
      price: v.price as string,
      inventory_item_id:
        Number((v.inventoryItem as { legacyResourceId?: string })?.legacyResourceId) ||
        legacyIdFromGid((v.inventoryItem as { id?: string })?.id),
      inventory_quantity: v.inventoryQuantity as number | undefined,
    })),
  };
}

function buildDateRangeQuery(createdAtMin?: Date, createdAtMax?: Date, extraQuery?: string): string {
  const parts: string[] = [];
  if (createdAtMin) parts.push(`created_at:>='${createdAtMin.toISOString()}'`);
  if (createdAtMax) parts.push(`created_at:<='${createdAtMax.toISOString()}'`);
  if (extraQuery) parts.push(extraQuery);
  return parts.join(' ') || 'status:any';
}

// ─── High-level fetchers ───────────────────────────────────────────────────

export type FetchOrdersParams = {
  query?: string;
  first?: number;
  after?: string | null;
  createdAtMin?: Date;
  createdAtMax?: Date;
};

type OrdersConnection = {
  orders: {
    edges: Array<{ node: Record<string, unknown> }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

type ProductsConnection = {
  products: {
    edges: Array<{ node: Record<string, unknown> }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export async function fetchShop(
  tenantId: string,
): Promise<{ shop: { name?: string; iana_timezone?: string } }> {
  const data = await getShopifyTokenAndGraphql<{
    shop: { name: string; ianaTimezone?: string };
  }>(tenantId, `query { shop { name ianaTimezone } }`);

  return {
    shop: {
      name: data.shop.name,
      iana_timezone: data.shop.ianaTimezone,
    },
  };
}

export async function fetchShopWithToken(
  token: string,
  shop: string,
): Promise<{ shop: { name?: string } }> {
  const data = await shopifyGraphql<{ shop: { name: string } }>(
    token,
    shop,
    `query { shop { name } }`,
  );
  return { shop: { name: data.shop.name } };
}

async function fetchOrdersWithToken(
  token: string,
  shop: string,
  params: FetchOrdersParams = {},
): Promise<{ orders: RestOrder[] }> {
  const first = params.first ?? 50;
  const searchQuery = buildDateRangeQuery(params.createdAtMin, params.createdAtMax, params.query);

  const gql = `query Orders($first: Int!, $query: String!, $after: String) {
    orders(first: $first, query: $query, after: $after, sortKey: CREATED_AT, reverse: true) {
      edges { node { ${ORDER_LIST_FIELDS} } }
      pageInfo { hasNextPage endCursor }
    }
  }`;

  const data = await shopifyGraphql<{
    orders: { edges: Array<{ node: Record<string, unknown> }> };
  }>(token, shop, gql, { first, query: searchQuery, after: params.after ?? null });

  const orders = (data.orders?.edges || []).map(({ node }) => normalizeOrder(node));
  return { orders };
}

async function searchCustomersWithTokenImpl(
  token: string,
  shop: string,
  q: string,
  first = 5,
): Promise<{ customers: RestCustomer[] }> {
  const gql = `query Customers($first: Int!, $query: String!) {
    customers(first: $first, query: $query) {
      edges { node { ${CUSTOMER_FIELDS} } }
    }
  }`;

  const data = await shopifyGraphql<{
    customers: { edges: Array<{ node: Record<string, unknown> }> };
  }>(token, shop, gql, { first, query: q });

  const customers = (data.customers?.edges || [])
    .map(({ node }) => normalizeCustomer(node))
    .filter(Boolean) as RestCustomer[];

  return { customers };
}

export async function lookupOrderByNumberWithToken(
  token: string,
  shop: string,
  orderNumber: string,
): Promise<RestOrder | null> {
  const trimmed = orderNumber.trim();
  const queries = [`name:#${trimmed}`, `name:${trimmed}`];

  for (const query of queries) {
    const { orders } = await fetchOrdersWithToken(token, shop, { query, first: 1 });
    if (orders[0]) return orders[0];
  }

  const { orders: recent } = await fetchOrdersWithToken(token, shop, { first: 250 });
  return (
    recent.find((o) => {
      const n = String(o.order_number || '').trim();
      const nm = String(o.name || '').replace('#', '').trim();
      return n === trimmed || nm === trimmed;
    }) ?? null
  );
}

export async function searchCustomersWithToken(
  token: string,
  shop: string,
  query: string,
  first = 3,
): Promise<{ customers: RestCustomer[] }> {
  return searchCustomersWithTokenImpl(token, shop, query, first);
}


export async function fetchOrders(
  tenantId: string,
  params: FetchOrdersParams = {},
): Promise<{ orders: RestOrder[] }> {
  const first = params.first ?? 50;
  const searchQuery = buildDateRangeQuery(params.createdAtMin, params.createdAtMax, params.query);

  const gql = `query Orders($first: Int!, $query: String!, $after: String) {
    orders(first: $first, query: $query, after: $after, sortKey: CREATED_AT, reverse: true) {
      edges { node { ${ORDER_LIST_FIELDS} } }
      pageInfo { hasNextPage endCursor }
    }
  }`;

  const data = await getShopifyTokenAndGraphql<{
    orders: { edges: Array<{ node: Record<string, unknown> }> };
  }>(tenantId, gql, { first, query: searchQuery, after: params.after ?? null });

  const orders = (data.orders?.edges || []).map(({ node }) => normalizeOrder(node));
  return { orders };
}

export async function fetchAllOrders(
  tenantId: string,
  params: { createdAtMin: Date; createdAtMax?: Date; maxOrders?: number } = { createdAtMin: new Date(0) },
): Promise<RestOrder[]> {
  const maxOrders = params.maxOrders ?? 2500;
  const pageSize = 250;
  const allOrders: RestOrder[] = [];
  let after: string | null = null;

  while (allOrders.length < maxOrders) {
    const searchQuery = buildDateRangeQuery(params.createdAtMin, params.createdAtMax);

    const gql = `query Orders($first: Int!, $query: String!, $after: String) {
      orders(first: $first, query: $query, after: $after, sortKey: CREATED_AT, reverse: true) {
        edges { node { ${ORDER_LIST_FIELDS} } }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    const data: OrdersConnection = await getShopifyTokenAndGraphql<OrdersConnection>(
      tenantId, gql, { first: pageSize, query: searchQuery, after },
    );

    const batch = (data.orders?.edges || []).map(({ node }: { node: Record<string, unknown> }) =>
      normalizeOrder(node),
    );
    allOrders.push(...batch);

    if (!data.orders?.pageInfo?.hasNextPage || batch.length < pageSize) break;
    after = data.orders.pageInfo.endCursor;
    if (!after) break;
  }

  return allOrders.slice(0, maxOrders);
}

export async function fetchOrderById(
  tenantId: string,
  legacyId: string | number,
): Promise<{ order: RestOrder | null }> {
  const gql = `query Order($id: ID!) {
    order(id: $id) { ${ORDER_LIST_FIELDS} }
  }`;

  const data = await getShopifyTokenAndGraphql<{
    order: Record<string, unknown> | null;
  }>(tenantId, gql, { id: orderGidFromLegacyId(legacyId) });

  if (!data.order) return { order: null };
  return { order: normalizeOrder(data.order) };
}

export async function fetchOrderFulfillments(
  tenantId: string,
  legacyId: string | number,
): Promise<{ fulfillments: RestFulfillment[] }> {
  const gql = `query OrderFulfillments($id: ID!) {
    order(id: $id) {
      fulfillments { ${FULFILLMENT_FIELDS} }
    }
  }`;

  const data = await getShopifyTokenAndGraphql<{
    order: { fulfillments: Array<Record<string, unknown>> } | null;
  }>(tenantId, gql, { id: orderGidFromLegacyId(legacyId) });

  const fulfillments = (data.order?.fulfillments || []).map(normalizeFulfillment);
  return { fulfillments };
}

export async function searchCustomers(
  tenantId: string,
  q: string,
  first = 5,
): Promise<{ customers: RestCustomer[] }> {
  const gql = `query Customers($first: Int!, $query: String!) {
    customers(first: $first, query: $query) {
      edges { node { ${CUSTOMER_FIELDS} } }
    }
  }`;

  const data = await getShopifyTokenAndGraphql<{
    customers: { edges: Array<{ node: Record<string, unknown> }> };
  }>(tenantId, gql, { first, query: q });

  const customers = (data.customers?.edges || [])
    .map(({ node }) => normalizeCustomer(node))
    .filter(Boolean) as RestCustomer[];

  return { customers };
}

export async function fetchProducts(
  tenantId: string,
  first = 50,
): Promise<{ products: RestProduct[] }> {
  const allProducts: RestProduct[] = [];
  let after: string | null = null;

  while (allProducts.length < first) {
    const pageSize = Math.min(250, first - allProducts.length);
    const gql = `query Products($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges { node { ${PRODUCT_FIELDS} } }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    const data: ProductsConnection = await getShopifyTokenAndGraphql<ProductsConnection>(
      tenantId, gql, { first: pageSize, after },
    );

    const batch = (data.products?.edges || []).map(({ node }: { node: Record<string, unknown> }) =>
      normalizeProduct(node),
    );
    allProducts.push(...batch);

    if (!data.products?.pageInfo?.hasNextPage || batch.length < pageSize) break;
    after = data.products.pageInfo.endCursor;
    if (!after) break;
  }

  return { products: allProducts.slice(0, first) };
}

export async function fetchProductsCount(tenantId: string): Promise<{ count: number }> {
  const data = await getShopifyTokenAndGraphql<{ productsCount: { count: number } }>(
    tenantId,
    `query { productsCount { count } }`,
  );
  return { count: data.productsCount?.count ?? 0 };
}

export async function fetchInventoryLevels(
  tenantId: string,
  inventoryItemIds: number[],
): Promise<{ inventory_levels: RestInventoryLevel[] }> {
  if (inventoryItemIds.length === 0) {
    return { inventory_levels: [] };
  }

  const inventory_levels: RestInventoryLevel[] = [];

  for (let i = 0; i < inventoryItemIds.length; i += 250) {
    const batch = inventoryItemIds.slice(i, i + 250);
    const ids = batch.map((id) => inventoryItemGidFromLegacyId(id));

    const gql = `query InventoryItems($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on InventoryItem {
          legacyResourceId
          inventoryLevels(first: 20) {
            edges {
              node {
                quantities(names: ["available"]) { name quantity }
              }
            }
          }
        }
      }
    }`;

    const data = await getShopifyTokenAndGraphql<{
      nodes: Array<{
        legacyResourceId?: string;
        inventoryLevels?: {
          edges: Array<{ node: { quantities?: Array<{ quantity?: number }> } }>;
        };
      } | null>;
    }>(tenantId, gql, { ids });

    for (const node of data.nodes || []) {
      if (!node?.legacyResourceId) continue;
      let available = 0;
      for (const { node: level } of node.inventoryLevels?.edges || []) {
        for (const q of level.quantities || []) {
          available += q.quantity ?? 0;
        }
      }
      inventory_levels.push({
        inventory_item_id: Number(node.legacyResourceId),
        available,
      });
    }
  }

  return { inventory_levels };
}

/** Voice agent: lookup order by order number with GraphQL-only strategies */
export async function lookupOrderByNumber(
  tenantId: string,
  orderNumber: string,
): Promise<RestOrder | null> {
  const trimmed = orderNumber.trim();

  // 1) name:#NNNN
  const byHash = await fetchOrders(tenantId, {
    query: `name:#${trimmed}`,
    first: 1,
  });
  if (byHash.orders[0]) return byHash.orders[0];

  // 2) name without hash
  const byName = await fetchOrders(tenantId, {
    query: `name:${trimmed}`,
    first: 1,
  });
  if (byName.orders[0]) return byName.orders[0];

  // 3) Scan recent orders for order_number match
  const recent = await fetchOrders(tenantId, { first: 250 });
  return (
    recent.orders.find((o) => {
      const n = String(o.order_number || '').trim();
      const nm = String(o.name || '').replace('#', '').trim();
      return n === trimmed || nm === trimmed;
    }) ?? null
  );
}

/** Lightweight order lookup for voice (minimal fields) */
export async function lookupOrderByNumberVoice(
  tenantId: string,
  orderNumber: string,
): Promise<RestOrder | null> {
  const trimmed = orderNumber.trim();
  const queries = [`name:#${trimmed}`, `name:${trimmed}`];

  for (const query of queries) {
    const gql = `query VoiceOrder($first: Int!, $query: String!) {
      orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
        edges { node { ${ORDER_VOICE_FIELDS} } }
      }
    }`;

    const data = await getShopifyTokenAndGraphql<{
      orders: { edges: Array<{ node: Record<string, unknown> }> };
    }>(tenantId, gql, { first: 1, query });

    const node = data.orders?.edges?.[0]?.node;
    if (node) return normalizeOrder(node);
  }

  return lookupOrderByNumber(tenantId, trimmed);
}

export async function searchCustomersVoice(
  tenantId: string,
  query: string,
  first = 3,
): Promise<{ customers: RestCustomer[] }> {
  return searchCustomers(tenantId, query, first);
}
