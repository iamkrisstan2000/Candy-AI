async (page, tools) => {
  const check = (x, m) => {
      if (!x) throw Error(m);
    },
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3000");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  check(
    (await page.locator(".footer-version").textContent()).trim() === "v1.0.0",
    "Official footer version missing",
  );
  await page.locator("#open-settings").click();
  await page.getByRole("tab", { name: "Device & data", exact: true }).click();
  const summary = page.locator(".legal-notices summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  check(
    await page.locator(".legal-notices").evaluate((e) => e.open),
    "Legal disclosure is not keyboard operable",
  );
  check(
    (await page.locator(".license-copy").textContent()).includes(
      "Version 3, 29 June 2007",
    ),
    "Incomplete legal text",
  );
  check(
    (await page.locator(".legal-notices").textContent()).includes("KnightWin"),
    "Wrong copyright identity",
  );
  await page.keyboard.press("Tab");
  check(
    await page
      .locator('[data-window="minimize"]')
      .evaluate((e) => e === document.activeElement),
    "Legal summary did not wrap to window controls",
  );
  await page.keyboard.press("Escape");
  const timers = await page.evaluate(async () => {
    let calls = 0;
    const r = new CandyRhythm.ReplyRhythm({
      random: () => 0,
      setTimer: (fn, ms) => {
        calls++;
        return setTimeout(fn, ms);
      },
    });
    r.push("waiting only");
    const initial = calls;
    await new Promise((r) => setTimeout(r, 100));
    const after = calls;
    r.stop();
    return { initial, after };
  });
  check(
    timers.initial === 0 && timers.after === 0,
    "Reply pacing is still polling during generation",
  );
  check(!errors.length, errors.join("; "));
  return {
    officialVersion: true,
    knightWinCopyright: true,
    completeLocalGplText: true,
    legalSummaryKeyboardAndCaptionFocus: true,
    noGenerationPolling: true,
    pageErrors: errors.length,
  };
};
