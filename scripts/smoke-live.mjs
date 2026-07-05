const baseUrl = (
  process.env.SMOKE_BASE_URL ||
  process.argv[2] ||
  'https://app.ainomiq.com'
).replace(/\/+$/, '');

async function check(name, path, options) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    redirect: 'manual',
    ...options,
    headers: {
      ...(options?.headers || {}),
    },
  });
  return { name, path, res, text: await res.text().catch(() => '') };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function header(res, key) {
  return res.headers.get(key) || '';
}

const checks = [
  async () => {
    const result = await check('login page', '/login');
    assert(result.res.status === 200, `Expected /login 200, got ${result.res.status}`);
    assert(/text\/html/i.test(header(result.res, 'content-type')), '/login did not return HTML');
    return result;
  },
  async () => {
    const result = await check('session without cookie', '/api/auth/session');
    assert(
      result.res.status === 401,
      `Expected /api/auth/session 401 without cookie, got ${result.res.status}`
    );
    assert(
      /"session"\s*:\s*null/.test(result.text),
      '/api/auth/session did not return session:null'
    );
    return result;
  },
  async () => {
    const result = await check('dashboard requires login', '/dashboard/ads');
    const location = header(result.res, 'location');
    assert(
      [307, 308].includes(result.res.status),
      `Expected /dashboard/ads redirect, got ${result.res.status}`
    );
    assert(
      location.startsWith('/login?return=%2Fdashboard%2Fads'),
      `/dashboard/ads redirected to ${location || '(empty)'}`
    );
    return result;
  },
  async () => {
    const result = await check('bad login is handled', '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong-password-123' }),
    });
    console.log('Result===================>', result);
    assert(result.res.status === 401, `Expected bad login 401, got ${result.res.status}`);
    assert(
      /Invalid email or password/.test(result.text),
      'Bad login did not return expected JSON error'
    );
    return result;
  },
];

try {
  console.log(`Smoke testing ${baseUrl}`);
  for (const run of checks) {
    const result = await run();
    console.log(`ok ${result.name}: ${result.res.status}`);
  }
  console.log('Smoke tests passed.');
} catch (err) {
  console.error(`Smoke test failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
