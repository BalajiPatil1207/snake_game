/**
 * SNAKE PRO - Professional Gaming Logic
 */

// --- CONFIGURATION ---
const BASE_SPEED = 200;
const SPEED_MIN = 80;
const SPEED_STEP = 12;
const GRID_SIZE_RATIO = 20; // Cells cross-axis

// --- STATE ---
let gameState = {
    started: false,
    paused: false,
    frozen: false,
    score: 0,
    highScore: parseInt(localStorage.getItem("snakeHighScore") || "0"),
    speed: BASE_SPEED,
    timeLeft: 0,
    direction: 'right',
    prevDirection: 'right',
    snake: [],
    food: { normal: null, big: null, golden: null, speed: null, freeze: null },
    boom: null,
    intervals: { main: null, time: null, boom: null, fruits: [] },
    grid: { rows: 0, cols: 0, blocks: {} }
};

// --- DOM ELEMENTS ---
const elements = {
    board: document.getElementById('game-board'),
    score: document.getElementById('score'),
    time: document.getElementById('time'),
    highScore: document.getElementById('highScore'),
    startBtn: document.getElementById('start-button'),
    pauseBtn: document.getElementById('pause-button'),
    restartBtn: document.getElementById('restartBtn'),
    closeBtn: document.getElementById('closeBtn'),
    startOverlay: document.getElementById('start-overlay'),
    pauseOverlay: document.getElementById('pause-overlay'),
    modal: document.getElementById('modalOverlay'),
    finalScore: document.getElementById('finalScore'),
    finalHigh: document.getElementById('finalHigh')
};

// --- AUDIO SYSTEM ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioCtx ? new AudioCtx() : null;
const bgMusic = new Audio('sankeGame.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.3;

function playTone(freq, type = 'sine', duration = 120, gain = 0.05) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    setTimeout(() => { o.stop(); o.disconnect(); g.disconnect(); }, duration);
}

const sounds = {
    eat: () => { playTone(700); playTone(900, 'sine', 80); },
    hit: () => playTone(120, 'sawtooth', 250),
    boom: () => playTone(80, 'square', 400, 0.15)
};

// --- GRID ENGINE ---
function setupGrid() {
    const rect = elements.board.getBoundingClientRect();
    const cellSize = rect.width / GRID_SIZE_RATIO;
    gameState.grid.cols = GRID_SIZE_RATIO;
    gameState.grid.rows = Math.floor(rect.height / cellSize);
    
    elements.board.style.gridTemplateColumns = `repeat(${gameState.grid.cols}, 1fr)`;
    elements.board.style.gridTemplateRows = `repeat(${gameState.grid.rows}, 1fr)`;
    
    elements.board.innerHTML = "";
    gameState.grid.blocks = {};

    for (let r = 0; r < gameState.grid.rows; r++) {
        for (let c = 0; c < gameState.grid.cols; c++) {
            const block = document.createElement("div");
            block.className = "block";
            elements.board.appendChild(block);
            gameState.grid.blocks[`${r}-${c}`] = block;
        }
    }
}

// --- CORE GAME LOGIC ---
function spawnItem(type, timeout = null) {
    let x, y;
    let attempts = 0;
    do {
        x = Math.floor(Math.random() * gameState.grid.rows);
        y = Math.floor(Math.random() * gameState.grid.cols);
        attempts++;
        if(attempts > 100) return; // Prevent infinite loop on full board
    } while (isOccupied(x, y));

    if (type === 'boom') {
        gameState.boom = { x, y };
        showBoomWarning();
        setTimeout(() => { gameState.boom = null; draw(); }, 4000);
    } else {
        gameState.food[type] = { x, y };
        if (timeout) {
            setTimeout(() => {
                if (gameState.food[type] && gameState.food[type].x === x && gameState.food[type].y === y) {
                    gameState.food[type] = null;
                    draw();
                }
            }, timeout);
        }
    }
    draw();
}

function isOccupied(x, y) {
    if (gameState.snake.some(s => s.x === x && s.y === y)) return true;
    if (gameState.food.normal && gameState.food.normal.x === x && gameState.food.normal.y === y) return true;
    if (gameState.boom && gameState.boom.x === x && gameState.boom.y === y) return true;
    // Check other special fruits...
    return Object.values(gameState.food).some(f => f && f.x === x && f.y === y);
}

