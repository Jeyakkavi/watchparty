// server/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { configureAuth } = require('./auth');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const FRONTEND = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({ origin: FRONTEND, credentials: true }));
 
// configure passport + oauth endpoints
configureAuth(app, {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
  frontendOrigin: FRONTEND
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: FRONTEND, methods: ['GET','POST'], credentials: true }
});

// In-memory stores
const rooms = {};       // rooms[roomId] = { isYouTube: bool, src: url or videoId, playing: bool, time: number, host: userId }
const chats = {};       // chats[roomId] = [{ user, text, ts }]

/* Helper to authenticate on socket connect via token */
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
  if (!token) {
    // allow unauthenticated sockets but mark as guest
    socket.data.user = { id: `guest_${socket.id}`, name: 'Guest' };
    return next();
  }
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.user = data;
    return next();
  } catch (err) {
    socket.data.user = { id: `guest_${socket.id}`, name: 'Guest' };
    return next();
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'user=', socket.data.user?.name);

  socket.on('join-room', ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { isYouTube: false, src: null, playing: false, time: 0, host: socket.data.user?.id || socket.id };
      chats[roomId] = [];
    }

    // send room state and chat history
    socket.emit('sync-state', rooms[roomId]);
    socket.emit('chat-history', chats[roomId] || []);
    socket.to(roomId).emit('user-joined', { id: socket.data.user.id, name: socket.data.user.name });
  });

  // control events (play/pause/seek/load)
  socket.on('control', ({ roomId, action, time, src, isYouTube }) => {
    // ensure room exists
    if (!rooms[roomId]) return;
    // optionally restrict control to host:
    // if (socket.data.user.id !== rooms[roomId].host) return;

    // update room state
    if (action === 'load') {
      rooms[roomId].src = src;
      rooms[roomId].isYouTube = !!isYouTube;
      rooms[roomId].time = 0;
      rooms[roomId].playing = false;
    } else if (action === 'play') {
      rooms[roomId].playing = true;
      rooms[roomId].time = time || rooms[roomId].time;
    } else if (action === 'pause') {
      rooms[roomId].playing = false;
      rooms[roomId].time = time || rooms[roomId].time;
    } else if (action === 'seek') {
      rooms[roomId].time = time || rooms[roomId].time;
    }
    // broadcast to others in room
    socket.to(roomId).emit('control', { action, time, src, isYouTube });
  });

  // chat
  socket.on('chat-message', ({ roomId, text }) => {
    if (!roomId || !text) return;
    const item = { user: socket.data.user, text, ts: Date.now() };
    chats[roomId] = chats[roomId] || [];
    chats[roomId].push(item);
    io.to(roomId).emit('chat-message', item);
  });
  // Receive sync data from host
  socket.on("sync", ({ roomId, time, state }) => {
  socket.to(roomId).emit("sync", { time, state });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log('✅ Server running at http://localhost:' + PORT));
