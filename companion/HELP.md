## LivePremier Plus

Drives what [LivePremier Plus](https://github.com/stoatworks-labs/livepremier-plus) adds to
an Analog Way LivePremier or Aquilon: the Timeline, Layer Lock, Send to a layer group, Matrix
Routing, HyperDecks, Triggers, the Console and your `@variables`. Not affiliated with or
endorsed by Analog Way.

It does **not** drive the switcher. Sources, memories and takes belong to the **Analog Way
AWJ** module, which talks to the box itself. Use both: AWJ for the switcher, this one for the
show layer on top of it. LivePremier Plus's Companion panel adds the pair for you.

### Setting it up

You need a LivePremier Plus newer than 0.18.7, the first with the Control API plugin.

1. In LivePremier Plus, open **Preconfig ▸ LivePremier Plus → Plugins** and switch on
   **Control API**. It is off until you do.
2. Add this connection and point it at **the computer running LivePremier Plus**, not the
   switcher. Address `127.0.0.1` and port `8535` if Companion runs on the same computer.
   From another computer, start LivePremier Plus with `--host 0.0.0.0` so it listens on the
   network, and use that computer's address.
3. Keep a Web RCS page open through LivePremier Plus. The Timeline, Layer Lock, Send to,
   the Console and variables live in that page, so a key for them needs one open. The
   connection goes amber and says so when there isn't one. Matrix, HyperDeck, Triggers and
   plugin keys go straight to LivePremier Plus and need no page.

If several pages are open, the first one runs the actions and the rest wait their turn. Close
it and the next takes over within a few seconds.

### Actions

**Through the open page**

- **Timeline: GO, Back, Skip forward, Back to the top, Stop** — as the Timeline's own
  buttons. GO during a pre-wait fires the cue at once.
- **Timeline: Make a cue the standby** / **Fire a cue now** — by its number: `3`, `3.5`,
  `12a`. A cue with no number answers to its place in the list.
- **Timeline: Timecode chase** — arm, disarm or toggle.
- **Console: Run a line** — anything you would type into the Console, `@variables` and all.
- **Layer Lock: Lock / unlock** and **Take only this** — a layer as `S1/2` (screen 1,
  layer 2), `A1/1` for an aux, or a layer group by name.
- **Layer Groups: Send a source** — put an input, image or nothing on a layer or a group, on
  preview or program, as the layer's … menu does. A shut padlock refuses, as it does there.
- **Variables: Set** — change a variable's definition, or add one: a number, or arithmetic
  over other variables such as `@gap * 2`. One that doesn't evaluate is kept as typed, as
  the Variables panel keeps it, and the log says why.

**Straight to LivePremier Plus**

- **Matrix: Route a crosspoint**, router output from router input. **Feed a switcher input**
  and **Send a switcher output** go through the patch, so you name the switcher's side and
  LivePremier Plus works out which router port is cabled to it.
- **HyperDeck: Transport** — play, stop, cue a clip, next/previous, record, preview, for one
  deck or all of them.
- **Triggers: Send a trigger's lines**, its go or its back side, as Test go and Test back
  do, and **Restore all** that the cues' triggers are holding.
- **Run an address** — any plugin address, `/lp/matrix/…`, `/hyperdeck/…`, `/lp/dante/…`,
  `/ma3/…`, with its arguments.
- **Plugin: Switch on or off**.

When LivePremier Plus refuses something, the reason goes to the connection's log in its own
words: "there is no cue 9", "PGM is locked on S1".

### Feedbacks

The standby cue, the cue fired last, a pre-wait counting down, a cue waiting for a take,
chase armed, timecode arriving, a layer or group locked, a crosspoint routed, a deck playing
or recording, triggers holding something, a plugin on, and a page open to run actions. Each
is false when it isn't known yet, so a key never lights up on a guess.

### Variables

`standby_number`, `standby_label`, `next_*`, `previous_*`, `last_*`, `cue_count`,
`stack_name`, `running`, `chase`, `timecode`, `locks`, `lock_count`, `holds`, `page_open`,
`connected`, `version` and `device`. Every user variable appears as `var_<name>`, and each
HyperDeck as `deck<n>_name`, `_state`, `_clip`, `_remaining` and `_timecode`.

### Presets

GO with the standby cue on the key, Back, Skip, Top, Stop and Chase; fire and standby keys for
cues 1–12; lock and take-only keys for layer 1 of screens 1–4; inputs 1–8 to S1 layer 1; a
row for the first router; transport for each HyperDeck; and Restore all.
