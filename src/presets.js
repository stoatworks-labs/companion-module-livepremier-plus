import { combineRgb } from "@companion-module/base";

/**
 * Presets: ready-made keys, dragged from Companion's preset panel.
 *
 * `setPresetDefinitions` takes TWO arguments in base 2.x — the structure of
 * sections, then the definitions. A 1.x `category` on a definition still
 * loads, and the preset simply never appears.
 *
 * Variable references are built from `self.label`, the connection's own
 * label, never a fixed prefix: an operator who renames the connection, or
 * adds a second LivePremier Plus, must not get keys reading another one.
 */

const WHITE = combineRgb(255, 255, 255);
const BLACK = combineRgb(0, 0, 0);
const DARK = combineRgb(24, 28, 34);
const GREEN = combineRgb(0, 150, 60);
const AMBER = combineRgb(220, 150, 0);
const RED = combineRgb(200, 30, 30);
const BLUE = combineRgb(30, 90, 180);
const GREY = combineRgb(70, 70, 70);

const CUES = 12;
const LAYERS = 4;
const INPUTS = 8;
const DECKS = 4;

const key = (
  name,
  text,
  bgcolor,
  down,
  feedbacks = [],
  size = "14",
  color = WHITE,
) => ({
  type: "simple",
  name,
  style: { text, size, color, bgcolor },
  steps: [{ down, up: [] }],
  feedbacks,
});

const act = (actionId, options = {}) => ({ actionId, options });
/* Every option the action has, so a preset never leans on a default Companion may not fill in. */
const deckOptions = (deck, command) => ({
  deck,
  command,
  clip: 1,
  loop: false,
  single: true,
  name: "",
});
const fb = (feedbackId, options, bgcolor, color = WHITE) => ({
  feedbackId,
  options,
  style: { bgcolor, color },
});

