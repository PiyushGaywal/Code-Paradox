document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const roomIdEl = document.getElementById("roomId");
  const usersListEl = document.getElementById("usersList");
  const outputEl = document.getElementById("output");
  const runBtn = document.getElementById("runBtn");
  const clearBtn = document.getElementById("clearBtn");
  const btnCopyLink = document.getElementById("btnCopyLink");
  

  const urlParts = window.location.pathname.split("/");
  const roomId = urlParts[urlParts.length - 1] || "";
  roomIdEl.textContent = roomId;
  roomIdEl.addEventListener("click", async () => {
  const roomId = roomIdEl.textContent;
  
});

  const urlParams = new URLSearchParams(window.location.search);
  let username = urlParams.get("name") || localStorage.getItem("cc_name") || ("User" + Math.floor(Math.random() * 1000));
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
    extraKeys: { "Ctrl-Space": "autocomplete" }
  });
  

  editor.on("inputRead", function(cm, change) {
    if (change.text[0].match(/[\w\.]/)) {
      cm.showHint({ completeSingle: false });
    }
  });

  let applyingRemote = false;

  function debounce(func, wait) {
    let t = null;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => func.apply(this, args), wait);
    };
  }

  socket.emit("join-room", { roomId, name: username, avatar: avatarUrl });

  function  showToast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 400);
    }, 2500);
  }
  roomIdEl.addEventListener("click", async () => {
  const roomId = roomIdEl.textContent;
  try {
    await navigator.clipboard.writeText(roomId);
    showToast('Room ID copied to clipboard!');
  } catch (err) {
    showToast("Failed to copy Room ID");
  }
});

  function renderUsers(users) {
    usersListEl.innerHTML = "";
    users.forEach(u => {
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
  });

  socket.on("user-joined", (user) => {
    showToast(`${user.name} joined`);
  });

  socket.on("user-left", (user) => {
    const who = (user && user.name) ? user.name : "A user";
    showToast(`${who} left`);
  });

  socket.on("code-sync", (code) => {
    if (code !== undefined) {
      applyingRemote = true;
      editor.setValue(code);
      applyingRemote = false;
    }
  });

  socket.on("code-change", ({ code, from }) => {
    if (!applyingRemote) {
      applyingRemote = true;
      const cursor = editor.getCursor();
      editor.setValue(code);
      try { editor.setCursor(cursor); } catch(e){}
      applyingRemote = false;
    }
  });

  const sendChange = debounce(() => {
    const code = editor.getValue();
    socket.emit("code-change", { roomId, code });
  }, 150);

  editor.on("change", () => {
    if (applyingRemote) return;
    sendChange();
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

  runBtn.addEventListener("click", () => {
    outputEl.innerHTML = "";
    const code = editor.getValue();

    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = (...args) => appendConsole(args.map(x => format(x)).join(" "), "log");
    console.warn = (...args) => appendConsole(args.map(x => format(x)).join(" "), "warn");
    console.error = (...args) => appendConsole(args.map(x => format(x)).join(" "), "error");

    try {
      new Function(code)();
      
    } catch (err) {
      appendConsole(String(err), "error");
    } finally {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    }
    setTimeout(() => {
      runBtn.classList.remove("loading");
    }, 300);
  });

  function format(v) {
    if (typeof v === "object") {
      try { return JSON.stringify(v); } catch(e) { return String(v); }
    }
    return String(v);
  }

  btnCopyLink.addEventListener("click", async () => {
    const link = window.location.origin+'/';
    try {
      await navigator.clipboard.writeText(link);
      showToast("Room link copied to clipboard");
    } catch (e) {
      showToast("Unable to copy link");
    }
  });
});
