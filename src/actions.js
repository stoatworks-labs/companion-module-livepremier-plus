/**
 * Actions.
 *
 * Two routes in, and each action says which it takes:
 *
 *  - **Through the open page** (`link.do`, LivePremier Plus's Control API):
 *    the Timeline, Timecode chase, the Console, Layer Lock, Send to a layer
 *    group, and the user's variables. Those run in a Web RCS page, so they
 *    need one open through LivePremier Plus — the module says so when there
 *    is none rather than pretending it pressed something.
 *  - **Straight to a route of LivePremier Plus's own**: Matrix Routing, the
 *    HyperDecks, Triggers, a plugin's address and the plugin switches. Those
 *    work with no page open.
 *
 * The switcher's own work — sources, memories, takes — is the AWJ module's,
 * not this one's. LivePremier Plus's Companion panel adds both.
 */

const ON_OFF = [
  { id: "toggle", label: "Toggle" },
  { id: "on", label: "On" },
  { id: "off", label: "Off" },
];

const LOCK = [
  { id: "toggle", label: "Toggle" },
  { id: "on", label: "Lock" },
  { id: "off", label: "Unlock" },
];

const DECK_COMMANDS = [
  { id: "play", label: "Play" },
  { id: "stop", label: "Stop" },
  { id: "clip", label: "Cue a clip" },
  { id: "next", label: "Next clip" },
  { id: "prev", label: "Previous clip" },
  { id: "rewind", label: "Rewind to the start of the clip" },
  { id: "end", label: "Go to the end of the clip" },
  { id: "record", label: "Record" },
  { id: "preview", label: "Preview (input) mode" },
];

const target = (label = "Layer or layer group") => ({
  type: "textinput",
  id: "target",
  label,
  default: "S1/1",
  useVariables: true,
  tooltip:
    "A layer as S1/2 (screen 1 layer 2) or A1/1 for an aux, or a layer group by its name",
});

const cue = {
  type: "textinput",
  id: "cue",
  label: "Cue number",
  default: "1",
  useVariables: true,
  tooltip:
    "The cue's number as the Timeline shows it: 3, 3.5, 12a. A cue with no number answers to its place in the list.",
};

