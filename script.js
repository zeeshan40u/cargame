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
const overtakeSynth = new Tone.PluckSynth({ dampening: 2000, resonance: 0.9, volume: -5 }).toDestination();
const nitroSynth = new Tone.NoiseSynth({
    "volume": -10,
    "envelope": { "attack": 0.001, "decay": 0.2, "sustain": 0.05, "release": 0.2 },
    "filter": { "Q": 6, "type": "lowpass", "frequency": 2000 }
}).toDestination();
const gameOverSynth = new Tone.MembraneSynth().toDestination();

// Assuming "shieldcargame.mp3" is available in the same directory or accessible path
const shieldSound = new Tone.Player("shieldcargame.mp3").toDestination();

// Devastating meteoroid sound
const meteoroidSynth = new Tone.MetalSynth({
    "frequency": 200,
    "envelope": { "attack": 0.001, "decay": 0.1, "sustain": 0.05, "release": 0.2 },
    "harmonicity": 5.1,
    "modulationIndex": 32,
    "resonance": 4000,
    "octaves": 1.5,
    "volume": -5
}).toDestination();
const blastSynth = new Tone.NoiseSynth({
    "volume": -5,
    "envelope": { "attack": 0.001, "decay": 0.5, "sustain": 0, "release": 0.2 }
}).toDestination();

// Music State Initialization
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

// Game variables
let player, obstacles, shields, disasters, score, highScore, gameOver;

// Core game speed constants
const BASE_GAME_SPEED = 3;
let gameSpeed = BASE_GAME_SPEED;
let backgroundSpeed = BASE_GAME_SPEED;

// Power-up state variables
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
  ['T', 'D', 'L', 'L', 'L', 'L', 'D', 'T']
];
const opponentCarDesign = [
  ['T', 'T', 'R', 'R', 'R', 'R', 'T', 'T'],
  ['T', 'R', 'O', 'O', 'O', 'O', 'R', 'T'],
  ['R', 'O', 'B', 'B', 'B', 'B', 'O', 'R'],
  ['R', 'O', 'B', 'B', 'B', 'B', 'O', 'R'],
  ['T', 'R', 'O', 'O', 'O', 'O', 'R', 'T']
];
const colors = {
  'T': '#00000000', 'D': '#444444', 'L': '#CCCCCC', 'G': '#00FF00',
  'R': '#FF0000', 'O': '#FFAA00', 'B': '#0000FF'
};

// Linear Interpolation for smooth animations
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
  Tone.start();
  introOverlay.style.display = 'none';
  playButton.style.display = 'none';
  playButton.classList.remove('fade-in');
  musicToggle.style.display = 'none';

  if (bgMusic && musicEnabled) {
      bgMusic.muted = false;
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
  shieldDisplay.style.display = 'none';

  gameContainer.className = 'game-container';

  scoreDisplay.innerText = `Score: ${score}`;
  highScoreDisplay.innerText = `High Score: ${highScore}`;

  updateNitroButton();
  updateGame();
}

function spawnObstacle() {
  const scale = 6;
  const width = opponentCarDesign[0].length * scale;
  const height = opponentCarDesign.length * scale;
  // No padding, allowing cars to spawn at the very edge of the road
  const x = Math.random() * (canvas.width - width);
  obstacles.push({ x, y: -height, width, height, passed: false });
}

function spawnShield() {
  const size = 30;
  const x = Math.random() * (canvas.width - size);
  shields.push({ x, y: -size, width: size, height: size });
}

function spawnDisaster() {
  const size = 40;
  const x = Math.random() * (canvas.width - size);
  disasters.push({ x, y: -size, width: size, height: size });
}

function drawExplosion(x, y) {
    for (let i = 0; i < 30; i++) {
        explosionParticles.push({
            x: x,
            y: y,
            size: Math.random() * 5 + 2,
            speedX: Math.random() * 6 - 3,
            speedY: Math.random() * 6 - 3,
            alpha: 1,
            color: Math.random() > 0.5 ? '#FF4500' : '#FFA500'
        });
    }
}

function drawMeteor(meteor) {
    // Draw the main meteor body
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(meteor.x, meteor.y, meteor.size, 0, Math.PI * 2);
    ctx.fill();

    // Draw the tail
    ctx.fillStyle = `rgba(255, 100, 0, ${meteor.alpha})`;
    ctx.beginPath();
    ctx.moveTo(meteor.x, meteor.y);
    ctx.lineTo(meteor.x - meteor.speedX * 10, meteor.y - meteor.speedY * 10);
    ctx.lineTo(meteor.x + meteor.speedX * 10, meteor.y - meteor.speedY * 10);
    ctx.closePath();
    ctx.fill();
}

