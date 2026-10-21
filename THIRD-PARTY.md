# Third-party notices and source references

Candy is an independent application by KnightWin, not affiliated with Microsoft, MSN/Windows Live Messenger, Qwen or llama.cpp. Windows is a Microsoft trademark. Its original scene artwork, mascot and AI-assisted avatar illustrations are not copied Messenger/Windows account artwork; chat sounds are original oscillator recipes, not redistributed Messenger recordings.

## Candy's own work

Candy application code, original interface artwork and original sound recipes: **GNU GPL version 3 only**, copyright © 2026 KnightWin. See LICENSE and NOTICE. The matching Candy source archive includes the application, assets, dependency lockfile, tests and build/release scripts. Historical experimental releases keep their original licenses.

## Bundled dependencies

- **Electron 44.9.1 — MIT**, with Chromium, Node.js, V8, FFmpeg and other components under their respective licenses. Preserve the upstream `LICENSE.electron.txt` and `LICENSES.chromium.html` in the desktop payload. Upstream source/tag: https://github.com/electron/electron/tree/v44.9.1 . That source's DEPS/build definitions pin its Chromium and other dependencies; follow the upstream source/build instructions for those components. Do not delete or replace those notices with Candy's GPL.
- **extract-zip 2.0.1 — BSD-2-Clause**; its production dependencies retain their upstream notices within `app.asar/node_modules/`. Sources and exact versions/integrity are in package-lock.json and https://github.com/max-mapper/extract-zip/tree/v2.0.1 .
- Electron Builder, resedit, yazl and optional Python/Playwright tools are **development/build tools**, not bundled Candy runtime dependencies. Their own upstream licenses apply; the lockfile records the JavaScript tools. resedit edits/verifies Windows version/icon resources without a signing key; it does not certify the publisher.

GPL does not override these third-party licenses. Redistributors must preserve their notices and comply with any corresponding-source or relinking obligations that apply to the versions they distribute. Consult the bundled upstream notices, not just this summary.

## Downloaded only by explicit Setup Candy

- **llama.cpp b11755 Windows x64 runtime — MIT.** Source: https://github.com/ggml-org/llama.cpp/tree/b11755 . Downloaded archives retain their upstream notices, including LLVM OpenMP terms. No llama.cpp binary is in the initial Candy EXE.
- **Qwen2.5-1.5B-Instruct-GGUF — Apache 2.0.** https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF
- **Qwen3-4B-GGUF — Apache 2.0.** https://huggingface.co/Qwen/Qwen3-4B-GGUF
- **Microsoft Visual C++ app-local runtime DLLs** from `Microsoft.VCLibs.x64.14.00.Desktop.appx` — proprietary Microsoft software under Microsoft's applicable terms, **not Candy's GPL**. Candy fetches the original directly from Microsoft on the user's setup request, copying only required DLLs beside the local AI server; it does not redistribute those DLLs in the initial EXE or install a system-wide package. https://learn.microsoft.com/troubleshoot/developer/visualstudio/cpp/libraries/c-runtime-packages-desktop-bridge

Runtime/model URLs, expected sizes and SHA-256 hashes are pinned in `src/runtime-manifest.json` and `src/core.js`. Apache 2.0: https://www.apache.org/licenses/LICENSE-2.0 . Model outputs may be inaccurate; a model license is not an accuracy or suitability guarantee.
