import { combineRgb } from "@companion-module/base";

import * as read from "./state.js";

/**
 * Feedbacks. Every one is boolean, and every one is false when the fact is
 * not known — no page open, a plugin off, a report not in yet. A key that
 * lights up because the module guessed is worse than one that stays dark.
 */

const WHITE = combineRgb(255, 255, 255);
const BLACK = combineRgb(0, 0, 0);
const GREEN = combineRgb(0, 150, 60);
const AMBER = combineRgb(220, 150, 0);
const RED = combineRgb(200, 30, 30);
const BLUE = combineRgb(30, 90, 180);

const style = (bgcolor, color = WHITE) => ({ bgcolor, color });

export default function UpdateFeedbacks(self) {
  const s = () => self.link.state;
  const routers = (s().matrix || []).map((m) => ({
    id: m.id,
    label: m.name || m.id,
  }));
  const decks = (s().decks?.live || []).map((d) => ({
    id: d.name,
    label: d.name,
  }));
  const plugins = (s().plugins || []).map((p) => ({ id: p.id, label: p.name }));

  self.setFeedbackDefinitions({
    page_open: {
      type: "boolean",
      name: "A LivePremier Plus page is open to run actions",
      description:
        "The Timeline, Layer Lock, Send to, the Console and variables run in an open Web RCS page. Lit while one holds the Control API's lease.",
      defaultStyle: style(GREEN),
      options: [],
      callback: () => Boolean(s().control?.page),
    },
    cue_standby: {
      type: "boolean",
      name: "Timeline: This cue is the standby",
      defaultStyle: style(AMBER, BLACK),
      options: [
        {
          type: "textinput",
          id: "cue",
          label: "Cue number",
          default: "1",
          useVariables: true,
        },
      ],
      callback: (fb) =>
        read.sameCue(read.timeline(s())?.standby?.number, fb.options.cue),
    },
    cue_last: {
      type: "boolean",
      name: "Timeline: This cue fired last",
      defaultStyle: style(RED),
      options: [
        {
          type: "textinput",
          id: "cue",
          label: "Cue number",
          default: "1",
          useVariables: true,
        },
      ],
      callback: (fb) =>
        read.sameCue(read.timeline(s())?.last?.number, fb.options.cue),
    },
    timeline_running: {
      type: "boolean",
      name: "Timeline: A pre-wait or follow is counting down",
      defaultStyle: style(AMBER, BLACK),
      options: [],
      callback: () => Boolean(read.timeline(s())?.running),
    },
    timeline_waiting: {
      type: "boolean",
      name: "Timeline: A cue is waiting for a take to land",
      description:
        "Preview lock holds a cue that recalls into a preview that is mid-take.",
      defaultStyle: style(BLUE),
      options: [],
      callback: () => (read.timeline(s())?.waiting || []).length > 0,
    },
    chase_armed: {
      type: "boolean",
      name: "Timeline: Timecode chase is armed",
      defaultStyle: style(GREEN),
      options: [],
      callback: () => Boolean(read.page(s())?.timecode?.armed),
    },
    timecode_running: {
      type: "boolean",
      name: "Timeline: Timecode is arriving",
      defaultStyle: style(GREEN),
      options: [],
      callback: () => Boolean(read.page(s())?.timecode?.running),
    },
    layer_locked: {
      type: "boolean",
      name: "Layer Lock: This layer (or every layer of this group) is locked",
      defaultStyle: style(RED),
      options: [
        {
          type: "textinput",
          id: "target",
          label: "Layer or layer group",
          default: "S1/1",
          useVariables: true,
        },
      ],
      callback: (fb) => read.isLocked(s(), fb.options.target),
    },
    matrix_route: {
      type: "boolean",
      name: "Matrix: This crosspoint is routed",
      defaultStyle: style(GREEN),
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
      callback: (fb) =>
        read.routedTo(s(), fb.options.matrix, fb.options.output) ===
        Number(fb.options.input),
    },
    deck_state: {
      type: "boolean",
      name: "HyperDeck: The deck is doing this",
      defaultStyle: style(GREEN),
      options: [
        {
          type: "dropdown",
          id: "deck",
          label: "Deck",
          default: decks[0]?.id ?? "1",
          choices: decks,
          allowCustom: true,
        },
        {
          type: "dropdown",
          id: "state",
          label: "State",
          default: "play",
          choices: [
            { id: "play", label: "Playing" },
            { id: "record", label: "Recording" },
            { id: "stopped", label: "Stopped" },
            { id: "preview", label: "Preview (input)" },
            { id: "offline", label: "Not connected" },
          ],
        },
      ],
      callback: (fb) =>
        read.deckState(read.deck(s(), fb.options.deck)) === fb.options.state,
    },
    triggers_holding: {
      type: "boolean",
      name: "Triggers: Something is waiting to be put back",
      defaultStyle: style(AMBER, BLACK),
      options: [],
      callback: () => read.holds(s()).length > 0,
    },
    plugin_on: {
      type: "boolean",
      name: "LivePremier Plus: This plugin is on",
      defaultStyle: style(GREEN),
      options: [
        {
          type: "dropdown",
          id: "plugin",
          label: "Plugin",
          default: plugins[0]?.id ?? "",
          choices: plugins,
          allowCustom: true,
        },
      ],
      callback: (fb) => s().on?.[String(fb.options.plugin)] === true,
    },
  });
}
