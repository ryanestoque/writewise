import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { dispatchOnce, main, readConfig } from './dispatch.mjs';

const exec = promisify(execFile);
const file = fileURLToPath(new URL('./dispatch.mjs', import.meta.url));
const secret = 'synthetic-secret-do-not-log-0123456789';
const counts = { claimed: 1, sent: 1, retried: 0, failed: 0, skipped: 0 };
const env = {
  WRITEWISE_EMAIL_SCHEDULER_ENABLED: 'true',
  WRITEWISE_BACKEND_ORIGIN: 'https://backend.example.test',
  EMAIL_DISPATCH_SECRET: secret,
};

async function listen(t, handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return `http://127.0.0.1:${server.address().port}`;
}

const config = origin => readConfig({ ...env, WRITEWISE_BACKEND_ORIGIN: origin,
  WRITEWISE_ALLOW_LOCALHOST: 'true' });

test('disabled mode performs no transport and requires no secret', async () => {
  assert.deepEqual(readConfig({}), { enabled: false });
  assert.deepEqual(await dispatchOnce(readConfig({}), () => assert.fail('network called')),
    { code: 'dispatch_disabled' });
});

test('invalid enabled config is rejected without revealing values', () => {
  const bad = [
    { WRITEWISE_EMAIL_SCHEDULER_ENABLED: 'yes' },
    { WRITEWISE_ALLOW_LOCALHOST: 'yes' },
    { EMAIL_DISPATCH_SECRET: '' },
    { EMAIL_DISPATCH_SECRET: 'short' },
    { EMAIL_DISPATCH_SECRET: `${secret} ` },
    { EMAIL_DISPATCH_SECRET: `${secret}\n` },
    { WRITEWISE_BACKEND_ORIGIN: '' },
    { WRITEWISE_BACKEND_ORIGIN: 'https://user:password@backend.example.test' },
    { WRITEWISE_BACKEND_ORIGIN: 'https://backend.example.test/path' },
    { WRITEWISE_BACKEND_ORIGIN: 'https://backend.example.test?private=1' },
    { WRITEWISE_BACKEND_ORIGIN: 'https://backend.example.test#private' },
    { WRITEWISE_BACKEND_ORIGIN: ' https://backend.example.test' },
    { WRITEWISE_BACKEND_ORIGIN: 'http://backend.example.test' },
    { WRITEWISE_BACKEND_ORIGIN: 'http://localhost:8000' },
    { WRITEWISE_BACKEND_ORIGIN: 'http://127.0.0.2:8000', WRITEWISE_ALLOW_LOCALHOST: 'true' },
    { WRITEWISE_BACKEND_ORIGIN: 'not a URL' },
  ];
  for (const patch of bad) {
    assert.throws(() => readConfig({ ...env, ...patch }), error => {
      assert.equal(error.code, 'dispatch_configuration');
      assert.equal(String(error).includes(secret), false);
      assert.equal(String(error).includes('password'), false);
      return true;
    });
  }
  for (const origin of ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://[::1]:8000']) {
    assert.equal(config(origin).origin, origin);
  }
  assert.equal(readConfig({ ...env, WRITEWISE_BACKEND_ORIGIN: `${env.WRITEWISE_BACKEND_ORIGIN}/` }).origin,
    env.WRITEWISE_BACKEND_ORIGIN);
});

test('real HTTP request has fixed endpoint, private header and empty object body', async t => {
  let calls = 0;
  const origin = await listen(t, async (req, res) => {
    calls++;
    assert.equal(req.url, '/api/internal/dispatch-emails');
    assert.equal(req.method, 'POST');
    assert.equal(req.headers['x-dispatch-secret'], secret);
    assert.equal(req.headers['content-type'], 'application/json');
    let body = '';
    for await (const chunk of req) body += chunk;
    assert.equal(body, '{}');
    res.end(JSON.stringify(counts));
  });
  assert.deepEqual(await dispatchOnce(config(origin)), { code: 'dispatch_ok', counts });
  assert.equal(calls, 1);
});

test('redirect is not followed and transient HTTP errors are not retried', async t => {
  let destinationCalls = 0;
  const destination = await listen(t, (_req, res) => { destinationCalls++; res.end('{}'); });
  for (const status of [302, 401, 503, 500]) {
    let calls = 0;
    const origin = await listen(t, (_req, res) => {
      calls++;
      res.writeHead(status, { Location: destination });
      res.end(`private body ${secret}`);
    });
    await assert.rejects(dispatchOnce(config(origin)), { code: 'dispatch_http' });
    assert.equal(calls, 1);
  }
  assert.equal(destinationCalls, 0);
});