function moveSnake() {
    if (!gameState.started || gameState.paused || gameState.frozen) return;

    const head = { ...gameState.snake[0] };
    gameState.prevDirection = gameState.direction;

    if (gameState.direction === 'up') head.x--;
    if (gameState.direction === 'down') head.x++;
    if (gameState.direction === 'left') head.y--;
    if (gameState.direction === 'right') head.y++;

    // Collision Check
    if (head.x < 0 || head.x >= gameState.grid.rows || head.y < 0 || head.y >= gameState.grid.cols ||
        gameState.snake.some(s => s.x === head.x && s.y === head.y)) {
        sounds.hit();
        return endGame();
    }

    // Boom Collision
    if (gameState.boom && head.x === gameState.boom.x && head.y === gameState.boom.y) {
        sounds.boom();
        return endGame();
    }

    gameState.snake.unshift(head);

    // Eating Logic
    let ate = false;
    if (gameState.food.normal && head.x === gameState.food.normal.x && head.y === gameState.food.normal.y) {
        updateScore(5);
        gameState.speed = Math.max(SPEED_MIN, gameState.speed - SPEED_STEP);
        resetMainInterval();
        spawnItem('normal');
        ate = true;
    } else if (gameState.food.big && head.x === gameState.food.big.x && head.y === gameState.food.big.y) {
        updateScore(20);
        gameState.food.big = null;
        ate = true;
    } else if (gameState.food.golden && head.x === gameState.food.golden.x && head.y === gameState.food.golden.y) {
        updateScore(50);
        gameState.food.golden = null;
        ate = true;
    } else if (gameState.food.speed && head.x === gameState.food.speed.x && head.y === gameState.food.speed.y) {
        triggerSpeedBoost();
        gameState.food.speed = null;
        ate = true;
    } else if (gameState.food.freeze && head.x === gameState.food.freeze.x && head.y === gameState.food.freeze.y) {
        triggerFreezeEffect();
        gameState.food.freeze = null;
        ate = true;
    }

    if (!ate) gameState.snake.pop();
    if (ate) sounds.eat();

    draw();
}

function updateScore(pts) {
    gameState.score += pts;
    elements.score.textContent = gameState.score;
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        elements.highScore.textContent = gameState.highScore;
        localStorage.setItem("snakeHighScore", gameState.highScore);
    }
}

function triggerSpeedBoost() {
    const currentSpeed = gameState.speed;
    gameState.speed = Math.max(SPEED_MIN, Math.floor(gameState.speed * 0.6));
    resetMainInterval();
    setTimeout(() => {
        gameState.speed = currentSpeed;
        resetMainInterval();
    }, 5000);
}

function triggerFreezeEffect() {
    gameState.frozen = true;
    setTimeout(() => {
        gameState.frozen = false;
    }, 5000);
}

// --- RENDER SYSTEM ---
function draw() {
    // Clear board classes
    Object.values(gameState.grid.blocks).forEach(b => {
        b.className = "block";
    });

    // Draw snake
    gameState.snake.forEach((segment, i) => {
        const key = `${segment.x}-${segment.y}`;
        if (gameState.grid.blocks[key]) {
            gameState.grid.blocks[key].classList.add(i === 0 ? "head" : "fill");
        }
    });

    // Draw items
    if (gameState.food.normal) addClass(gameState.food.normal, "apple");
    if (gameState.food.big) addClass(gameState.food.big, "big-apple");
    if (gameState.food.golden) addClass(gameState.food.golden, "golden-apple");
    if (gameState.food.speed) addClass(gameState.food.speed, "speed-fruit");
    if (gameState.food.freeze) addClass(gameState.food.freeze, "freeze-fruit");
    if (gameState.boom) addClass(gameState.boom, "boom");
}

function addClass(pos, className) {
    const key = `${pos.x}-${pos.y}`;
    if (gameState.grid.blocks[key]) gameState.grid.blocks[key].classList.add(className);
}

// --- INTERACTION SYSTEM ---
function handleKey(e) {
    if (!gameState.started) {
        if (e.code === 'Space') startGame();
        return;
    }
    
    if (e.code === 'KeyP') togglePause();
    
    const dirs = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right'
    };

    const newDir = dirs[e.code];
    if (!newDir) return;

    changeDirection(newDir);
}

function changeDirection(newDir) {
    const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };
    if (newDir !== opposites[gameState.prevDirection]) {
        gameState.direction = newDir;
    }
}

// Swipe Support
let touchStart = { x: 0, y: 0 };
elements.board.addEventListener('touchstart', e => {
    touchStart.x = e.touches[0].clientX;
    touchStart.y = e.touches[0].clientY;
}, { passive: true });

