"use strict";
// Chromium background services are not part of Candy's setup downloader.
// Keep GPU acceleration and Windows accessibility/rendering defaults intact.
const SWITCHES = Object.freeze([
  "disable-background-networking",
  "disable-component-update",
  "disable-domain-reliability",
]);
function configureOfflineBrowser(app) {
  for (const name of SWITCHES) app.commandLine.appendSwitch(name);
}
module.exports = { SWITCHES, configureOfflineBrowser };
