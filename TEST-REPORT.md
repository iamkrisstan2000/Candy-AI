# Candy 1.0 — release validation

Validated 21 October 2026. Official version **1.0.0**, author/company **KnightWin**, Candy-owned work **GPL-3.0-only**. This is release preparation, not a claim that a GitHub release has already been published.

## Executed checks

- **161/161 Node unit/local-protocol tests passed**, zero failures/skips. Includes retained setup, download integrity, storage/reset, personas, avatars, local engine, GPU planning, native-nudge guards, security, atomic replies and new release/privacy/one-shot pacing regressions.
- **20 Chromium suites passed:** official-release, settings-chrome, titlebar, animated-avatars, sounds, conversations, sidebar-menu, identity-cleanup, pacing, beach-refresh, chatmate, scenes, ui, windows-bloom, facelift, corner-material, corner, visual-fixes, polish and beach-bubbles. Fresh isolated browser contexts; labelled fixtures, not real AI output.
- **416 UI contrast screens**, no contrast failures. Original banner pixel checks: **240 cases**, minimum 5.104:1; Windows Bloom: **168 cases**, minimum 5.812:1. Exact veil samples remain 38 / 147 / 255 (left / center / right). **96** corner-material cases and **12** corner pixel cases pass, without double tint or a colored fringe. Scale cases emulate layout; they do not certify Windows DPI/compositing.
- Settings: **16** tab/theme/width cases, **64** trusted caption mouse clicks, caption-inclusive keyboard loop and legal-disclosure focus, inert background/search, preserved drafts and safe reset confirmation. The complete local GPL matches LICENSE; KnightWin and v1.0.0 are present. No generation polling.
- Animated avatars: eight persona/avatar cases, actual WebP compositor playback, persisted selection, original titlebar icon, reduced-motion posters and hidden-document pause. Visible nudge works independently of native success/fallback/error/pending responses; no automatic send or draft loss.
- Sounds: default-on behavior, independent persisted mute, three previews, accepted-send/completed-reply gating, cooldown, reduced motion and pending-cue cancellation. Conversation limit, zero-thread persistence, transactional failures, per-thread export/delete, search and compact-menu behavior pass.
- **Actual Linux Electron**, disposable profiles: privacy, clean release UI/screenshot, sounds/native nudge, desktop, conversations and atomic reply fixtures pass. **Xvfb + Openbox** also verifies real minimize/maximize/restore/close with Settings open; reset passes all four pending-operation cases. These are native Linux results, not Windows execution.
- Privacy fixture: ordinary app use and chat with a missing model do not invoke setup downloads; actual Electron CSP and session policy block external fetches. No cloud-chat path was added. This is targeted validation and source review, not a packet-capture certification of Windows or its services.
- Styles audit: zero unused selector branches, superseded declarations, duplicate keyframes or unused keyframes. Approved scenes, sounds, avatars, nudge, acrylic tints, banner and corner geometry are retained. A clean native screenshot is included as docs/candy.png.

## Built artifact and source verification

Unsigned Windows x64 cross-build using Electron **44.9.1**, electron-builder **26.15.3**, Node **24**, compression **5**. Unpacked staging and portable packaging run separately to bound memory use.

`npm run release:verify` passes:

- Actual **inner Candy.exe and outer portable EXE** Windows resources: CompanyName KnightWin, ProductName Candy, FileVersion 1.0.0, copyright © 2026 KnightWin. Metadata is edited even though signing is disabled. KnightWin is not an Authenticode-verified publisher.
- **43 first-party runtime/license files** byte-compared against source; packaged version/author/license checked. Development scripts, tests, docs, uploads and private profiles excluded from the app. Only the English Electron locale PAK remains; ICU, Unicode, GPU and other runtime libraries are retained.
- **Complete embedded portable archive CRC test**, plus embedded app.asar byte-identical to verified staging. Checking a builder exit code alone is not considered sufficient.
- **118-file complete source ZIP**, every file byte-compared with current source; pinned lockfile, GPL/NOTICE, original assets, tests, screenshot, workflow and build/release tooling included. Dependencies, cache, models, binaries and personal data excluded. SHA256SUMS.txt verifies the binary and source ZIP.

The source archive includes this report. Machine-readable package verification and detailed execution logs are retained separately in the workshop validation archive.

## Explicit limits

The exact Windows EXE has **not been executed on Windows here**. The included GitHub Windows workflow builds, runs unit tests and launches the unpacked app with disposable data when the repository owner runs it; no remote run is claimed. Real-model inference, GPU/CPU throughput, installed Windows voices, physical speakers, native Windows acrylic/drag/DPI and SmartScreen behavior were not newly tested. The optional custom-picture import branch of the broad UI suite was not seeded; it reports that skip explicitly, rather than claiming an import was performed.

No speed/memory benchmark or blanket Windows certification is claimed. The safe optimizations remove unused token IPC/copies and the 40ms generation polling, trim unused locale files and disable unnecessary Chromium background networking without changing approved chat pacing or UI.

## Existing users

Close old Candy and open Candy-Portable-1.0.0-x64.exe. The app ID and **%APPDATA%\CandyLocal** data root are unchanged. **Do not reset to update.** Compatible existing models, chats, settings and avatars remain. Clear & reset is deliberately destructive and closes Candy without restarting or deleting the executable.