export default function UpdatePresets(self) {
  const v = (id) => `$(${self.label}:${id})`;
  const s = self.link.state;
  const presets = {};
  const sections = [];
  const section = (id, name, description, ids) =>
    sections.push({ id, name, description, definitions: ids });

  /* ---------------------------------------------------------- Timeline */
  presets.go = key(
    "GO",
    `GO\n${v("standby_number")} ${v("standby_label")}`,
    GREEN,
    [act("timeline_go")],
    [fb("timeline_running", {}, AMBER, BLACK), fb("page_open", {}, GREY)].map(
      (f, i) =>
        /* The second is inverted: no page open greys GO out, because it would press nothing. */
        i === 1 ? { ...f, isInverted: true } : f,
    ),
    "14",
  );
  presets.back = key("Back", "BACK", DARK, [act("timeline_back")]);
  presets.skip = key("Skip forward", "SKIP ›", DARK, [act("timeline_next")]);
  presets.top = key("Back to the top", "TOP", DARK, [act("timeline_first")]);
  presets.stop = key(
    "Stop",
    "STOP",
    RED,
    [act("timeline_stop")],
    [fb("timeline_running", {}, AMBER, BLACK)],
  );
  presets.chase = key(
    "Timecode chase",
    `CHASE\n${v("timecode")}`,
    DARK,
    [act("timecode_chase", { on: "toggle" })],
    [fb("chase_armed", {}, GREEN)],
  );
  presets.standby = key(
    "Standby cue (display)",
    `NEXT UP\n${v("standby_number")}\n${v("standby_label")}`,
    BLACK,
    [],
    [],
    "auto",
    AMBER,
  );
  presets.last = key(
    "Last cue (display)",
    `LAST\n${v("last_number")}\n${v("last_label")}`,
    BLACK,
    [],
    [],
    "auto",
    RED,
  );
  presets.page = key(
    "Page open (display)",
    "LPP\nPAGE",
    RED,
    [],
    [fb("page_open", {}, GREEN)],
  );
  section(
    "timeline",
    "Timeline",
    "GO, back, stop and chase, with the standby cue on the key",
    ["go", "back", "skip", "top", "stop", "chase", "standby", "last", "page"],
  );

  const fire = [];
  const standby = [];
  for (let n = 1; n <= CUES; n++) {
    const cue = String(n);
    presets[`fire_${n}`] = key(
      `Fire cue ${n}`,
      `CUE\n${n}`,
      DARK,
      [act("timeline_fire", { cue })],
      [fb("cue_standby", { cue }, AMBER, BLACK), fb("cue_last", { cue }, RED)],
    );
    presets[`standby_${n}`] = key(
      `Make cue ${n} the standby`,
      `SBY\n${n}`,
      DARK,
      [act("timeline_goto", { cue })],
      [fb("cue_standby", { cue }, AMBER, BLACK)],
    );
    fire.push(`fire_${n}`);
    standby.push(`standby_${n}`);
  }
  section(
    "cues",
    "Cues: fire",
    "Fire a cue straight away. Amber is the standby, red fired last.",
    fire,
  );
  section(
    "standby",
    "Cues: standby",
    "Make a cue the standby without firing it.",
    standby,
  );

  /* -------------------------------------------------------- Layer Lock */
  const locks = [];
  for (let screen = 1; screen <= LAYERS; screen++) {
    const target = `S${screen}/1`;
    presets[`lock_s${screen}`] = key(
      `Lock S${screen} layer 1`,
      `LOCK\nS${screen} L1`,
      DARK,
      [act("lock_set", { target, on: "toggle" })],
      [fb("layer_locked", { target }, RED)],
    );
    presets[`take_s${screen}`] = key(
      `Take only S${screen} layer 1`,
      `TAKE\nONLY\nS${screen} L1`,
      BLUE,
      [act("lock_take", { target })],
    );
    locks.push(`lock_s${screen}`, `take_s${screen}`);
  }
  section(
    "locks",
    "Layer Lock",
    "Lock a layer so a take leaves it alone, or take only that layer. Edit the target for a group.",
    locks,
  );

  /* ----------------------------------------------------------- Send to */
  const sends = [];
  for (let n = 1; n <= INPUTS; n++) {
    presets[`send_${n}`] = key(
      `Input ${n} to S1 layer 1, preview`,
      `IN${n}\n› S1 L1\nPVW`,
      DARK,
      [
        act("send_source", {
          source: String(n),
          target: "S1/1",
          mode: "PREVIEW",
        }),
      ],
    );
    sends.push(`send_${n}`);
  }
  section(
    "send",
    "Layer Groups: send",
    "Put an input on a layer or a group, as the … menu does. Edit the target to a group's name.",
    sends,
  );

  /* ------------------------------------------------------------ Matrix */
  const router = s.matrix?.[0];
  if (router) {
    const routes = [];
    for (let n = 1; n <= INPUTS; n++) {
      const options = { matrix: router.id, output: 1, input: n };
      presets[`route_${n}`] = key(
        `${router.name}: output 1 from input ${n}`,
        `${router.name}\n${n} › 1`,
        DARK,
        [act("matrix_route", options)],
        [fb("matrix_route", options, GREEN)],
      );
      routes.push(`route_${n}`);
    }
    section(
      "matrix",
      "Matrix",
      `Router ${router.name}, output 1. Edit a key for any other crosspoint or router.`,
      routes,
    );
  }

  /* -------------------------------------------------------- HyperDecks */
  const deckKeys = [];
  (s.decks?.live || []).slice(0, DECKS).forEach((d, i) => {
    const n = i + 1;
    const deck = d.name;
    presets[`deck${n}_play`] = key(
      `${deck}: play`,
      `${deck}\n▶\n${v(`deck${n}_remaining`)}`,
      DARK,
      [act("deck_command", deckOptions(deck, "play"))],
      [fb("deck_state", { deck, state: "play" }, GREEN)],
    );
    presets[`deck${n}_stop`] = key(
      `${deck}: stop`,
      `${deck}\n■`,
      DARK,
      [act("deck_command", deckOptions(deck, "stop"))],
      [fb("deck_state", { deck, state: "stopped" }, RED)],
    );
    presets[`deck${n}_prev`] = key(
      `${deck}: previous clip`,
      `${deck}\n⏮`,
      DARK,
      [act("deck_command", deckOptions(deck, "prev"))],
    );
    presets[`deck${n}_next`] = key(`${deck}: next clip`, `${deck}\n⏭`, DARK, [
      act("deck_command", deckOptions(deck, "next")),
    ]);
    presets[`deck${n}_rec`] = key(
      `${deck}: record`,
      `${deck}\nREC`,
      DARK,
      [act("deck_command", deckOptions(deck, "record"))],
      [fb("deck_state", { deck, state: "record" }, RED)],
    );
    deckKeys.push(
      `deck${n}_play`,
      `deck${n}_stop`,
      `deck${n}_prev`,
      `deck${n}_next`,
      `deck${n}_rec`,
    );
  });
  if (deckKeys.length)
    section(
      "decks",
      "HyperDecks",
      "Transport for the first decks in LivePremier Plus's list.",
      deckKeys,
    );

  /* ---------------------------------------------------------- Triggers */
  presets.restore = key(
    "Triggers: restore all",
    `RESTORE\n${v("holds")} held`,
    DARK,
    [act("trigger_restore_all")],
    [fb("triggers_holding", {}, AMBER, BLACK)],
    "auto",
  );
  section(
    "triggers",
    "Triggers",
    "Put back everything the cues' triggers are holding.",
    ["restore"],
  );

  self.setPresetDefinitions(sections, presets);
}
