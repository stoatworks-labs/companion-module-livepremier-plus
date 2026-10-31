/**
 * Smoke tests. `node test/smoke.mjs`, no test runner, nothing off this machine.
 *
 * Three things are checked. The pure helpers first: the event-stream parser,
 * the argument splitter and the state readers every feedback and variable
 * leans on. Then the link, against a stand-in LivePremier Plus on a loopback
 * port, because a stream that never opens looks exactly like a quiet show.
 * Last the module surface against the real `@companion-module/base`, because
 * the traps that have bitten this fleet before — a bare `checkFeedbacks()`,
 * array variable definitions, 1.x preset shapes, a hardcoded variable prefix —
 * all fail silently at runtime.
 */

import assert from "node:assert/strict";
import http from "node:http";

import { createSseParser } from "../src/sse.js";
import { splitArgs } from "../src/actions.js";
import { Link } from "../src/link.js";
import * as read from "../src/state.js";

let passed = 0;
const check = async (name, fn) => {
  try {
    await fn();
    passed++;
  } catch (e) {
    console.error(`FAIL  ${name}\n      ${e.stack || e.message}`);
    process.exitCode = 1;
  }
};

// ---------------------------------------------------------------------------
// A show, as the link holds it
// ---------------------------------------------------------------------------

const cue = (id, number, label) => ({ id, number, label, enabled: true });

function show() {
  return {
    connected: true,
    error: null,
    version: "0.18.8",
    device: "192.168.1.203:3000",
    clients: 1,
    plugins: [
      { id: "control", name: "Control API", on: true },
      { id: "matrix-routing", name: "Matrix Routing", on: true },
      { id: "hyperdeck", name: "HyperDeck", on: true },
      { id: "triggers", name: "Triggers", on: true },
    ],
    on: {
      control: true,
      "matrix-routing": true,
      hyperdeck: true,
      triggers: true,
    },
    control: {
      version: 1,
      page: "page-a",
      state: {
        timeline: {
          name: "Main",
          count: 3,
          running: false,
          standby: cue("c2", "2", "Walk-in"),
          next: cue("c3", "3.5", "Keynote"),
          previous: cue("c1", "1", "Preset"),
          last: cue("c1", "1", "Preset"),
          waiting: [],
          cues: [
            cue("c1", "1", "Preset"),
            cue("c2", "2", "Walk-in"),
            cue("c3", "3.5", "Keynote"),
          ],
        },
        timecode: {
          armed: true,
          source: "ltc",
          running: true,
          value: "10:00:05",
        },
        locks: ["S1/1", "S2/1"],
        groups: [
          { name: "Lower thirds", gang: true, members: ["S1/1", "S2/1"] },
        ],
        variables: [
          { name: "gap", value: 40, error: null },
          { name: "side.width", value: 1920, error: null },
        ],
      },
    },
    matrix: [{ id: "hub", name: "Hub", state: { routing: { 1: 4, 3: 9 } } }],
    decks: {
      live: [
        {
          id: "d1",
          name: "Deck A",
          status: "connected",
          transport: {
            status: "play",
            clip: 2,
            displayTimecode: "00:01:02:03",
          },
          clips: [
            { id: 1, name: "Opener" },
            { id: 2, name: "Sting" },
          ],
          position: { remaining: 75.4 },
        },
        { id: "d2", name: "Deck B", status: "connecting" },
      ],
    },
    triggers: {
      triggers: [{ id: "t1", name: "House lights" }],
      holds: [{ id: "h1" }, { id: "h2", stale: true }],
    },
  };
}

// ---------------------------------------------------------------------------
// The event-stream parser
// ---------------------------------------------------------------------------

await check("events split anywhere still arrive whole", () => {
  const got = [];
  const feed = createSseParser((e) => got.push(e));
  for (const chunk of [
    ": hello\n\nevent: st",
    "ate\r",
    '\ndata: {"a"',
    ":1}\n",
    "\n",
    "data: x\ndata: y\n\n",
  ])
    feed(chunk);
  assert.deepEqual(got, [
    { event: "state", data: '{"a":1}' },
    { event: "message", data: "x\ny" },
  ]);
});

await check("a comment alone dispatches nothing", () => {
  const got = [];
  const feed = createSseParser((e) => got.push(e));
  feed(": keepalive\n\n");
  assert.equal(got.length, 0);
});

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

