document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const roomIdEl = document.getElementById("roomId");
  const usersListEl = document.getElementById("usersList");
  const outputEl = document.getElementById("output");
  const runBtn = document.getElementById("runBtn");
  const clearBtn = document.getElementById("clearBtn");
  const btnCopyLink = document.getElementById("btnCopyLink");
  const typingStatus = document.getElementById("typingStatus");

  const adminPanel = document.getElementById("adminPanel");
  const permissionPanel = document.getElementById("permissionPanel");
  const userCountEl = document.getElementById("userCount");
  const joinSound = new Audio("/sounds/notification.mp3");
  const leaveSound = new Audio("/sounds/notification.mp3");
  const mouseSound = new Audio("/sounds/mouse-click.mp3");


  const urlParts = window.location.pathname.split("/");
  const roomId = urlParts[urlParts.length - 1] || "";
  roomIdEl.textContent = roomId;

  const keySounds = [
  new Audio("/sounds/keystroke1.mp3"),
  new Audio("/sounds/keystroke2.mp3"),
  new Audio("/sounds/keystroke3.mp3"),
  new Audio("/sounds/keystroke4.mp3")
];

joinSound.volume = 0.4;
leaveSound.volume = 0.4;
mouseSound.volume = 0.3;

let lastKeySound = 0;

function playKeySound() {
  const now = Date.now();
  if (now - lastKeySound < 70) return;

  lastKeySound = now;

  const sound = keySounds[Math.floor(Math.random() * keySounds.length)];
  sound.currentTime = 0;
  sound.play().catch(() => {});
}


keySounds.forEach(s => s.volume = 1);

  const urlParams = new URLSearchParams(window.location.search);
  let username = urlParams.get("name");

  if (!username) {
    window.location.href = `/?room=${encodeURIComponent(roomId)}`;
    return;
  }

  username = decodeURIComponent(username);
  localStorage.setItem("cc_name", username);

  const avatarUrl = `https://api.dicebear.com/6.x/pixel-art/svg?seed=${encodeURIComponent(username)}`;

  const cmHost = document.createElement("textarea");
  document.getElementById("editor").appendChild(cmHost);

  const editor = CodeMirror.fromTextArea(cmHost, {
    mode: "javascript",
    theme: "dracula",
    lineNumbers: true,
    lineWrapping: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    extraKeys: { "Ctrl-Space": "autocomplete" },
  });

  editor.on("change", () => {
  if (applyingRemote) return;

  if (myCanWrite) {
    playKeySound();
    emitTyping();
  }

  sendChange();
});


  let applyingRemote = false;
document.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", () => {
    mouseSound.currentTime = 0;
    mouseSound.play().catch(() => {});
  });
});

  function showToast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 400);
    }, 2500);
  }

  function debounce(func, wait) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => func.apply(this, args), wait);
    };
  }

  socket.emit("join-room", { roomId, name: username, avatar: avatarUrl });

  roomIdEl.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      showToast("Room ID copied!");
    } catch (err) {
      showToast("Failed to copy Room ID");
    }
  });

  btnCopyLink.addEventListener("click", async () => {
    const cleanLink = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(cleanLink);
      showToast("Room link copied");
    } catch (e) {
      showToast("Unable to copy link");
    }
  });

  function renderUsers(users) {
    usersListEl.innerHTML = "";
    users.forEach((u) => {
      const li = document.createElement("div");
      li.className = "user-item";
      li.innerHTML = `
        <img class="avatar" src="${u.avatar}" alt="${u.name}" />
        <div class="uinfo">
          <div class="uname">${u.name}</div>
        </div>
      `;
      usersListEl.appendChild(li);
    });
  }

  socket.on("room-users", (users) => {
  renderUsers(users);
  userCountEl.textContent = `Users: ${users.length}`;
});

  socket.on("user-joined", (user) => {
  joinSound.currentTime = 0;
  joinSound.play().catch(() => {});
  showToast(`${user.name} joined`);
});

