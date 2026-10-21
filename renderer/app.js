"use strict";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const api = window.candy;
const sounds = new CandySounds.CuePlayer();
const reducedNudgeMotion = matchMedia("(prefers-reduced-motion: reduce)");
let lastNudgeAt = -Infinity;
let state,
  activeId,
  busy = false,
  currentError = "",
  setupBusy = false,
  toastTimer,
  lastFocus,
  replyRhythm = null,
  resettingUI = false,
  chatEditBusy = false,
  menuChatId = null,
  menuButton = null,
  deleteTargetId = null;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const current = () => state.chats.find((c) => c.id === activeId);
function positionToast() {
  if (resettingUI) return;
  const t = $("#toast"),
    column = $(".conversation-main");
  if (!t || t.hidden || !column) return;
  const r = column.getBoundingClientRect(),
    anchor = $("#empty-new-chat")?.getBoundingClientRect();
  t.style.left =
    (anchor ? anchor.x + anchor.width / 2 : r.x + r.width / 2) + "px";
  t.style.maxWidth = Math.max(120, Math.min(550, r.width - 32)) + "px";
}
function toast(message) {
  if (resettingUI || !$("#toast")) return;
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  positionToast();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if ($("#toast")) $("#toast").hidden = true;
  }, 6500);
}
function closeConversationMenu() {
  if (resettingUI) return;
  $("#more-menu").hidden = true;
  $$(".conversation-more").forEach((b) =>
    b.setAttribute("aria-expanded", "false"),
  );
  menuChatId = null;
  menuButton = null;
}
function openConversationMenu(button) {
  const id = button.dataset.menuChat;
  if (chatEditBusy || !state.chats.some((c) => c.id === id)) return;
  if (menuChatId === id && !$("#more-menu").hidden) {
    closeConversationMenu();
    return;
  }
  closeConversationMenu();
  menuChatId = id;
  menuButton = button;
  button.setAttribute("aria-expanded", "true");
  const menu = $("#more-menu");
  menu.hidden = false;
  const r = button.getBoundingClientRect(),
    w = menu.offsetWidth,
    h = menu.offsetHeight;
  menu.style.left =
    Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + "px";
  menu.style.top =
    Math.max(8, Math.min(innerHeight - h - 8, r.bottom - 2)) + "px";
}
function leaveConversationMenu(e) {
  if (resettingUI) return;
  const next = e.relatedTarget;
  if (
    next?.closest?.("#more-menu") ||
    next?.closest?.(".chat-row-tools") ===
      menuButton?.closest(".chat-row-tools")
  )
    return;
  if (
    menuButton?.matches(":focus-visible") ||
    $("#more-menu").querySelector(":focus-visible")
  )
    return;
  closeConversationMenu();
}

function fail(e) {
  toast(e?.message || String(e));
}
async function persist() {
  await api.saveChats(state.chats);
}
function syncConversationControls() {
  if (resettingUI || !state) return;
  const noChat = !current();
  $("#new-chat").disabled =
    busy ||
    chatEditBusy ||
    state.chats.length >= CandyConversations.MAX_CONVERSATIONS;
  $("#new-chat").title =
    state.chats.length >= 10
      ? "Maximum 10 conversations. Delete older chats to make room."
      : "Create a separate conversation (Ctrl+N)";
  $("#message-input").disabled = busy || chatEditBusy || noChat;
  $("#message-input").placeholder = noChat
    ? "Create a conversation to start chatting"
    : "Say hello to Candy…";
  for (const id of ["emojis", "nudge"])
    $("#" + id).disabled = busy || chatEditBusy || noChat;
  $("#send").disabled = chatEditBusy || noChat;
  $$(".conversation-more").forEach((b) => (b.disabled = chatEditBusy));
  $("#confirm-delete").disabled = chatEditBusy;
}
async function commitChats(next, nextId, { preserveView = false } = {}) {
  chatEditBusy = true;
  syncConversationControls();
  try {
    await api.saveChats(next);
    state.chats = next;
    activeId = nextId;
    if (!preserveView) {
      currentError = "";
      $("#message-input").value = "";
      $("#search").value = "";
    }
    renderList();
    if (!preserveView) renderMessages();
    return true;
  } catch (e) {
    fail(e);
    return false;
  } finally {
    chatEditBusy = false;
    syncConversationControls();
  }
}
async function newConversation() {
  if (busy || chatEditBusy) {
    toast("Finish or stop the current operation first.");
    return;
  }
  try {
    const c = CandyConversations.createConversation(
      state.chats,
      crypto.randomUUID(),
      new Date().toISOString(),
    );
    if (await commitChats([c, ...state.chats], c.id))
      $("#message-input").focus();
  } catch (e) {
    fail(e);
  }
}
async function deleteConversation(id = activeId) {
  if (busy || chatEditBusy || !state.chats.some((c) => c.id === id)) return;
  const next = CandyConversations.removeConversation(state.chats, id, activeId),
    preserveView = id !== activeId && next.activeId === activeId;
  if (await commitChats(next.chats, next.activeId, { preserveView })) {
    $("#delete-dialog").close();
    deleteTargetId = null;
    toast("Conversation deleted.");
    if (current()) $("#message-input").focus();
    else $("#new-chat").focus();
  }
}

