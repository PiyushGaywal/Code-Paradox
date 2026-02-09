const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const roomUsers = new Map();
const roomCode = new Map();
const roomAdmin = new Map();
const roomPermissions = new Map();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use("/utils", express.static("utils"));

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/room/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const name = req.query.name;
  if (!name) return res.redirect(`/?room=${encodeURIComponent(roomId)}`);
  res.render("room");
});

function ensureRoom(roomId) {
  if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
  if (!roomCode.has(roomId)) roomCode.set(roomId, "");
  if (!roomPermissions.has(roomId)) roomPermissions.set(roomId, new Map());
}

function getUsersArray(roomId) {
  if (!roomUsers.has(roomId)) return [];
  return Array.from(roomUsers.get(roomId).entries()).map(([id, u]) => ({
    id,
    ...u,
  }));
}

function getPermission(roomId, socketId) {
  const perms = roomPermissions.get(roomId);
  if (!perms) return false;
  return !!perms.get(socketId);
}

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, name, avatar }) => {
    if (!roomId) roomId = uuidv4();
    ensureRoom(roomId);

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = name || "Anonymous";
    socket.data.avatar = avatar || null;

    roomUsers.get(roomId).set(socket.id, {
      name: socket.data.name,
      avatar: socket.data.avatar,
    });

    if (!roomAdmin.has(roomId)) {
      roomAdmin.set(roomId, socket.id);
    }

    const perms = roomPermissions.get(roomId);
    if (!perms.has(socket.id)) {
      perms.set(socket.id, socket.id === roomAdmin.get(roomId));
    }

    io.to(roomId).emit("room-users", getUsersArray(roomId));

    socket.emit("code-sync", roomCode.get(roomId));

    socket.emit("permission-state", {
      adminId: roomAdmin.get(roomId),
      myCanWrite: getPermission(roomId, socket.id),
    });

    io.to(roomAdmin.get(roomId)).emit("permissions-list", {
      permissions: Array.from(perms.entries()).map(([id, canWrite]) => ({
        id,
        canWrite,
      })),
    });

    socket.to(roomId).emit("user-joined", {
      id: socket.id,
      name: socket.data.name,
      avatar: socket.data.avatar,
    });
  });

  socket.on("code-change", ({ roomId, code }) => {
    if (!roomId) return;

    const canWrite = getPermission(roomId, socket.id);
    if (!canWrite) {
      socket.emit("permission-error", { message: "You don't have write permission ✋" });
      return;
    }

    roomCode.set(roomId, code);
    socket.to(roomId).emit("code-change", { code, from: socket.id });
  });

  socket.on("set-permission", ({ roomId, userId, canWrite }) => {
    if (!roomId) return;
    const adminId = roomAdmin.get(roomId);
    if (socket.id !== adminId) return;

    ensureRoom(roomId);
    const perms = roomPermissions.get(roomId);

    perms.set(userId, !!canWrite);

    io.to(userId).emit("permission-updated", { canWrite: !!canWrite });

    io.to(adminId).emit("permissions-list", {
      permissions: Array.from(perms.entries()).map(([id, canWrite]) => ({
        id,
        canWrite,
      })),
    });
  });
  

  socket.on("typing", ({ roomId, name }) => {
    if (!roomId) return;
    socket.to(roomId).emit("typing", { id: socket.id, name });
  });

  socket.on("stop-typing", ({ roomId }) => {
    if (!roomId) return;
    socket.to(roomId).emit("stop-typing", { id: socket.id });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    if (roomUsers.has(roomId)) {
      roomUsers.get(roomId).delete(socket.id);
      io.to(roomId).emit("room-users", getUsersArray(roomId));
    }

    if (roomPermissions.has(roomId)) {
      roomPermissions.get(roomId).delete(socket.id);
    }

    socket.to(roomId).emit("user-left", {
      id: socket.id,
      name: socket.data.name,
    });

    if (roomAdmin.get(roomId) === socket.id) {
      const usersMap = roomUsers.get(roomId);
      const nextAdmin =
        usersMap && usersMap.size > 0 ? usersMap.keys().next().value : null;

      if (nextAdmin) {
        roomAdmin.set(roomId, nextAdmin);
        if (roomPermissions.has(roomId)) {
          roomPermissions.get(roomId).set(nextAdmin, true);
        }

        io.to(roomId).emit("new-admin", { adminId: nextAdmin });

        const perms = roomPermissions.get(roomId);
        io.to(nextAdmin).emit("permissions-list", {
          permissions: Array.from(perms.entries()).map(([id, canWrite]) => ({
            id,
            canWrite,
          })),
        });
      } else {
        roomAdmin.delete(roomId);
      }
    }

    if (roomUsers.has(roomId) && roomUsers.get(roomId).size === 0) {
      roomUsers.delete(roomId);
      roomCode.delete(roomId);
      roomAdmin.delete(roomId);
      roomPermissions.delete(roomId);
    }
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
