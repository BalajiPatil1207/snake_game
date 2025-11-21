// ------------------------------
// Snake Game + Apple Food + Boom Bomb
// ------------------------------

// DOM refs
const boardElement = document.getElementById('game-board');
const scoreDisplay = document.getElementById('score');
const timeDisplay = document.getElementById('time');
const highScoreDisplay = document.getElementById('highScore');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const modalOverlay = document.getElementById('modalOverlay');
const finalScoreEl = document.getElementById('finalScore');
const finalHighEl = document.getElementById('finalHigh');
const restartBtn = document.getElementById('restartBtn');
const closeBtn = document.getElementById('closeBtn');

let bgMUsic = new Audio('sankeGame.mp3');

// game settings
const BLOCK_PX = 30;
let rows = 0, cols = 0;
let blocks = {};
let snake = [];
let direction = 'right';
let food = null;
let boom = null;
let gameInterval = null;
let timeInterval = null;
let boomInterval = null;
let timeLeft = 0;
let speed = 200;
const SPEED_STEP = 12;
const SPEED_MIN = 80;
let started = false;
let paused = false;

// audio
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioCtx ? new AudioCtx() : null;

function playTone(freq, type = 'sine', duration = 120, gain = 0.06) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  setTimeout(() => { o.stop(); o.disconnect(); g.disconnect(); }, duration);
}

function playEatSound() { playTone(760, 'sine'); playTone(980, 'sine', 80); }
function playHitSound() { playTone(120, 'sawtooth', 220); }
function playBoomSound() { playTone(80, 'square', 320, 0.18); }

// high score
let highScore = parseInt(localStorage.getItem('snakeHighScore') || '0', 10);
highScoreDisplay.textContent = highScore;

// THEME: ensure DOM ready and wire up theme selector robustly
document.addEventListener('DOMContentLoaded', () => {
  // Ensure body has a theme (default to 'dark' if not present)
  if (!document.body.dataset.theme) {
    document.body.dataset.theme = 'dark';
  }

  const themeSelect = document.getElementById('themeSelect');
  if (!themeSelect) {
    console.warn('themeSelect element not found - check your HTML id');
    return;
  }

  // set select to current theme
  themeSelect.value = document.body.dataset.theme || 'dark';

  // attach listener
  themeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    document.body.dataset.theme = val;
    console.log('Theme changed to', val);
  });

  console.log('Theme init done — current theme:', document.body.dataset.theme);
});


// ------------------------------
// GRID
// ------------------------------
function setupGrid() {
  rows = Math.max(6, Math.floor(boardElement.clientHeight / BLOCK_PX));
  cols = Math.max(6, Math.floor(boardElement.clientWidth / BLOCK_PX));
  boardElement.style.gridTemplate = `repeat(${rows}, 1fr) / repeat(${cols}, 1fr)`;

  boardElement.innerHTML = '';
  blocks = {};

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const el = document.createElement('div');
      el.className = 'block';
      boardElement.appendChild(el);
      blocks[`${r}-${c}`] = el;
    }
  }
}

// ------------------------------
// FOOD
// ------------------------------
function spawnFood() {
  let fx, fy;
  do {
    fx = Math.floor(Math.random() * rows);
    fy = Math.floor(Math.random() * cols);
  } while (snake.some(s => s.x === fx && s.y === fy));

  food = { x: fx, y: fy };
}
// ------------------------------
// PAUSE / RESUME & MOBILE CONTROLS
// ------------------------------
pauseButton.addEventListener('click', () => {
  if (!started) return; // nothing to pause if game not started

  paused = !paused;

  if (paused) {
    // stop the main intervals
    clearInterval(gameInterval);
    clearInterval(timeInterval);
    clearInterval(boomInterval);

    // pause bg music
    try { bgMUsic.pause(); } catch (e) { console.warn('bgMUsic pause failed', e); }

    pauseButton.textContent = 'Resume';
  } else {
    // resume intervals
    gameInterval = setInterval(stepSnake, speed);
    timeInterval = setInterval(tickTime, 1000);
    // resume boom spawns only if you want them to continue
    boomInterval = setInterval(spawnBoom, 10000);

    // resume audio — allowed because user already interacted
    bgMUsic.play().catch(err => console.warn('bgMUsic resume blocked:', err));

    pauseButton.textContent = 'Pause';
  }
});




