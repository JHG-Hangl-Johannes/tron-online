export default class GameRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cellSize = 12;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    this.ctx = ctx;

    this.canvas.width = 60 * this.cellSize;
    this.canvas.height = 40 * this.cellSize;
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
    for (const p of state.players) {
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

      // Draw head
      if (p.alive) {
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