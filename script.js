const gameContainer = document.getElementById("gameContainer");
const introOverlay = document.getElementById("introOverlay");
const playButton = document.getElementById("playButton");
const canvas = document.getElementById("racing-canvas");
const ctx = canvas.getContext("2d");
const scoreDisplay = document.getElementById("score");
const highScoreDisplay = document.getElementById("high-score");
const nitroBtn = document.getElementById("nitroBtn");
const nitroFill = document.getElementById("nitroFill");
const shieldDisplay = document.getElementById("shieldDisplay");
const shieldTimeDisplay = document.getElementById("shieldTime");
const bgMusic = document.getElementById("bg-music");
const musicToggle = document.getElementById("musicToggle");

// Tone.js sound effects
const overtakeSynth = new Tone.PluckSynth({
  dampening: 2000,
  resonance: 0.9,
  volume: -5
}).toDestination();
const nitroSynth = new Tone.NoiseSynth({
  "volume": -10,
  "envelope": {
    "attack": 0.001,
    "decay": 0.2,
    "sustain": 0.05,
    "release": 0.2
  },
  "filter": {
    "Q": 6,
    "type": "lowpass",
    "frequency": 2000
  }
}).toDestination();
const gameOverSynth = new Tone.MembraneSynth().toDestination();
const shieldSound = new Tone.Player("shieldcargame.mp3").toDestination();
const meteoroidSynth = new Tone.MetalSynth({
  "frequency": 200,
  "envelope": {
    "attack": 0.001,
    "decay": 0.1,
    "sustain": 0.05,
    "release": 0.2
  },
  "harmonicity": 5.1,
  "modulationIndex": 32,
  "resonance": 4000,
  "octaves": 1.5,
  "volume": -5
}).toDestination();
const blastSynth = new Tone.NoiseSynth({
  "volume": -5,
  "envelope": {
    "attack": 0.001,
    "decay": 0.5,
    "sustain": 0,
    "release": 0.2
  }
}).toDestination();

// Music State Initialization
let musicEnabled = localStorage.getItem('musicEnabled') === 'true';

function initializeMusic() {
  if (bgMusic) {
    bgMusic.volume = 0.25;
    bgMusic.muted = !musicEnabled;
    if (musicEnabled) {
      musicToggle.textContent = '';
      musicToggle.classList.remove('off');
    } else {
      musicToggle.textContent = '';
      musicToggle.classList.add('off');
    }
  }
}
initializeMusic();

// Game variables
let player, obstacles, shields, disasters, score, highScore, gameOver;

// Core game speed constants
const BASE_GAME_SPEED = 3;
let gameSpeed = BASE_GAME_SPEED;
let backgroundSpeed = BASE_GAME_SPEED;

// Power-up state variables
let nitroActive = false,
  nitroDuration = 0,
  nitroCooldown = 0;
let shieldActive = false,
  shieldDuration = 0;
let disasterActive = false,
  disasterDuration = 0;
let meteors = [];
let roadLines = [];
let smokeParticles = [];
let explosionParticles = [];
let isDragging = false;
let endGameEffect = false;
let shakeFrames = 0;

// Game Constants
const NITRO_SPEED_MULTIPLIER = 2.5;
const NITRO_DURATION_FRAMES = 480;
const NITRO_COOLDOWN_FRAMES = 720;
const SHIELD_DURATION_FRAMES = 600;
const SHIELD_SPAWN_RATE = 0.0005;
const DISASTER_SPAWN_RATE = 0.0005;
const DISASTER_DURATION_FRAMES = 120; // 2 seconds at 60fps
const ROAD_LINE_COUNT = 3;
const ROAD_LINE_WIDTH = 5;
const ROAD_LINE_LENGTH = 50;
const ROAD_LINE_SPACING = 80;

