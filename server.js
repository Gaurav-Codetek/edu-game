// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const rooms = {};

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    socket.on('create-room', () => {
        const roomId = generateRoomId();
        rooms[roomId] = {
            players: [],
            host: socket.id
        };
        socket.join(roomId);
        socket.emit('room-created', roomId);
        assignPlayer(socket, roomId);
    });
    
    socket.on('join-room', (roomId) => {
        if (rooms[roomId] && rooms[roomId].players.length < 2) {
            socket.join(roomId);
            assignPlayer(socket, roomId);
            socket.emit('room-joined', roomId);
            
            // Notify both players that game can start
            io.to(roomId).emit('opponent-connected');
        } else {
            socket.emit('room-full');
        }
    });
    
    socket.on('player-move', (data) => {
        const room = getPlayerRoom(socket);
        if (!room) return;
        
        socket.to(room).emit('opponent-move', data);
    });
    
    socket.on('ball-update', (ballData) => {
        const room = getPlayerRoom(socket);
        if (!room) return;
        
        socket.to(room).emit('ball-update', ballData);
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        const room = getPlayerRoom(socket);
        if (room) {
            socket.to(room).emit('opponent-disconnected');
            cleanupRoom(room);
        }
    });
});

function assignPlayer(socket, roomId) {
    const playerId = rooms[roomId].players.length + 1;
    rooms[roomId].players.push({
        id: socket.id,
        playerId
    });
    socket.emit('player-assigned', { playerId, isHost: playerId === 1 });
}

function getPlayerRoom(socket) {
    for (const roomId in rooms) {
        if (rooms[roomId].players.some(p => p.id === socket.id)) {
            return roomId;
        }
    }
    return null;
}

function cleanupRoom(roomId) {
    if (rooms[roomId]) {
        delete rooms[roomId];
    }
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});