function time(t) {
  return new Date(t).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
function renderList() {
  closeConversationMenu();
  const query = $("#search").value.trim().toLowerCase();
  const list = state.chats.filter((c) =>
    (c.title + " " + c.messages.map((m) => m.content).join(" "))
      .toLowerCase()
      .includes(query),
  );
  $("#chat-count").textContent = state.chats.length + " / 10";
  syncConversationControls();
  $("#chat-list").innerHTML =
    list
      .map((c, index) => {
        const last = c.messages.at(-1);
        const date = new Date(last?.time || c.created);
        const today = date.toDateString() === new Date().toDateString();
        return `<div class="chat-row" data-row-chat="${esc(c.id)}"><button class="chat-item ${c.id === activeId ? "active" : ""}" data-chat="${esc(c.id)}" title="${esc(c.title)}" ${c.id === activeId ? 'aria-current="page"' : ""}><span class="chat-item-icon">${icon("chat")}<span class="chat-index" aria-hidden="true">${index + 1}</span></span><span class="chat-item-content"><strong>${esc(c.title)}</strong><p>${esc(last?.content.slice(0, 65) || "A little hello goes a long way.")}</p></span><time>${today ? "Today" : date.toLocaleDateString([], { month: "short", day: "numeric" })}</time></button><div class="chat-row-tools"><button class="icon-btn conversation-more" data-menu-chat="${esc(c.id)}" title="Options for ${esc(c.title)}" aria-label="Options for ${esc(c.title)}" aria-expanded="false" aria-controls="more-menu">${icon("more")}</button></div></div>`;
      })
      .join("") || '<p class="search-empty">No conversations found.</p>';
  $$(".conversation-more").forEach(
    (b) => (b.onclick = () => openConversationMenu(b)),
  );
  $$(".chat-row-tools").forEach((tools) => {
    tools.addEventListener("pointerleave", leaveConversationMenu);
    tools.addEventListener("focusout", () =>
      queueMicrotask(() => {
        if (resettingUI) return;
        const menu = $("#more-menu");
        if (
          !tools.contains(document.activeElement) &&
          !menu.contains(document.activeElement) &&
          !tools.matches(":hover") &&
          !menu.matches(":hover")
        )
          closeConversationMenu();
      }),
    );
  });
  $$("#chat-list [data-chat]").forEach((b) =>
    b.addEventListener("click", () => {
      if (busy || chatEditBusy) {
        toast("Finish or stop the current operation first.");
        return;
      }
      activeId = b.dataset.chat;
      currentError = "";
      $("#message-input").value = "";
      renderList();
      renderMessages();
    }),
  );
}
function format(s) {
  // Escape all model/user text before applying a deliberately small Markdown subset.
  return s
    .split(/(```[\s\S]*?```)/g)
    .map((part, i) => {
      if (i % 2) {
        const body = part.slice(3, -3).replace(/^[\w+-]*\n/, "");
        return "<pre><code>" + esc(body) + "</code></pre>";
      }
      return esc(part)
        .replace(/`([^`\n]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    })
    .join("");
}
function welcome() {
  const ready = !!state.installation;
  return `<div class="day-divider">THE START OF SOMETHING GOOD</div><article class="message assistant"><div class="message-label"><strong>Candy</strong><time>Just now</time></div><div class="message-body welcome-copy"><p class="hello">Hey, I’m Candy. It’s really nice to meet you. <span>👋</span></p><p>Remember when a little chat window could make your day?<br>Let’s bring a bit of that back.</p><p>I’m your AI companion, right here on your PC. A place to think<br class="welcome-break"> out loud, untangle an idea, or just talk about your day.</p><p>No cloud. No audience. Just us.</p><p class="signoff">Make yourself at home. 🌱</p></div></article>${!ready ? `<div class="welcome-setup"><span class="setup-icon">${icon("sparkle")}</span><div><h3>First, let’s give Candy a little brain.</h3><p>A one-time setup. Then we can talk completely offline.</p></div><button id="welcome-setup">Setup Candy ${icon("arrow")}</button></div>` : ""}<div class="welcome-bottom"><span>A LITTLE INSPIRATION</span><i></i></div><div class="starter-chips"><button class="starter-chip" data-starter="Hey Candy! Let’s get to know each other.">${icon("chat")}Just say hello</button><button class="starter-chip" data-starter="I have an idea I’d like to brainstorm. Can you help me think it through?">${icon("sparkle")}Think through an idea</button><button class="starter-chip" data-starter="Tell me something interesting that I might not know.">${icon("smile")}Surprise me</button></div>`;
}
function renderMessages(scroll = true) {
  const c = current(),
    list = $("#messages");
  syncConversationControls();
  if (!c) {
    list.innerHTML =
      '<section class="empty-conversations"><h2>No conversations yet.</h2><p>Start a fresh chat. Each conversation has its own history.<br>You can keep up to 10 at a time.</p><button id="empty-new-chat" class="primary"><svg aria-hidden="true"><use href="#i-plus"/></svg>New conversation</button></section>';
    $("#empty-new-chat").onclick = newConversation;
    return;
  }
  if (!c.messages.length) {
    list.innerHTML = welcome();
    $("#welcome-setup")?.addEventListener("click", () =>
      openSettings("device"),
    );
    $$("[data-starter]").forEach(
      (b) =>
        (b.onclick = () => {
          $("#message-input").value = b.dataset.starter;
          $("#message-input").focus();
        }),
    );
    return;
  }
  list.innerHTML =
    `<div class="day-divider">${esc(new Date(c.created).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }).toUpperCase())}</div>` +
    c.messages
      .map(
        (m, i) =>
          `<article class="message ${m.role}"><div class="message-label"><strong>${m.role === "user" ? "You" : "Candy"}</strong><time>${esc(time(m.time))}${m.stopped ? " · stopped" : ""}</time></div><div class="message-body">${format(m.content)}</div>${m.role === "assistant" ? `<div class="message-tools"><button data-read="${i}" title="Read aloud">Read aloud</button><button data-copy="${i}">Copy</button></div>` : ""}</article>`,
      )
      .join("") +
    (busy
      ? `<div class="reply-pending" id="stream-message"><div class="typing" role="status" aria-label="Candy is typing"><span></span><span></span><span></span></div></div>`
      : "") +
    (currentError
      ? `<article class="message error"><div class="message-body">${esc(currentError)}</div><div class="message-tools"><button id="retry">Try again</button>${!state.installation ? '<button id="error-setup">Open setup</button>' : ""}</div></article>`
      : "");
  $$("[data-read]").forEach(
    (b) =>
      (b.onclick = () =>
        api.speak(c.messages[Number(b.dataset.read)].content).catch(fail)),
  );
  $$("[data-copy]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await navigator.clipboard.writeText(
            c.messages[Number(b.dataset.copy)].content,
          );
          toast("Copied.");
        } catch {
          toast(
            "Clipboard access is unavailable. You can select and copy the message manually.",
          );
        }
      }),
  );
  $("#retry")?.addEventListener("click", () => generateReply());
  $("#error-setup")?.addEventListener("click", () => openSettings("device"));
  if (scroll) list.scrollTop = list.scrollHeight;
}
function setBusy(value) {
  busy = value;
  $("#send").classList.toggle("stopping", value);
  $("#send").innerHTML = value
    ? '<span>Stop</span><span aria-hidden="true">■</span>'
    : "<span>Send</span>" + icon("send");
  $("#send").setAttribute("aria-label", value ? "Stop reply" : "Send message");
  $("#message-input").disabled = value;
  $("#new-chat").disabled = value;
  $("#setup-candy").disabled = value || setupBusy;
  syncConversationControls();
}
async function send() {
  if (chatEditBusy) return;
  if (!current()) {
    toast("Create a conversation first.");
    return;
  }
  if (busy) {
    replyRhythm?.stop();
    await api.stop();
    return;
  }
  const text = $("#message-input").value.trim();
  if (!text) return;
  if (!state.installation) {
    toast(
      api.desktop
        ? "Give Candy a local brain first. Setup is a one-time download."
        : "This is the design preview. Run the Windows app for offline AI chat.",
    );
    openSettings("device");
    return;
  }
  void sounds.unlock(); // Acquire audio permission during the Send gesture, before awaiting disk.
  const c = current();
  c.messages.push({
    role: "user",
    content: text,
    time: new Date().toISOString(),
  });
  if (c.messages.length === 1) c.title = text.slice(0, 42);
  $("#message-input").value = "";
  currentError = "";
  renderList();
  renderMessages();
  try {
    chatEditBusy = true;
    syncConversationControls();
    await persist();
    chatEditBusy = false;
    if (resettingUI) return;
    void sounds.play("sent");
    await generateReply();
  } catch (e) {
    chatEditBusy = false;
    currentError = e.message;
    renderMessages();
  } finally {
    syncConversationControls();
  }
}
async function generateReply() {
  if (busy || chatEditBusy || !current()) return;
  currentError = "";
  setBusy(true);
  renderMessages();
  let rhythm,
    received = false;
  try {
    await settingsSerial;
    if (resettingUI) return;
    rhythm = new CandyRhythm.ReplyRhythm();
    replyRhythm = rhythm;
    const r = await api.chat(activeId);
    if (r.stopped) rhythm.stop();
    const displayed = await rhythm.finish(r.text);
    if (resettingUI) return;
    if (displayed.text) {
      current().messages.push({
        role: "assistant",
        content: displayed.text,
        time: new Date().toISOString(),
        stopped: r.stopped || displayed.stopped,
      });
      received = !r.stopped && !displayed.stopped;
      if (state.settings.speak && !r.stopped && !displayed.stopped)
        api.speak(displayed.text).catch(fail);
    } else if (!r.stopped && !displayed.stopped)
      currentError = "Candy returned an empty reply. Try again.";
  } catch (e) {
    rhythm?.stop();
    if (!resettingUI) currentError = e.message;
  } finally {
    rhythm?.stop();
    if (replyRhythm === rhythm) replyRhythm = null;
    if (!resettingUI) {
      setBusy(false);
      renderList();
      renderMessages();
      try {
        await persist();
        if (received && !resettingUI) void sounds.play("received");
      } catch (e) {
        fail(e);
      }
      $("#message-input").focus();
    }
  }
}
function applyAvatars() {
  const s = state.settings;
  s.candyAvatar = CandyAvatars.candyId(s.candyAvatar, s.persona);
  s.userAvatar = CandyAvatars.userId(s.userAvatar);
  const candy = CandyAvatars.CANDY.find((a) => a.id === s.candyAvatar);
  $$("[data-candy-avatar]").forEach((img) => {
    const src = CandyAvatars.source(
      candy,
      reducedNudgeMotion.matches || document.hidden,
    );
    if (img.getAttribute("src") !== src) img.src = src;
    img.alt = "Candy · " + candy.name;
  });
  const user = CandyAvatars.YOU.find((a) => a.id === s.userAvatar);
  const custom =
    typeof state.customAvatar === "string" &&
    state.customAvatar.startsWith("data:image/png;base64,")
      ? state.customAvatar
      : null;
  const src = s.userAvatar === "custom" ? custom : user?.src;
  $("#you-picture").hidden = !src;
  $("#you-initial").hidden = !!src;
  if (src) $("#you-picture").src = src;
  else $("#you-picture").removeAttribute("src");
  const focused = document.activeElement?.dataset;
  const previous = focused?.candyChoice
    ? '[data-candy-choice="' + focused.candyChoice + '"]'
    : focused?.userChoice
      ? '[data-user-choice="' + focused.userChoice + '"]'
      : null;
  function tile(a, selected, attribute) {
    const src = CandyAvatars.source(
      a,
      reducedNudgeMotion.matches ||
        document.hidden ||
        $("#settings").hidden ||
        $("#tab-avatars").hidden,
    );
    return `<button class="avatar-option ${selected ? "selected" : ""}" ${attribute}="${esc(a.id)}" aria-pressed="${selected}" title="${esc(a.name)}">${src ? `<img src="${esc(src)}" alt=""/>` : '<span class="initial-preview">Y</span>'}<span>${esc(a.name)}${a.animated ? '<small class="avatar-motion-label">Animated</small>' : ""}</span><i aria-hidden="true">✓</i></button>`;
  }
  $("#candy-avatar-grid").innerHTML = CandyAvatars.candyOptions(s.persona)
    .map((a) => tile(a, s.candyAvatar === a.id, "data-candy-choice"))
    .join("");
  const users = [...CandyAvatars.YOU];
  if (custom)
    users.push({ id: "custom", name: "Your custom picture", src: custom });
  $("#user-avatar-grid").innerHTML = users
    .map((a) => tile(a, s.userAvatar === a.id, "data-user-choice"))
    .join("");
  $$("[data-candy-choice]").forEach(
    (b) =>
      (b.onclick = () => saveSetting("candyAvatar", b.dataset.candyChoice)),
  );
  $$("[data-user-choice]").forEach(
    (b) => (b.onclick = () => saveSetting("userAvatar", b.dataset.userChoice)),
  );
  $("#remove-user-avatar").hidden = !custom;
  if (previous) $(previous)?.focus({ preventScroll: true });
}
// Engine activity belongs to the small indicator/tooltip, never the mood line.
function setEngineStatus({ status, backend, note } = {}) {
  const dot = $("#engine-dot");
  if (!dot || resettingUI) return;
  const text =
    note ||
    (status === "ready"
      ? `Local model ready${backend ? " · " + backend : ""} · offline`
      : status === "loading"
        ? "Loading local model"
        : status === "error"
          ? "Local engine needs attention"
          : "Local engine idle");
  dot.classList.toggle("amber", status !== "ready");
  dot.title = text;
  dot.setAttribute("aria-label", text);
}
let moodChoice = null,
  moodTimer = null,
  moodKey = "";
