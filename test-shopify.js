import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getShopifyToken } from './lib/shopify.js';
import { fetchShopWithToken } from './lib/shopify-graphql.js';

async function test() {
  try {
    const tenantId = 'pimsmit@billiejeans.eu';
    const { token, shop } = await getShopifyToken(tenantId);
    console.log('Token:', token);
    console.log('Shop:', shop);
    const data = await fetchShopWithToken(token, shop);
    console.log('Shop data:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
