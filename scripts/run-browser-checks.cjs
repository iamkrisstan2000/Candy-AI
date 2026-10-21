// DEVELOPMENT ONLY. npm install --no-save playwright, then npx playwright install chromium.
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { chromium } = require(process.env.CANDY_PLAYWRIGHT_PATH || "playwright");
const output = path.resolve(
  process.env.CANDY_TEST_OUTPUT_DIR ||
    path.join(__dirname, "../.cache/test-output"),
);
fs.mkdirSync(output, { recursive: true });
const outputPath = (name) => path.join(output, name);
(async () => {
  const names = process.argv.slice(2);
  if (!names.length)
    throw Error("Pass check names, e.g. settings-chrome sounds");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    for (const name of names) {
      if (!/^[a-z-]+$/.test(name)) throw Error("Invalid check name");
      const context = await browser.newContext({
          viewport: { width: 1360, height: 900 },
        }),
        page = await context.newPage();
      page.setDefaultTimeout(15000);
      const log = outputPath("candy100-" + name + ".log");
      try {
        await page.goto("http://localhost:3000");
        const text = fs.readFileSync(
            path.join(__dirname, name + "-check.playwright.js"),
            "utf8",
          ),
          fn = vm.runInThisContext("(" + text + "\n)", {
            filename: name + "-check",
          });
        const result = await fn(page, {
          outputPath,
          imagePixels: (buffer) =>
            require("node:child_process").execFileSync(
              "python3",
              [
                "-c",
                'import sys;from PIL import Image;im=Image.open(sys.stdin.buffer).convert("RGBA");sys.stdout.buffer.write(im.tobytes())',
              ],
              { input: buffer },
            ),
        });
        if (result.audioPreviews) {
          for (const a of result.audioPreviews) {
            const target = outputPath("Candy-1.0.0-" + a.name + ".wav");
            fs.writeFileSync(target, Buffer.from(a.wavBase64, "base64"));
            delete a.wavBase64;
            a.file = target;
          }
        }
        fs.writeFileSync(log, "### Result\n" + JSON.stringify(result) + "\n");
        console.log(name + " PASS " + JSON.stringify(result).slice(0, 250));
      } catch (e) {
        fs.writeFileSync(log, "### Error\n" + e.stack + "\n");
        throw e;
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