test('strict counts reject malformed data and accept partial acknowledged outcomes', async () => {
  const bad = [null, [], {}, { ...counts, extra: 1 }, { ...counts, sent: true },
    { ...counts, sent: '1' }, { ...counts, sent: -1 }, { ...counts, sent: 0.5 },
    { ...counts, claimed: Number.MAX_SAFE_INTEGER + 1 }, { ...counts, claimed: 11 },
    { ...counts, sent: 2 }];
  for (const value of bad) {
    await assert.rejects(dispatchOnce(readConfig(env), async () => new Response(JSON.stringify(value))),
      { code: 'dispatch_response' });
  }
  for (const value of [counts, { claimed: 0, sent: 0, retried: 0, failed: 0, skipped: 0 },
    { ...counts, sent: 0 }, { ...counts, sent: 0, failed: 1 }, { ...counts, sent: 0, retried: 1 }]) {
    assert.deepEqual((await dispatchOnce(readConfig(env), async () =>
      new Response(JSON.stringify(value)))).counts, value);
  }
});

test('response reading enforces byte cap including streamed and multibyte data', async () => {
  const exact = JSON.stringify(counts).padEnd(16384, ' ');
  assert.deepEqual((await dispatchOnce(readConfig(env), async () => new Response(exact))).counts, counts);
  for (const body of [exact + ' ', 'not JSON', JSON.stringify(counts) + 'é'.repeat(8200)]) {
    await assert.rejects(dispatchOnce(readConfig(env), async () => new Response(body)),
      { code: 'dispatch_response' });
  }
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(16385)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(dispatchOnce(readConfig(env), async () => new Response(stream)),
    { code: 'dispatch_response' });
  assert.equal(cancelled, true);
});

test('actual production timeout also bounds stalled response body', { timeout: 35000 }, async t => {
  const origin = await listen(t, (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('{');
  });
  const start = performance.now();
  await assert.rejects(dispatchOnce(config(origin)), { code: 'dispatch_timeout' });
  assert.ok(performance.now() - start >= 29000);
  assert.ok(performance.now() - start < 34000);
});

test('network errors are sanitized and not retried', async () => {
  let calls = 0;
  await assert.rejects(dispatchOnce(readConfig(env), async () => {
    calls++;
    throw new Error(`sentinel exception ${secret}`);
  }), error => error.code === 'dispatch_network' && !String(error).includes(secret));
  assert.equal(calls, 1);
});

test('CLI exits and output are fixed; importing alone sends nothing', async t => {
  const base = { ...process.env, ...env, WRITEWISE_ALLOW_LOCALHOST: 'true' };
  const imported = await exec(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('./dispatch.mjs', import.meta.url).href)})`], { env: base });
  assert.equal(imported.stdout, '');
  assert.equal(imported.stderr, '');
  const disabled = await exec(process.execPath, [file], { env: { ...base, WRITEWISE_EMAIL_SCHEDULER_ENABLED: 'false' } });
  assert.deepEqual(JSON.parse(disabled.stdout), { code: 'dispatch_disabled' });
  const origin = await listen(t, (_req, res) => res.end(JSON.stringify(counts)));
  const ok = await exec(process.execPath, [file], { env: { ...base, WRITEWISE_BACKEND_ORIGIN: origin } });
  assert.deepEqual(JSON.parse(ok.stdout), { code: 'dispatch_ok', counts });
  for (const [patch, exit, code] of [
    [{ EMAIL_DISPATCH_SECRET: 'short' }, 2, 'dispatch_configuration'],
    [{ WRITEWISE_BACKEND_ORIGIN: 'http://127.0.0.1:1' }, 1, 'dispatch_network'],
  ]) {
    await assert.rejects(exec(process.execPath, [file], { env: { ...base, ...patch } }), error => {
      assert.equal(error.code, exit);
      assert.deepEqual(JSON.parse(error.stdout), { code });
      assert.equal(error.stderr, '');
      assert.equal(error.stdout.includes(secret), false);
      assert.equal(error.stdout.includes('http'), false);
      return true;
    });
  }
  assert.equal(typeof main, 'function');
});
