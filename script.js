// ========================= 🎮 GAME SETUP =========================
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
const musicModal = document.getElementById("musicModal");
const modalYes = musicModal.querySelector('.yes');
const modalCancel = musicModal.querySelector('.cancel');

// ========================= 🎵 SOUND EFFECTS =========================
const overtakeSynth = new Tone.PluckSynth({ dampening: 2000, resonance: 0.9, volume: -5 }).toDestination();

const nitroSynth = new Tone.NoiseSynth({
  volume: -10,
  envelope: { attack: 0.001, decay: 0.2, sustain: 0.05, release: 0.2 },
  filter: { Q: 6, type: "lowpass", frequency: 2000 }
}).toDestination();

const gameOverSynth = new Tone.MembraneSynth().toDestination();
const shieldSound = new Tone.Player("shieldcargame.mp3").toDestination();

const meteoroidSynth = new Tone.MetalSynth({
  frequency: 200,
  envelope: { attack: 0.001, decay: 0.1, sustain: 0.05, release: 0.2 },
  harmonicity: 5.1,
  modulationIndex: 32,
  resonance: 4000,
  octaves: 1.5,
  volume: -5
}).toDestination();

const blastSynth = new Tone.NoiseSynth({
  volume: -5,
  envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.2 }
}).toDestination();

// ========================= 🎶 MUSIC STATE =========================
let musicEnabled = localStorage.getItem('musicEnabled') === 'true';

function initializeMusic() {
  if (bgMusic) {
    bgMusic.volume = 0.25;
    bgMusic.muted = !musicEnabled;

    if (musicEnabled) {
      musicToggle.textContent = '🔊';
      musicToggle.classList.remove('off');
    } else {
      musicToggle.textContent = '🔇';
      musicToggle.classList.add('off');
    }
  }
}
initializeMusic();

// ========================= ⚙️ GAME VARIABLES =========================
let player, obstacles, shields, disasters, score, highScore, gameOver;

const BASE_GAME_SPEED = 3;
let gameSpeed = BASE_GAME_SPEED;
let backgroundSpeed = BASE_GAME_SPEED;

let nitroActive = false, nitroDuration = 0, nitroCooldown = 0;
let shieldActive = false, shieldDuration = 0;
let disasterActive = false, disasterDuration = 0;

let meteors = [];
let roadLines = [];
let smokeParticles = [];
let explosionParticles = [];
let isDragging = false;
let endGameEffect = false;
let shakeFrames = 0;

// ========================= ⚡ CONSTANTS =========================
const NITRO_SPEED_MULTIPLIER = 2.5;
const NITRO_DURATION_FRAMES = 480;
const NITRO_COOLDOWN_FRAMES = 720;

const SHIELD_DURATION_FRAMES = 600;
const SHIELD_SPAWN_RATE = 0.0005;

const DISASTER_SPAWN_RATE = 0.0005;
const DISASTER_DURATION_FRAMES = 120;

const ROAD_LINE_COUNT = 3;
const ROAD_LINE_WIDTH = 5;
const ROAD_LINE_LENGTH = 50;
const ROAD_LINE_SPACING = 80;

// ========================= 🚗 CAR DESIGN =========================
const playerCarDesign = [
  ['T','T','D','D','D','D','T','T'],
  ['T','D','L','L','L','L','D','T'],
  ['D','L','G','G','G','G','L','D'],
  ['D','L','G','G','G','G','L','D'],
  ['T','D','L','L','L','L','D','T']
];

