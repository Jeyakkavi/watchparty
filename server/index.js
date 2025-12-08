require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cors());

app.get('/', (req, res) => res.send('WatchParty Server Running'));

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', ({ roomId, user }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        hostId: socket.id,
        videoUrl: '',
        isPlaying: false,
        time: 0
      });
    }

    const state = rooms.get(roomId);
    socket.emit('room_state', { ...state, roomId, timestamp: Date.now() });
  });

  socket.on('host_update', ({ roomId, event, time, videoUrl }) => {
    if (!rooms.has(roomId)) return;

    const state = rooms.get(roomId);
    state.time = time;
    state.isPlaying = event === 'play';
    state.videoUrl = videoUrl || state.videoUrl;

    io.to(roomId).emit('host_broadcast', {
      event,
      time: state.time,
      videoUrl: state.videoUrl,
      serverTime: Date.now()
    });
  });

  socket.on('sync_ping', (t0, cb) => {
    cb(Date.now());
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
