// DEVELOPMENT ONLY: clean native screenshot and local GPL disclosure; disposable profile.
const { app } = require("electron"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  assert = require("node:assert/strict");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "candy-release-ui-"));
app.setPath("appData", profile);
app.commandLine.appendSwitch("disable-gpu");
const timeout = setTimeout(() => app.exit(1), 20000);
app.once("browser-window-created", (_, w) =>
  w.webContents.once("did-finish-load", async () => {
    try {
      await new Promise((r) => setTimeout(r, 250));
      await w.webContents.executeJavaScript('openSettings("device")');
      const legal = await w.webContents.executeJavaScript(
        '({text:document.querySelector(".license-copy").textContent,notice:document.querySelector(".legal-notices").textContent,captionInert:!!document.querySelector("[data-window]").closest("[inert]")})',
      );
      assert.equal(
        legal.text,
        fs.readFileSync(path.join(__dirname, "../LICENSE"), "utf8"),
      );
      assert.ok(legal.notice.includes("KnightWin"));
      assert.equal(legal.captionInert, false);
      await w.webContents.executeJavaScript(
        'closeSettings();saveSetting("candyAvatar","finger-heart");settingsSerial',
      );
      await new Promise((r) => setTimeout(r, 250));
      const target = path.join(__dirname, "../docs/candy.png");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, (await w.webContents.capturePage()).toPNG());
      console.log(
        "PASS: local GPL disclosure exactly matches LICENSE; KnightWin legal notice, active captions and clean personal-data-free native screenshot.",
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