// ------------------------------
// BOOM SYSTEM
// ------------------------------
function spawnBoom() {
  // Warning
  showWarning();

  setTimeout(() => {
    let bx, by;
    do {
      bx = Math.floor(Math.random() * rows);
      by = Math.floor(Math.random() * cols);
    } while (
      snake.some(s => s.x === bx && s.y === by) ||
      (food && food.x === bx && food.y === by)
    );

    boom = { x: bx, y: by };

    screenShake();
    playBoomSound();

    // boom stays only 3 seconds
    setTimeout(() => {
      boom = null;
      draw();
    }, 3000);

    draw();
  }, 2000);
}

function showWarning() {
  const warn = document.createElement('div');
  warn.className = "boom-warning";
  warn.innerText = "⚠️ BOOM INCOMING!";
  document.body.appendChild(warn);

  setTimeout(() => warn.remove(), 1500);
}

function screenShake() {
  document.body.classList.add("shake");
  setTimeout(() => document.body.classList.remove("shake"), 500);
}

// ------------------------------
// START GAME
// ------------------------------
startButton.addEventListener('click', async () => {
   if (audioCtx && audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  bgMUsic.play()
    .then(() => console.log("Music playing"))
    .catch(err => console.log("Audio blocked:", err));

  bgMUsic.loop = true;
  bgMUsic.volume = 0.4;
  if (!started) startGame();
});

function startGame() {
  started = true;
  paused = false;

  timeLeft = 0;
  speed = 400;
  scoreDisplay.textContent = '0';

  setupGrid();

  const sx = Math.floor(rows / 2), sy = Math.floor(cols / 2);
  snake = [
    { x: sx, y: sy },
    { x: sx, y: sy - 1 },
    { x: sx, y: sy - 2 }
  ];
  direction = 'right';

  spawnFood();
  boom = null;

  clearInterval(gameInterval);
  clearInterval(timeInterval);
  clearInterval(boomInterval);

  gameInterval = setInterval(stepSnake, speed);
  timeInterval = setInterval(tickTime, 1000);

  // Boom every 10 seconds
  boomInterval = setInterval(spawnBoom, 10000);

  draw();
}

// ------------------------------
// MOVE SNAKE
// ------------------------------
function stepSnake() {
  if (paused) return;

  const head = { ...snake[0] };
  if (direction === 'left') head.y--;
  if (direction === 'right') head.y++;
  if (direction === 'up') head.x--;
  if (direction === 'down') head.x++;

  // WALL HIT
  if (head.x < 0 || head.x >= rows || head.y < 0 || head.y >= cols) {
    playHitSound();
    return endGame("Wall");
  }

  // SELF HIT
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    playHitSound();
    return endGame("Self");
  }

  // ------------------------------
  // BOOM HIT = GAME OVER
  // ------------------------------
  if (boom && head.x === boom.x && head.y === boom.y) {
    playBoomSound();
    return endGame("BOOM");
  }

  snake.unshift(head);

  // EAT FOOD
  if (food && head.x === food.x && head.y === food.y) {
    playEatSound();

    const newScore = parseInt(scoreDisplay.textContent) + 1;
    scoreDisplay.textContent = newScore;

    speed = Math.max(SPEED_MIN, speed - SPEED_STEP);
    clearInterval(gameInterval);
    gameInterval = setInterval(stepSnake, speed);

    spawnFood();
  } else {
    snake.pop();
  }

  draw();
}

