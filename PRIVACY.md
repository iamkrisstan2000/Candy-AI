# Candy privacy and network policy

Candy is an offline AI chatmate. **The only intended internet use by the installed application is the user's explicit Setup Candy action, to download files necessary for its local AI functionality. Nothing else.** There is no account, analytics, chat upload, remote conversation API, advertisement, telemetry SDK or automatic update check.

## What connects, and when

| Operation | Connection |
| --- | --- |
| Launch, settings, avatars, scenes, sounds, speech | No Candy internet download or service call. Assets are bundled; speech uses installed Windows voices. |
| Setup Candy / rerunning setup | HTTPS downloads for the pinned llama.cpp runtime, selected Qwen GGUF model and Microsoft app-local C++ runtime DLLs; GitHub/Hugging Face/Microsoft plus their allowlisted download redirects. No chat content is included. |
| Generation and local context preparation | Node talks to the app-owned AI server on `127.0.0.1` with a random API key, ephemeral port and no web UI. This stays on the PC. |
| Export | User-chosen local JSON file; Candy does not send it anywhere. |
| Clear & reset | Local deletion after the app exits; no remote wipe or account request. |

Setup hosts can see the client's IP address, requested file, ordinary TLS/HTTP connection metadata and Candy's download user agent. They may have their own logging policies. Files and redirects are allowlisted and pinned SHA-256 values are checked before use; temporary downloads are removed on failure/cancellation. The app does not silently run setup when a model is missing.

The sandboxed renderer has `connect-src 'none'`, local-only asset rules and a session-level external-request block. Pop-up windows, external navigation and permission requests are denied. Chromium background networking/component-update/domain-reliability switches are disabled. Setup networking is isolated in the Node downloader and imported only by the setup module. The engine's HTTP traffic is loopback-only.

These controls concern **Candy**. Windows, antivirus, SmartScreen, GPU drivers and other programs may independently contact their own services. Candy does not disable or control those OS/security services.

## Local storage and deletion

Everything managed by Candy lives under `%APPDATA%\CandyLocal`: settings, chats, custom-picture copy, downloaded model/runtime, logs, Electron session/cache/crash-dump directories and temporary files. No cloud backup is configured. Original user-selected pictures are read locally; a resized copy is saved without modifying or uploading the original.

Deleting a conversation removes that saved thread. **Clear & reset** removes the entire app-managed folder after shutdown, including models and settings, and does not restart Candy. The EXE/program and external originals, exports and backups are not deleted. Ordinary filesystem deletion is not forensic secure erasure. Other Windows accounts or programs with appropriate filesystem access may read unencrypted local data.

Developer tools (`npm`, GitHub Actions, build dependencies and optional explicit integration tests) have separate network needs and are not runtime Candy services. The optional real-model test clearly downloads files when deliberately invoked. See TEST-REPORT.md for what was actually tested.