await check(
  "arguments: numbers become numbers, quotes keep their spaces",
  () => {
    assert.deepEqual(splitArgs("hub 3 9"), ["hub", 3, 9]);
    assert.deepEqual(splitArgs('"1-4" -2 0.5 "two words"'), [
      "1-4",
      -2,
      0.5,
      "two words",
    ]);
    assert.deepEqual(splitArgs(""), []);
    assert.deepEqual(splitArgs(undefined), []);
  },
);

// ---------------------------------------------------------------------------
// Reading the state
// ---------------------------------------------------------------------------

await check("a cue number is the same cue however it is written", () => {
  assert.ok(read.sameCue("3", "3.0"));
  assert.ok(read.sameCue("03", "3"));
  assert.ok(!read.sameCue("3", "3.5"));
  assert.ok(read.sameCue("12A", "12a"));
  assert.ok(!read.sameCue("", ""));
  assert.ok(!read.sameCue(null, "1"));
});

await check("targets: a layer, an aux, native, a group by name", () => {
  const s = show();
  assert.deepEqual(read.targetKeys(s, "S1/2"), ["S1/2"]);
  assert.deepEqual(read.targetKeys(s, "s1 l2"), ["S1/2"]);
  assert.deepEqual(read.targetKeys(s, "A1/native"), ["A1/NATIVE"]);
  assert.deepEqual(read.targetKeys(s, "lower THIRDS"), ["S1/1", "S2/1"]);
  assert.deepEqual(read.targetKeys(s, "nobody"), []);
});

await check("a group is locked only when every layer of it is", () => {
  const s = show();
  assert.ok(read.isLocked(s, "S1/1"));
  assert.ok(read.isLocked(s, "Lower thirds"));
  s.control.state.locks = ["S1/1"];
  assert.ok(!read.isLocked(s, "Lower thirds"));
  assert.ok(!read.isLocked(s, "nobody"));
});

await check("nothing is known with no page open", () => {
  const s = show();
  s.control.page = null;
  assert.equal(read.page(s), null);
  assert.equal(read.timeline(s), null);
  assert.ok(!read.isLocked(s, "S1/1"));
});

await check("matrix: the routed input, by router id or name", () => {
  const s = show();
  assert.equal(read.routedTo(s, "hub", 3), 9);
  assert.equal(read.routedTo(s, "HUB", "1"), 4);
  assert.equal(read.routedTo(s, "", 3), 9);
  assert.equal(read.routedTo(s, "hub", 2), null);
  assert.equal(read.routedTo(s, "other", 3), null);
});

await check("decks: by name or place, and offline unless connected", () => {
  const s = show();
  assert.equal(read.deck(s, "deck a").id, "d1");
  assert.equal(read.deck(s, "2").id, "d2");
  assert.equal(read.deckState(read.deck(s, "1")), "play");
  assert.equal(read.deckState(read.deck(s, "2")), "offline");
  assert.equal(read.deckState(null), "unknown");
  assert.equal(read.deckClip(read.deck(s, "1")), "Sting");
});

await check("clock reads m:ss, and h:mm:ss past the hour", () => {
  assert.equal(read.clock(75.4), "1:15");
  assert.equal(read.clock(3725), "1:02:05");
  assert.equal(read.clock(NaN), "");
  assert.equal(read.clock(-1), "");
});

await check("a stale hold is not a hold", () => {
  assert.equal(read.holds(show()).length, 1);
});

await check("variable ids are Companion-safe", () => {
  assert.equal(read.variableId("@side.width"), "var_side_width");
  assert.equal(read.variableId("gap"), "var_gap");
});

// ---------------------------------------------------------------------------
// The link, against a stand-in LivePremier Plus on loopback
// ---------------------------------------------------------------------------

/** A LivePremier Plus that answers status, plugins and the Control API's stream. */
async function standIn({ controlOn = true } = {}) {
  const seen = [];
  const streams = new Set();
  const server = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    const json = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.url === "/__lpp/status")
      return json(200, { device: "10.0.0.5", clients: 1, version: "9.9.9" });
    if (req.url === "/__lpp/plugins")
      return json(200, {
        plugins: [{ id: "control", name: "Control API", on: controlOn }],
      });
    if (req.url === "/__lpp/control/events" && controlOn) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(": hello\n\n");
      res.write(
        `event: state\ndata: ${JSON.stringify({ version: 1, page: "p1", state: { timeline: { count: 1 } } })}\n\n`,
      );
      streams.add(res);
      req.on("close", () => streams.delete(res));
      return;
    }
    if (req.url === "/__lpp/control/do" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const { action } = JSON.parse(body);
        if (action === "timeline.fire")
          return json(409, { error: "there is no cue 9" });
        json(200, { ok: true, result: { action } });
      });
      return;
    }
    json(404, { error: "not here" });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  const close = () =>
    new Promise((r) => {
      for (const s of streams) s.destroy();
      server.closeAllConnections?.();
      server.close(r);
    });
  return { port, seen, close };
}