socket.on("user-left", (user) => {
  leaveSound.currentTime = 0;
  leaveSound.play().catch(() => {});
  showToast(`${user?.name || "A user"} left`);
});

  socket.on("code-sync", (code) => {
    applyingRemote = true;
    editor.setValue(code || "");
    applyingRemote = false;
  });

  socket.on("code-change", ({ code }) => {
    if (applyingRemote) return;
    applyingRemote = true;
    const cursor = editor.getCursor();
    editor.setValue(code);
    try {
      editor.setCursor(cursor);
    } catch (e) {}
    applyingRemote = false;
  });

  let myCanWrite = false;
  let currentAdminId = null;
  let lastPermissionsList = [];

  function applyPermissionToEditor() {
    editor.setOption("readOnly", myCanWrite ? false : "nocursor");
  }

  socket.on("permission-state", ({ adminId, myCanWrite: canWrite }) => {
    currentAdminId = adminId;
    myCanWrite = !!canWrite;
    applyPermissionToEditor();

    if (socket.id === currentAdminId) {
      adminPanel.style.display = "block";
      showToast("You are Admin 👑");
    } else {
      adminPanel.style.display = "none";
      showToast(myCanWrite ? "Write permission ✅" : "Readonly mode 👁️");
    }
  });

  socket.on("permission-updated", ({ canWrite }) => {
    myCanWrite = !!canWrite;
    applyPermissionToEditor();
    showToast(myCanWrite ? "Write enabled ✅" : "Write removed ❌");
  });

  socket.on("permission-error", ({ message }) => {
    showToast(message || "No write permission ✋");
  });

  socket.on("new-admin", ({ adminId }) => {
    currentAdminId = adminId;
    if (socket.id === adminId) {
      adminPanel.style.display = "block";
      showToast("You are the new Admin 👑");
    } else {
      adminPanel.style.display = "none";
      showToast("Admin changed");
    }
  });

  socket.on("permissions-list", ({ permissions }) => {
    lastPermissionsList = permissions || [];
    if (socket.id !== currentAdminId) return;
    renderPermissionsUI();
  });

  function renderPermissionsUI() {
    permissionPanel.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "8px";

    lastPermissionsList.forEach((p) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.padding = "6px 8px";
      row.style.border = "1px solid rgba(255,255,255,0.08)";
      row.style.borderRadius = "10px";

      const left = document.createElement("div");
      left.style.fontSize = "12px";
      left.style.opacity = "0.9";
      left.textContent =
        p.id === currentAdminId ? `👑 Admin (${p.id.slice(0, 6)}...)` : `User (${p.id.slice(0, 6)}...)`;

      const btn = document.createElement("button");
      btn.className = "btn ghost";
      btn.style.fontSize = "12px";
      btn.textContent = p.canWrite ? "✅ Can Write" : "👁️ Readonly";

      if (p.id === currentAdminId) {
        btn.disabled = true;
      } else {
        btn.addEventListener("click", () => {
          socket.emit("set-permission", {
            roomId,
            userId: p.id,
            canWrite: !p.canWrite,
          });
        });
      }

      row.appendChild(left);
      row.appendChild(btn);
      wrap.appendChild(row);
    });

    permissionPanel.appendChild(wrap);
  }

  const typingUsers = new Map();
  let typingTimeout = null;
  let iAmTyping = false;

  function renderTyping() {
    if (typingUsers.size === 0) {
      typingStatus.textContent = "";
      return;
    }
    const names = Array.from(typingUsers.values());
    typingStatus.textContent =
      names.length === 1
        ? `${names[0]} is typing...`
        : `${names.slice(0, 2).join(", ")}${names.length > 2 ? "..." : ""} are typing...`;
  }

  function emitTyping() {
    if (!iAmTyping) {
      iAmTyping = true;
      socket.emit("typing", { roomId, name: username });
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      iAmTyping = false;
      socket.emit("stop-typing", { roomId });
    }, 1200);
  }

  socket.on("typing", ({ id, name }) => {
    typingUsers.set(id, name);
    renderTyping();
  });

  socket.on("stop-typing", ({ id }) => {
    typingUsers.delete(id);
    renderTyping();
  });

  const sendChange = debounce(() => {
    const code = editor.getValue();
    socket.emit("code-change", { roomId, code });
  }, 150);

  editor.on("inputRead", function (cm, change) {
  if (myCanWrite) {
    playKeySound();
  }

  if (change.text[0].match(/[\w\.]/)) {
    cm.showHint({ completeSingle: false });
  }
});


  function appendConsole(text, cls = "") {
    const line = document.createElement("div");
    line.className = cls;
    line.textContent = text;
    outputEl.appendChild(line);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  clearBtn.addEventListener("click", () => {
    outputEl.innerHTML = "";
  });

  function format(v) {
    if (typeof v === "object") {
      try {
        return JSON.stringify(v);
      } catch (e) {
        return String(v);
      }
    }
    return String(v);
  }

  runBtn.addEventListener("click", () => {
    outputEl.innerHTML = "";
    const code = editor.getValue();

    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = (...args) => appendConsole(args.map((x) => format(x)).join(" "), "log");
    console.warn = (...args) => appendConsole(args.map((x) => format(x)).join(" "), "warn");
    console.error = (...args) => appendConsole(args.map((x) => format(x)).join(" "), "error");

    try {
      new Function(code)();
    } catch (err) {
      appendConsole(String(err), "error");
    } finally {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    }
  });
});
