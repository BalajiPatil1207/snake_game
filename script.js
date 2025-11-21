// ------------------------------
// Snake Game + Apple + Boom + POWER FRUITS (Golden + Speed + Freeze)
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

// backgrounds
let bgMUsic = new Audio('sankeGame.mp3');

// game settings
const BLOCK_PX = 30;
let rows = 0, cols = 0;
let blocks = {};
let snake = [];
let direction = 'right';
let food = null;
let boom = null;

// POWER FRUITS
let bigFood = null;       // 20 pts every 5 sec
let goldenFood = null;    // 50 pts every 10 sec
let speedFood = null;     // speed boost every 12 sec
let freezeFood = null;    // freeze effect
let bigFoodTimer = null;
let goldenTimer = null;
let speedBoostTimer = null;
let freezeTimer = null;

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

function playEatSound() { playTone(760); playTone(980, 'sine', 80); }
function playHitSound() { playTone(120, 'sawtooth', 220); }
function playBoomSound() { playTone(80, 'square', 320, 0.18); }

// ------------------------------
// GRID
// ------------------------------
function setupGrid() {
  rows = Math.max(6, Math.floor(boardElement.clientHeight / BLOCK_PX));
  cols = Math.max(6, Math.floor(boardElement.clientWidth / BLOCK_PX));
  boardElement.style.gridTemplate = `repeat(${rows},1fr)/repeat(${cols},1fr)`;

  boardElement.innerHTML = "";
  blocks = {};

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const el = document.createElement("div");
      el.className = "block";
      boardElement.appendChild(el);
      blocks[`${r}-${c}`] = el;
    }
  }
}

// ------------------------------
// NORMAL FOOD
// ------------------------------
function spawnFood() {
  let fx, fy;
  do {
    fx = Math.floor(Math.random() * rows);
    fy = Math.floor(Math.random() * cols);
  } while (
    snake.some(s => s.x === fx && s.y === fy) ||
    (boom && boom.x === fx && boom.y === fy)
  );
  food = { x: fx, y: fy };
}

// ------------------------------
// BIG ORANGE FOOD (20 pts / 5 sec)
// ------------------------------
function spawnBigFood() {
  let fx, fy;
  do {
    fx = Math.floor(Math.random() * rows);
    fy = Math.floor(Math.random() * cols);
  } while (
    snake.some(s => s.x === fx && s.y === fy) ||
    (food && food.x === fx && food.y === fy)
  );
  bigFood = { x: fx, y: fy };

  // auto remove in 5 sec
  setTimeout(() => { bigFood = null; draw(); }, 5000);
}

// ------------------------------
// GOLDEN APPLE (50 pts / 10 sec)
// ------------------------------
function spawnGoldenFood() {
  let gx, gy;
  do {
    gx = Math.floor(Math.random() * rows);
    gy = Math.floor(Math.random() * cols);
  } while (
    snake.some(s => s.x === gx && s.y === gy) ||
    (food && food.x === gx && food.y === gy)
  );
  goldenFood = { x: gx, y: gy };

  setTimeout(() => { goldenFood = null; draw(); }, 6000);
}

// ------------------------------
// SPEED FRUIT 🔥 (speed boost 5 sec)
// ------------------------------
function spawnSpeedFruit() {
  let sx, sy;
  do {
    sx = Math.floor(Math.random() * rows);
    sy = Math.floor(Math.random() * cols);
  } while (snake.some(s => s.x === sx && s.y === sy));
  speedFood = { x: sx, y: sy };
  setTimeout(() => { speedFood = null; draw(); }, 5000);
}

// ------------------------------
// FREEZE FRUIT ⏳ (freeze game 5 sec)
// ------------------------------
function spawnFreezeFruit() {
  let fx, fy;
  do {
    fx = Math.floor(Math.random() * rows);
    fy = Math.floor(Math.random() * cols);
  } while (snake.some(s => s.x === fx && s.y === fy));

  freezeFood = { x: fx, y: fy };
  setTimeout(() => { freezeFood = null; draw(); }, 5000);
}

// ------------------------------
// (CONTINUED) BOOM SYSTEM + GAME LOOP + FRUIT LOGIC + DRAW + CONTROLS
// ------------------------------

// boom system (keeps your original behavior)
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
      (food && food.x === bx && food.y === by) ||
      (bigFood && bigFood.x === bx && bigFood.y === by) ||
      (goldenFood && goldenFood.x === bx && goldenFood.y === by) ||
      (speedFood && speedFood.x === bx && speedFood.y === by) ||
      (freezeFood && freezeFood.x === bx && freezeFood.y === by)
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
// GAME STATE HELPERS for intervals and freeze/speed
// ------------------------------
let frozen = false;        // used by Freeze fruit
let prevSpeed = null;      // used to restore speed after boost

