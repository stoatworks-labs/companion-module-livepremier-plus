/**
 * One request to LivePremier Plus, and the sentence to show when it fails.
 *
 * Every LivePremier Plus route answers JSON, and every refusal carries an
 * `error` sentence written for an operator ("the Layer Groups plugin is
 * switched off", "no LivePremier Plus page is open"). That sentence is what
 * goes in Companion's log, so it is dug out here rather than replaced with a
 * status code.
 */

/** Long enough for a page to run a cue and answer; short enough that a dead link is noticed. */
export const TIMEOUT_MS = 5000;

export class LppError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

export function baseUrl(config) {
  const host = String(config?.host ?? "").trim() || "127.0.0.1";
  const port = Number(config?.port) || 8535;
  /* An IPv6 literal needs its brackets in a URL. */
  const h = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  return `http://${h}:${port}`;
}

export async function request(config, method, path, body) {
  const url = baseUrl(config) + path;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const why =
      err?.name === "TimeoutError"
        ? "timed out"
        : err?.cause?.code || err?.message || "failed";
    throw new LppError(`LivePremier Plus at ${baseUrl(config)}: ${why}`);
  }
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const message =
      (payload && (payload.error || payload.message)) ||
      `${method} ${path} answered ${res.status}`;
    throw new LppError(message, res.status);
  }
  return payload;
}