// ------------------------------
// KEYBOARD CONTROLS
// ------------------------------
document.addEventListener('keydown', (e) => {
  if (paused || !started) return;

  if (e.key === 'ArrowUp' && direction !== 'down') {
    direction = 'up';
  }
  else if (e.key === 'ArrowDown' && direction !== 'up') {
    direction = 'down';
  }
  else if (e.key === 'ArrowLeft' && direction !== 'right') {
    direction = 'left';
  }
  else if (e.key === 'ArrowRight' && direction !== 'left') {
    direction = 'right';
  }
});

// --- MOBILE / TOUCH CONTROLS (robust) ---
(function() {
  const mobileControls = document.getElementById('mobileControls');
  if (!mobileControls) return;

  const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };

  // helper: set direction safely (prevent reverse)
  function trySetDirection(newDir) {
    // don't allow reversing directly
    if (!started || paused) return;
    if (opposite[newDir] === direction) return;
    direction = newDir;
  }

  // pointerdown is best for touch + mouse; fallback to touchstart for older browsers
  mobileControls.querySelectorAll('button[data-direction]').forEach(btn => {
    const dir = btn.dataset.direction;

    function onPointerDown(e) {
      // stop page from scrolling on mobile while pressing
      if (e.cancelable) e.preventDefault();
      trySetDirection(dir);
      btn.classList.add('active');
    }

    function removeActive() { btn.classList.remove('active'); }

    // Use pointer events when available
    btn.addEventListener('pointerdown', onPointerDown, { passive: false });
    btn.addEventListener('pointerup', removeActive);
    btn.addEventListener('pointercancel', removeActive);
    btn.addEventListener('pointerleave', removeActive);

    // Touch fallback for old devices
    btn.addEventListener('touchstart', function(e) { onPointerDown(e); }, { passive: false });

    // click fallback (keyboard / mouse)
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      trySetDirection(dir);
      // remove active in case pointer events didn't fire
      setTimeout(removeActive, 120);
    });
  });

  // JS fallback visibility: rely primarily on CSS but hide on large viewports
  function updateMobileVisibility() {
    if (window.innerWidth <= 680) {
      mobileControls.style.display = ''; // defer to CSS media query
    } else {
      mobileControls.style.display = 'none';
    }
  }
  window.addEventListener('resize', updateMobileVisibility);
  updateMobileVisibility();
})();




// ------------------------------
// DRAW BLOCKS
// ------------------------------
function draw() {
  Object.values(blocks).forEach(el => el.className = "block");

  if (food) {
    blocks[`${food.x}-${food.y}`].classList.add("apple");
  }

  if (boom) {
    blocks[`${boom.x}-${boom.y}`].classList.add("boom");
  }

  for (let i = 1; i < snake.length; i++) {
    blocks[`${snake[i].x}-${snake[i].y}`].classList.add("fill");
  }

  blocks[`${snake[0].x}-${snake[0].y}`].classList.add("head");
}

// ------------------------------
// TIMER
// ------------------------------
function tickTime() {
  timeLeft++;
  timeDisplay.textContent = timeLeft;
 }

// ------------------------------
// END GAME
// ------------------------------
function endGame(reason) {
  started = false;
  bgMUsic.pause();
  bgMUsic.currentTime = 0;

  clearInterval(gameInterval);
  clearInterval(timeInterval);
  clearInterval(boomInterval);

  const finalScore = parseInt(scoreDisplay.textContent);

  if (finalScore > highScore) {
    highScore = finalScore;
    localStorage.setItem('snakeHighScore', highScore);
    highScoreDisplay.textContent = highScore;
  }

  finalScoreEl.textContent = finalScore;
  finalHighEl.textContent = highScore;

  modalOverlay.classList.remove("hidden");
}

// restart
restartBtn.addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
  startGame();
});
closeBtn.addEventListener('click', () => modalOverlay.classList.add('hidden'));
