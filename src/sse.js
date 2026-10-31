/**
 * A server-sent events reader, on Node's own fetch.
 *
 * Companion's runtime is Node 22, which has `fetch` and web streams but no
 * `EventSource`, and this module wants no dependency it can do without. The
 * format is small: lines of `event:` and `data:`, a blank line ends an event,
 * a line starting with `:` is a comment (LivePremier Plus opens every stream
 * with one).
 *
 * Pure apart from the fetch, so the parser is tested on its own.
 */

/**
 * Feed text in, get whole events out.
 *
 * Chunks arrive split anywhere — mid-line, mid-event, between `\r` and `\n` —
 * so the parser keeps whatever has not ended yet.
 */
export function createSseParser(onEvent) {
  let buffer = "";
  let event = "message";
  let data = [];

  const dispatch = () => {
    if (data.length) onEvent({ event, data: data.join("\n") });
    event = "message";
    data = [];
  };

  return (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.search(/\r\n|\r|\n/)) !== -1) {
      /* A `\r` that ends the chunk may be half of a `\r\n`: read as a line
         end on its own, the `\n` arriving next is a blank line, and the event
         dispatches without its name. Wait for the next chunk to say. */
      if (nl === buffer.length - 1 && buffer[nl] === "\r") break;
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + (buffer.startsWith("\r\n", nl) ? 2 : 1));
      if (line === "") {
        dispatch();
        continue;
      }
      if (line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
  };
}

/**
 * Hold one stream open until `signal` aborts or the server ends it.
 *
 * Resolves when the stream ends, rejects when it fails to open. The caller
 * decides about reconnecting: a stream that ends because LivePremier Plus was
 * restarted is normal, and the backoff belongs to the caller who knows why it
 * was listening.
 */
export async function readSse(url, { signal, onOpen, onEvent }) {
  const res = await fetch(url, {
    headers: { accept: "text/event-stream" },
    signal,
  });
  if (!res.ok) {
    const err = new Error(`${res.status} ${res.statusText}`.trim());
    err.status = res.status;
    throw err;
  }
  onOpen?.();
  const parse = createSseParser(onEvent);
  const decoder = new TextDecoder();
  for await (const chunk of res.body)
    parse(decoder.decode(chunk, { stream: true }));
}
