const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const port = 3000;
const HOST = "0.0.0.0";

// ---------- HTTP + SOCKET.IO SETUP ----------
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// ---------- SIMPLE API ROUTE ----------
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from backend!" });
});

// ---------- GAME CONSTANTS ----------
const COLS = 80;
const ROWS = 60;
const TICK_MS = 80;

// ---------- GAME STATE ----------
/**
 * games[roomId] = {
 *   players: [player0, player1],
 *   grid: Set<string>,
 *   playerBySocket: { [socketId]: 0 | 1 },
 *   interval: NodeJS.Timer | null,
 *   rematchVotes: number,
 * }
 */
const games = {};
let waitingSocket = null;

// ---------- SOCKET HANDLERS ----------
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // ---- MATCHMAKING: READY ----
  socket.on("ready", () => {
    // If this player is already waiting, ignore
    if (waitingSocket && waitingSocket.id === socket.id) {
      return;
    }

    // No one waiting → put this player in queue
    if (!waitingSocket) {
      waitingSocket = socket;
      socket.emit("waiting");
    } else {
      // Someone is waiting → create a match
      const socketA = waitingSocket;
      const socketB = socket;

      // Prevent matching the same socket
      if (socketA.id === socketB.id) return;

      const roomId = socketA.id + "#" + socketB.id;

      socketA.join(roomId);
      socketB.join(roomId);

      waitingSocket = null;

      startCountdown(roomId, socketA, socketB);
    }
  });

  // ---- INPUT FROM CLIENTS ----
  socket.on("input", (key) => {
    const { game, playerIndex } = findGameBySocket(socket.id);
    if (!game) return;

    const player = game.players[playerIndex];
    if (!player || !player.alive) return;

    if (key === "ArrowUp" || key === "w") player.pendingDir = "up";
    if (key === "ArrowDown" || key === "s") player.pendingDir = "down";
    if (key === "ArrowLeft" || key === "a") player.pendingDir = "left";
    if (key === "ArrowRight" || key === "d") player.pendingDir = "right";
  });

  // ---- REMATCH REQUEST ----
  socket.on("rematchRequest", () => {
    const { roomId, game } = findGameBySocket(socket.id);
    if (!game) return;

    game.rematchVotes++;

    // Notify the opponent that this player wants to rematch
    socket.to(roomId).emit("opponentRematchRequest");

    if (game.rematchVotes === 2) {
      io.to(roomId).emit("rematchStart");
      game.rematchVotes = 0;

      const sockets = Object.keys(game.playerBySocket);
      const socketA = io.sockets.sockets.get(sockets[0]);
      const socketB = io.sockets.sockets.get(sockets[1]);

      startCountdown(roomId, socketA, socketB);
    }
  });

  // ---- PLAYER EXPLICITLY LEAVES TO MENU ----
  socket.on("playerlefttothemenu", () => {
    const { roomId, game } = findGameBySocket(socket.id);
    if (!game || !roomId) return;

    // End game and notify opponent
    endGame(roomId, "opponent disconnected");
  });

  // ---- PLAY AGAIN (BACK TO MATCHMAKING) ----
  socket.on("playAgain", () => {
    const { roomId, game } = findGameBySocket(socket.id);

    // If player was in a game, stop it and clean up
    if (game && roomId) {
      clearInterval(game.interval);
      delete games[roomId];
    }

    // Remove from old rooms
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }

    // Put player back into matchmaking
    if (!waitingSocket) {
      waitingSocket = socket;
      socket.emit("waiting");
    } else {
      const socketA = waitingSocket;
      const socketB = socket;
      const newRoomId = socketA.id + "#" + socketB.id;

      socketA.join(newRoomId);
      socketB.join(newRoomId);

      waitingSocket = null;

      startCountdown(newRoomId, socketA, socketB);
    }
  });

  // ---- DISCONNECT (HARD RESET MODEL) ----
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // If this player was waiting in queue, remove them
    if (waitingSocket && waitingSocket.id === socket.id) {
      waitingSocket = null;
      return;
    }

    // If this player was in a game, end it and notify opponent
    const { roomId, game } = findGameBySocket(socket.id);
    if (game && roomId) {
      endGame(roomId, "opponent disconnected");
    }
  });
});

