# companion-module-livepremier-plus

> **AI-assisted project.** This module was written with [Claude](https://claude.com/claude-code)
> (Anthropic), directed and reviewed by a human author. It has been run end to end from a
> real Companion 5.0.7 against LivePremier Plus and Analog Way's rack simulator, not yet
> against a switcher in a show, so try it on yours before you trust it with one.

A [Bitfocus Companion](https://bitfocus.io/companion) module for
**[LivePremier Plus](https://github.com/stoatworks-labs/livepremier-plus)**, the layer that
sits between your browser and an Analog Way LivePremier or Aquilon and adds a cue stack,
layer groups, matrix routing and the rest.

It drives what LivePremier Plus adds, and nothing else: GO on the Timeline with the standby
cue written on the key, Layer Lock, Send to a layer group, Matrix Routing, HyperDecks,
Triggers, the Console and your `@variables`. The switcher's own sources, memories and takes
belong to Analog Way's **AWJ** module, which talks to the box directly. Run both;
LivePremier Plus's Companion panel will add the pair for you.

Not affiliated with or endorsed by Analog Way. Product names are used only to describe
compatibility.

<!-- downloads:start -->

## Download

**[v0.1.0](https://github.com/stoatworks-labs/companion-module-livepremier-plus/releases/tag/v0.1.0)**

This release contains:

- [`companion-module-livepremier-plus-pkg.tgz`](https://github.com/stoatworks-labs/companion-module-livepremier-plus/releases/latest/download/companion-module-livepremier-plus-pkg.tgz) — npm package
- [`livepremier-plus-0.1.0.tgz`](https://github.com/stoatworks-labs/companion-module-livepremier-plus/releases/download/v0.1.0/livepremier-plus-0.1.0.tgz) — npm package

All builds, checksums and release notes: [github.com/stoatworks-labs/companion-module-livepremier-plus/releases](https://github.com/stoatworks-labs/companion-module-livepremier-plus/releases).

<!-- downloads:end -->

## Install

You need a LivePremier Plus newer than 0.18.7: the Control API plugin this module talks to
arrived after it.

1. Download the `.tgz` above. Don't unpack it.
2. In Companion (4.1 or later), open **Modules** and choose **Import module package**, then
   pick the file. It appears as **Stoatworks Labs: LivePremier Plus**.
3. In LivePremier Plus, switch on **Control API** under **Preconfig ▸ LivePremier Plus →
   Plugins**.
4. Add the connection, either from LivePremier Plus's own **Companion** panel (it points the
   connection back at itself) or by hand in Companion with LivePremier Plus's address and
   port, `127.0.0.1` and `8535` on the same computer.

Companion on another computer needs LivePremier Plus started with `--host 0.0.0.0`, so it
listens on the network rather than only on its own machine.

## What needs a page open

The Timeline, Layer Lock, Send to, the Console and variables run in an open Web RCS page,
because that is where LivePremier Plus keeps the show. Leave one open through LivePremier
Plus; a tab in the background is fine. The connection turns amber and says so when there
isn't one, and a key pressed meanwhile is refused in the log rather than quietly ignored.
Matrix, HyperDeck, Triggers and plugin keys go straight to LivePremier Plus and work without
a page.

## Actions, feedbacks, variables, presets

The full list is in [companion/HELP.md](companion/HELP.md), which is also what Companion shows
under the connection's help button.

## Develop

```bash
npm install
npm test            # helpers, the link against a stand-in server, the module surface
npm run format
npm run package     # livepremier-plus-<version>.tgz
```

The HTTP contract this module speaks is LivePremier Plus's
[docs/CONTROL.md](https://github.com/stoatworks-labs/livepremier-plus/blob/main/docs/CONTROL.md).
See [AGENTS.md](AGENTS.md) for how the module is put together and what it must not do.

<!-- attributions:start -->

This project is built on other people's work — see [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
<!-- attributions:end -->

## Licence

MIT.