elements.board.addEventListener('touchend', e => {
    if (!gameState.started) {
        startGame();
        return;
    }

    const deltaX = e.changedTouches[0].clientX - touchStart.x;
    const deltaY = e.changedTouches[0].clientY - touchStart.y;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (Math.abs(deltaX) > 30) changeDirection(deltaX > 0 ? 'right' : 'left');
    } else {
        if (Math.abs(deltaY) > 30) changeDirection(deltaY > 0 ? 'down' : 'up');
    }
}, { passive: true });

// --- GAME FLOW ---
function startGame() {
    if (gameState.started) return;

    // Reset State
    gameState.started = true;
    gameState.paused = false;
    gameState.score = 0;
    gameState.timeLeft = 0;
    gameState.speed = BASE_SPEED;
    gameState.direction = 'right';
    gameState.prevDirection = 'right';
    gameState.food = { normal: null, big: null, golden: null, speed: null, freeze: null };
    gameState.boom = null;

    elements.score.textContent = "0";
    elements.time.textContent = "0";
    elements.highScore.textContent = gameState.highScore;
    elements.startOverlay.classList.add('hidden');
    elements.modal.classList.add('hidden');

    setupGrid();
    
    const startX = Math.floor(gameState.grid.rows / 2);
    const startY = Math.floor(gameState.grid.cols / 2);
    gameState.snake = [
        { x: startX, y: startY },
        { x: startX, y: startY - 1 },
        { x: startX, y: startY - 2 }
    ];

    spawnItem('normal');
    startIntervals();
    
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    bgMusic.play().catch(() => {});
}

function endGame() {
    gameState.started = false;
    stopIntervals();
    bgMusic.pause();
    bgMusic.currentTime = 0;
    
    elements.finalScore.textContent = gameState.score;
    elements.finalHigh.textContent = gameState.highScore;
    elements.modal.classList.remove('hidden');
    elements.startOverlay.classList.remove('hidden');
}

function togglePause() {
    if (!gameState.started) return;
    gameState.paused = !gameState.paused;
    elements.pauseOverlay.classList.toggle('hidden', !gameState.paused);
    if (gameState.paused) bgMusic.pause();
    else bgMusic.play().catch(() => {});
}

// --- INTERVAL MANAGEMENT ---
function startIntervals() {
    stopIntervals();
    gameState.intervals.main = setInterval(moveSnake, gameState.speed);
    gameState.intervals.time = setInterval(() => {
        if (!gameState.paused && !gameState.frozen) {
            gameState.timeLeft++;
            elements.time.textContent = gameState.timeLeft;
        }
    }, 1000);

    gameState.intervals.boom = setInterval(() => {
        if (!gameState.paused && !gameState.frozen) spawnItem('boom');
    }, 12000);

    // Fruit schedules
    gameState.intervals.fruits.push(setInterval(() => { if(shouldSpawn()) spawnItem('big', 5000); }, 8000));
    gameState.intervals.fruits.push(setInterval(() => { if(shouldSpawn()) spawnItem('golden', 8000); }, 15000));
    gameState.intervals.fruits.push(setInterval(() => { if(shouldSpawn()) spawnItem('speed', 6000); }, 20000));
    gameState.intervals.fruits.push(setInterval(() => { if(shouldSpawn()) spawnItem('freeze', 6000); }, 25000));
}

function shouldSpawn() { return gameState.started && !gameState.paused && !gameState.frozen; }

function stopIntervals() {
    clearInterval(gameState.intervals.main);
    clearInterval(gameState.intervals.time);
    clearInterval(gameState.intervals.boom);
    gameState.intervals.fruits.forEach(clearInterval);
    gameState.intervals.fruits = [];
}

function resetMainInterval() {
    clearInterval(gameState.intervals.main);
    gameState.intervals.main = setInterval(moveSnake, gameState.speed);
}

// --- UTILITIES ---
function showBoomWarning() {
    const warn = document.createElement('div');
    warn.className = "boom-warning";
    warn.innerHTML = "⚠️ INCOMING!";
    document.body.appendChild(warn);
    setTimeout(() => warn.remove(), 1200);
}

// --- INITIALIZATION ---
window.addEventListener('keydown', handleKey);
elements.startBtn.addEventListener('click', startGame);
elements.pauseBtn.addEventListener('click', togglePause);
elements.restartBtn.addEventListener('click', startGame);
elements.closeBtn.addEventListener('click', () => elements.modal.classList.add('hidden'));

// Theme Selector
document.getElementById('themeSelect').addEventListener('change', (e) => {
    document.body.setAttribute('data-theme', e.target.value);
});

// Initialization
setupGrid();
window.addEventListener('resize', () => {
    if (!gameState.started) setupGrid();
});
