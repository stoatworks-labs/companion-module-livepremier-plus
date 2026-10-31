import { InstanceBase, InstanceStatus } from "@companion-module/base";
import { UpgradeScripts } from "./upgrades.js";
import UpdateActions from "./actions.js";
import UpdateFeedbacks from "./feedbacks.js";
import UpdateVariableDefinitions, { refreshVariables } from "./variables.js";
import UpdatePresets from "./presets.js";
import { Link } from "./link.js";
import * as read from "./state.js";
import { aboutField } from "./about-field.js";

/** How long a burst of reports is gathered before the buttons are redrawn. */
const SETTLE_MS = 50;

/**
 * What the definitions are built from: the plugins and which are on, the
 * routers, decks and triggers in the dropdowns, and the user variables and
 * decks that each get variables. A change here rebuilds the definitions; any
 * other change only refreshes values and feedbacks.
 */
function shapeKey(s) {
  return JSON.stringify([
    s.connected,
    (s.plugins || []).map((p) => [p.id, p.on]),
    (s.matrix || []).map((m) => [m.id, m.name]),
    (s.decks?.live || []).map((d) => d.name),
    (s.triggers?.triggers || []).map((t) => [t.id, t.name]),
    (read.page(s)?.variables || []).map((v) => v.name),
  ]);
}

export default class ModuleInstance extends InstanceBase {
  constructor(internal) {
    super(internal);
    this.shape = null;
    this.settle = null;
    this.link = new Link(
      () => ({ host: this.config?.host, port: this.config?.port }),
      (level, text) => this.log(level, text),
    );
    this.link.on("change", () => {
      clearTimeout(this.settle);
      this.settle = setTimeout(() => this.refresh(), SETTLE_MS);
    });
  }

  async init(config) {
    this.config = config;
    this.updateStatus(InstanceStatus.Connecting);
    this.rebuild();
    this.link.start();
  }

  async destroy() {
    clearTimeout(this.settle);
    this.link.stop();
  }

  async configUpdated(config) {
    this.config = config;
    this.updateStatus(InstanceStatus.Connecting);
    this.link.start();
    this.rebuild();
  }

  rebuild() {
    this.shape = shapeKey(this.link.state);
    UpdateActions(this);
    UpdateFeedbacks(this);
    UpdateVariableDefinitions(this);
    UpdatePresets(this);
    refreshVariables(this);
    this.checkAllFeedbacks();
  }

  refresh() {
    const s = this.link.state;
    if (shapeKey(s) !== this.shape) this.rebuild();
    else {
      refreshVariables(this);
      this.checkAllFeedbacks();
    }
    this.status(s);
  }

  /** Ok only when every kind of action would work; otherwise say what is missing. */
  status(s) {
    if (!s.connected) {
      this.updateStatus(
        InstanceStatus.ConnectionFailure,
        s.error || "Not connected",
      );
    } else if (s.on.control !== true) {
      this.updateStatus(
        InstanceStatus.UnknownWarning,
        "Control API is off: Timeline, locks and variables keys do nothing",
      );
    } else if (!s.control?.page) {
      this.updateStatus(
        InstanceStatus.UnknownWarning,
        "No LivePremier Plus page open: Timeline, locks and variables keys wait for one",
      );
    } else {
      this.updateStatus(InstanceStatus.Ok);
    }
  }

  getConfigFields() {
    return [
      {
        type: "static-text",
        id: "info",
        width: 12,
        label: "Connection",
        value:
          "Point this at the computer running <b>LivePremier Plus</b>, not at the switcher. Switch on <b>Control API</b> in LivePremier Plus (Preconfig ▸ LivePremier Plus → Plugins) and keep a Web RCS page open through it: the Timeline, Layer Lock, Send to, the Console and variables run in that page. Matrix, HyperDeck and Triggers keys work without one. For the switcher's own sources, memories and takes, add the Analog Way AWJ module as well.",
      },
      {
        type: "textinput",
        id: "host",
        label: "LivePremier Plus address",
        width: 8,
        default: "127.0.0.1",
        tooltip:
          "127.0.0.1 when Companion runs on the same computer. From another computer, start LivePremier Plus with --host 0.0.0.0.",
      },
      {
        type: "number",
        id: "port",
        label: "Port",
        width: 4,
        default: 8535,
        min: 1,
        max: 65535,
      },
      aboutField(),
    ];
  }
}

export { UpgradeScripts };
