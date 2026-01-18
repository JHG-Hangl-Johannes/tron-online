import { io } from "socket.io-client";
import GameRenderer from "./renderer";

// ---------- DOM ELEMENTS ----------
const canvas = document.getElementById("game") as HTMLCanvasElement;

const mainMenu = document.getElementById("mainMenu") as HTMLDivElement;
const gameUI = document.getElementById("gameUI") as HTMLDivElement;

const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
const rematchBtn = document.getElementById("rematchBtn") as HTMLButtonElement;
const playAgainBtn = document.getElementById("playAgainBtn") as HTMLButtonElement;
const quitBtn = document.getElementById("quitBtn") as HTMLButtonElement;

const statusText = document.getElementById("status") as HTMLDivElement;

// ---------- STATE ----------
let gameActive = false;
let searchingInterval: number | null = null;

// ---------- HELPERS ----------
function showStatus(msg: string) {
  statusText.innerText = msg;
  statusText.classList.add("show");
  setTimeout(() => statusText.classList.remove("show"), 1500);
}

function startSearchingAnimation() {
  let dots = 0;

  if (searchingInterval !== null) {
    clearInterval(searchingInterval);
  }

  searchingInterval = window.setInterval(() => {
    dots = (dots + 1) % 4;
    statusText.innerText = "Suche Gegner" + ".".repeat(dots);
    statusText.classList.add("searching");
  }, 500);
}

function stopSearchingAnimation() {
  if (searchingInterval !== null) {
    clearInterval(searchingInterval);
    searchingInterval = null;
  }
  statusText.classList.remove("searching");
}

// ---------- SOCKET ----------
const socket = io("http://192.168.173.122:3000");
const renderer = new GameRenderer(canvas);

// ---------- MATCHMAKING ----------
startBtn.addEventListener("click", () => {
  mainMenu.style.display = "none";
  gameUI.style.display = "block";

  socket.emit("ready");
  showStatus("Suche Gegner…");
  startSearchingAnimation();
});

// When waiting for opponent
socket.on("waiting", () => {
  startSearchingAnimation();
});

// Opponent found
socket.on("matchFound", () => {
  stopSearchingAnimation();
  showStatus("Gegner gefunden!");
});

// Countdown
socket.on("countdown", (num) => {
  if (num > 0) showStatus(`Start in ${num}…`);
  else showStatus("GO!");
});

// Game starts
socket.on("startGame", () => {
  stopSearchingAnimation();
  gameActive = true;

  rematchBtn.style.display = "none";
  playAgainBtn.style.display = "none";
  quitBtn.style.display = "none";

  showStatus("Möge das Spiel beginnen!");
});

// ---------- GAME LOOP ----------
socket.on("state", (state) => {
  renderer.render(state);
});

// ---------- GAME OVER ----------
socket.on("gameOver", () => {
  gameActive = false;
  showStatus("Spiel vorbei!");

  rematchBtn.style.display = "block";
  playAgainBtn.style.display = "block";
  quitBtn.style.display = "block";
});

// ---------- REMATCH ----------
rematchBtn.addEventListener("click", () => {
  rematchBtn.style.display = "none";
  playAgainBtn.style.display = "none";
  quitBtn.style.display = "none";

  showStatus("Warte auf Gegner…");
  socket.emit("rematchRequest");
});

socket.on("rematchStart", () => {
  showStatus("Rematch startet!");
  gameActive = false;
});

// ---------- PLAY AGAIN (NEW OPPONENT) ----------
playAgainBtn.addEventListener("click", () => {
  rematchBtn.style.display = "none";
  playAgainBtn.style.display = "none";
  quitBtn.style.display = "none";

  showStatus("Suche neuen Gegner…");
  socket.emit("playAgain");
});

// ---------- QUIT TO MENU ----------
quitBtn.addEventListener("click", () => {
  gameUI.style.display = "none";
  mainMenu.style.display = "flex";

  rematchBtn.style.display = "none";
  playAgainBtn.style.display = "none";
  quitBtn.style.display = "none";

  statusText.innerText = "";
});

// ---------- INPUT ----------
window.addEventListener("keydown", (e) => {
  if (!gameActive) return;
  socket.emit("input", e.key);
});