function updateGame() {
  if (gameOver) {
    if (!endGameEffect) {
      endGameEffect = true;
      gameOverSynth.triggerAttackRelease("C1", "2n");
      shakeFrames = 30;
    }

    backgroundSpeed *= 0.95;
    if (player.opacity > 0) {
      player.opacity -= 0.03;
    } else {
      return;
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Screen shake effect
  if (shakeFrames > 0) {
      const shakeX = (Math.random() - 0.5) * 10;
      const shakeY = (Math.random() - 0.5) * 10;
      ctx.translate(shakeX, shakeY);
      shakeFrames--;
  }

  // Set game speed based on power-up state
  gameSpeed = BASE_GAME_SPEED;
  if (nitroActive) {
      gameSpeed = BASE_GAME_SPEED * NITRO_SPEED_MULTIPLIER;
  } else if (disasterActive) {
      gameSpeed = BASE_GAME_SPEED * 0.25;
  }
  backgroundSpeed = gameSpeed;

  drawRoadLines();

  // Handle devastating meteoroid animation and effect
  if (disasterActive) {
      disasterDuration--;

      if (disasterDuration > 0) {
          // Move meteors towards their targets
          for (let i = meteors.length - 1; i >= 0; i--) {
              const m = meteors[i];
              const dx = m.targetX - m.x;
              const dy = m.targetY - m.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist > 1) {
                  m.x += dx / 20;
                  m.y += dy / 20;
              } else {
                  // Meteor hit its target
                  blastSynth.triggerAttackRelease("4n");
                  drawExplosion(m.targetX, m.targetY);
                  meteors.splice(i, 1);
              }
              drawMeteor(m);
          }
      }

      if (disasterDuration <= 0) {
          disasterActive = false;
          meteors = [];
          gameContainer.classList.remove('disaster-active');
      }
  }

  // Obstacles
  for (let obs of obstacles) {
    obs.y += gameSpeed;
    drawCar(obs.x, obs.y, opponentCarDesign);

    if (!obs.passed && obs.y > player.y + player.height) {
      score++;
      obs.passed = true;
      scoreDisplay.innerText = `Score: ${score}`;
      overtakeSynth.triggerAttackRelease("C5", "8n");
    }
  }
  obstacles = obstacles.filter(o => o.y < canvas.height + 20);

  // Shields
  for (let i = shields.length - 1; i >= 0; i--) {
    const shield = shields[i];
    shield.y += gameSpeed;

    // Draw shield
    ctx.fillStyle = '#00aaff';
    ctx.beginPath();
    ctx.arc(shield.x + shield.width / 2, shield.y + shield.height / 2, shield.width / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = `${shield.width - 5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛡️', shield.x + shield.width / 2, shield.y + shield.height / 2);

    // Check for collision with player
      if (player.x < shield.x + shield.width &&
        player.x + player.width > shield.x &&
        player.y < shield.y + shield.height &&
        player.y + player.height > shield.y) {

        shieldSound.start();

        if (!shieldActive) {
            shieldActive = true;
            shieldDuration = SHIELD_DURATION_FRAMES;
            shieldDisplay.style.display = 'flex';
            gameContainer.classList.add('shield-active');
        }
        shields.splice(i, 1);
    }
  }
  shields = shields.filter(s => s.y < canvas.height + 20);

  // Disasters
  for (let i = disasters.length - 1; i >= 0; i--) {
    const disaster = disasters[i];
    disaster.y += gameSpeed;

    // Draw disaster
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(disaster.x + disaster.width / 2, disaster.y + disaster.height / 2, disaster.width / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = `${disaster.width - 10}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☄️', disaster.x + disaster.width / 2, disaster.y + disaster.height / 2);

    // Check for collision with player
    if (player.x < disaster.x + disaster.width &&
        player.x + player.width > disaster.x &&
        player.y < disaster.y + disaster.height &&
        player.y + player.height > disaster.y) {

        disasterActive = true;
        disasterDuration = DISASTER_DURATION_FRAMES;
        gameContainer.classList.add('disaster-active');

        // Spawn meteors to hit all current cars
        for(let obs of obstacles) {
            meteors.push({
                x: Math.random() * canvas.width,
                y: -50,
                size: Math.random() * 8 + 15,
                targetX: obs.x + obs.width / 2,
                targetY: obs.y + obs.height / 2,
                speedX: 0,
                speedY: 0,
                alpha: 1
            });
            meteoroidSynth.triggerAttackRelease("C2", "8n");
        }
        obstacles = []; // Clear cars immediately

        disasters.splice(i, 1);
    }
  }
  disasters = disasters.filter(d => d.y < canvas.height + 20);

  // Spawning Logic
  let minOpponents, maxOpponents;

  if (score === 0) { minOpponents = 1; maxOpponents = 1; }
  else if (score >= 1 && score < 20) { minOpponents = 1; maxOpponents = 4; }
  else if (score >= 20 && score < 40) { minOpponents = 1; maxOpponents = 5; }
  else if (score >= 40 && score < 70) { minOpponents = 4; maxOpponents = 5; }
  else if (score >= 70) { minOpponents = 5; maxOpponents = 5; }

  if (!disasterActive) {
      if (obstacles.length < minOpponents) spawnObstacle();
      else if (obstacles.length < maxOpponents && Math.random() < 0.015) spawnObstacle();
  }
  if (Math.random() < SHIELD_SPAWN_RATE && shields.length === 0 && disasters.length === 0 && !shieldActive && !disasterActive) {
      spawnShield();
  }
  if (Math.random() < DISASTER_SPAWN_RATE && disasters.length === 0 && shields.length === 0 && !shieldActive && !disasterActive) {
      spawnDisaster();
  }

  // Smoke particles
  if (isDragging || nitroActive) {
    const particleColor = nitroActive ? '#ffd700' : 'rgba(240, 240, 240, 1)';
    const particleSize = nitroActive ? Math.random() * 10 + 5 : Math.random() * 5 + 3;
    const particleCount = nitroActive ? 3 : 1;
    for (let i = 0; i < particleCount; i++) {
        smokeParticles.push({
            x: player.x + player.width / 2 + Math.random() * 10 - 5,
            y: player.y + player.height - 5,
            size: particleSize,
            alpha: 1,
            speedY: backgroundSpeed + 2,
            color: particleColor
        });
    }
  }
  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    const p = smokeParticles[i];
    p.y += p.speedY;
    p.alpha -= 0.03;
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
    ctx.fill();
    if (p.alpha <= 0) smokeParticles.splice(i, 1);
  }
  ctx.globalAlpha = 1;

  // Explosion particles
  for (let i = explosionParticles.length - 1; i >= 0; i--) {
      const p = explosionParticles[i];
      p.x += p.speedX;
      p.y += p.speedY;
      p.alpha -= 0.05;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
      ctx.fill();
      if (p.alpha <= 0) explosionParticles.splice(i, 1);
  }
  ctx.globalAlpha = 1;

  // Update player rotation for tilting effect
  const targetRotation = (player.x - (canvas.width / 2 - player.width / 2)) / (canvas.width / 2 - player.width / 2) * 0.2; // Max 0.2 radians tilt
  player.rotation = lerp(player.rotation, targetRotation, 0.1);

  // Draw player with opacity and rotation
  ctx.save();
  ctx.globalAlpha = player.opacity;
  drawCar(player.x, player.y, playerCarDesign, player.rotation);

  // Draw shield effect around player if active
  if (shieldActive) {
      ctx.beginPath();
      ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2 + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = `rgba(0, 170, 255, ${shieldDuration / SHIELD_DURATION_FRAMES})`;
      ctx.lineWidth = 3;
      ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha = 1;

  // Collision
  if (!gameOver && !shieldActive) {
    for (let obs of obstacles) {
      if (player.x < obs.x + obs.width &&
        player.x + player.width > obs.x &&
        player.y < obs.y + obs.height &&
        player.y + player.height > obs.y) {
        endGame();
        return;
      }
    }
  }

  // Nitro Countdown
  if (nitroActive) {
    gameContainer.classList.add('nitro-active');
    nitroDuration--;
    if (nitroDuration <= 0) {
      nitroActive = false;
      nitroCooldown = NITRO_COOLDOWN_FRAMES;
      gameContainer.classList.remove('nitro-active');
    }
  } else {
    if (nitroCooldown > 0) {
      nitroCooldown--;
    }
  }
  updateNitroButton();

  // Shield Countdown
  if (shieldActive) {
      shieldDuration--;
      shieldTimeDisplay.textContent = Math.ceil(shieldDuration / 60) + 's';
      gameContainer.classList.add('shield-active');
      if (shieldDuration <= 0) {
          shieldActive = false;
          shieldDisplay.style.display = 'none';
          gameContainer.classList.remove('shield-active');
      }
  }

  requestAnimationFrame(updateGame);
}

function endGame() {
  gameOver = true;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("highScore", highScore);
  }
  highScoreDisplay.innerText = `High Score: ${highScore}`;

  setTimeout(() => {
    introOverlay.style.display = 'flex';
    playButton.innerText = "Retry";
    playButton.classList.add('retry-btn', 'fade-in');
    playButton.style.display = 'block';

    requestAnimationFrame(() => {
        playButton.style.opacity = '1';
    });

    if (bgMusic) {
        bgMusic.muted = true;
    }
    musicToggle.style.display = 'flex';
  }, 500);
}

// --- Music Modal Logic ---

const musicModal = document.getElementById('musicModal');
const modalYes = musicModal.querySelector('.yes');
const modalCancel = musicModal.querySelector('.cancel');

let popupShown = sessionStorage.getItem('musicPopupShown') === 'true';

// Override Play Button logic to show modal if not shown
playButton.addEventListener("click", function playHandler(e) {
  if (!popupShown) {
    e.preventDefault();
    musicModal.style.display = 'flex';
  } else {
    Tone.start();
    startGame();
  }
});

// Modal Yes button
modalYes.onclick = function() {
  musicModal.style.display = 'none';
  sessionStorage.setItem('musicPopupShown', 'true');
  popupShown = true;
  // Enable music
  if (bgMusic) {
    bgMusic.muted = false;
    // Attempt to play, catching potential autoplay block error
    bgMusic.play().catch(e => console.log('Autoplay blocked, unmuted only.'));
    musicToggle.textContent = '🔊';
    musicToggle.classList.remove('off');
  }
  localStorage.setItem('musicEnabled', true);
  Tone.start();
  startGame();
};

// Modal Cancel button
modalCancel.onclick = function() {
  musicModal.style.display = 'none';
  sessionStorage.setItem('musicPopupShown', 'true');
  popupShown = true;
  Tone.start();
  startGame();
};

// Optional: Hide modal if clicking outside
musicModal.addEventListener('click', function(e){
  if (e.target === musicModal) {
    musicModal.style.display = 'none';
    sessionStorage.setItem('musicPopupShown', 'true');
    popupShown = true;
  }
});

// Button Events
musicToggle.addEventListener("click", () => {
  musicEnabled = !musicEnabled;
  if (bgMusic) {
    bgMusic.muted = !musicEnabled;
    if (musicEnabled) {
      musicToggle.textContent = '🔊';
      musicToggle.classList.remove('off');
      bgMusic.play().catch(e => console.log('Autoplay blocked, unmuted only.'));
    } else {
      musicToggle.textContent = '🔇';
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

function updateNitroButton() {
  if (!nitroBtn) return;
  const nitroClassList = nitroBtn.classList;
  nitroClassList.remove('ready', 'charging', 'using');

  if (nitroActive) {
    nitroClassList.add('using');
    nitroFill.style.height = `${(nitroDuration / NITRO_DURATION_FRAMES) * 100}%`;
    nitroBtn.disabled = true;
  } else if (nitroCooldown > 0) {
    nitroClassList.add('charging');
    nitroFill.style.height = `${(1 - nitroCooldown / NITRO_COOLDOWN_FRAMES) * 100}%`;
    nitroBtn.disabled = true;
  } else {
    nitroClassList.add('ready');
    nitroFill.style.height = '100%';
    nitroBtn.disabled = false;
  }
}

// Controls
function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  let x;
  if (e.touches) {
    x = e.touches[0].clientX;
  } else {
    x = e.clientX;
  }
  return x - rect.left;
}

canvas.addEventListener('mousedown', () => { isDragging = true; });
canvas.addEventListener('mouseup', () => { isDragging = false; });
canvas.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const mouseX = getMousePos(e);
    player.x = mouseX - player.width / 2;
    player.x = Math.max(0, Math.min(player.x, canvas.width - player.width));
  }
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  isDragging = true;
  const touchX = getMousePos(e);
  player.x = touchX - player.width / 2;
  player.x = Math.max(0, Math.min(player.x, canvas.width - player.width));
});
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  isDragging = false;
});
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (isDragging) {
    const touchX = getMousePos(e);
    player.x = touchX - player.width / 2;
    player.x = Math.max(0, Math.min(player.x, canvas.width - player.width));
  }
});
// Add this function to your script.js file
function requestFullScreen() {
  const element = document.documentElement; // Targets the whole page (HTML element)
  
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) { /* Safari */
    element.webkitRequestFullscreen();
  } else if (element.msRequestFullscreen) { /* IE11 */
    element.msRequestFullscreen();
  }
}

// Attach the function to an in-game click/touch event, for example, the canvas itself
canvas.addEventListener('click', () => {
  // Only try to enter fullscreen if the game is already running or the intro is gone
  if (!gameOver) {
    requestFullScreen();
  }
});

// OR, you could put it on the playButton's existing handler:
// playButton.addEventListener("click", function playHandler(e) {
//   // ... existing code ...
//   requestFullScreen(); // Add it here after Tone.start() and startGame()
// });
function exitFullScreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) { /* Safari */
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) { /* IE11 */
    document.msExitFullscreen();
  }
}