const until = async (test, ms = 2000) => {
  const end = Date.now() + ms;
  while (!test()) {
    if (Date.now() > end) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 10));
  }
};

await check(
  "the link polls, then follows the Control API's stream",
  async () => {
    const lpp = await standIn();
    const link = new Link(() => ({ host: "127.0.0.1", port: lpp.port }));
    try {
      link.start();
      await until(() => link.state.control?.page === "p1");
      assert.equal(link.state.connected, true);
      assert.equal(link.state.version, "9.9.9");
      assert.equal(link.state.on.control, true);
      assert.equal(read.timeline(link.state).count, 1);
    } finally {
      link.stop();
      await lpp.close();
    }
  },
);

await check(
  "an action answers with LivePremier Plus's own sentence",
  async () => {
    const lpp = await standIn();
    const link = new Link(() => ({ host: "127.0.0.1", port: lpp.port }));
    try {
      link.start();
      await until(() => link.state.connected);
      assert.deepEqual(await link.do("timeline.go"), {
        ok: true,
        result: { action: "timeline.go" },
      });
      await assert.rejects(
        link.do("timeline.fire", { cue: "9" }),
        /there is no cue 9/,
      );
    } finally {
      link.stop();
      await lpp.close();
    }
  },
);

await check(
  "with the Control API off, an action says so and opens no stream",
  async () => {
    const lpp = await standIn({ controlOn: false });
    const link = new Link(() => ({ host: "127.0.0.1", port: lpp.port }));
    try {
      link.start();
      await until(() => link.state.connected);
      await assert.rejects(
        link.do("timeline.go"),
        /Control API plugin is switched off/,
      );
      assert.ok(!lpp.seen.includes("GET /__lpp/control/events"));
      assert.ok(!lpp.seen.includes("POST /__lpp/control/do"));
    } finally {
      link.stop();
      await lpp.close();
    }
  },
);

await check(
  "nothing listening is a failure with a reason, not a hang",
  async () => {
    const lpp = await standIn();
    const port = lpp.port;
    await lpp.close();
    const link = new Link(() => ({ host: "127.0.0.1", port }));
    try {
      link.start();
      await until(() => link.state.error);
      assert.equal(link.state.connected, false);
      assert.match(
        link.state.error,
        /LivePremier Plus at http:\/\/127\.0\.0\.1:\d+: /,
      );
    } finally {
      link.stop();
    }
  },
);

// ---------------------------------------------------------------------------
// The module surface, against the real @companion-module/base
// ---------------------------------------------------------------------------

const { default: ModuleInstance } = await import("../src/main.js");

/** A stand-in for Companion that records what the module registered. */
function harness(state) {
  const recorded = { values: {} };
  const self = Object.create(ModuleInstance.prototype);
  // `label` is a getter on InstanceBase, so it is defined rather than
  // assigned — and presets must build their variable references from it.
  Object.defineProperty(self, "label", {
    value: "lpp-front",
    configurable: true,
  });
  self.config = { host: "127.0.0.1", port: 8535 };
  self.link = { state };
  self.setActionDefinitions = (v) => (recorded.actions = v);
  self.setFeedbackDefinitions = (v) => (recorded.feedbacks = v);
  self.setVariableDefinitions = (v) => {
    // The real one THROWS on an array, leaving a connection with nothing
    // registered and no visible cause.
    if (Array.isArray(v))
      throw new Error("Variable definitions should be an object, not an array");
    recorded.variableDefs = v;
  };
  self.setVariableValues = (v) =>
    (recorded.values = { ...recorded.values, ...v });
  self.setPresetDefinitions = (structure, presets) => {
    assert.ok(
      Array.isArray(structure),
      "preset structure must be the FIRST argument and an array",
    );
    assert.ok(
      presets && !Array.isArray(presets),
      "preset definitions must be the second argument, an object",
    );
    recorded.structure = structure;
    recorded.presets = presets;
  };
  self.updateStatus = (status, message) =>
    (recorded.status = [status, message]);
  self.log = () => {};
  self.checkAllFeedbacks = () => (recorded.checkedAll = true);
  self.checkFeedbacks = () => {
    throw new Error(
      "bare checkFeedbacks() checks nothing — use checkAllFeedbacks()",
    );
  };
  self.rebuild();
  return { self, recorded };
}