function startIntervals() {
  // clear any existing to avoid duplicates
  clearInterval(gameInterval);
  clearInterval(timeInterval);
  clearInterval(boomInterval);

  gameInterval = setInterval(stepSnake, speed);
  timeInterval = setInterval(tickTime, 1000);
  boomInterval = setInterval(spawnBoom, 10000);
}

function stopIntervals() {
  clearInterval(gameInterval);
  clearInterval(timeInterval);
  clearInterval(boomInterval);
}

// ------------------------------
// START GAME (update to start extra fruit timers)
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
  frozen = false;

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
  bigFood = null;
  goldenFood = null;
  speedFood = null;
  freezeFood = null;

  // clear any previous timers
  clearInterval(gameInterval);
  clearInterval(timeInterval);
  clearInterval(boomInterval);
  clearInterval(bigFoodTimer);
  clearInterval(goldenTimer);
  clearInterval(speedBoostTimer);
  clearInterval(freezeTimer);

  // main intervals
  gameInterval = setInterval(stepSnake, speed);
  timeInterval = setInterval(tickTime, 1000);
  boomInterval = setInterval(spawnBoom, 10000);

  // spawn special fruits on their schedules
  bigFoodTimer = setInterval(spawnBigFood, 5000);       // big every 5s
  goldenTimer = setInterval(spawnGoldenFood, 10000);   // golden every 10s
  speedBoostTimer = setInterval(spawnSpeedFruit, 12000);// speed fruit every 12s
  freezeTimer = setInterval(spawnFreezeFruit, 15000);  // freeze fruit every 15s

  // initial draw
  draw();
}

// ------------------------------
// MOVE SNAKE (with fruit handling & freeze check)
// ------------------------------
function stepSnake() {
  if (paused || frozen || !started) return;

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

  // BOOM HIT = GAME OVER
  if (boom && head.x === boom.x && head.y === boom.y) {
    playBoomSound();
    return endGame("BOOM");
  }

  snake.unshift(head);

  // --- EAT NORMAL FOOD (5 points)
  if (food && head.x === food.x && head.y === food.y) {
    playEatSound();

    const newScore = parseInt(scoreDisplay.textContent) + 5;
    scoreDisplay.textContent = newScore;

    speed = Math.max(SPEED_MIN, speed - SPEED_STEP);
    clearInterval(gameInterval);
    gameInterval = setInterval(stepSnake, speed);

    spawnFood();
  }
  // --- EAT BIG ORANGE APPLE (20 points)
  else if (bigFood && head.x === bigFood.x && head.y === bigFood.y) {
    playEatSound();
    const newScore = parseInt(scoreDisplay.textContent) + 20;
    scoreDisplay.textContent = newScore;
    bigFood = null;
  }
  // --- EAT GOLDEN APPLE (50 points)
  else if (goldenFood && head.x === goldenFood.x && head.y === goldenFood.y) {
    playEatSound();
    const newScore = parseInt(scoreDisplay.textContent) + 50;
    scoreDisplay.textContent = newScore;
    goldenFood = null;
  }
  // --- EAT SPEED FRUIT (speed boost 5s)
  else if (speedFood && head.x === speedFood.x && head.y === speedFood.y) {
    playEatSound();
    speedFood = null;

    // store and apply faster speed (40% faster => multiply by 0.6)
    if (!prevSpeed) prevSpeed = speed;
    speed = Math.max(SPEED_MIN, Math.floor(speed * 0.6));
    clearInterval(gameInterval);
    gameInterval = setInterval(stepSnake, speed);

    // restore after 5s
    setTimeout(() => {
      if (prevSpeed) {
        speed = prevSpeed;
        prevSpeed = null;
        clearInterval(gameInterval);
        gameInterval = setInterval(stepSnake, speed);
      }
    }, 5000);
  }
  // --- EAT FREEZE FRUIT (freeze 5s)
  else if (freezeFood && head.x === freezeFood.x && head.y === freezeFood.y) {
    playEatSound();
    freezeFood = null;

    // freeze game: stop movement, stop time and bombs
    frozen = true;
    clearInterval(gameInterval);
    clearInterval(boomInterval);
    clearInterval(timeInterval);

    // after 5s resume
    setTimeout(() => {
      frozen = false;
      // restart intervals with current speed
      clearInterval(gameInterval);
      gameInterval = setInterval(stepSnake, speed);
      timeInterval = setInterval(tickTime, 1000);
      boomInterval = setInterval(spawnBoom, 10000);
    }, 5000);
  }
  else {
    // no eating -> move normally (pop tail)
    snake.pop();
  }

  draw();
}

