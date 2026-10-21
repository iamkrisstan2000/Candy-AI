"use strict";
// Bounded, cancellable native-window nudge; never focuses, unminimizes or resizes a window.
const OFFSETS = Object.freeze(
  [
    [-10, 0],
    [10, 3],
    [-10, -3],
    [9, 2],
    [-8, -2],
    [6, 1],
    [-5, -1],
    [3, 1],
    [-2, 0],
    [1, 0],
    [0, 0],
  ].map(Object.freeze),
);
class WindowNudge {
  constructor(
    win,
    screen,
    {
      now = () => Date.now(),
      setTimer = setTimeout,
      clearTimer = clearTimeout,
    } = {},
  ) {
    this.win = win;
    this.screen = screen;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.timer = null;
    this.origin = null;
    this.expected = null;
    this.last = -Infinity;
  }
  normal() {
    const w = this.win;
    return (
      w &&
      !w.isDestroyed() &&
      w.isVisible() &&
      !w.isMinimized() &&
      !w.isMaximized() &&
      !w.isSnapped?.() &&
      w.snapped !== true &&
      !w.isFullScreen()
    );
  }
  matches() {
    if (!this.expected || this.win.isDestroyed()) return false;
    const p = this.win.getPosition();
    return p.every((v, i) => Math.abs(v - this.expected[i]) <= 1);
  }
  cancel(restore = true) {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    if (restore && this.origin && this.normal() && this.matches()) {
      try {
        this.win.setPosition(...this.origin, false);
      } catch {}
    }
    this.origin = null;
    this.expected = null;
  }
  start({ reducedMotion = true } = {}) {
    if (reducedMotion !== false) {
      this.cancel();
      return { mode: "none" };
    }
    const w = this.win;
    if (
      !w ||
      w.isDestroyed() ||
      !w.isVisible() ||
      w.isMinimized() ||
      !w.isFocused()
    )
      return { mode: "none" };
    if (this.now() - this.last < 1200) return { mode: "none" };
    this.last = this.now();
    if (!this.normal()) return { mode: "content" };
    let bounds, area;
    try {
      bounds = w.getBounds();
      area = this.screen.getDisplayMatching(bounds).workArea;
    } catch {
      return { mode: "content" };
    }
    const { x, y, width, height } = bounds;
    if (
      x < area.x ||
      y < area.y ||
      x + width > area.x + area.width ||
      y + height > area.y + area.height
    )
      return { mode: "content" };
    this.cancel();
    this.origin = [x, y];
    this.expected = [x, y];
    let frame = 0;
    const tick = () => {
      this.timer = null;
      if (!this.normal() || !w.isFocused() || !this.matches()) {
        this.cancel(false);
        return;
      }
      if (frame === OFFSETS.length) {
        this.cancel();
        return;
      }
      const [dx, dy] = OFFSETS[frame++];
      const px = Math.max(
          area.x,
          Math.min(area.x + area.width - width, x + dx),
        ),
        py = Math.max(area.y, Math.min(area.y + area.height - height, y + dy));
      this.expected = [px, py];
      try {
        w.setPosition(px, py, false);
      } catch {
        this.cancel(false);
        return;
      }
      this.timer = this.setTimer(tick, 48);
    };
    tick();
    return { mode: "window" };
  }
}
module.exports = { WindowNudge, OFFSETS };
