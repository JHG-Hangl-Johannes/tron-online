export default class GameRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cellSize = 24;
  sprites: { [key: string]: HTMLImageElement } = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    this.ctx = ctx;

    this.canvas.width = 60 * this.cellSize;
    this.canvas.height = 40 * this.cellSize;

    // Load sprites
    this.loadSprite("player1", "/src/assets/player1.png");
    this.loadSprite("player2", "/src/assets/player2.png");
  }

  loadSprite(key: string, src: string) {
    const img = new Image();
    img.src = src;
    this.sprites[key] = img;
  }

  render(state: any) {
    const ctx = this.ctx;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid (trails)
    ctx.fillStyle = "#444444ff";
    for (const key of state.grid) {
      const [x, y] = key.split(",").map(Number);
      ctx.fillRect(
        x * this.cellSize,
        y * this.cellSize,
        this.cellSize,
        this.cellSize
      );
    }

    // Draw players
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      ctx.fillStyle = p.color || "#fff";

      // Draw trail
      for (const [x, y] of p.trail) {
        ctx.fillRect(
          x * this.cellSize,
          y * this.cellSize,
          this.cellSize,
          this.cellSize
        );
      }

      // Draw head with sprite
      if (p.alive) {
        const spriteKey = `player${i + 1}`;
        const sprite = this.sprites[spriteKey];
        
        if (sprite && sprite.complete) {
          ctx.drawImage(
            sprite,
            p.x * this.cellSize,
            p.y * this.cellSize,
            this.cellSize,
            this.cellSize
          );
        } else {
          // Fallback to white square if sprite not loaded
          ctx.fillStyle = "#fff";
          ctx.fillRect(
            p.x * this.cellSize,
            p.y * this.cellSize,
            this.cellSize,
            this.cellSize
          );
        }
      }
    }
  }
}