// ---------- COUNTDOWN ----------
function startCountdown(roomId, socketA, socketB) {
  io.to(roomId).emit("matchFound");

  let count = 3;

  const countdownInterval = setInterval(() => {
    io.to(roomId).emit("countdown", count);

    if (count === 0) {
      clearInterval(countdownInterval);

      io.to(roomId).emit("startGame");

      createGame(roomId, socketA, socketB);
    }

    count--;
  }, 1000);
}

// ---------- GAME CREATION ----------
function createGame(roomId, socketA, socketB) {
  const players = [
    {
      x: COLS - 10,
      y: Math.floor(ROWS / 2),
      dir: "left",
      color: "#00BFFF",
      alive: true,
      trail: [],
      pendingDir: null,
    },
    {
      x: 10,
      y: Math.floor(ROWS / 2),
      dir: "right",
      color: "#DF740C",
      alive: true,
      trail: [],
      pendingDir: null,
    },
  ];

  const grid = new Set();
  for (const p of players) {
    p.trail.push([p.x, p.y]);
    grid.add(`${p.x},${p.y}`);
  }

  games[roomId] = {
    players,
    grid,
    playerBySocket: {
      [socketA.id]: 0,
      [socketB.id]: 1,
    },
    interval: setInterval(() => updateGame(roomId), TICK_MS),
    rematchVotes: 0,
  };
}

// ---------- GAME HELPERS ----------
function findGameBySocket(socketId) {
  for (const roomId of Object.keys(games)) {
    const game = games[roomId];
    if (socketId in game.playerBySocket) {
      return {
        roomId,
        game,
        playerIndex: game.playerBySocket[socketId],
      };
    }
  }
  return { roomId: null, game: null, playerIndex: -1 };
}

function endGame(roomId, reason = "gameOver") {
  const game = games[roomId];
  if (!game) return;

  clearInterval(game.interval);
  game.interval = null;

  io.to(roomId).emit("gameOver", { reason });

  if (reason === "opponent disconnected") {
    io.to(roomId).emit("opponentLeft");
  }

  // Automatic cleanup of finished game
  delete games[roomId];

  console.log("Game ended in room:", roomId, "reason:", reason);
}

// ---------- GAME LOOP ----------
function updateGame(roomId) {
  const game = games[roomId];
  if (!game) return;

  const players = game.players;
  const grid = game.grid;

  const opposite = { up: "down", down: "up", left: "right", right: "left" };

  for (const p of players) {
    if (!p.alive) continue;

    if (p.pendingDir && p.pendingDir !== opposite[p.dir]) {
      p.dir = p.pendingDir;
    }
    p.pendingDir = null;

    if (p.dir === "up") p.y--;
    if (p.dir === "down") p.y++;
    if (p.dir === "left") p.x--;
    if (p.dir === "right") p.x++;

    const key = `${p.x},${p.y}`;

    if (
      p.x < 0 ||
      p.x >= COLS ||
      p.y < 0 ||
      p.y >= ROWS ||
      grid.has(key)
    ) {
      p.alive = false;
    } else {
      grid.add(key);
      p.trail.push([p.x, p.y]);
    }
  }

  io.to(roomId).emit("state", {
    players: players.map((p) => ({
      x: p.x,
      y: p.y,
      dir: p.dir,
      color: p.color,
      alive: p.alive,
      trail: p.trail,
    })),
    grid: Array.from(grid),
  });

  const alive = players.filter((p) => p.alive);
  if (alive.length <= 1) {
    endGame(roomId, "round finished");
  }
}

// ---------- START SERVER ----------
server.listen(port, HOST, () => {
  console.log(`Backend running at http://${HOST}:${port}`);
});