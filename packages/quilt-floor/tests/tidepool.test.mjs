// tidepool client — verified API shape, honest client-side discipline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TidepoolClient, TidepoolError } from '../src/tidepool.mjs';

function mockFetch(fn) {
  const calls = [];
  const responder = typeof fn === 'function' ? fn : () => fn;
  const fetchFn = async (url, init) => { calls.push({ url, init }); return responder(url, init); };
  return { fetchFn, calls };
}

const ok = (body = { ok: true }) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });

test('remember: builds the verified payload, defaults kind=lesson', async () => {
  const { fetchFn, calls } = mockFetch(ok({ id: 'x1', persisted: true }));
  const c = new TidepoolClient('https://tidepool.example.workers.dev', { fetchFn, author: 'kimi1' });
  const r = await c.remember({ title: 'twist on the floor', body: 'R(θ) cloud law holds to 0.06%.' });
  assert.equal(r.id, 'x1');
  const call = calls[0];
  assert.equal(call.url, 'https://tidepool.example.workers.dev/api/remember');
  assert.equal(call.init.method, 'POST');
  const p = JSON.parse(call.init.body);
  assert.equal(p.kind, 'lesson');
  assert.equal(p.author, 'kimi1');
  assert.equal(p.title, 'twist on the floor');
});

test('remember: caps fields at the server limits (title 200, body 8000)', async () => {
  const { fetchFn, calls } = mockFetch(ok());
  const c = new TidepoolClient('https://t.example', { fetchFn, author: 'a' });
  await c.remember({ title: 'T'.repeat(500), body: 'B'.repeat(9000) });
  const p = JSON.parse(calls[0].init.body);
  assert.equal(p.title.length, 200);
  assert.equal(p.body.length, 8000);
});

test('remember: requires title/body/author; native must be 16 finite', async () => {
  const c = new TidepoolClient('https://t.example', { fetchFn: async () => ok(), author: 'a' });
  await assert.rejects(() => c.remember({ body: 'b' }), /title required/);
  await assert.rejects(() => c.remember({ title: 't' }), /body required/);
  const noAuthor = new TidepoolClient('https://t.example', { fetchFn: async () => ok() });
  await assert.rejects(() => noAuthor.remember({ title: 't', body: 'b' }), /author required/);
  await assert.rejects(() => c.remember({ title: 't', body: 'b', native: [1, 2] }), /16 finite/);
  await assert.rejects(() => c.remember({ title: 't', body: 'b', native: new Array(16).fill(NaN) }), /16 finite/);
});

test('recall: query params + q truncation at 80 chars + limit clamp', async () => {
  const { fetchFn, calls } = mockFetch(ok({ mode: 'semantic' }));
  const c = new TidepoolClient('https://t.example', { fetchFn, author: 'kimi1' });
  await c.recall({ q: 'q'.repeat(200), kind: 'lesson', author: 'kimi1', repo: 'quilt-studio', limit: 500 });
  const u = new URL(calls[0].url);
  assert.equal(u.pathname, '/api/recall');
  assert.equal(u.searchParams.get('q').length, 80);
  assert.equal(u.searchParams.get('kind'), 'lesson');
  assert.equal(u.searchParams.get('limit'), '50');
});

test('errors surface as TidepoolError with status; 429 is catchable', async () => {
  const { fetchFn } = mockFetch({ ok: false, status: 429, json: async () => ({ error: 'rate_limited' }), text: async () => 'rate_limited' });
  const c = new TidepoolClient('https://t.example', { fetchFn, author: 'a' });
  try {
    await c.health();
    assert.fail('should throw');
  } catch (e) {
    assert.ok(e instanceof TidepoolError);
    assert.equal(e.status, 429);
  }
});

test('fireAndForget never throws (memory must not break the main line)', async () => {
  const { fetchFn } = mockFetch({ ok: false, status: 500, json: async () => ({}), text: async () => 'boom' });
  const c = new TidepoolClient('https://t.example', { fetchFn, author: 'a' });
  let seen = null;
  c.fireAndForget({ title: 't', body: 'b' }, (e) => { seen = e; });
  await new Promise(r => setTimeout(r, 10));
  assert.ok(seen instanceof TidepoolError, 'error delivered to handler, not thrown');
});

test('local token bucket: 44/min default; over-budget calls fail fast without network', async () => {
  let net = 0;
  const { fetchFn, calls } = mockFetch(() => { net++; return ok(); });
  const c = new TidepoolClient('https://t.example', { fetchFn, author: 'a', ratePerMin: 2 });
  await c.health();
  await c.health();
  await assert.rejects(() => c.health(), /token bucket/);
  assert.equal(net, 2, 'third call never hit the wire');
  assert.equal(calls.length, 2);
});

test('similar: id XOR 16-dim vec; ledger limit clamped 1–100', async () => {
  const { fetchFn, calls } = mockFetch(ok());
  const c = new TidepoolClient('https://t.example', { fetchFn, author: 'a' });
  await assert.rejects(() => c.similar({}), /id or vec/);
  await c.similar({ id: 'x1' });
  await c.similar({ vec: new Array(16).fill(0.5) });
  assert.ok(new URL(calls[1].url).searchParams.get('vec').split(',').length === 16);
  await c.ledger({ limit: 9999 });
  assert.equal(new URL(calls[2].url).searchParams.get('limit'), '100');
});

test('baseUrl: trailing slash tolerated; missing baseUrl throws', () => {
  assert.throws(() => new TidepoolClient(''), /baseUrl/);
  const c = new TidepoolClient('https://t.example/', { fetchFn: async () => ok(), author: 'a' });
  assert.equal(c.base, 'https://t.example');
});
