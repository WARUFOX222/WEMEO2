const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 10000;

const upload = multer({ dest: 'streams/' });
app.use(express.static('public'));
app.use(express.json());

let sockets = {};

const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws, request, roomId) => {
  if (!sockets[roomId]) sockets[roomId] = [];
  sockets[roomId].push(ws);

  ws.on('close', () => {
    sockets[roomId] = sockets[roomId].filter(s => s !== ws);
  });
});

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const roomId = url.searchParams.get('room');

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, roomId);
  });
});

app.post('/stream/:room', upload.single('frame'), (req, res) => {
  const roomId = req.params.room;
  const data = fs.readFileSync(req.file.path);
  if (sockets[roomId]) {
    sockets[roomId].forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  }
  fs.unlinkSync(req.file.path);
  res.sendStatus(200);
});