const full = harness(show());
const bare = harness((await import("../src/link.js")).emptyState());

await check("registers every action, through the page and direct", () => {
  for (const id of [
    "timeline_go",
    "timeline_back",
    "timeline_next",
    "timeline_first",
    "timeline_stop",
    "timeline_goto",
    "timeline_fire",
    "timecode_chase",
    "console_run",
    "lock_set",
    "lock_take",
    "send_source",
    "variable_set",
    "matrix_route",
    "matrix_feed",
    "matrix_send",
    "deck_command",
    "trigger_test",
    "trigger_restore_all",
    "address_run",
    "plugin_switch",
  ]) {
    assert.ok(full.recorded.actions[id], `missing action ${id}`);
  }
});

await check(
  "an expression only reads a field that cannot itself be one",
  () => {
    for (const [id, def] of Object.entries(full.recorded.actions)) {
      const fixed = new Set(
        def.options.filter((o) => o.disableAutoExpression).map((o) => o.id),
      );
      for (const o of def.options) {
        for (const [, ref] of (o.isVisibleExpression || "").matchAll(
          /\$\(options:([^)]+)\)/g,
        )) {
          assert.ok(
            fixed.has(ref),
            `${id}.${o.id} reads ${ref}, which needs disableAutoExpression`,
          );
        }
      }
    }
  },
);

await check("feedbacks are boolean, and read the show right", () => {
  const fb = full.recorded.feedbacks;
  for (const [id, def] of Object.entries(fb))
    assert.equal(def.type, "boolean", `${id} is not boolean`);
  const run = (id, options = {}) => fb[id].callback({ options });
  assert.equal(run("page_open"), true);
  assert.equal(run("cue_standby", { cue: "2.0" }), true);
  assert.equal(run("cue_standby", { cue: "1" }), false);
  assert.equal(run("cue_last", { cue: "1" }), true);
  assert.equal(run("chase_armed"), true);
  assert.equal(run("layer_locked", { target: "Lower thirds" }), true);
  assert.equal(
    run("matrix_route", { matrix: "hub", output: 3, input: 9 }),
    true,
  );
  assert.equal(
    run("matrix_route", { matrix: "hub", output: 3, input: 8 }),
    false,
  );
  assert.equal(run("deck_state", { deck: "Deck A", state: "play" }), true);
  assert.equal(run("deck_state", { deck: "Deck B", state: "offline" }), true);
  assert.equal(run("triggers_holding"), true);
  assert.equal(run("plugin_on", { plugin: "control" }), true);
});

await check("with nothing known, every feedback is false", () => {
  const fb = bare.recorded.feedbacks;
  const options = {
    cue: "1",
    target: "S1/1",
    matrix: "",
    output: 1,
    input: 1,
    deck: "1",
    state: "play",
    plugin: "control",
  };
  for (const [id, def] of Object.entries(fb)) {
    assert.equal(
      def.callback({ options }),
      false,
      `${id} lights up on nothing`,
    );
  }
});

await check(
  "variable definitions are an object keyed by id, not an array",
  () => {
    for (const { recorded } of [full, bare]) {
      assert.ok(recorded.variableDefs && !Array.isArray(recorded.variableDefs));
      for (const [id, d] of Object.entries(recorded.variableDefs)) {
        assert.match(id, /^[A-Za-z0-9_]+$/, `${id} is not a Companion-safe id`);
        assert.ok(d.name, `${id} needs a name`);
      }
    }
  },
);

await check("every variable set has a definition, and vice versa", () => {
  for (const { recorded } of [full, bare]) {
    const defined = new Set(Object.keys(recorded.variableDefs));
    for (const id of Object.keys(recorded.values))
      assert.ok(defined.has(id), `${id} is set but never defined`);
    for (const id of defined)
      assert.ok(
        id in recorded.values,
        `${id} is defined but never given a value`,
      );
  }
});

