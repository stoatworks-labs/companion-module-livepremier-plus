# Notes

## What has been run (2026-10-31, v0.1.0)

Companion 5.0.7, headless with its own config folder, against LivePremier Plus 0.18.7 with the
new Control API plugin (unreleased at the time), pointed at Analog Way's rack simulator, with
the HyperDeck simulator from LivePremier Plus's `tools/`. No real switcher, no real HyperDeck,
no Stream Deck.

- The connection was added by LivePremier Plus's own Companion panel
  (`POST /__lpp/companion/connections`), which found the module, added it and pointed it back
  at LivePremier Plus. Status went green.
- The packaged `livepremier-plus-0.1.0.tgz` installed through Companion's import route
  (`instances.modulesManager.installModuleTar`), ran, and showed its About block.
- Presets were dropped onto buttons (`controls.importPreset`) and pressed
  (`controls.hotPressControl`), and the variables read back over Companion's HTTP API:
  GO, Back, Skip, Top, fire cue, chase toggle, lock / unlock S1 L1, take only S1 L1, send IN1
  to S1 L1, Restore all, router crosspoints, HyperDeck play / stop / next clip. Feedback
  colours were checked on the rendered buttons.
- Console, variables (including one that does not evaluate), Feed / Send through the patch
  (refused: not patched in the scratch show), trigger lines, an address, and a plugin switch
  were run through the module's own callbacks against the same LivePremier Plus.
- With the Web RCS tab in the background for over a minute, the page kept the lease and every
  key still worked. Before LivePremier Plus held the lease on the page's open stream, the
  same test lost it in about fifteen seconds.

Not run: a real LivePremier or Aquilon, a real HyperDeck, a physical surface, Companion on a
different computer from LivePremier Plus.

## Running it the same way

```bash
# LivePremier Plus against the simulator, on a scratch data folder
node server/index.js --device <sim-host:port> --port 8540 --data <scratch>/lpp-data

# Companion, without touching the installed one's config
"/Applications/Companion.app/Contents/Resources/node-runtimes/node22/bin/node" \
  /Applications/Companion.app/Contents/Resources/main.js \
  --config-dir <scratch>/companion-config --admin-port 8611 --admin-address 127.0.0.1 \
  --extra-module-path <folder holding this checkout>
```

Then open Web RCS through LivePremier Plus, switch on Control API, point its Companion panel
at `127.0.0.1:8611` and add the connection. Variables read back at
`http://127.0.0.1:8611/api/variable/<connection label>/<name>/value`.

## Why the lease lives on the stream

A browser slows the timers of a tab hidden for a while to about one tick a minute. The page's
4-second beat on `/runner` then misses its 12-second lease, and a page that is open and
listening, the usual place for Web RCS during a show, stops running Companion's keys.
LivePremier Plus now holds the lease for as long as the page's `/stream` is open and hands it to
the next open page the moment that stream closes; the beat is a fallback.
