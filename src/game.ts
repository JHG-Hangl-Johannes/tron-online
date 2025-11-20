type Dir = 'up' | 'down' | 'left' | 'right';
function getRandomNeonColorsForPlayers(): [string, string] {
  const neonColors: string[] = [
    "#ff009dff", // neon pink
    "#26ff00ff", // neon green
    "#FF3131", // neon red
    "#ffff00ff", // neon yellow
    "#a200ffff", // neon purple
    "#00BFFF", // Tron electric blue
    "#FF8C00", // Tron vivid orange
  ];

  // Shuffle the array (Fisher-Yates)
  for (let i = neonColors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [neonColors[i], neonColors[j]] = [neonColors[j], neonColors[i]];
  }

  // Take the first two colors
  return [neonColors[0], neonColors[1]];
}

const KEY = {
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  W: 'w',
  A: 'a',
  S: 's',
  D: 'd'
} as const;

class Player {
  x: number;
  y: number;
  dir: Dir;
  color: string;
  trail: Array<[number, number]>;
  alive: boolean;
  pendingDir: Dir | null;

  constructor(x: number, y: number, dir: Dir, color: string) {
    this.x = x; this.y = y; this.dir = dir; this.color = color;
    this.trail = [];
    this.alive = true;
    this.pendingDir = null;
  }

  setDir(d: Dir) {
    const rev: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
    if (d === rev[this.dir]) return;
    this.pendingDir = d;
  }

  step() {
    if (this.pendingDir) { this.dir = this.pendingDir; this.pendingDir = null; }
    if (this.dir === 'up') this.y--;
    if (this.dir === 'down') this.y++;
    if (this.dir === 'left') this.x--;
    if (this.dir === 'right') this.x++;
    this.trail.push([this.x, this.y]);
  }
}

export default class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cellSize: number;
  cols: number;
  rows: number;
  running: boolean;
  _loop: number | null;
  keyHandler: (e: KeyboardEvent) => void;
  grid: Map<string, true>;
  players: Player[];
  mode: '1p' | '2p' | null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    this.ctx = ctx;
    this.cellSize = 12;
    this.cols = 60;
    this.rows = 40;
    this.running = false;
    this._loop = null;
    this.keyHandler = this.onKey.bind(this);
    this.grid = new Map();
    this.players = [];
    this.mode = null;
    this.resize();
  }

  resize() {
    this.canvas.width = this.cols * this.cellSize;
    this.canvas.height = this.rows * this.cellSize;
  }

  start(mode: '1p'|'2p' = '1p') {
    const [player1Color, player2Color] = getRandomNeonColorsForPlayers();
    this.mode = mode;
    this.grid = new Map();
    this.players = [];

    const p1 = new Player(this.cols - 10, Math.floor(this.rows/2), 'left', player1Color);
    this.players.push(p1);

    if (mode === '2p') {
      const p2 = new Player(10, Math.floor(this.rows/2), 'right', player2Color);
      this.players.push(p2);
    } else {
      const ai = new Player(10, Math.floor(this.rows/2)+2, 'right', player2Color);
      this.players.push(ai);
    }

    this.players.forEach(p => { p.trail = [[p.x,p.y]]; p.alive = true; });

    window.addEventListener('keydown', this.keyHandler);
    this.running = true;
    this._loop = window.setInterval(() => this.update(), 80);
  }

  stop() {
    this.running = false;
    window.removeEventListener('keydown', this.keyHandler);
    if (this._loop) { clearInterval(this._loop); this._loop = null; }
  }

  onKey(e: KeyboardEvent) {
    const k = e.key;
    const p1 = this.players[0];
    if (!p1) return;
    if (k === KEY.UP) p1.setDir('up');
    if (k === KEY.DOWN) p1.setDir('down');
    if (k === KEY.LEFT) p1.setDir('left');
    if (k === KEY.RIGHT) p1.setDir('right');

    if (this.mode === '2p') {
      const p2 = this.players[1];
      if (!p2) return;
      if (k === KEY.W) p2.setDir('up');
      if (k === KEY.S) p2.setDir('down');
      if (k === KEY.A) p2.setDir('left');
      if (k === KEY.D) p2.setDir('right');
    }
  }

  isOccupied(x: number, y: number) {
    return this.grid.has(`${x},${y}`);
  }

  update() {
    if (!this.running) return;
    for (const p of this.players) {
      if (!p.alive) continue;
      p.step();
      if (p.x < 0 || p.x >= this.cols || p.y < 0 || p.y >= this.rows) {
        p.alive = false; continue;
      }
      const key = `${p.x},${p.y}`;
      if (this.grid.has(key)) {
        p.alive = false; continue;
      }
      this.grid.set(key, true);
    }

    if (this.mode !== '2p') {
      const ai = this.players[1];
      if (ai && ai.alive) {
        const dirs: Dir[] = ['up','down','left','right'];
        const forward = ai.dir;
        let nx = ai.x, ny = ai.y;
        if (forward==='up') ny--;
        if (forward==='down') ny++;
        if (forward==='left') nx--;
        if (forward==='right') nx++;
        if (nx<0||nx>=this.cols||ny<0||ny>=this.rows||this.isOccupied(nx,ny)) {
          const safe = dirs.filter(d => {
            let tx = ai.x, ty = ai.y;
            if (d==='up') ty--;
            if (d==='down') ty++;
            if (d==='left') tx--;
            if (d==='right') tx++;
            if (tx<0||tx>=this.cols||ty<0||ty>=this.rows) return false;
            if (this.isOccupied(tx,ty)) return false;
            return true;
          });
          if (safe.length) ai.setDir(safe[Math.floor(Math.random()*safe.length)]);
        }
      }
    }

    this.draw();

    const alive = this.players.filter(p => p.alive);
    if (alive.length <= 1) {
      this.running = false;
      window.removeEventListener('keydown', this.keyHandler);
      if (this._loop) { clearInterval(this._loop); this._loop = null; }
      setTimeout(()=> alert(alive.length? 'You win!' : 'All crashed!'), 50);
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,this.canvas.width,this.canvas.height);

    for (const [k] of this.grid) {
      const [x,y] = k.split(',').map(n=>+n);
      ctx.fillStyle = '#444';
      ctx.fillRect(x*this.cellSize, y*this.cellSize, this.cellSize, this.cellSize);
    }

    for (const p of this.players) {
      ctx.fillStyle = p.color;
      for (const [x,y] of p.trail) {
        ctx.fillRect(x*this.cellSize, y*this.cellSize, this.cellSize, this.cellSize);
      }
      if (p.alive) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(p.x*this.cellSize, p.y*this.cellSize, this.cellSize, this.cellSize);
      }
    }
  }
}