const opponentCarDesign = [
  ['T','T','R','R','R','R','T','T'],
  ['T','R','O','O','O','O','R','T'],
  ['R','O','B','B','B','B','O','R'],
  ['R','O','B','B','B','B','O','R'],
  ['T','R','O','O','O','O','R','T']
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

// ========================= 🛠 UTILITY =========================
function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

function drawCar(x, y, design, rotation = 0, scale = 6) {
  ctx.save();
  ctx.translate(x + (design[0].length * scale)/2, y + (design.length * scale)/2);
  ctx.rotate(rotation);

  for (let row=0; row<design.length; row++){
    for (let col=0; col<design[row].length; col++){
      const color = design[row][col];
      if(color!=='T'){
        ctx.fillStyle = colors[color] || '#000';
        ctx.fillRect(col*scale-(design[0].length*scale)/2, row*scale-(design.length*scale)/2, scale, scale);
      }
    }
  }

  ctx.restore();
}

// ========================= 🎶 MUSIC MODAL (NEW FEATURE) =========================
// Keep track if modal has been shown in this session
let popupShown = sessionStorage.getItem('musicPopupShown') === 'true';

playButton.addEventListener("click", function(e) {
  if (!popupShown) {
    e.preventDefault();
    musicModal.style.display = 'flex';
  } else {
    Tone.start();
    startGame();
  }
});

modalYes.onclick = function() {
  popupShown = true;
  sessionStorage.setItem('musicPopupShown', 'true');
  musicEnabled = true;
  localStorage.setItem('musicEnabled', 'true');
  bgMusic.muted = false;
  musicToggle.textContent = '🔊';
  musicToggle.classList.remove('off');
  musicModal.style.display = 'none';
  Tone.start();
  startGame();
};

modalCancel.onclick = function() {
  popupShown = true;
  sessionStorage.setItem('musicPopupShown', 'true');
  musicEnabled = false;
  localStorage.setItem('musicEnabled', 'false');
  bgMusic.muted = true;
  musicToggle.textContent = '🔇';
  musicToggle.classList.add('off');
  musicModal.style.display = 'none';
  Tone.start();
  startGame();
};

musicModal.addEventListener('click', function(e) {
  if (e.target === musicModal) {
    musicModal.style.display = 'none';
  }
});
// ========================= 🎮 CORE GAME FUNCTIONS =========================
function resetGame() {
  player = { x: canvas.width/2 - 24, y: canvas.height - 100, width: 48, height: 60, speed: 5 };
  obstacles = [];
  shields = [];
  disasters = [];
  meteors = [];
  smokeParticles = [];
  explosionParticles = [];
  roadLines = [];

  score = 0;
  gameOver = false;
  endGameEffect = false;

  nitroActive = false;
  nitroDuration = 0;
  nitroCooldown = 0;
  shieldActive = false;
  shieldDuration = 0;
  disasterActive = false;
  disasterDuration = 0;

  for (let i = 0; i < ROAD_LINE_COUNT; i++) {
    roadLines.push({
      x: canvas.width/2 - ROAD_LINE_WIDTH/2,
      y: i * (ROAD_LINE_LENGTH + ROAD_LINE_SPACING),
    });
  }
}

function drawRoadLines() {
  ctx.fillStyle = "#FFF";
  roadLines.forEach(line => {
    ctx.fillRect(line.x, line.y, ROAD_LINE_WIDTH, ROAD_LINE_LENGTH);
    line.y += backgroundSpeed;
    if (line.y > canvas.height) line.y = -ROAD_LINE_LENGTH;
  });
}

// ========================= 🎮 SPAWN FUNCTIONS =========================
function spawnObstacle() {
  const laneWidth = canvas.width / 3;
  const lane = Math.floor(Math.random() * 3);
  obstacles.push({
    x: lane * laneWidth + laneWidth/2 - 24,
    y: -60,
    width: 48,
    height: 60,
    speed: gameSpeed
  });
}

function spawnShield() {
  if (Math.random() < SHIELD_SPAWN_RATE) {
    shields.push({
      x: Math.random() * (canvas.width - 30),
      y: -30,
      width: 30,
      height: 30,
      speed: gameSpeed
    });
  }
}

function spawnDisaster() {
  if (Math.random() < DISASTER_SPAWN_RATE) {
    disasters.push({
      x: Math.random() * (canvas.width - 30),
      y: -30,
      width: 30,
      height: 30,
      speed: gameSpeed
    });
  }
}

// ========================= 🎮 POWERUPS & EFFECTS =========================
function activateNitro() {
  if (!nitroActive && nitroCooldown === 0) {
    nitroActive = true;
    nitroDuration = NITRO_DURATION_FRAMES;
    nitroCooldown = NITRO_COOLDOWN_FRAMES;
    nitroSynth.triggerAttackRelease("8n");
  }
}

function activateShield() {
  shieldActive = true;
  shieldDuration = SHIELD_DURATION_FRAMES;
  shieldSound.start();
}

function triggerDisaster() {
  disasterActive = true;
  disasterDuration = DISASTER_DURATION_FRAMES;
  meteoroidSynth.triggerAttackRelease("16n");
  meteors.push({
    x: Math.random() * canvas.width,
    y: -50,
    radius: 20,
    speed: gameSpeed * 2
  });
}

// ========================= 🎮 COLLISION DETECTION =========================
function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
// ========================= 🎮 GAME LOOP =========================
function updateGame() {
  if (gameOver) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw road
  drawRoadLines();

  // Nitro effect
  if (nitroActive) {
    gameSpeed = BASE_GAME_SPEED * NITRO_SPEED_MULTIPLIER;
    backgroundSpeed = gameSpeed;
    nitroDuration--;
    nitroFill.style.width = `${(nitroDuration / NITRO_DURATION_FRAMES) * 100}%`;

    if (nitroDuration <= 0) {
      nitroActive = false;
      gameSpeed = BASE_GAME_SPEED;
      backgroundSpeed = BASE_GAME_SPEED;
    }
  } else {
    if (nitroCooldown > 0) nitroCooldown--;
    nitroFill.style.width = `${100 - (nitroCooldown / NITRO_COOLDOWN_FRAMES) * 100}%`;
    gameSpeed = BASE_GAME_SPEED;
    backgroundSpeed = BASE_GAME_SPEED;
  }

  // Shield timer
  if (shieldActive) {
    shieldDuration--;
    shieldDisplay.style.display = "block";
    shieldTimeDisplay.textContent = Math.ceil(shieldDuration / 60);

    if (shieldDuration <= 0) {
      shieldActive = false;
      shieldDisplay.style.display = "none";
    }
  }

  // Disaster timer
  if (disasterActive) {
    disasterDuration--;
    if (disasterDuration <= 0) {
      disasterActive = false;
      meteors = [];
    }
  }

  // Draw player
  drawCar(player.x, player.y, playerCarDesign);

  // Draw obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    drawCar(obs.x, obs.y, opponentCarDesign);
    obs.y += obs.speed;

    if (isColliding(player, obs)) {
      if (shieldActive) {
        obstacles.splice(i, 1);
        explosionParticles.push({ x: obs.x, y: obs.y, radius: 20, life: 30 });
      } else {
        endGame();
        return;
      }
    }

    if (obs.y > canvas.height) {
      obstacles.splice(i, 1);
      score++;
      overtakeSynth.triggerAttackRelease("C4", "8n");
    }
  }

  // Draw shields
  for (let i = shields.length - 1; i >= 0; i--) {
    const s = shields[i];
    ctx.fillStyle = "cyan";
    ctx.beginPath();
    ctx.arc(s.x + s.width/2, s.y + s.height/2, 15, 0, Math.PI*2);
    ctx.fill();
    s.y += s.speed;

    if (isColliding(player, s)) {
      activateShield();
      shields.splice(i, 1);
    }
  }

  // Draw disasters
  for (let i = disasters.length - 1; i >= 0; i--) {
    const d = disasters[i];
    ctx.fillStyle = "orange";
    ctx.fillRect(d.x, d.y, d.width, d.height);
    d.y += d.speed;

    if (isColliding(player, d)) {
      triggerDisaster();
      disasters.splice(i, 1);
    }
  }

  // Draw meteors
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI*2);
    ctx.fill();
    m.y += m.speed;

    if (isColliding(player, m)) {
      if (shieldActive) {
        meteors.splice(i, 1);
      } else {
        endGame();
        return;
      }
    }
  }

  // Draw explosions
  for (let i = explosionParticles.length - 1; i >= 0; i--) {
    const p = explosionParticles[i];
    ctx.fillStyle = `rgba(255,100,0,${p.life/30})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
    ctx.fill();
    p.life--;
    if (p.life <= 0) explosionParticles.splice(i, 1);
  }

  // Update score
  scoreDisplay.textContent = score;
  highScore = Math.max(score, highScore || 0);
  highScoreDisplay.textContent = highScore;

  // Spawning
  if (Math.random() < 0.02) spawnObstacle();
  spawnShield();
  spawnDisaster();

  requestAnimationFrame(updateGame);
}

// ========================= 🎮 START / END GAME =========================
function startGame() {
  resetGame();
  introOverlay.style.display = "none";
  gameOver = false;
  requestAnimationFrame(updateGame);
}

function endGame() {
  gameOver = true;
  gameOverSynth.triggerAttackRelease("C2", "1n");
  introOverlay.style.display = "flex";
}

// ========================= 🎮 INPUT HANDLING =========================
document.addEventListener("keydown", e => {
  if (gameOver) return;
  if (e.key === "ArrowLeft" && player.x > 0) player.x -= player.speed*2;
  if (e.key === "ArrowRight" && player.x < canvas.width - player.width) player.x += player.speed*2;
  if (e.key === " ") activateNitro();
});

canvas.addEventListener("touchstart", e => { isDragging = true; });
canvas.addEventListener("touchmove", e => {
  if (isDragging && e.touches[0]) {
    player.x = e.touches[0].clientX - canvas.offsetLeft - player.width/2;
  }
});
canvas.addEventListener("touchend", e => { isDragging = false; });

nitroBtn.addEventListener("click", activateNitro);

// ========================= 🎶 MUSIC MODAL =========================
let popupShown = sessionStorage.getItem('musicPopupShown') === 'true';

playButton.addEventListener("click", function(e) {
  if (!popupShown) {
    e.preventDefault();
    musicModal.style.display = 'flex';
  } else {
    Tone.start();
    startGame();
  }
});

modalYes.onclick = function() {
  popupShown = true;
  sessionStorage.setItem('musicPopupShown','true');
  musicEnabled = true;
  localStorage.setItem('musicEnabled','true');
  bgMusic.muted = false;
  musicToggle.textContent = '🔊';
  musicToggle.classList.remove('off');
  musicModal.style.display = 'none';
  Tone.start();
  startGame();
};

modalCancel.onclick = function() {
  popupShown = true;
  sessionStorage.setItem('musicPopupShown','true');
  musicEnabled = false;
  localStorage.setItem('musicEnabled','false');
  bgMusic.muted = true;
  musicToggle.textContent = '🔇';
  musicToggle.classList.add('off');
  musicModal.style.display = 'none';
  Tone.start();
  startGame();
};

musicModal.addEventListener('click', function(e) {
  if (e.target === musicModal) musicModal.style.display = 'none';
});