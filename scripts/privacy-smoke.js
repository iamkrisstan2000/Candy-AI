// DEVELOPMENT ONLY: no model/downloads; disposable profile and actual Electron session policy.
const { app, session } = require("electron"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "candy-privacy-test-"));
app.setPath("appData", root);
app.commandLine.appendSwitch("disable-gpu");
let external = 0;
const https = require("node:https");
https.get = () => {
  external++;
  throw Error("Unexpected setup download during ordinary use");
};
const timeout = setTimeout(() => {
  console.error("Privacy test timed out");
  app.exit(1);
}, 20000);
app.once("browser-window-created", (_, w) =>
  w.webContents.once("did-finish-load", async () => {
    try {
      await new Promise((r) => setTimeout(r, 400));
      assert.equal(external, 0);
      assert.ok(app.commandLine.hasSwitch("disable-background-networking"));
      assert.ok(app.commandLine.hasSwitch("disable-component-update"));
      const csp = await w.webContents.executeJavaScript(
        '(async()=>{try{await fetch("https://example.com/candy-network-probe");return false}catch{return true}})()',
      );
      assert.equal(csp, true);
      let blocked = false;
      try {
        await session.defaultSession.fetch(
          "https://example.com/candy-session-probe",
        );
      } catch (e) {
        blocked = String(e).includes("ERR_BLOCKED_BY_CLIENT");
      }
      assert.equal(
        blocked,
        true,
        "Session did not block external HTTP before transmission",
      );
      const loaded = await w.webContents.executeJavaScript(
        "window.candy.load()",
      );
      assert.ok(!loaded.installation);
      const chat = await w.webContents.executeJavaScript(
        'window.candy.chat("nonexistent").then(()=>false,e=>e.message.includes("Set up Candy"))',
      );
      assert.equal(chat, true);
      assert.equal(external, 0);
      console.log(
        "PASS: no startup/ordinary-use setup downloads; CSP rejects renderer fetch; actual Electron session blocks external HTTP; chat without a model does not secretly download.",
      );
      clearTimeout(timeout);
      await w.webContents.session.clearStorageData();
      app.exit(0);
    } catch (e) {
      console.error("FAIL:", e);
      clearTimeout(timeout);
      app.exit(1);
    }
  }),
);
require("../src/main");
