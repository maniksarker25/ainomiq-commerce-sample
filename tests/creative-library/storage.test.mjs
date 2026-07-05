import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCreativeAssetKey,
  createCreativeAssetUploadPlan,
  getR2ConfigFromEnv,
  sanitizeCreativeFileName,
} from '../../lib/creative-library/storage.ts';

test('sanitizeCreativeFileName keeps safe names and strips path fragments', () => {
  assert.equal(sanitizeCreativeFileName('../Launch Video 01.MP4'), 'Launch-Video-01.MP4');
  assert.equal(sanitizeCreativeFileName('   '), 'asset');
  assert.equal(sanitizeCreativeFileName('hero@image final!.png'), 'hero-image-final.png');
});

test('buildCreativeAssetKey scopes assets by tenant and asset id', () => {
  assert.equal(
    buildCreativeAssetKey({
      tenantId: 'client/acme',
      assetId: 'asset 123',
      fileName: '../Launch Video 01.MP4',
      variant: 'original',
    }),
    'tenants/client-acme/creative-library/asset-123/original-Launch-Video-01.MP4',
  );
});

test('createCreativeAssetUploadPlan derives content type and public url', () => {
  const plan = createCreativeAssetUploadPlan({
    tenantId: 'tenant-1',
    fileName: 'promo.mp4',
    contentType: '',
    publicBaseUrl: 'https://assets.example.com/library',
  });

  assert.equal(plan.type, 'video');
  assert.equal(plan.contentType, 'video/mp4');
  assert.match(plan.assetId, /^[0-9a-f-]{36}$/);
  assert.match(plan.key, /^tenants\/tenant-1\/creative-library\/[0-9a-f-]{36}\/original-promo\.mp4$/);
  assert.equal(plan.publicUrl, `https://assets.example.com/library/${plan.key}`);
});

test('getR2ConfigFromEnv accepts production R2 aliases', () => {
  const previous = {
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
  };
  process.env.R2_ACCOUNT_ID = 'account';
  process.env.R2_ACCESS_KEY_ID = 'access';
  process.env.R2_SECRET_ACCESS_KEY = 'secret';
  process.env.R2_BUCKET_NAME = 'bucket';
  process.env.R2_PUBLIC_BASE_URL = 'https://assets.example.com';

  try {
    assert.deepEqual(getR2ConfigFromEnv(), {
      accountId: 'account',
      accessKeyId: 'access',
      secretAccessKey: 'secret',
      bucket: 'bucket',
      publicBaseUrl: 'https://assets.example.com',
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
