const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const { log } = require("console");
require('dotenv').config()

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const roomUsers = new Map();
const roomCode = new Map();

app.set('view engine','ejs')
app.use(express.static('public'))
app.use('/utils', express.static('utils'));


app.get("/", (req, res) => {
  res.render('index')
});

app.get("/room/:roomId", (req, res) => {
  res.render('room')
});

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, name, avatar }) => {
    if (!roomId) roomId = uuidv4();

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = name || "Anonymous";
    socket.data.avatar = avatar || null;

    if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
    roomUsers.get(roomId).set(socket.id, { name: socket.data.name, avatar: socket.data.avatar });

    const users = Array.from(roomUsers.get(roomId).entries()).map(([id, u]) => ({ id, ...u }));
    io.to(roomId).emit("room-users", users);

    if (roomCode.has(roomId)) {
      socket.emit("code-sync", roomCode.get(roomId));
    } else {
      roomCode.set(roomId, "");
      socket.emit("code-sync", roomCode.get(roomId));
    }

    socket.to(roomId).emit("user-joined", { id: socket.id, name: socket.data.name, avatar: socket.data.avatar });
  });

  socket.on("code-change", ({ roomId, code }) => {
    if (!roomId) return;
    roomCode.set(roomId, code);
    socket.to(roomId).emit("code-change", { code, from: socket.id });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (roomId && roomUsers.has(roomId)) {
      roomUsers.get(roomId).delete(socket.id);
      const users = Array.from(roomUsers.get(roomId).entries()).map(([id, u]) => ({ id, ...u }));
      io.to(roomId).emit("room-users", users);
      socket.to(roomId).emit("user-left", { id: socket.id, name: socket.data.name });
      if (roomUsers.get(roomId).size === 0) {
        roomUsers.delete(roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