export default function UpdateActions(self) {
  const s = self.link.state;

  /* Run through the page, logging the sentence LivePremier Plus gave. */
  const page =
    (action, args = () => ({})) =>
    async (event) => {
      try {
        await self.link.do(action, args(event.options));
      } catch (err) {
        self.log("warn", `${action}: ${err.message}`);
      }
    };
  const post = (path, body) => async (event) => {
    try {
      await self.link.post(path, body(event.options));
    } catch (err) {
      self.log("warn", `${path}: ${err.message}`);
    }
  };

  const routers = (s.matrix || []).map((m) => ({
    id: m.id,
    label: m.name || m.id,
  }));
  const decks = [
    ...(s.decks?.live || []).map((d) => ({ id: d.name, label: d.name })),
    { id: "all", label: "All decks" },
    { id: "players", label: "All players" },
    { id: "recorders", label: "All recorders" },
  ];
  const triggers = (s.triggers?.triggers || []).map((t) => ({
    id: t.id,
    label: t.name,
  }));
  const plugins = (s.plugins || []).map((p) => ({ id: p.id, label: p.name }));

  self.setActionDefinitions({
    /* ----------------------------------------------------------- Timeline */
    timeline_go: {
      name: "Timeline: GO",
      description:
        "Fire the standby cue, then advance. A GO during a cue's pre-wait fires it at once.",
      options: [],
      callback: page("timeline.go"),
    },
    timeline_back: {
      name: "Timeline: Back",
      description:
        "Move the standby back one cue. Fires nothing, and is not the switcher's STEP BACK.",
      options: [],
      callback: page("timeline.back"),
    },
    timeline_next: {
      name: "Timeline: Skip forward",
      description: "Move the standby on one cue without firing it.",
      options: [],
      callback: page("timeline.next"),
    },
    timeline_first: {
      name: "Timeline: Back to the top",
      description: "Make the first cue the standby.",
      options: [],
      callback: page("timeline.first"),
    },
    timeline_stop: {
      name: "Timeline: Stop",
      description:
        "Cancel a pending pre-wait or follow. A cue already fired is not undone.",
      options: [],
      callback: page("timeline.stop"),
    },
    timeline_goto: {
      name: "Timeline: Make a cue the standby",
      options: [cue],
      callback: page("timeline.goto", (o) => ({ cue: o.cue })),
    },
    timeline_fire: {
      name: "Timeline: Fire a cue now",
      description:
        "Fire one cue straight away, wherever the standby is. The standby does not move.",
      options: [cue],
      callback: page("timeline.fire", (o) => ({ cue: o.cue })),
    },
    timecode_chase: {
      name: "Timeline: Timecode chase",
      description:
        "Arm or disarm Chase, so cues with a timecode fire when the clock reaches them.",
      options: [
        {
          type: "dropdown",
          id: "on",
          label: "Chase",
          default: "toggle",
          choices: ON_OFF,
        },
      ],
      callback: page("timecode.chase", (o) => ({ on: o.on })),
    },

    /* ------------------------------------------------------------ Console */
    console_run: {
      name: "Console: Run a line",
      description:
        "Run a line exactly as if it had been typed at LivePremier Plus's Console: Mynah (Recall Screen 1 Memory 5, Take Screen 2), raw AWJ, or a plugin's address such as /lp/matrix/hub/route/3 9. Preview lock and Layer Lock see it, as they see the page's own buttons.",
      options: [
        {
          type: "textinput",
          id: "line",
          label: "Line",
          default: "Take Screen 1",
          useVariables: true,
        },
      ],
      callback: page("console.run", (o) => ({ line: o.line })),
    },

    /* --------------------------------------------------------- Layer Lock */
    lock_set: {
      name: "Layer Lock: Lock or unlock",
      description:
        "Lock a layer (or every layer of a group) so its preview copy follows program and a take leaves it alone.",
      options: [
        target(),
        {
          type: "dropdown",
          id: "on",
          label: "Do",
          default: "toggle",
          choices: LOCK,
        },
      ],
      callback: page("locks.set", (o) => ({ target: o.target, on: o.on })),
    },
    lock_take: {
      name: "Layer Lock: Take only this",
      description:
        "Take only this layer, or this group on each of its screens. Every other layer stays as it is.",
      options: [target()],
      callback: page("locks.take", (o) => ({ target: o.target })),
    },

    /* ------------------------------------------------- Send to (groups) */
    send_source: {
      name: "Layer Groups: Send a source",
      description:
        "Put a source on a layer or on every layer of a group, as the … menu on a source card does. A program send is refused while that screen's PGM padlock is shut, and nothing is sent mid-take.",
      options: [
        {
          type: "textinput",
          id: "source",
          label: "Source",
          default: "1",
          useVariables: true,
          tooltip:
            "An input number (3), IN3, IMG2 for a still, or NONE to clear the layer",
        },
        target("To (layer or layer group)"),
        {
          type: "dropdown",
          id: "mode",
          label: "Into",
          default: "PREVIEW",
          choices: [
            { id: "PREVIEW", label: "Preview" },
            { id: "PROGRAM", label: "Program" },
          ],
        },
      ],
      callback: page("groups.send", (o) => ({
        source: o.source,
        target: o.target,
        mode: o.mode,
      })),
    },

    /* ---------------------------------------------------------- Variables */
    variable_set: {
      name: "Variables: Set a user variable",
      description:
        "Give an @variable a new definition, adding it if it is new: a number, or arithmetic over other variables such as @gap * 2.",
      options: [
        {
          type: "textinput",
          id: "name",
          label: "Name",
          default: "@gap",
          useVariables: true,
        },
        {
          type: "textinput",
          id: "value",
          label: "Definition",
          default: "40",
          useVariables: true,
        },
      ],
      callback: async (event) => {
        const o = event.options;
        try {
          const answer = await self.link.do("variables.set", {
            name: o.name,
            value: o.value,
          });
          /* Kept as typed, as the panel keeps it, but one that does not evaluate is worth a line. */
          const row = answer?.result;
          if (row?.error)
            self.log(
              "warn",
              `variables.set: @${row.name} is saved but does not evaluate: ${row.error}`,
            );
        } catch (err) {
          self.log("warn", `variables.set: ${err.message}`);
        }
      },
    },

    /* ---------------------------------------------------- Matrix Routing */
    matrix_route: {
      name: "Matrix: Route a crosspoint",
      description: "Router output takes router input, both counted from 1.",
      options: [
        {
          type: "dropdown",
          id: "matrix",
          label: "Router",
          default: routers[0]?.id ?? "",
          choices: routers,
          allowCustom: true,
        },
        {
          type: "number",
          id: "output",
          label: "Output",
          default: 1,
          min: 1,
          max: 1024,
        },
        {
          type: "number",
          id: "input",
          label: "Input",
          default: 1,
          min: 1,
          max: 1024,
        },
      ],
      callback: post("/__lpp/matrix/route", (o) => ({
        matrix: o.matrix,
        output: Number(o.output),
        input: Number(o.input),
      })),
    },
    matrix_feed: {
      name: "Matrix: Feed a switcher input",
      description:
        "Through the patch: the switcher input sees this router input, whichever router output is cabled to it.",
      options: [
        {
          type: "number",
          id: "input",
          label: "Switcher input",
          default: 1,
          min: 1,
          max: 256,
        },
        {
          type: "number",
          id: "source",
          label: "Router input",
          default: 1,
          min: 1,
          max: 1024,
        },
      ],
      callback: post("/__lpp/addresses/run", (o) => ({
        address: `/lp/matrix/input/${Number(o.input)}/source`,
        args: [Number(o.source)],
      })),
    },
    matrix_send: {
      name: "Matrix: Send a switcher output",
      description:
        "Through the patch: router outputs (1-4, or 1,3,5) take this switcher output.",
      options: [
        {
          type: "number",
          id: "output",
          label: "Switcher output",
          default: 1,
          min: 1,
          max: 256,
        },
        {
          type: "textinput",
          id: "destinations",
          label: "Router outputs",
          default: "1",
          useVariables: true,
        },
      ],
      callback: post("/__lpp/addresses/run", (o) => ({
        address: `/lp/matrix/output/${Number(o.output)}/destinations`,
        args: [String(o.destinations)],
      })),
    },

    /* --------------------------------------------------------- HyperDecks */
    deck_command: {
      name: "HyperDeck: Transport",
      description:
        "Play, stop, cue, record. A deck by name, by its place in the list (1, 2…), or all / players / recorders.",
      options: [
        {
          type: "dropdown",
          id: "deck",
          label: "Deck",
          default: decks[0]?.id ?? "1",
          choices: decks,
          allowCustom: true,
        },
        /* The fields below show or hide on this one, and an expression may only
           read a field that cannot itself be an expression. */
        {
          type: "dropdown",
          id: "command",
          label: "Command",
          default: "play",
          choices: DECK_COMMANDS,
          disableAutoExpression: true,
        },
        {
          type: "number",
          id: "clip",
          label: "Clip (Cue a clip)",
          default: 1,
          min: 1,
          max: 999,
          isVisibleExpression: `$(options:command) == 'clip'`,
        },
        {
          type: "checkbox",
          id: "loop",
          label: "Loop (Play)",
          default: false,
          isVisibleExpression: `$(options:command) == 'play'`,
        },
        {
          type: "checkbox",
          id: "single",
          label: "Stop at the end of the clip (Play)",
          default: true,
          isVisibleExpression: `$(options:command) == 'play'`,
        },
        {
          type: "textinput",
          id: "name",
          label: "Clip name (Record)",
          default: "",
          useVariables: true,
          isVisibleExpression: `$(options:command) == 'record'`,
        },
      ],
      callback: post("/__lpp/hyperdeck/command", (o) => {
        const step = { command: o.command };
        if (o.command === "clip") step.clip = Number(o.clip);
        if (o.command === "play")
          Object.assign(step, {
            loop: o.loop === true,
            single: o.single !== false,
          });
        if (o.command === "record" && o.name) step.name = String(o.name);
        if (o.command === "preview") step.enable = true;
        return { deck: String(o.deck), ...step };
      }),
    },

    /* ----------------------------------------------------------- Triggers */
    trigger_test: {
      name: "Triggers: Send a trigger's lines",
      description:
        "Send one trigger's go or back lines now, as Test go / Test back do.",
      options: [
        {
          type: "dropdown",
          id: "trigger",
          label: "Trigger",
          default: triggers[0]?.id ?? "",
          choices: triggers,
          allowCustom: true,
        },
        {
          type: "dropdown",
          id: "side",
          label: "Lines",
          default: "go",
          choices: [
            { id: "go", label: "Go" },
            { id: "back", label: "Back" },
          ],
        },
      ],
      callback: post("/__lpp/triggers/test", (o) => ({
        trigger: o.trigger,
        side: o.side,
      })),
    },
    trigger_restore_all: {
      name: "Triggers: Restore all",
      description:
        "Send back everything a cue's triggers are holding, newest first.",
      options: [],
      callback: post("/__lpp/triggers/restore", () => ({ all: true })),
    },

    /* ------------------------------------------------------- Any address */
    address_run: {
      name: "Plugin address: Run",
      description:
        "Run any address a LivePremier Plus plugin answers, as OSC input would: /lp/matrix/…, /hyperdeck/…, /lp/dante/…. Separate arguments with spaces; quote one that holds a space.",
      options: [
        {
          type: "textinput",
          id: "address",
          label: "Address",
          default: "/hyperdeck/1/play",
          useVariables: true,
        },
        {
          type: "textinput",
          id: "args",
          label: "Arguments",
          default: "",
          useVariables: true,
        },
      ],
      callback: post("/__lpp/addresses/run", (o) => ({
        address: String(o.address).trim(),
        args: splitArgs(o.args),
      })),
    },

    /* ------------------------------------------------------ Plugin switch */
    plugin_switch: {
      name: "LivePremier Plus: Switch a plugin on or off",
      description:
        "The same switch as Preconfig ▸ LivePremier Plus → Plugins. The server half changes at once; an open page applies it on its next load.",
      options: [
        {
          type: "dropdown",
          id: "plugin",
          label: "Plugin",
          default: plugins[0]?.id ?? "",
          choices: plugins,
          allowCustom: true,
        },
        {
          type: "dropdown",
          id: "on",
          label: "Switch",
          default: "toggle",
          choices: ON_OFF,
        },
      ],
      callback: async (event) => {
        const id = String(event.options.plugin);
        const now = self.link.state.on[id];
        const enabled =
          event.options.on === "toggle" ? !now : event.options.on === "on";
        try {
          await self.link.put("/__lpp/settings", {
            plugins: { [id]: { enabled } },
          });
          await self.link.poll();
        } catch (err) {
          self.log("warn", `plugin ${id}: ${err.message}`);
        }
      },
    },
  });
}

/**
 * OSC-style arguments from one text field: numbers become numbers, quoted
 * text keeps its spaces. `7`, `"1-4"`, `hub 3 9`.
 */
export function splitArgs(raw) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(String(raw ?? "")))) {
    if (m[1] !== undefined) out.push(m[1]);
    else out.push(/^-?\d+(\.\d+)?$/.test(m[2]) ? Number(m[2]) : m[2]);
  }
  return out;
}
