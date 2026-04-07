/**
 * SNAKE PRO - Professional Gaming Logic
 */

// --- CONFIGURATION ---
const GRID_SIZE_RATIO = 20; // Cells cross-axis

const DIFFICULTY_SETTINGS = {
    easy: { baseSpeed: 300, speedStep: 8 },
    medium: { baseSpeed: 200, speedStep: 12 },
    hard: { baseSpeed: 120, speedStep: 18 }
};

const SKINS = [
    { id: 'classic', name: 'Classic Green', price: 0, class: 'fill-classic' },
    { id: 'neon', name: 'Neon Cyber', price: 50, class: 'fill-neon' },
    { id: 'lava', name: 'Lava Flow', price: 100, class: 'fill-lava' },
    { id: 'ice', name: 'Arctic Ice', price: 150, class: 'fill-ice' },
    { id: 'gold', name: 'Royal Gold', price: 300, class: 'fill-gold' }
];

// --- STATE ---
let gameState = {
    started: false,
    paused: false,
    frozen: false,
    score: 0,
    coins: parseInt(localStorage.getItem("snakeProCoins") || "0"),
    highScore: parseInt(localStorage.getItem("snakeHighScore") || "0"),
    speed: 200,
    timeLeft: 0,
    direction: 'right',
    prevDirection: 'right',
    snake: [],
    food: { normal: null, big: null, golden: null, speed: null, freeze: null },
    boom: null,
    intervals: { main: null, time: null, boom: null, fruits: [] },
    grid: { rows: 0, cols: 0, blocks: {} },
    settings: {
        sound: true,
        vibration: true,
        difficulty: 'medium',
        selectedSkin: localStorage.getItem("snakeProSelectedSkin") || 'classic',
        unlockedSkins: JSON.parse(localStorage.getItem("snakeProUnlockedSkins") || '["classic"]')
    }
};

