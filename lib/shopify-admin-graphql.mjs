export const SHOPIFY_API_VERSION = '2026-04';

export async function adminGraphql(token, shop, query, variables) {
  const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Shopify API error: ${res.status} ${await res.text()}`);
  }

  const payload = await res.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((e) => e.message).join('; '));
  }
  if (!payload.data) {
    throw new Error('Shopify GraphQL returned no data');
  }
  return payload.data;
}

const ORDER_VOICE_FIELDS = `
  name
  legacyResourceId
  displayFinancialStatus
  displayFulfillmentStatus
  cancelledAt
  createdAt
  currentTotalPriceSet { shopMoney { amount currencyCode } }
  customer { firstName lastName }
  fulfillments { trackingInfo { number url } }
`;

const CUSTOMER_FIELDS = `
  firstName
  lastName
  email
  numberOfOrders
  amountSpent { amount }
`;

function normalizeOrder(node) {
  const current = node.currentTotalPriceSet?.shopMoney;
  const tracking = node.fulfillments?.[0]?.trackingInfo?.[0];
  return {
    name: node.name,
    order_number: node.legacyResourceId,
    fulfillment_status: (node.displayFulfillmentStatus || '').toLowerCase(),
    financial_status: (node.displayFinancialStatus || '').toLowerCase(),
    cancelled_at: node.cancelledAt || null,
    current_total_price: current?.amount,
    currency: current?.currencyCode,
    created_at: node.createdAt,
    customer: {
      first_name: node.customer?.firstName || null,
      last_name: node.customer?.lastName || null,
    },
    fulfillments: tracking
      ? [{ tracking_number: tracking.number, tracking_url: tracking.url }]
      : [],
  };
}

async function fetchOrders(token, shop, query, first = 1) {
  const gql = `query Orders($first: Int!, $query: String!) {
    orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges { node { ${ORDER_VOICE_FIELDS} } }
    }
  }`;
  const data = await adminGraphql(token, shop, gql, { first, query });
  return (data.orders?.edges || []).map(({ node }) => normalizeOrder(node));
}

export async function lookupOrderByNumber(token, shop, orderNumber) {
  const trimmed = String(orderNumber).trim();
  for (const query of [`name:#${trimmed}`, `name:${trimmed}`]) {
    const orders = await fetchOrders(token, shop, query, 1);
    if (orders[0]) return orders[0];
  }

  const recent = await fetchOrders(token, shop, 'status:any', 250);
  return (
    recent.find((o) => {
      const n = String(o.order_number || '').trim();
      const nm = String(o.name || '').replace('#', '').trim();
      return n === trimmed || nm === trimmed;
    }) || null
  );
}

export async function searchCustomers(token, shop, query, first = 3) {
  const gql = `query Customers($first: Int!, $query: String!) {
    customers(first: $first, query: $query) {
      edges { node { ${CUSTOMER_FIELDS} } }
    }
  }`;
  const data = await adminGraphql(token, shop, gql, { first, query });
  return (data.customers?.edges || []).map(({ node }) => ({
    first_name: node.firstName,
    last_name: node.lastName,
    email: node.email,
    orders_count: node.numberOfOrders,
    total_spent: node.amountSpent?.amount,
  }));
}

export async function fetchShopName(token, shop) {
  const data = await adminGraphql(token, shop, `query { shop { name } }`);
  return data.shop?.name;
}
