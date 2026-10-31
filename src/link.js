import { EventEmitter } from "node:events";

import { baseUrl, request } from "./http.js";
import { readSse } from "./sse.js";

/**
 * The link to one LivePremier Plus.
 *
 * Two kinds of traffic, for two kinds of fact:
 *
 *  - **A poll, every few seconds**, of `/__lpp/status` and `/__lpp/plugins`:
 *    is the app there, which version, which switcher, and which plugins are
 *    on. These change rarely and a poll is the only way to notice the app
 *    going away.
 *  - **An event stream per plugin that has state worth a button**, held open
 *    while that plugin is on: the Control API's report of the open page (the
 *    standby cue, the locks, the variables), Matrix Routing's crosspoints,
 *    the HyperDecks' transport, Triggers' holds. A stream's first event is a
 *    snapshot, so nothing is fetched twice.
 *
 * A plugin switched off answers its stream with a 404; the poll notices the
 * switch and stops asking. Nothing here retries faster than the poll.
 */

/** How often the app is asked whether it is still there. */
export const POLL_MS = 3000;

/**
 * The streams, by the plugin that owns them. `event` is the event that
 * carries the state; `get` is the route to read when a stream opens, for a
 * stream that does not greet with a snapshot.
 */
export const STREAMS = {
  control: { path: "/__lpp/control/events", event: "state", key: "control" },
  "matrix-routing": {
    path: "/__lpp/matrix/stream",
    event: "matrix",
    key: "matrix",
    get: "/__lpp/matrix",
    /* The stream sends the routers; the GET wraps them. */
    unwrap: (body) => (Array.isArray(body) ? body : body?.matrices || []),
  },
  hyperdeck: {
    path: "/__lpp/hyperdeck/stream",
    event: "decks",
    key: "decks",
    get: "/__lpp/hyperdeck",
  },
  triggers: {
    path: "/__lpp/triggers/stream",
    event: "state",
    key: "triggers",
    get: "/__lpp/triggers",
  },
};

export function emptyState() {
  return {
    connected: false,
    error: null,
    version: null,
    device: null,
    clients: 0,
    plugins: [],
    on: {},
    control: null,
    matrix: [],
    decks: null,
    triggers: null,
  };
}

export class Link extends EventEmitter {
  /**
   * @param {() => {host: string, port: number}} config read per request, so a
   *   changed config needs only a restart of the link
   * @param {(level: string, text: string) => void} log
   */
  constructor(config, log = () => {}) {
    super();
    this.config = config;
    this.log = log;
    this.state = emptyState();
    this.streams = new Map();
    this.timer = null;
    this.running = false;
  }

  start() {
    this.stop();
    this.running = true;
    this.state = emptyState();
    void this.poll();
    this.timer = setInterval(() => void this.poll(), POLL_MS);
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
    this.timer = null;
    for (const s of this.streams.values()) s.abort.abort();
    this.streams.clear();
  }

  changed() {
    this.emit("change", this.state);
  }

  async poll() {
    const cfg = this.config();
    try {
      const [status, plugins] = await Promise.all([
        request(cfg, "GET", "/__lpp/status"),
        request(cfg, "GET", "/__lpp/plugins"),
      ]);
      if (!this.running) return;
      const list = (plugins?.plugins || []).map((p) => ({
        id: p.id,
        name: p.name,
        on: p.on === true,
        reason: p.reason || null,
      }));
      const on = Object.fromEntries(list.map((p) => [p.id, p.on]));
      const was = this.state;
      this.state = {
        ...was,
        connected: true,
        error: null,
        version: status?.version ?? null,
        device: status?.device ?? null,
        clients: status?.clients ?? 0,
        plugins: list,
        on,
      };
      if (!was.connected)
        this.log(
          "info",
          `Connected to LivePremier Plus ${this.state.version ?? ""} at ${baseUrl(cfg)}`,
        );
      this.follow();
      if (
        !was.connected ||
        JSON.stringify(was.on) !== JSON.stringify(on) ||
        was.device !== this.state.device ||
        was.clients !== this.state.clients
      ) {
        this.changed();
      }
    } catch (err) {
      if (!this.running) return;
      const was = this.state;
      if (was.connected || was.error !== err.message) {
        this.log(was.connected ? "warn" : "debug", err.message);
        for (const s of this.streams.values()) s.abort.abort();
        this.streams.clear();
        this.state = { ...emptyState(), error: err.message };
        this.changed();
      }
    }
  }

  /** Open a stream for every plugin that is on, close the rest. */
  follow() {
    for (const [plugin, spec] of Object.entries(STREAMS)) {
      const want = this.state.on[plugin] === true;
      const held = this.streams.get(plugin);
      if (want && !held) this.open(plugin, spec);
      if (!want && held) {
        held.abort.abort();
        this.streams.delete(plugin);
        this.state = { ...this.state, [spec.key]: emptyState()[spec.key] };
        this.changed();
      }
    }
  }

  open(plugin, spec) {
    const abort = new AbortController();
    const entry = { abort };
    this.streams.set(plugin, entry);
    const cfg = this.config();
    const set = (value) => {
      if (abort.signal.aborted) return;
      this.state = {
        ...this.state,
        [spec.key]: spec.unwrap ? spec.unwrap(value) : value,
      };
      this.changed();
    };
    readSse(baseUrl(cfg) + spec.path, {
      signal: abort.signal,
      onOpen: () => {
        if (spec.get) request(cfg, "GET", spec.get).then(set, () => {});
      },
      onEvent: ({ event, data }) => {
        if (event !== spec.event) return;
        try {
          set(JSON.parse(data));
        } catch {
          /* a frame we cannot read is skipped, not fatal */
        }
      },
    })
      .catch((err) => {
        if (!abort.signal.aborted)
          this.log("debug", `${plugin} stream: ${err.message}`);
      })
      .finally(() => {
        /* Ended or failed: forget it, and the next poll opens it again if the
           plugin is still on. */
        if (this.streams.get(plugin) === entry) this.streams.delete(plugin);
      });
  }

  /* -------------------------------------------------------------- writing */

  /** Run a Control API action through the open page. Throws its sentence. */
  async do(action, args = {}) {
    if (this.state.connected && this.state.on.control === false) {
      throw new Error(
        "the Control API plugin is switched off in LivePremier Plus (Preconfig ▸ LivePremier Plus → Plugins)",
      );
    }
    return request(this.config(), "POST", "/__lpp/control/do", {
      action,
      args,
    });
  }

  post(path, body) {
    return request(this.config(), "POST", path, body);
  }

  put(path, body) {
    return request(this.config(), "PUT", path, body);
  }
}