await check("variables carry the show", () => {
  const v = full.recorded.values;
  assert.equal(v.standby_number, "2");
  assert.equal(v.standby_label, "Walk-in");
  assert.equal(v.next_number, "3.5");
  assert.equal(v.timecode, "10:00:05");
  assert.equal(v.locks, "S1/1, S2/1");
  assert.equal(v.var_side_width, 1920);
  assert.equal(v.deck1_clip, "Sting");
  assert.equal(v.deck1_remaining, "1:15");
  assert.equal(v.deck2_state, "offline");
  assert.equal(v.holds, 1);
});

await check(
  "every preset in the structure exists, and every preset is reachable",
  () => {
    for (const { recorded } of [full, bare]) {
      const referenced = [];
      for (const section of recorded.structure) {
        assert.ok(section.id && section.name, "sections need an id and a name");
        for (const entry of section.definitions) referenced.push(entry);
      }
      for (const id of referenced)
        assert.ok(
          recorded.presets[id],
          `structure references a missing preset: ${id}`,
        );
      assert.equal(
        new Set(referenced).size,
        Object.keys(recorded.presets).length,
        "every preset should be reachable once",
      );
    }
  },
);

await check("no preset carries a 1.x category field", () => {
  for (const [id, p] of Object.entries(full.recorded.presets)) {
    assert.ok(
      !("category" in p),
      `${id} uses the 1.x category field, which loads but never appears`,
    );
    assert.equal(p.type, "simple");
  }
});

await check("preset variable references use the connection label", () => {
  for (const [id, p] of Object.entries(full.recorded.presets)) {
    for (const [, ref] of (p.style?.text ?? "").matchAll(/\$\(([^:)]+):/g)) {
      assert.equal(
        ref,
        "lpp-front",
        `${id} hardcodes a variable prefix: ${p.style.text}`,
      );
    }
  }
});

await check("preset variable references name real variables", () => {
  const defined = new Set(Object.keys(full.recorded.variableDefs));
  for (const [id, p] of Object.entries(full.recorded.presets)) {
    for (const [, name] of (p.style?.text ?? "").matchAll(
      /\$\([^:)]+:([^)]+)\)/g,
    )) {
      assert.ok(
        defined.has(name),
        `${id} shows $(…:${name}), which is never defined`,
      );
    }
  }
});

await check(
  "every preset action and feedback is real, with every option it takes",
  () => {
    const { actions, feedbacks, presets } = full.recorded;
    for (const [id, p] of Object.entries(presets)) {
      for (const step of p.steps) {
        for (const a of [...step.down, ...step.up]) {
          const def = actions[a.actionId];
          assert.ok(def, `${id} references unknown action ${a.actionId}`);
          for (const o of def.options)
            assert.ok(
              o.id in a.options,
              `${id}: ${a.actionId} is missing option ${o.id}`,
            );
        }
      }
      for (const f of p.feedbacks) {
        const def = feedbacks[f.feedbackId];
        assert.ok(def, `${id} references unknown feedback ${f.feedbackId}`);
        for (const o of def.options)
          assert.ok(
            o.id in f.options,
            `${id}: ${f.feedbackId} is missing option ${o.id}`,
          );
      }
    }
  },
);

await check(
  "presets follow the show: a router and decks only when there are some",
  () => {
    assert.ok(
      full.recorded.presets.route_1 && full.recorded.presets.deck1_play,
    );
    assert.ok(
      !bare.recorded.presets.route_1 && !bare.recorded.presets.deck1_play,
    );
    assert.ok(
      bare.recorded.presets.go,
      "the Timeline keys are there before anything is known",
    );
  },
);

await check("status says what is missing", () => {
  const { self, recorded } = harness(show());
  self.status(self.link.state);
  assert.equal(recorded.status[0], "ok");
  const off = show();
  off.on.control = false;
  self.status(off);
  assert.match(recorded.status[1], /Control API is off/);
  const closed = show();
  closed.control.page = null;
  self.status(closed);
  assert.match(recorded.status[1], /No LivePremier Plus page open/);
  self.status({ ...show(), connected: false, error: "refused" });
  assert.deepEqual(recorded.status, ["connection_failure", "refused"]);
});

await check("config fields default to this computer's LivePremier Plus", () => {
  const fields = ModuleInstance.prototype.getConfigFields.call({});
  const byId = Object.fromEntries(fields.map((f) => [f.id, f]));
  assert.equal(byId.host.default, "127.0.0.1");
  assert.equal(byId.port.default, 8535);
  assert.ok(byId.about, "the About block is there");
});

await check("checkAllFeedbacks is what the module calls", () => {
  assert.ok(full.recorded.checkedAll);
});

console.log(`${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