function refreshMood(force = false) {
  if (resettingUI || !state) return;
  const key = state.settings.persona + ":" + state.settings.humor;
  if (force || key !== moodKey) {
    moodChoice = CandyMoods.pickMood({
      persona: state.settings.persona,
      humor: state.settings.humor,
      previous: moodChoice,
    });
    $("#mood-status").textContent = moodChoice.display;
    moodKey = key;
  }
  if (moodTimer === null)
    moodTimer = setTimeout(() => {
      moodTimer = null;
      refreshMood(true);
    }, CandyMoods.moodDelay());
}
function applySettings() {
  if (resettingUI) return;
  const s = state.settings;
  document.body.classList.toggle(
    "sidebar-collapsed",
    s.sidebarCollapsed === true,
  );
  document.body.dataset.nativeAcrylic = String(
    state.windowMaterial === "acrylic",
  );
  const toggle = $("#toggle-sidebar");
  toggle.setAttribute("aria-expanded", String(!s.sidebarCollapsed));
  toggle.setAttribute(
    "aria-label",
    s.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar",
  );
  toggle.title = s.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";
  const dark =
    s.theme === "dark" ||
    (s.theme === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.toggle("dark", dark);
  const appearance = state.appearance || {};
  const palette = CandyTheme.palette({
    dark,
    scene: s.scene,
    accentSource: s.accentSource,
    windowsAccent: appearance.accentColor,
  });
  for (const [key, value] of Object.entries(palette.vars))
    document.body.style.setProperty(key, value);
  $('[data-scene="windows"]').title = palette.usesWindows
    ? "Follows your Windows accent live."
    : api.desktop
      ? "Uses Windows blue if the device accent is unavailable."
      : "Windows device color is available in the Windows app; this preview uses Windows blue.";
  document.body.dataset.bubbleStyle = s.bubbleStyle;
  $("#bubble-style").value = s.bubbleStyle;
  refreshMood();
  $("#scene").className = "scene " + s.scene;
  $$("[data-persona]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.persona === s.persona);
    b.setAttribute("aria-pressed", b.dataset.persona === s.persona);
  });
  $$("[data-scene]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.scene === s.scene);
    b.setAttribute("aria-pressed", b.dataset.scene === s.scene);
  });
  for (const id of ["humor", "rate", "theme", "model", "backend", "voice"])
    $("#" + id).value = s[id];
  $("#humor-value").textContent = s.humor + "%";
  const specialty = CandyPersonas.PERSONAS[s.persona];
  $("#persona-specialty-title").textContent = specialty.title;
  $("#persona-specialty-copy").textContent = specialty.ability;
  const expression = CandyPersonas.humor(s.persona, s.humor);
  $("#humor-description").textContent =
    expression.name + " · " + expression.description;
  applyAvatars();
  $("#rate-value").textContent =
    s.rate === 0 ? "Normal" : s.rate > 0 ? "+" + s.rate : String(s.rate);
  sounds.setEnabled(s.chatSounds !== false);
  $("#chatSounds").checked = s.chatSounds !== false;
  $$("[data-sound-preview]").forEach(
    (b) => (b.disabled = s.chatSounds === false),
  );
  $("#sound-note").textContent =
    s.chatSounds === false
      ? "Chat sounds are muted. Spoken replies have their own switch."
      : "Original sounds, made quietly on your device. Separate from spoken replies.";
  $("#speak").checked = s.speak;
  $("#toggle-voice").classList.toggle("on", s.speak);
  $("#toggle-voice").setAttribute("aria-pressed", s.speak);
  $("#toggle-voice").title = s.speak
    ? "Turn spoken replies off"
    : "Read replies aloud";
  $("#installation-label").textContent = state.installation
    ? `${state.installation.modelName} · ${state.installation.backend.toUpperCase()} · installed`
    : "One setup. Then it’s just the two of you.";
}
let settingsSerial = Promise.resolve();
function saveSetting(key, value) {
  if (resettingUI) return;
  state.settings[key] = value;
  if (key === "scene")
    state.settings.accentSource = value === "windows" ? "windows" : "scene";
  if (key === "persona")
    state.settings.candyAvatar = CandyAvatars.candyId(
      state.settings.candyAvatar,
      value,
    );
  applySettings();
  const snapshot = { ...state.settings };
  settingsSerial = settingsSerial
    .then(() => api.saveSettings(snapshot))
    .catch(fail);
  if (["backend", "model"].includes(key) && state.installation)
    toast("Run Setup Candy again to apply this engine change.");
}
async function refreshAppearance() {
  try {
    state.appearance = await api.appearance();
    applySettings();
  } catch {
    /* retain the last known local appearance */
  }
}
function setTab(tab) {
  $$("[data-tab]").forEach((b) => {
    const a = b.dataset.tab === tab;
    b.classList.toggle("active", a);
    b.setAttribute("aria-selected", a);
    b.tabIndex = a ? 0 : -1;
  });
  $$(".settings-page").forEach((p) => (p.hidden = p.id !== "tab-" + tab));
  $(".drawer-body").scrollTop = 0;
  applyAvatars();
}
async function openSettings(tab = "personality") {
  lastFocus = document.activeElement;
  // The app chrome is outside the settings modal; only its background content is inert.
  $(".workspace").inert = true;
  $(".titlebar-search").inert = true;
  $("#settings").hidden = false;
  $("#settings-backdrop").hidden = false;
  setTab(tab);
  refreshAppearance();
  $("#close-settings").focus();
  if (tab === "device") checkHardware();
  if (tab === "voice") loadVoices();
}
function closeSettings() {
  $(".workspace").inert = false;
  $(".titlebar-search").inert = false;
  $("#settings").hidden = true;
  $("#settings-backdrop").hidden = true;
  applyAvatars();
  lastFocus?.focus();
}
async function checkHardware() {
  const button = $("#refresh-hardware");
  button.disabled = true;
  $("#hardware-details").textContent = "Checking graphics adapters first…";
  try {
    const h = await api.hardware();
    if (h.preview) {
      $("#hardware-details").textContent =
        "Hardware detection is available in Candy for Windows.\nBrowser preview has no access to your PC hardware.";
      return;
    }
    $("#hardware-details").textContent =
      `GPU  ·  ${h.gpus.map((g) => g.name).join(", ") || "No supported GPU detected"}\nCPU  ·  ${h.cpu}\nMemory  ·  ${h.ramGB} GB RAM · ${h.cores} threads\nRecommended  ·  ${h.plan.model.name} · ${h.plan.backend.toUpperCase()}${h.plan.supported ? "" : "\nRequires Windows x64 and at least 4 GB RAM."}${h.gpuWarning ? "\n" + h.gpuWarning : ""}`;
  } catch (e) {
    $("#hardware-details").textContent = e.message;
  } finally {
    button.disabled = false;
  }
}
async function loadVoices() {
  try {
    const voices = await api.voices();
    $("#voice").innerHTML =
      '<option value="">Windows default voice</option>' +
      voices
        .map(
          (v) =>
            `<option value="${esc(v.name)}">${esc(v.name)} · ${esc(v.culture)}</option>`,
        )
        .join("");
    $("#voice").value = state.settings.voice;
    $("#voice-note").textContent = api.desktop
      ? voices.length
        ? "Installed offline Windows System.Speech voices. Some Windows natural voices are not compatible."
        : "No compatible Windows voices were found. Add a speech voice in Windows Settings, then reopen this tab."
      : "Voice playback is available in the Windows app, using installed offline voices.";
  } catch (e) {
    fail(e);
  }
}
async function runSetup() {
  if (setupBusy) return;
  setupBusy = true;
  $("#setup-candy").disabled = true;
  $("#setup-progress").hidden = false;
  $("#cancel-setup").hidden = false;
  $("#setup-result").textContent = "";
  $("#setup-detail").textContent = "Checking graphics card, then CPU and RAM…";
  $("#progress").value = 0;
  $("#setup-percent").textContent = "0%";
  try {
    await settingsSerial;
    const installation = await api.setup();
    state.installation = installation;
    $("#setup-result").textContent =
      "All set. Your local Candy is ready! You can disconnect from the internet now.";
    setEngineStatus({ status: "ready", backend: state.installation.backend });
    applySettings();
    renderMessages(false);
    toast("Candy is set up. Say hello!");
  } catch (e) {
    $("#setup-result").textContent = e.message;
    $("#setup-result").classList.add("danger-text");
  } finally {
    setupBusy = false;
    $("#setup-candy").disabled = busy;
    $("#cancel-setup").hidden = true;
  }
}
function openReset() {
  $("#reset-confirm").value = "";
  $("#confirm-reset").disabled = true;
  $("#reset-error").textContent = "";
  $("#reset-dialog").showModal();
  $("#reset-confirm").focus();
}
function events() {
  $("#toggle-sidebar").onclick = () =>
    saveSetting("sidebarCollapsed", !state.settings.sidebarCollapsed);
  $("#new-chat").onclick = newConversation;
  $("#search").oninput = renderList;
  $("#send").onclick = () => send().catch(fail);
  $("#message-input").onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send().catch(fail);
    }
  };
  $("#open-settings").onclick = () => openSettings();
  $("#close-settings").onclick = closeSettings;
  $("#settings-backdrop").onclick = closeSettings;
  $("#change-candy-avatar").onclick = () => openSettings("avatars");
  $("#change-user-avatar").onclick = () => openSettings("avatars");
  $$("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        setTab(b.dataset.tab);
        if (b.dataset.tab === "device") checkHardware();
        if (b.dataset.tab === "voice") loadVoices();
      }),
  );
  $$("[data-persona]").forEach(
    (b) => (b.onclick = () => saveSetting("persona", b.dataset.persona)),
  );
  $$("[data-scene]").forEach(
    (b) => (b.onclick = () => saveSetting("scene", b.dataset.scene)),
  );
  for (const id of ["humor", "rate"])
    $("#" + id).oninput = (e) => saveSetting(id, Number(e.target.value));
  for (const id of ["theme", "model", "backend", "voice"])
    $("#" + id).onchange = (e) => saveSetting(id, e.target.value);
  $("#bubble-style").onchange = (e) =>
    saveSetting("bubbleStyle", e.target.value);
  $("#chatSounds").onchange = (e) => {
    saveSetting("chatSounds", e.target.checked);
    if (e.target.checked) void sounds.unlock();
  };
  $$("[data-sound-preview]").forEach(
    (b) =>
      (b.onclick = async () => {
        const played = await sounds.play(b.dataset.soundPreview);
        if (
          resettingUI ||
          !$("#sound-note") ||
          state.settings.chatSounds === false
        )
          return;
        $("#sound-note").textContent = played
          ? "Original sounds, made quietly on your device. Separate from spoken replies."
          : "No sound played. Try again in a moment or check your audio output.";
      }),
  );
  $("#speak").onchange = (e) => saveSetting("speak", e.target.checked);
  $("#toggle-voice").onclick = () => {
    saveSetting("speak", !state.settings.speak);
    toast(
      state.settings.speak
        ? "Spoken replies are on."
        : "Spoken replies are off.",
    );
  };
  $("#test-voice").onclick = async () => {
    await settingsSerial;
    api
      .speak(
        "Hey, I’m Candy. A little company, right here on your PC. Make yourself at home.",
      )
      .catch(fail);
  };
  $("#stop-voice").onclick = () => api.stopSpeech();
  $("#choose-user-avatar").onclick = async () => {
    try {
      await settingsSerial;
      const r = await api.chooseAvatar();
      if (r) {
        state.settings = r.settings;
        state.customAvatar = r.dataUrl;
        applySettings();
        toast("Your picture is saved locally. The original file is untouched.");
      }
    } catch (e) {
      fail(e);
    }
  };
  $("#remove-user-avatar").onclick = async () => {
    try {
      await settingsSerial;
      const r = await api.removeAvatar();
      state.settings = r.settings;
      state.customAvatar = null;
      applySettings();
      toast("Candy’s copy of your custom picture was removed.");
    } catch (e) {
      fail(e);
    }
  };
  $("#setup-candy").onclick = runSetup;
  $("#cancel-setup").onclick = () => api.cancelSetup();
  $("#refresh-hardware").onclick = checkHardware;
  $("#more-menu").addEventListener("pointerleave", leaveConversationMenu);
  $("#more-menu").addEventListener("focusout", () =>
    queueMicrotask(() => {
      if (resettingUI) return;
      const menu = $("#more-menu");
      if (
        !menu.contains(document.activeElement) &&
        document.activeElement !== menuButton &&
        !menu.matches(":hover") &&
        !menuButton?.closest(".chat-row-tools")?.matches(":hover")
      )
        closeConversationMenu();
    }),
  );
  $("#chat-list").addEventListener("scroll", closeConversationMenu);
  window.addEventListener("resize", closeConversationMenu);
  window.addEventListener("resize", positionToast);
  new ResizeObserver(positionToast).observe($(".conversation-main"));
  document.addEventListener("click", (e) => {
    if (resettingUI) return;
    if (!e.target.closest(".chat-row-tools,#more-menu"))
      closeConversationMenu();
    if (!e.target.closest("#emoji-picker") && !e.target.closest("#emojis"))
      $("#emoji-picker").hidden = true;
  });
  $("#export-chat").onclick = async () => {
    const id = menuChatId;
    closeConversationMenu();
    if (!id) return;
    try {
      if (await api.exportChat(id))
        toast("Conversation exported. Keep it somewhere safe.");
    } catch (e) {
      fail(e);
    }
  };
  $("#delete-chat").onclick = () => {
    const id = menuChatId;
    closeConversationMenu();
    if (busy) {
      toast("Stop Candy’s reply first.");
      return;
    }
    const c = state.chats.find((c) => c.id === id);
    if (!c) return;
    deleteTargetId = id;
    $("#delete-dialog p").textContent =
      "“" + c.title + "” will be deleted from Candy. This cannot be undone.";
    $("#delete-dialog").showModal();
  };
  $("#cancel-delete").onclick = () => {
    deleteTargetId = null;
    $("#delete-dialog").close();
  };
  $("#confirm-delete").onclick = () => deleteConversation(deleteTargetId);
  $("#open-reset").onclick = openReset;
  $("#reset-confirm").oninput = (e) =>
    ($("#confirm-reset").disabled = e.target.value !== "DELETE");
  $("#cancel-reset").onclick = () => $("#reset-dialog").close();
  $("#confirm-reset").onclick = async () => {
    if ($("#reset-confirm").value !== "DELETE") return;
    $("#confirm-reset").disabled = true;
    $("#cancel-reset").disabled = true;
    $("#reset-error").textContent =
      "Stopping Candy, clearing local data and closing…";
    resettingUI = true;
    sounds.setEnabled(false);
    sounds.close();
    $(".app-shell").classList.remove("nudge-anim");
    clearTimeout(toastTimer);
    clearTimeout(moodTimer);
    moodTimer = null;
    replyRhythm?.stop();
    try {
      await settingsSerial;
      const r = await api.reset("DELETE ALL CANDY DATA");
      if (r?.preview) {
        document.body.innerHTML =
          '<main class=preview-reset-complete><h1>Preview data cleared.</h1><p>The Windows app fully closes after reset. This browser tab cannot close itself.</p><button id="preview-reopen">Reopen design preview</button></main>';
        $("#preview-reopen").onclick = () => location.reload();
      }
    } catch (e) {
      resettingUI = false;
      applySettings();
      refreshMood();
      $("#reset-error").textContent = e.message;
      $("#confirm-reset").disabled = false;
      $("#cancel-reset").disabled = false;
    }
  };
  $("#emojis").onclick = () =>
    ($("#emoji-picker").hidden = !$("#emoji-picker").hidden);
  $$("#emoji-picker button").forEach(
    (b) =>
      (b.onclick = () => {
        $("#message-input").value += b.textContent;
        $("#message-input").focus();
        $("#emoji-picker").hidden = true;
      }),
  );
  $("#nudge").onclick = async () => {
    if (
      busy ||
      chatEditBusy ||
      resettingUI ||
      !current() ||
      performance.now() - lastNudgeAt < 1200
    )
      return;
    lastNudgeAt = performance.now();
    void sounds.play("nudge");
    const reduce = reducedNudgeMotion.matches;
    // Always animate the UI immediately: Windows may refuse/restrict native moves,
    // and maximized/snapped windows must still visibly nudge. Native motion is a bonus.
    if (!reduce) {
      $(".app-shell").classList.remove("nudge-anim");
      void $(".app-shell").offsetWidth;
      $(".app-shell").classList.add("nudge-anim");
    }
    try {
      void Promise.resolve(api.nudge?.({ reducedMotion: reduce })).catch(
        () => {},
      );
    } catch {
      /* The visible nudge still works. */
    }
    if (resettingUI) return;
    const draft = $("#message-input");
    if (!draft.value.trim())
      draft.value = "Hey Candy! Just sending you a little nudge. 👋";
    draft.focus();
    toast(
      reduce
        ? "Windows reduced motion is on, so the shake is skipped. Your draft stays yours—press Send when ready."
        : "A little nudge, just like old times. Your draft stays yours—press Send when ready.",
    );
  };
  $(".app-shell").addEventListener("animationend", (e) => {
    if (e.target === $(".app-shell") && e.animationName === "nudge")
      $(".app-shell").classList.remove("nudge-anim");
  });
  reducedNudgeMotion.addEventListener("change", (e) => {
    if (e.matches) {
      $(".app-shell")?.classList.remove("nudge-anim");
      api.nudge?.({ reducedMotion: true }).catch(() => {});
    }
    if (!resettingUI && state?.settings) applyAvatars();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      $(".app-shell")?.classList.remove("nudge-anim");
      api.nudge?.({ reducedMotion: true }).catch(() => {});
    }
    if (!resettingUI && state?.settings) applyAvatars();
  });
  window.addEventListener("beforeunload", () => sounds.dispose(), {
    once: true,
  });
  $$("[data-window]").forEach(
    (b) =>
      (b.onclick = () => {
        if (api.desktop) api.window(b.dataset.window);
        else toast("Window controls work in the Windows desktop app.");
      }),
  );
  document.addEventListener("keydown", (e) => {
    if (resettingUI) return;
    if (e.ctrlKey && !e.altKey && ["f", "k"].includes(e.key.toLowerCase())) {
      e.preventDefault();
      if (!document.querySelector("dialog[open]") && $("#settings").hidden) {
        $("#search").focus();
        $("#search").select();
      }
      return;
    }
    if (e.key === "Escape") {
      if (
        document.activeElement === $("#search") &&
        $("#settings").hidden &&
        !document.querySelector("dialog[open]")
      ) {
        $("#search").value = "";
        renderList();
      }
      if (!$("#settings").hidden && !$("#reset-dialog").open) closeSettings();
      $("#emoji-picker").hidden = true;
      const trigger = menuButton;
      closeConversationMenu();
      trigger?.focus();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      if (!document.querySelector("dialog[open]") && $("#settings").hidden)
        newConversation();
    }
    if (
      e.key === "Tab" &&
      !$("#settings").hidden &&
      !document.querySelector("dialog[open]")
    ) {
      const focusables = $$(
        ".title-actions [data-window], #settings button:not([disabled]), #settings input:not([disabled]), #settings select, #settings summary",
      ).filter((el) => el.offsetParent !== null);
      const first = focusables[0],
        last = focusables.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener(
    "change",
    applySettings,
  );
  api.onEvent((e) => {
    if (resettingUI) return;
    if (e.type === "appearance") {
      state.appearance = {
        accentColor: e.accentColor,
        accentAvailable: e.accentAvailable,
      };
      applySettings();
    }
    if (e.type === "engine") setEngineStatus(e);
    if (e.type === "setup") {
      $("#setup-detail").textContent = e.detail;
      $("#setup-percent").textContent = e.percent + "%";
      $("#progress").value = e.percent;
      $("#setup-result").classList.remove("danger-text");
    }
    if (e.type === "speech-error") toast(e.message);
    if (e.type === "context") toast(e.note);
  });
}
(async () => {
  try {
    state = await api.load();
    Object.assign(state.settings, CandyTheme.sceneSettings(state.settings));
    state.settings.candyAvatar ||= "candy";
    state.settings.userAvatar ||= "initial";
    state.settings.bubbleStyle = [
      "outlined",
      "solid",
      "fruit",
      "metro",
    ].includes(state.settings.bubbleStyle)
      ? state.settings.bubbleStyle
      : "outlined";
    if (!api.desktop) $("#preview-badge").hidden = false;
    $("#data-location").textContent = state.root;
    events();
    applySettings();
    activeId = state.chats[0]?.id || null;
    renderList();
    renderMessages();
    if (state.installation) {
      setEngineStatus({ status: "ready", backend: state.installation.backend });
    }
  } catch (e) {
    fail(e);
  }
})();
