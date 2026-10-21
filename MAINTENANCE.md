# Maintaining Candy 1.0

## Project map

- `src/`: Electron lifecycle/preload, settings/storage, local AI engine/setup, security and privacy policy.
- `renderer/`: local interface, original scene/mascot/avatars, sound recipes, one-shot reply pacing and deterministic persona/theme/conversation helpers.
- `assets/`: Windows ICO/PNG. Keep the fixed app icon independent of selected avatars.
- `tests/`: Node regression tests. `scripts/`: development/build/integration/browser/asset tools. None are runtime app hooks.
- `docs/candy.png`: clean screenshot with disposable demo preferences, no personal chat data.
- `LICENSE`, `NOTICE`, `THIRD-PARTY.md`, `PRIVACY.md`: release licensing/privacy contract. In-app Device & data exposes a local GPL notice/text. Keep it synchronized with LICENSE.

## Build and prepare a release

Use Node.js 24+; `npm ci --no-audit --no-fund`, then `npm test` and `npm run build:win`. Windows produces portable and installer builds. No private signing key is required. `signAndEditExecutable:true` writes the app icon and KnightWin/1.0 metadata; `signExecutable:false` keeps the build unsigned. **Do not switch metadata editing off**—that leaves Electron's own file properties behind.

The builder's cross-platform JavaScript PE editor handles version/icon resources. `npm run release:prepare` creates the complete allowlisted source ZIP, release notes and SHA256SUMS.txt. `npm run release:verify` compares runtime/source files, Windows inner/outer version resources, English locale and artifact hashes, then CRC-tests the complete portable payload and byte-compares its embedded ASAR. Publish the **matching source ZIP with the binary**, as required for Candy's GPL distribution. Never publish private profiles, models, cache, uploads, node_modules or old workbench outputs. Test the exact Windows EXE on Windows before claiming Windows certification.

For memory-constrained cross-builds, use compression level 5. Build the unpacked app first (`electron-builder --win --dir --x64`), then package it in a separate process (`electron-builder --prepackaged release/win-unpacked --win portable --x64`). This avoids retaining PE-editing buffers during compression. Do not use high compression levels blindly; they can exhaust build memory. Keep full payload CRC/extracted-ASAR verification in the release audit.

## GitHub workflow

Commit the repository contents at the repository root (package.json beside README), not a nested extra `candy/` directory. `.github/workflows/build-windows.yml` installs locked dependencies, runs unit/protocol tests, builds on Windows and launches the real unpacked app with a disposable profile. It prepares/verifies source and hashes, then uploads workflow artifacts. Pushing **v1.0.0** creates a **draft** release with those assets; review and publish it yourself. The optional real-model test is opt-in and downloads roughly 1.2 GB; a tag build does not pretend it ran that test. No repository URL/token is hardcoded in the app.

## Optional regression checks

Browser tools are separate development dependencies. Install Playwright/Chromium separately, run `npm run preview` and pass `CANDY_PLAYWRIGHT_PATH` if using a shared installation. Then:

```text
node scripts/run-browser-checks.cjs settings-chrome titlebar animated-avatars sounds conversations sidebar-menu identity-cleanup pacing
```

Screenshots/logs go under `.cache/test-output/`, or `CANDY_TEST_OUTPUT_DIR`; no fixed workshop paths. Avatar playback checks compare compositor screenshots (canvas drawImage uses a default frame) and require development Pillow for pixel decoding. Python pixel/style tools use requirements-dev.txt. Never bundle those tools as app dependencies.

Native Linux fixtures need Electron, GTK, Xvfb; `settings-chrome-smoke.js` additionally needs Openbox to assert actual minimize/maximize/restore/close. Use disposable profiles only. `privacy-smoke.js` asserts no ordinary-use setup downloader calls and real Electron session/CSP external-request blocks. `reset-smoke.js` tests four pending-operation states without touching personal data. `offline-smoke.js` is an explicitly invoked Windows model-download/inference test; it is not run by app launch/npm install.

## Behavior and performance invariants

- No UI redesign: preserve banner wash, corner single-paint, compact titlebar/sidebar/search, caption hit regions and all existing scene palettes/controls.
- Main commits only complete, non-stopped replies. No unnecessary token copies/renderer IPC. Engine may still parse SSE internally; the renderer receives the final reply, not progressive text. Thinking/length delay stays 2–3s plus up to 4s; one-shot timer, no 40ms generation polling. Stop/reset cancels delivery.
- Do not disable GPU acceleration for production rendering. English-only Electron locale PAK is appropriate because Candy's interface is English; keep ICU, fonts/Unicode support, GPU libraries, media libraries and installed voice enumeration intact. Models/hardware planning are unchanged.
- Renderer external networking/navigation/popups/permissions stay blocked. Only setup imports the external downloader. Loopback engine requests remain local and authenticated. Do not add telemetry/updaters/link previews/remote avatars. Chromium background networking/component updates stay disabled.
- Sounds are original low-gain finite synthesis; no startup/history/error/partial cues, independent mute from speech, pending-note cancellation on reset/close. Nudge: primary 560ms ±12 CSS-pixel UI shake, optional bounded 10/3 DIP native motion, cooldown, snap/max/fullscreen protection, no focus/resize/unmaximize, restore after normal completion, manual-move protection and reduced motion. Never overwrite a draft or auto-send.
- Two animated avatars: 256px WebP, 48 × 60ms = 2.88s infinite loops; true still posters for reduced motion/hidden documents. `scripts/render-animated-avatars.py` regenerates from bundled stills using optional Pillow/numpy/OpenCV. Do not reassign an unchanged active src or run hidden picker loops.
- Settings makes workspace/search inert, **not app-shell/titlebar**. Caption buttons and legal summary participate in the keyboard loop. Native reset/delete confirmation retains browser top-layer modality. New/search shortcuts must not mutate background state.
- `%APPDATA%\CandyLocal` is the unchanged data root. Reset deletes ALL managed data after shutdown, never restarts and never deletes the program or external originals. Preserve existing safety/path guards and cancellation ordering. Updating to official 1.0 must not clear data from experimental builds.
