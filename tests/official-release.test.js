const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { configureOfflineBrowser, SWITCHES } = require("../src/privacy"),
  { allowed } = require("../src/network");
const root = path.join(__dirname, ".."),
  text = (f) => fs.readFileSync(path.join(root, f), "utf8");
test("official release identity, license and Windows metadata editing are configured", () => {
  const p = JSON.parse(text("package.json"));
  assert.equal(p.version, "1.0.0");
  assert.equal(p.author, "KnightWin");
  assert.equal(p.license, "GPL-3.0-only");
  assert.equal(p.build.win.signAndEditExecutable, true);
  assert.equal(p.build.win.signExecutable, false);
  assert.ok(p.build.copyright.includes("KnightWin"));
  assert.deepEqual(p.build.electronLanguages, ["en-US"]);
  assert.ok(p.build.files.includes("NOTICE"));
  assert.ok(text("LICENSE").includes("Version 3, 29 June 2007"));
  assert.ok(text("LICENSE").length > 35000);
});
test("background network switches are applied before readiness without disabling GPU or accessibility", () => {
  const calls = [];
  configureOfflineBrowser({
    commandLine: { appendSwitch: (x) => calls.push(x) },
  });
  assert.deepEqual(calls, [...SWITCHES]);
  assert.ok(calls.includes("disable-background-networking"));
  assert.ok(calls.includes("disable-component-update"));
  assert.ok(!calls.some((s) => /gpu|sandbox|accessibility/.test(s)));
});
test("external downloader is reachable only from setup, with renderer networking still denied", () => {
  for (const name of fs
    .readdirSync(path.join(root, "src"))
    .filter(
      (x) => x.endsWith(".js") && !["setup.js", "network.js"].includes(x),
    ))
    assert.ok(!text("src/" + name).includes("require('./network')"), name);
  assert.ok(text("src/setup.js").includes("require('./network')"));
  assert.ok(
    text("src/main.js").includes(
      "!['file:','data:','devtools:'].includes(u.protocol)",
    ),
  );
  assert.ok(text("renderer/index.html").includes("connect-src 'none'"));
  assert.equal(allowed("https://example.com/tracker"), false);
  assert.equal(allowed("http://huggingface.co/model"), false);
});
test("unused partial reply copies and token IPC are removed, without touching final commit conditions", () => {
  const main = text("src/main.js"),
    app = text("renderer/app.js");
  assert.ok(!main.includes("partial+=token"));
  assert.ok(!main.includes("notify({type:'token'"));
  assert.ok(!app.includes('e.type === "token"'));
  assert.ok(main.includes("!result.stopped&&!chatCancelled&&!resetting"));
  assert.ok(app.includes("rhythm.finish(r.text)"));
});
test("GPL legal notice is local, visible on Device page, and keyboard reachable", () => {
  const html = text("renderer/index.html");
  assert.ok(html.includes("About Candy &amp; license"));
  assert.ok(html.includes("Copyright © 2026 KnightWin"));
  assert.ok(html.includes("There is NO WARRANTY."));
  assert.ok(html.includes("GNU GENERAL PUBLIC LICENSE"));
  assert.ok(!/(?:href|src)=["']https?:/.test(html));
  assert.ok(text("renderer/app.js").includes("#settings summary"));
});