// Pixel Cars
const playerCarDesign = [
  ['T', 'T', 'D', 'D', 'D', 'D', 'T', 'T'],
  ['T', 'D', 'L', 'L', 'L', 'L', 'D', 'T'],
  ['D', 'L', 'G', 'G', 'G', 'G', 'L', 'D'],
  ['D', 'L', 'G', 'G', 'G', 'G', 'L', 'D'],
  // ... (previous code)

['T', 'D', 'L', 'L', 'L', 'L', 'D', 'T']
];
const opponentCarDesign = [
['T', 'T', 'R = 'R', 'R', 'R', 'R', 'T', 'T'],
['T', 'R', 'O', 'O', 'O', 'O', 'R', 'T'],
['R', 'O', 'B', 'B', 'B', 'B', 'O', 'R'],
['R', 'O', 'B', 'B', 'B', 'B', 'O', 'R'],
['T', 'R', 'O', 'O', 'O', 'O', 'R', 'T']
];

const colors = {
  'T': '#00000000',
  'D': '#444444',
  'L': '#CCCCCC',
  'G': '#00FF00',
  'R': '#FF0000',
  'O': '#FFAA00',
  'B': '#0000FF'
};

function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

function drawCar(x, y, design, rotation = 0, scale = 6) {
  ctx.save();
  ctx.translate(x + (design[0].length * scale) / 2, y + (design.length * scale) / 2);
  ctx.rotate(rotation);
  for (let row = 0; row < design.length; row++) {
    for (let col = 0; col < design[row].length; col++) {
      const color = design[row][col];
      if (color !== 'function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

function drawCar(x, y, design, rotation = 0, scale = 6) {
  ctx.save();
  ctx.translate(x + (design[0].length * scale) / 2, y + (design.length * scale) / 2);
  ctx.rotate(rotation);
  for (let row = 0; row < design.length; row++) {
    for (let col = 0; col < design[row].length; col++) {
      const color = design[row][col];
      if (color !== 'T') {
        ctx.fillStyle = colors[color] || '#000';
        ctx.fillRect(col * scale - (design[0].length * scale) / 2, row * scale - (design.length * scale) / 2, scale, scale);
      }
    }
  }
  ctx.restore();
}

function drawRoadLines() {
  const laneWidth = canvas.width / 3;
  const offsets = [-laneWidth, 0, laneWidth];
  const lineSpeed = backgroundSpeed;
  ctx.fillStyle = "#444";
  for (let i = 0; i < roadLines.length; i++) {
    roadLines[i].y += lineSpeed;
    for (let j = 0; j < ROAD_LINE_COUNT; j++) {
      const xPos = canvas.width / 2 + offsets[j];
      ctx.fillRect(xPos - ROAD_LINE_WIDTH / 2, roadLines[i].y, ROAD_LINE_WIDTH, ROAD_LINE_LENGTH);
    }
    if (roadLines[i].y > canvas.height) {
      roadLines[i].y = -ROAD_LINE_SPACING + (roadLines[i].y - canvas.height);
    }
  }
}

function startGame() {
                     
  introOverlay.style.display = 'function drawRoadLines() {
  const laneWidth = canvas.width / 3;
  const offsets = [-laneWidth, 0, laneWidth];
  const lineSpeed = backgroundSpeed;
  ctx.fillStyle = "#444";
  for (let i = 0; i < roadLines.length; i++) {
    roadLines[i].y += lineSpeed;
    for (let j = 0; j < ROAD_LINE_COUNT; j++) {
      const xPos = canvas.width / 2 + offsets[j];
      ctx.fillRect(xPos - ROAD_LINE_WIDTH / 2, roadLines[i].y, ROAD_LINE_WIDTH, ROAD_LINE_LENGTH);
    }
    if (roadLines[i].y > canvas.height) {
      roadLines[i].y = -ROAD_LINE_SPACING + (roadLines[i].y - canvas.height);
    }
  }
}

function startGame() {
  // Start game logic
  introOverlay.style.display = 'none';
  playButton.style.display = 'none';
  musicToggle.style.display = 'block';
  if (bgMusic && musicEnabled) {
    bgMusic.muted = false;
    bgMusic.play();
  }

                                          
  const scale = 6;
  player = {
    x: canvas.width / 2 - (playerCarDesign[0].length * scale) / 2,
    y: canvas.height - playerCarDesign.length * scale - 10,
    width: playerCarDesign[0].length * scale,
    height: playerCarDesign.length * scale,
    opacity: 1,
    rotation: 0
  };

  obstacles = [];
  shields = [];
  disasters = [];
  meteors = [];
  roadLines = [];
  smokeParticles = [];
  explosionParticles = [];

  for (let i = 0; i < canvas.height / ROAD_LINE_SPACING; i++) {
    roadLines.push({ y: i * ROAD_LINE_SPACING });
  }

  score = 0;
  highScore = localStorage.getItem("highScore") || 0;
  gameOver = false;
  endGameEffect = false;
  gameSpeed = BASE_GAME_SPEED;
  backgroundSpeed = BASE_GAME_SPEED;
  nitroActive = false;
  nitroDuration = 0;
  nitroCooldown = 0;
  shieldActive = false;
  shieldDuration = 0;
  disasterActive = false;
  disasterDuration = 0;
  shakeFrames = 0;
  shieldDisplay.style.display = '// Initialize game objects and variables
  const scale = 6;
  player = {
    x: canvas.width / 2 - (playerCarDesign[0].length * scale) / 2,
    y: canvas.height - playerCarDesign.length * scale - 10,
    width: playerCarDesign[0].length * scale,
    height: playerCarDesign.length * scale,
    opacity: 1,
    rotation: 0
  };

  obstacles = [];
  shields = [];
  disasters = [];
  meteors = [];
  roadLines = [];
  smokeParticles = [];
  explosionParticles = [];

  for (let i = 0; i < canvas.height / ROAD_LINE_SPACING; i++) {
    roadLines.push({ y: i * ROAD_LINE_SPACING });
  }

  score = 0;
  highScore = localStorage.getItem("highScore") || 0;
  gameOver = false;
  endGameEffect = false;
  gameSpeed = BASE_GAME_SPEED;
  backgroundSpeed = BASE_GAME_SPEED;
  nitroActive = false;
  nitroDuration = 0;
  nitroCooldown = 0;
  shieldActive = false;
  shieldDuration = 0;
  disasterActive = false;
  disasterDuration = 0;
  shakeFrames = 0;
  shieldDisplay.style.display = 'none';
  gameContainer.className = 'game-container';
  scoreDisplay.innerText = `Score: ${score}`;
  highScoreDisplay.innerText = `High Score: ${highScore}`;
  updateNitroButton();
  updateGame();
}

// ... (previous code)

function updateGame() {
  // Game loop logic
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRoadLines();
  drawCar(player.x, player.y, playerCarDesign, player.rotation);
  // Update game state and render game objects
  requestAnimationFrame(updateGame);
}

// Event listeners
playButton.addEventListener("click", () => {
  Tone.start();
  startGame();
});

musicToggle.addEventListener("click", () => {
  musicEnabled = !musicEnabled;
  if (bgMusic) {
    bgMusic.muted = !musicEnabled;
    if (musicEnabled) {
      musicToggle.textContent = '';
      musicToggle.classList.remove('off');
      bgMusic.play().catch(e => console.log('Autoplay blocked, unmuted only.'));
    } else {
      musicToggle.textContent = '';
      musicToggle.classList.add('off');
    }
  }
  localStorage.setItem('musicEnabled', musicEnabled);
});

nitroBtn.addEventListener("click", () => {
  if (!gameOver && !nitroActive && nitroCooldown === 0) {
    nitroActive = true;
    nitroDuration = NITRO_DURATION_FRAMES;
    nitroSynth.triggerAttackRelease("1n");
  }
});

// Other event listeners and functions...