// --- DOM ELEMENTS ---
const elements = {
    board: document.getElementById('game-board'),
    // Mobile HUD
    score: document.getElementById('score'),
    coinCount: document.getElementById('coinCount'),
    time: document.getElementById('time'),
    highScore: document.getElementById('highScore'),
    // Desktop Sidebar
    sideScore: document.getElementById('sideScore'),
    sideCoinCount: document.getElementById('sideCoinCount'),
    sideTime: document.getElementById('sideTime'),
    sideHighScore: document.getElementById('sideHighScore'),
    // Controls
    startBtn: document.getElementById('start-button'),
    pauseBtn: document.getElementById('pause-button'),
    restartBtn: document.getElementById('restartBtn'),
    closeBtn: document.getElementById('closeBtn'),
    // Desktop Quick Actions
    quickPlayBtn: document.getElementById('quickPlayBtn'),
    quickShopBtn: document.getElementById('quickShopBtn'),
    quickSettingsBtn: document.getElementById('quickSettingsBtn'),
    // Mobile Actions
    mobilePlayBtn: document.getElementById('mobilePlayBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    shopBtn: document.getElementById('shopBtn'),
    // Modals
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    closeShopBtn: document.getElementById('closeShopBtn'),
    startOverlay: document.getElementById('start-overlay'),
    pauseOverlay: document.getElementById('pause-overlay'),
    modal: document.getElementById('modalOverlay'),
    settingsModal: document.getElementById('settingsOverlay'),
    shopModal: document.getElementById('shopOverlay'),
    skinGallery: document.getElementById('skinGallery'),
    // Overlays
    finalScore: document.getElementById('finalScore'),
    finalHigh: document.getElementById('finalHigh'),
    soundToggle: document.getElementById('soundToggle'),
    vibrationToggle: document.getElementById('vibrationToggle'),
    difficultySelect: document.getElementById('difficultySelect'),
    shopCoinCount: document.getElementById('shopCoinCount')
};

// --- AUDIO SYSTEM ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioCtx ? new AudioCtx() : null;
const bgMusic = new Audio('sankeGame.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.3;

function playTone(freq, type = 'sine', duration = 120, gain = 0.05) {
    if (!audioCtx || !gameState.settings.sound) return;
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
    boom: () => playTone(80, 'square', 400, 0.15),
    buy: () => { playTone(600); playTone(800, 'sine', 100); }
};

// --- VIBRATION SYSTEM ---
function triggerVibrate(pattern) {
    if (gameState.settings.vibration && navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

// --- PERSISTENCE & SYNC ---
function updateDisplayValue(key, val) {
    const el = elements[key];
    const sideEl = elements[`side${key.charAt(0).toUpperCase() + key.slice(1)}`];
    if (el) el.textContent = val;
    if (sideEl) sideEl.textContent = val;
}

function loadProgress() {
    updateDisplayValue('coinCount', gameState.coins);
    updateDisplayValue('highScore', gameState.highScore);
}

function saveProgress() {
    localStorage.setItem("snakeProCoins", gameState.coins);
    localStorage.setItem("snakeHighScore", gameState.highScore);
    localStorage.setItem("snakeProSelectedSkin", gameState.settings.selectedSkin);
    localStorage.setItem("snakeProUnlockedSkins", JSON.stringify(gameState.settings.unlockedSkins));
}

function loadSettings() {
    const saved = localStorage.getItem('snakeProSettings');
    if (saved) {
        gameState.settings = { ...gameState.settings, ...JSON.parse(saved) };
        elements.soundToggle.checked = gameState.settings.sound;
        elements.vibrationToggle.checked = gameState.settings.vibration;
        elements.difficultySelect.value = gameState.settings.difficulty;
    }
}

function saveSettings() {
    gameState.settings.sound = elements.soundToggle.checked;
    gameState.settings.vibration = elements.vibrationToggle.checked;
    gameState.settings.difficulty = elements.difficultySelect.value;
    localStorage.setItem('snakeProSettings', JSON.stringify(gameState.settings));
}

// --- SHOP LOGIC ---
function renderShop() {
    elements.shopCoinCount.textContent = gameState.coins;
    elements.skinGallery.innerHTML = "";

    SKINS.forEach(skin => {
        const isUnlocked = gameState.settings.unlockedSkins.includes(skin.id);
        const isSelected = gameState.settings.selectedSkin === skin.id;

        const card = document.createElement("div");
        card.className = `skin-card ${isSelected ? 'selected' : ''}`;
        
        card.innerHTML = `
            <div class="skin-preview">
                <span class="${skin.class}"></span>
                <span class="${skin.class}"></span>
                <span class="${skin.class}"></span>
                <span class="${skin.class}"></span>
            </div>
            <div class="skin-name">${skin.name}</div>
            <div class="skin-status ${isUnlocked ? (isSelected ? 'status-active' : 'status-select') : 'status-buy'}">
                ${isUnlocked ? (isSelected ? 'Active' : 'Select') : skin.price + ' 💰'}
            </div>
        `;

        card.addEventListener('click', () => {
            if (isUnlocked) {
                selectSkin(skin.id);
            } else {
                buySkin(skin);
            }
        });

        elements.skinGallery.appendChild(card);
    });
}

function buySkin(skin) {
    if (gameState.coins >= skin.price) {
        gameState.coins -= skin.price;
        gameState.settings.unlockedSkins.push(skin.id);
        sounds.buy();
        saveProgress();
        renderShop();
        updateDisplayValue('coinCount', gameState.coins);
    } else {
        triggerVibrate([50, 50]);
        alert("Not enough coins! 🐍💰");
    }
}

function selectSkin(id) {
    gameState.settings.selectedSkin = id;
    saveProgress();
    renderShop();
    draw();
}

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
        if(attempts > 100) return; 
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
        triggerVibrate([100, 50, 100]);
        return endGame();
    }

    // Boom Collision
    if (gameState.boom && head.x === gameState.boom.x && head.y === gameState.boom.y) {
        sounds.boom();
        triggerVibrate([200]);
        return endGame();
    }

    gameState.snake.unshift(head);

    // Eating Logic
    let ate = false;
    if (gameState.food.normal && head.x === gameState.food.normal.x && head.y === gameState.food.normal.y) {
        updateGameStats(5, 1);
        const diff = DIFFICULTY_SETTINGS[gameState.settings.difficulty];
        gameState.speed = Math.max(50, gameState.speed - diff.speedStep);
        resetMainInterval();
        spawnItem('normal');
        ate = true;
    } else if (gameState.food.big && head.x === gameState.food.big.x && head.y === gameState.food.big.y) {
        updateGameStats(20, 5);
        gameState.food.big = null;
        ate = true;
    } else if (gameState.food.golden && head.x === gameState.food.golden.x && head.y === gameState.food.golden.y) {
        updateGameStats(50, 10);
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
    if (ate) {
        sounds.eat();
        triggerVibrate(30);
    }

    draw();
}

function updateGameStats(scorePts, coinPts) {
    // Score
    gameState.score += scorePts;
    updateDisplayValue('score', gameState.score);
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        updateDisplayValue('highScore', gameState.highScore);
    }

    // Coins
    gameState.coins += coinPts;
    updateDisplayValue('coinCount', gameState.coins);
    
    saveProgress();
}

function triggerSpeedBoost() {
    const currentSpeed = gameState.speed;
    gameState.speed = Math.max(50, Math.floor(gameState.speed * 0.6));
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
    Object.values(gameState.grid.blocks).forEach(b => {
        b.className = "block";
    });

    const skinClass = SKINS.find(s => s.id === gameState.settings.selectedSkin).class;

    gameState.snake.forEach((segment, i) => {
        const key = `${segment.x}-${segment.y}`;
        if (gameState.grid.blocks[key]) {
            gameState.grid.blocks[key].classList.add(i === 0 ? "head" : skinClass);
        }
    });

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

    loadSettings();
    const diff = DIFFICULTY_SETTINGS[gameState.settings.difficulty];

    gameState.started = true;
    gameState.paused = false;
    gameState.score = 0;
    gameState.timeLeft = 0;
    gameState.speed = diff.baseSpeed;
    gameState.direction = 'right';
    gameState.prevDirection = 'right';
    gameState.food = { normal: null, big: null, golden: null, speed: null, freeze: null };
    gameState.boom = null;

    updateDisplayValue('score', '0');
    updateDisplayValue('time', '0');
    elements.startOverlay.classList.add('hidden');
    elements.modal.classList.add('hidden');
    
    // Sync Play Icons
    elements.quickPlayBtn.textContent = '⏸️';
    if(elements.mobilePlayBtn) elements.mobilePlayBtn.textContent = '⏸️';

    setupGrid();
    loadProgress();
    
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
    if (gameState.settings.sound) {
        bgMusic.play().catch(() => {});
    }
}

function endGame() {
    gameState.started = false;
    stopIntervals();
    bgMusic.pause();
    bgMusic.currentTime = 0;
    
    // Sync Play Icons
    elements.quickPlayBtn.textContent = '▶️';
    if(elements.mobilePlayBtn) elements.mobilePlayBtn.textContent = '▶️';
    
    elements.finalScore.textContent = gameState.score;
    elements.finalHigh.textContent = gameState.highScore;
    elements.modal.classList.remove('hidden');
    elements.startOverlay.classList.remove('hidden');
}

function togglePause() {
    if (!gameState.started) {
        startGame();
        return;
    };
    gameState.paused = !gameState.paused;
    elements.pauseOverlay.classList.toggle('hidden', !gameState.paused);
    
    // Sync Play Icons
    const icon = gameState.paused ? '▶️' : '⏸️';
    elements.quickPlayBtn.textContent = icon;
    if(elements.mobilePlayBtn) elements.mobilePlayBtn.textContent = icon;
    
    if (gameState.paused) {
        bgMusic.pause();
    } else {
        if (gameState.settings.sound) bgMusic.play().catch(() => {});
    }
}

// --- INTERVAL MANAGEMENT ---
function startIntervals() {
    stopIntervals();
    gameState.intervals.main = setInterval(moveSnake, gameState.speed);
    gameState.intervals.time = setInterval(() => {
        if (!gameState.paused && !gameState.frozen) {
            gameState.timeLeft++;
            updateDisplayValue('time', gameState.timeLeft);
        }
    }, 1000);

    gameState.intervals.boom = setInterval(() => {
        if (!gameState.paused && !gameState.frozen) spawnItem('boom');
    }, 12000);

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

// Settings Event Listeners
const openSettings = () => {
    loadSettings();
    elements.settingsModal.classList.remove('hidden');
};
elements.settingsBtn.addEventListener('click', openSettings);
elements.quickSettingsBtn.addEventListener('click', openSettings);

elements.saveSettingsBtn.addEventListener('click', () => {
    saveSettings();
    elements.settingsModal.classList.add('hidden');
});

// Shop Event Listeners
const openShop = () => {
    renderShop();
    elements.shopModal.classList.remove('hidden');
};
elements.shopBtn.addEventListener('click', openShop);
elements.quickShopBtn.addEventListener('click', openShop);

elements.closeShopBtn.addEventListener('click', () => {
    elements.shopModal.classList.add('hidden');
});

// Quick Play Toggle (Desktop)
elements.quickPlayBtn.addEventListener('click', togglePause);

// Mobile Play Toggle
if(elements.mobilePlayBtn) {
    elements.mobilePlayBtn.addEventListener('click', togglePause);
}

// Theme Selector
document.getElementById('themeSelect').addEventListener('change', (e) => {
    document.body.setAttribute('data-theme', e.target.value);
});

// Initialization
loadProgress();
loadSettings();
setupGrid();
window.addEventListener('resize', () => {
    if (!gameState.started) setupGrid();
});
