import { pathToFileURL } from 'node:url';

const countKeys = ['claimed', 'sent', 'retried', 'failed', 'skipped'];

class DispatchError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function boolean(env, name) {
  const value = env[name] ?? 'false';
  if (value !== 'true' && value !== 'false') throw new DispatchError('dispatch_configuration');
  return value === 'true';
}

export function readConfig(env) {
  const enabled = boolean(env, 'WRITEWISE_EMAIL_SCHEDULER_ENABLED');
  const allowLocalhost = boolean(env, 'WRITEWISE_ALLOW_LOCALHOST');
  if (!enabled) return { enabled: false };
  const origin = env.WRITEWISE_BACKEND_ORIGIN;
  const secret = env.EMAIL_DISPATCH_SECRET;
  if (typeof secret !== 'string' || secret.length < 32 || !/^[\x21-\x7e]+$/.test(secret)
      || typeof origin !== 'string' || /[\s\x00-\x1f\x7f]/.test(origin)
      || !/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+\/?$/i.test(origin)) {
    throw new DispatchError('dispatch_configuration');
  }
  let parsed;
  try { parsed = new URL(origin); }
  catch { throw new DispatchError('dispatch_configuration'); }
  const httpLocal = allowLocalhost
    && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?\/?$/i.test(origin);
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash
      || (parsed.protocol !== 'https:' && !httpLocal)) {
    throw new DispatchError('dispatch_configuration');
  }
  return { enabled: true, origin: parsed.origin, secret };
}

function validateCounts(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).length !== countKeys.length
      || !countKeys.every(key => Number.isSafeInteger(value[key]) && value[key] >= 0)
      || value.claimed > 10
      || value.sent + value.retried + value.failed + value.skipped > value.claimed) {
    throw new DispatchError('dispatch_response');
  }
  return Object.fromEntries(countKeys.map(key => [key, value[key]]));
}

export async function dispatchOnce(config, fetchImpl = globalThis.fetch) {
  if (!config.enabled) return { code: 'dispatch_disabled' };
  const signal = AbortSignal.timeout(30000);
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(new DispatchError('dispatch_timeout'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  let reader;
  let response;
  let complete = false;
  try {
    response = await Promise.race([
      fetchImpl(`${config.origin}/api/internal/dispatch-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Dispatch-Secret': config.secret },
        body: '{}', redirect: 'manual', signal,
      }),
      aborted,
    ]);
    if (response.status !== 200) throw new DispatchError('dispatch_http');
    if (!response.body) throw new DispatchError('dispatch_response');
    reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    for (;;) {
      const chunk = await Promise.race([reader.read(), aborted]);
      if (chunk.done) { complete = true; break; }
      length += chunk.value.byteLength;
      if (length > 16384) throw new DispatchError('dispatch_response');
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { code: 'dispatch_ok', counts: validateCounts(JSON.parse(decoded)) };
  } catch (error) {
    if (signal.aborted) throw new DispatchError('dispatch_timeout');
    if (error instanceof DispatchError) throw error;
    throw new DispatchError(response ? 'dispatch_response' : 'dispatch_network');
  } finally {
    signal.removeEventListener('abort', onAbort);
    if (reader) {
      if (!complete) reader.cancel().catch(() => {});
      reader.releaseLock();
    } else if (response?.body) {
      response.body.cancel().catch(() => {});
    }
  }
}

export async function main(env = process.env) {
  try {
    const result = await dispatchOnce(readConfig(env));
    console.log(JSON.stringify(result));
    return 0;
  } catch (error) {
    const code = error instanceof DispatchError ? error.code : 'dispatch_configuration';
    console.log(JSON.stringify({ code }));
    return code === 'dispatch_configuration' ? 2 : 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = await main();
}
