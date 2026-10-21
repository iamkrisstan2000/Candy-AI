(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CandyRhythm = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function thinkingDelay(random = Math.random) {
    return 2000 + Math.floor(Math.max(0, Math.min(1, random())) * 1000);
  }
  function replyDelay(length) {
    return Math.min(4000, Math.max(0, Number(length) || 0) * 8);
  }
  class ReplyRhythm {
    constructor({
      onUpdate = () => {},
      now = () => performance.now(),
      setTimer = (fn, ms) => setTimeout(fn, ms),
      clearTimer = (id) => clearTimeout(id),
      random = Math.random,
    } = {}) {
      this.update = onUpdate;
      this.now = now;
      this.setTimer = setTimer;
      this.clearTimer = clearTimer;
      this.start = now();
      this.think = thinkingDelay(random);
      this.buffer = "";
      this.visible = "";
      this.done = false;
      this.closed = false;
      this.stopped = false;
      this.timer = null;
      this.result = new Promise((resolve) => (this.resolve = resolve));
      this.tick = this.tick.bind(this);
    }
    push(text) {
      if (!this.closed) {
        this.buffer += text;
        if (this.done) this.schedule();
      }
    }
    finish(text) {
      if (!this.closed) {
        this.buffer = String(text ?? this.buffer);
        this.done = true;
        this.schedule();
      }
      return this.result;
    }
    schedule() {
      if (this.timer !== null) {
        this.clearTimer(this.timer);
        this.timer = null;
      }
      this.tick();
    }
    stop() {
      if (!this.closed) {
        this.stopped = true;
        this.complete();
      }
    }
    complete() {
      this.closed = true;
      if (this.timer !== null) this.clearTimer(this.timer);
      this.timer = null;
      this.resolve({ text: this.visible, stopped: this.stopped });
    }
    tick() {
      this.timer = null;
      if (this.closed || !this.done) return;
      const remaining =
        this.start + this.think + replyDelay(this.buffer.length) - this.now();
      if (remaining > 0) {
        this.timer = this.setTimer(this.tick, remaining);
        return;
      }
      // Exactly one complete reply. No interval, polling, or partial-text paint.
      this.visible = this.buffer;
      this.update(this.visible, { done: true });
      this.complete();
    }
  }
  return { thinkingDelay, replyDelay, ReplyRhythm };
});
