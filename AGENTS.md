# AGENTS.md — bringing an LLM up to speed on this Companion module

Orientation for an AI assistant (or a new human) picking this project up cold. There is no
`CLAUDE.md` here; this is the entry point.

---

## 1. What this is

A **Bitfocus Companion connection module** for
[LivePremier Plus](https://github.com/stoatworks-labs/livepremier-plus), the proxy that adds a
cue stack, layer groups, matrix routing and more to an Analog Way LivePremier or Aquilon.
Module id `livepremier-plus`, which is the id LivePremier Plus's own Companion panel adds and
points back at itself (`MODULES.lpp` in its `plugins/companion/core.js`). Changing the id
breaks that.

It drives **what LivePremier Plus adds**, never the switcher. Sources, memories and takes are
the AWJ module's (`analogway-awj`). Two connections that can both set a source is a show where
nobody knows which one last did, so anything that can be said in AWJ stays out of here.

JavaScript, Node 22 runtime, `@companion-module/base` **~2.2** (main since 2026-11-01). A
module built on base 2.2 needs **Companion 5.1 or newer**: 5.0.7 refuses 2.2, and 5.1.2 takes
any 2.2.x. v0.1.1 was released on ~2.1.3 and runs on 5.0.7, so the user guide's "Companion
5.0 or newer" stays until the next release, then becomes 5.1. No build step.

## 2. Two ways in, and why

LivePremier Plus keeps no copy of the switcher's state on the server; the open Web RCS page
holds the store. So:

- **Through the page** — the Timeline, Timecode chase, Layer Lock, Send to (Layer Groups), the
  Console and user variables. `link.do(action, args)` POSTs `/__lpp/control/do`; LivePremier
  Plus's **Control API** plugin hands it to the page holding the lease and returns what the
  page said. No page: a 409 with a sentence, which goes to the log.
- **Direct** — Matrix Routing, HyperDecks, Triggers, `/__lpp/addresses/run`, the plugin
  switches. Their own routes, which work with no page open.

State comes the same two ways: a 3-second poll of `/__lpp/status` and `/__lpp/plugins`, and an
SSE stream per plugin that is on (`STREAMS` in `src/link.js`). The Control API's `/events`
carries the page's report: standby cue, last fired, locks, groups, variables, timecode.

The contract is LivePremier Plus's `docs/CONTROL.md`. Change it there first.

## 3. Layout

```
src/http.js       one request, and LivePremier Plus's own error sentence out of a refusal
src/sse.js        a server-sent events reader on Node's fetch (no EventSource in Node 22)
src/link.js       poll + streams + do(); emits `change`
src/state.js      pure readers over the link's state, for feedbacks and variables
src/actions.js    through-the-page actions and direct ones
src/feedbacks.js  all boolean, all false when not known
src/variables.js  fixed set + var_<name> per user variable + deck<n>_* per HyperDeck
src/presets.js    built from self.label and from what the show has (routers, decks)
src/main.js       InstanceBase: config, status, rebuild when the show's shape changes
test/smoke.mjs    helpers, the link against a loopback stand-in, the module surface
```

## 4. Hard rules

- **Base 2.x traps, all silent at runtime**: `setVariableDefinitions` takes an object keyed by
  id (an array throws and the connection is left empty); `setPresetDefinitions(structure,
presets)` takes two arguments; call `checkAllFeedbacks()`, never a bare `checkFeedbacks()`;
  build preset variable references from `self.label`; `isVisibleExpression` may only read a
  field with `disableAutoExpression: true`. The smoke test pins each one. Keep it passing.
- **Never guess.** A feedback is false and a variable is empty until LivePremier Plus has said
  so. A key that lights up on a guess is worse than a dark one.
- **Say why, in LivePremier Plus's words.** Refusals carry an `error` sentence ("there is no
  cue 9", "PGM is locked on S1"); log it as it came.
- **Do not commit `node_modules`**; the lockfile is committed.
- **`src/about-field.js`, `ATTRIBUTIONS.md`, `.github/FUNDING.yml` and
  `.github/ISSUE_TEMPLATE/` are vendored** from `stoatworks-backend`; edit the master there.
- **Be precise about validation.** See `docs/NOTES.md` for what has actually been run.

## 5. Verifying

```bash
npm test
npm run package
```

End to end without touching anyone's Companion: run Companion headless with its own config
folder and this checkout as an extra module path, and LivePremier Plus against the rack
simulator. `docs/NOTES.md` has the commands.
