/**
 * Reading the link's state: what feedbacks and variables ask of it.
 *
 * Pure, so it is tested without Companion or a network. Every function takes
 * the state the link holds (`emptyState()` in link.js) and answers plainly,
 * with null or false for anything not known yet — a button must never claim
 * a cue is standing by because a report has not arrived.
 */

const text = (v) => (v == null ? "" : String(v).trim());

/** The open page's report, or null when no page holds the lease. */
export const page = (s) =>
  s?.control?.page && s.control.state ? s.control.state : null;

export const timeline = (s) => page(s)?.timeline || null;

/**
 * Do two cue numbers name the same cue? `3` is `3.0` and `03`, not `3.5` —
 * the rule LivePremier Plus's Control API uses to find one.
 */
export function sameCue(a, b) {
  const x = text(a).toLowerCase();
  const y = text(b).toLowerCase();
  if (!x || !y) return false;
  if (x === y) return true;
  const n = (s) => (/^\d+(\.\d+)?$/.test(s) ? Number(s) : null);
  return n(x) != null && n(x) === n(y);
}

/**
 * The `S1/2` keys a target names: a layer as `S1/2` (or `S1 L2`), or a layer
 * group by name from the page's report. Empty when it names nothing known.
 */
export function targetKeys(s, raw) {
  const t = text(raw);
  const m = /^([SA])\s*(\d+)\s*(?:\/|\s|L)\s*L?\s*(\d+|native|nat)$/i.exec(t);
  if (m) {
    const layer = /^nat/i.test(m[3]) ? "NATIVE" : String(Number(m[3]));
    return [`${m[1].toUpperCase()}${Number(m[2])}/${layer}`];
  }
  const group = (page(s)?.groups || []).find(
    (g) => text(g.name).toLowerCase() === t.toLowerCase(),
  );
  return group ? [...group.members] : [];
}

/** Every key of the target is locked. */
export function isLocked(s, target) {
  const locks = page(s)?.locks;
  const keys = targetKeys(s, target);
  return Boolean(locks && keys.length && keys.every((k) => locks.includes(k)));
}

/** A user variable's value, or undefined. */
export function userVariable(s, name) {
  const v = (page(s)?.variables || []).find(
    (x) =>
      text(x.name).toLowerCase() === text(name).replace(/^@/, "").toLowerCase(),
  );
  return v ? v.value : undefined;
}

/* --------------------------------------------------------------- matrix */

export function router(s, ref) {
  const r = text(ref).toLowerCase();
  const list = s?.matrix || [];
  if (!r) return list[0] || null;
  return (
    list.find(
      (m) => text(m.id).toLowerCase() === r || text(m.name).toLowerCase() === r,
    ) || null
  );
}

/** The router input on an output, 1-based, or null. */
export function routedTo(s, ref, output) {
  const m = router(s, ref);
  const v = m?.state?.routing?.[String(Number(output))];
  return v == null ? null : Number(v);
}

/* ------------------------------------------------------------ hyperdeck */

/** A deck by name, id or 1-based position, as LivePremier Plus finds one. */
export function deck(s, ref) {
  const live = s?.decks?.live || [];
  const r = text(ref);
  if (/^\d+$/.test(r)) return live[Number(r) - 1] || null;
  const low = r.toLowerCase();
  return (
    live.find(
      (d) =>
        text(d.id).toLowerCase() === low || text(d.name).toLowerCase() === low,
    ) || null
  );
}

/** What a deck is doing, in one word: playing, recording, stopped, preview, offline… */
export function deckState(d) {
  if (!d) return "unknown";
  if (d.status !== "connected") return "offline";
  return text(d.transport?.status) || "unknown";
}

export function deckClip(d) {
  const id = d?.transport?.clip;
  const clip = (d?.clips || []).find((c) => c.id === id);
  return clip ? clip.name : id != null ? `Clip ${id}` : "";
}

/** `m:ss` from seconds; an hour or more as `h:mm:ss`. */
export function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const t = Math.floor(seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/* ------------------------------------------------------------- triggers */

export const holds = (s) => (s?.triggers?.holds || []).filter((h) => !h.stale);

/* ------------------------------------------------------------ variables */

/** A variable id from a user variable's name: `@side.gap` → `var_side_gap`. */
export const variableId = (name) =>
  `var_${text(name)
    .replace(/^@/, "")
    .replace(/[^A-Za-z0-9_]/g, "_")}`;
