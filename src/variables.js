import * as read from "./state.js";

/**
 * Variables.
 *
 * A fixed set for the app and the Timeline, plus one per user `@variable`
 * and one set per HyperDeck, which come and go with the show — so the
 * definitions are rebuilt when those lists change (`shapeKey` in main.js),
 * not on every report.
 *
 * Base 2.x wants the definitions as an object keyed by id. An array throws,
 * and the connection is left with nothing registered and no visible cause.
 */

const FIXED = {
  connected: "Connected to LivePremier Plus (yes/no)",
  version: "LivePremier Plus version",
  device: "The switcher LivePremier Plus is pointed at",
  page_open: "A page is open to run actions (yes/no)",
  stack_name: "Timeline: the cue stack's name",
  cue_count: "Timeline: how many cues",
  standby_number: "Timeline: standby cue number",
  standby_label: "Timeline: standby cue name",
  next_number: "Timeline: the cue after the standby, number",
  next_label: "Timeline: the cue after the standby, name",
  previous_number: "Timeline: the cue before the standby, number",
  previous_label: "Timeline: the cue before the standby, name",
  last_number: "Timeline: the cue that fired last, number",
  last_label: "Timeline: the cue that fired last, name",
  running: "Timeline: a pre-wait or follow is counting down (yes/no)",
  chase: "Timeline: timecode chase (armed/off)",
  timecode: "Timeline: the timecode arriving (hh:mm:ss)",
  locks: "Layer Lock: the locked layers",
  lock_count: "Layer Lock: how many layers are locked",
  holds: "Triggers: how many holds are waiting to be put back",
};

export function variableDefinitions(state) {
  const defs = {};
  for (const [id, name] of Object.entries(FIXED)) defs[id] = { name };
  for (const v of read.page(state)?.variables || []) {
    defs[read.variableId(v.name)] = { name: `Variables: @${v.name}` };
  }
  (state.decks?.live || []).forEach((d, i) => {
    const n = i + 1;
    defs[`deck${n}_name`] = { name: `HyperDeck ${n}: name (${d.name})` };
    defs[`deck${n}_state`] = {
      name: `HyperDeck ${n}: play, record, stopped… (${d.name})`,
    };
    defs[`deck${n}_clip`] = { name: `HyperDeck ${n}: clip (${d.name})` };
    defs[`deck${n}_remaining`] = {
      name: `HyperDeck ${n}: time left in the clip (${d.name})`,
    };
    defs[`deck${n}_timecode`] = {
      name: `HyperDeck ${n}: timecode (${d.name})`,
    };
  });
  return defs;
}

const yes = (b) => (b ? "yes" : "no");

export function variableValues(state) {
  const page = read.page(state);
  const t = page?.timeline;
  const values = {
    connected: yes(state.connected),
    version: state.version ?? "",
    device: state.device ?? "",
    page_open: yes(Boolean(state.control?.page)),
    stack_name: t?.name ?? "",
    cue_count: t ? t.count : "",
    standby_number: t?.standby?.number ?? "",
    standby_label: t?.standby?.label ?? "",
    next_number: t?.next?.number ?? "",
    next_label: t?.next?.label ?? "",
    previous_number: t?.previous?.number ?? "",
    previous_label: t?.previous?.label ?? "",
    last_number: t?.last?.number ?? "",
    last_label: t?.last?.label ?? "",
    running: yes(Boolean(t?.running)),
    chase: page?.timecode ? (page.timecode.armed ? "armed" : "off") : "",
    timecode: page?.timecode?.value ?? "",
    locks: (page?.locks || []).join(", "),
    lock_count: page?.locks ? page.locks.length : "",
    holds: read.holds(state).length,
  };
  for (const v of page?.variables || [])
    values[read.variableId(v.name)] = v.value ?? "";
  (state.decks?.live || []).forEach((d, i) => {
    const n = i + 1;
    values[`deck${n}_name`] = d.name ?? "";
    values[`deck${n}_state`] = read.deckState(d);
    values[`deck${n}_clip`] = read.deckClip(d);
    values[`deck${n}_remaining`] = read.clock(d.position?.remaining);
    values[`deck${n}_timecode`] =
      d.transport?.displayTimecode ?? d.transport?.timecode ?? "";
  });
  return values;
}

export default function UpdateVariableDefinitions(self) {
  self.setVariableDefinitions(variableDefinitions(self.link.state));
}

export function refreshVariables(self) {
  self.setVariableValues(variableValues(self.link.state));
}