// ------------------------------
// KEYBOARD CONTROLS
// ------------------------------
document.addEventListener('keydown', (e) => {
  if (paused || frozen || !started) return;

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

  function trySetDirection(newDir) {
    if (!started || paused || frozen) return;
    if (opposite[newDir] === direction) return;
    direction = newDir;
  }

  mobileControls.querySelectorAll('button[data-direction]').forEach(btn => {
    const dir = btn.dataset.direction;

    function onPointerDown(e) {
      if (e.cancelable) e.preventDefault();
      trySetDirection(dir);
      btn.classList.add('active');
    }

    function removeActive() { btn.classList.remove('active'); }

    btn.addEventListener('pointerdown', onPointerDown, { passive: false });
    btn.addEventListener('pointerup', removeActive);
    btn.addEventListener('pointercancel', removeActive);
    btn.addEventListener('pointerleave', removeActive);
    btn.addEventListener('touchstart', function(e) { onPointerDown(e); }, { passive: false });
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      trySetDirection(dir);
      setTimeout(removeActive, 120);
    });
  });

  function updateMobileVisibility() {
    if (window.innerWidth <= 680) {
      mobileControls.style.display = ''; // CSS decides
    } else {
      mobileControls.style.display = 'none';
    }
  }
  window.addEventListener('resize', updateMobileVisibility);
  updateMobileVisibility();
})();

// ------------------------------
// DRAW BLOCKS (render fruit classes safely)
// ------------------------------
function draw() {
  // reset blocks
  Object.values(blocks).forEach(el => el.className = "block");

  // normal food
  if (food) {
    const key = `${food.x}-${food.y}`;
    if (blocks[key]) blocks[key].classList.add("apple");
  }

  // big orange apple (20 pts)
  if (bigFood) {
    const key = `${bigFood.x}-${bigFood.y}`;
    if (blocks[key]) blocks[key].classList.add("big-apple");
  }

  // golden apple (50 pts)
  if (goldenFood) {
    const key = `${goldenFood.x}-${goldenFood.y}`;
    if (blocks[key]) blocks[key].classList.add("golden-apple");
  }

  // speed fruit (🔥)
  if (speedFood) {
    const key = `${speedFood.x}-${speedFood.y}`;
    if (blocks[key]) blocks[key].classList.add("speed-fruit");
  }

  // freeze fruit (⏳)
  if (freezeFood) {
    const key = `${freezeFood.x}-${freezeFood.y}`;
    if (blocks[key]) blocks[key].classList.add("freeze-fruit");
  }

  // boom
  if (boom) {
    const key = `${boom.x}-${boom.y}`;
    if (blocks[key]) blocks[key].classList.add("boom");
  }

  // snake body + head
  for (let i = 1; i < snake.length; i++) {
    const key = `${snake[i].x}-${snake[i].y}`;
    if (blocks[key]) blocks[key].classList.add("fill");
  }
  const headKey = `${snake[0].x}-${snake[0].y}`;
  if (blocks[headKey]) blocks[headKey].classList.add("head");
}

// ------------------------------
// TIMER
// ------------------------------
function tickTime() {
  // time paused during frozen state because we clear its interval there
  timeLeft++;
  timeDisplay.textContent = timeLeft;
}

// ------------------------------
// END GAME (clear fruit timers too)
// ------------------------------
function endGame(reason) {
  started = false;
  paused = false;
  frozen = false;

  try { bgMUsic.pause(); bgMUsic.currentTime = 0; } catch (e) {}

  clearInterval(gameInterval);
  clearInterval(timeInterval);
  clearInterval(boomInterval);
  clearInterval(bigFoodTimer);
  clearInterval(goldenTimer);
  clearInterval(speedBoostTimer);
  clearInterval(freezeTimer);

  // clear temporary states
  bigFood = null;
  goldenFood = null;
  speedFood = null;
  freezeFood = null;

  const finalScore = parseInt(scoreDisplay.textContent || "0", 10);

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

// Pause button behavior (keeps previous behavior but respects fruit timers)
pauseButton.addEventListener('click', () => {
  if (!started) return;

  paused = !paused;

  if (paused) {
    // stop the main intervals but keep spawn timers for fruits so they still appear
    clearInterval(gameInterval);
    clearInterval(timeInterval);
    clearInterval(boomInterval);

    try { bgMUsic.pause(); } catch (e) {}

    pauseButton.textContent = 'Resume';
  } else {
    // resume intervals
    if (!frozen) {
      gameInterval = setInterval(stepSnake, speed);
      timeInterval = setInterval(tickTime, 1000);
      boomInterval = setInterval(spawnBoom, 10000);
    }
    try { bgMUsic.play().catch(()=>{}); } catch(e){}

    pauseButton.textContent = 'Pause';
  }
});
