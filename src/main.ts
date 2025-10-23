import Game from './game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const modeSelect = document.getElementById('modeSelect') as HTMLSelectElement;

const game = new Game(canvas);

startBtn.addEventListener('click', () => {
  const mode = modeSelect.value as '1p' | '2p';
  game.start(mode);
});

window.addEventListener('resize', () => game.resize());

if ((import.meta as any).hot) {
  (import.meta as any).hot.dispose(() => game.stop());
}
