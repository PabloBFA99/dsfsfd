const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Servir archivos estáticos
app.use(express.static('./'));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Almacenar información de jugadores
const players = {};

// Manejar conexiones de socket
io.on('connection', (socket) => {
  console.log('Un jugador se ha conectado:', socket.id);
  
  // Asignar un ID único al jugador y añadirlo a la lista
  players[socket.id] = {
    id: socket.id,
    position: { x: 0, y: 0, z: 0 },
    rotation: { y: 0 },
    score: 0
  };
  
  // Enviar información de todos los jugadores actuales al nuevo jugador
  socket.emit('currentPlayers', players);
  
  // Informar a todos los demás jugadores sobre el nuevo jugador
  socket.broadcast.emit('newPlayer', players[socket.id]);
  
  // Actualizar la posición del jugador
  socket.on('playerMovement', (movementData) => {
    // Actualizar los datos del jugador
    players[socket.id].position = movementData.position;
    players[socket.id].rotation = movementData.rotation;
    
    // Emitir a todos los demás jugadores
    socket.broadcast.emit('playerMoved', {
      id: socket.id,
      position: players[socket.id].position,
      rotation: players[socket.id].rotation
    });
  });
  
  // Notificar cuando un jugador dispara una flecha
  socket.on('arrowShot', (arrowData) => {
    // Broadcast a todos los demás jugadores
    socket.broadcast.emit('arrowShot', {
      playerId: socket.id,
      position: arrowData.position,
      direction: arrowData.direction,
      power: arrowData.power
    });
  });
  
  // Notificar cuando un jugador mata a un murciélago
  socket.on('batKilled', (data) => {
    players[socket.id].score += 10;
    
    // Broadcast a todos los jugadores
    io.emit('scoreUpdate', {
      id: socket.id,
      score: players[socket.id].score
    });
  });
  
  // Manejar desconexiones
  socket.on('disconnect', () => {
    console.log('Un jugador se ha desconectado:', socket.id);
    
    // Eliminar al jugador de la lista
    delete players[socket.id];
    
    // Informar a los demás jugadores
    io.emit('playerDisconnected', socket.id);
  });
});

// Puerto y arranque del servidor
const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
}); 