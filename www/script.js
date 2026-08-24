(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const container = document.getElementById("gameContainer");

  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const playAgainButton = document.getElementById("playAgainButton");

  const centerMessage = document.getElementById("centerMessage");
  const resultModal = document.getElementById("resultModal");

  const timeValue = document.getElementById("timeValue");
  const scoreValue = document.getElementById("scoreValue");
  const energyValue = document.getElementById("energyValue");
  const energyFill = document.getElementById("energyFill");

  const radarFill = document.getElementById("radarFill");
  const radarText = document.getElementById("radarText");

  const toast = document.getElementById("toast");

  const finalTime = document.getElementById("finalTime");
  const finalScore = document.getElementById("finalScore");
  const bestScore = document.getElementById("bestScore");

  const resultTitle = document.getElementById("resultTitle");
  const resultDescription = document.getElementById("resultDescription");
  const resultIcon = document.getElementById("resultIcon");

  let width = 0;
  let height = 0;
  let dpr = 1;

  let running = false;
  let gameWon = false;

  let startTime = 0;
  let elapsed = 0;

  let energy = 100;
  let score = 0;

  let lastFrame = 0;
  let lastMove = 0;

  let shake = 0;

  const hayParticles = [];
  const strawLines = [];
  const holes = [];
  const traps = [];
  const particles = [];

  let needle = null;

  let pointerDown = false;

  let audioContext = null;
  let audioReady = false;

  const MAX_ENERGY = 100;

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  function randomInt(min, max) {
    return Math.floor(random(min, max + 1));
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(s / 60);
    const secs = s % 60;

    return String(minutes).padStart(2, "0") + ":" +
           String(secs).padStart(2, "0");
  }

  function resizeCanvas() {
    const rect = container.getBoundingClientRect();

    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);

    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (running) {
      draw();
    } else {
      drawBackground();
    }
  }

  function createHay() {
    hayParticles.length = 0;
    strawLines.length = 0;

    const count = Math.floor((width * height) / 500);

    for (let i = 0; i < count; i++) {
      hayParticles.push({
        x: random(0, width),
        y: random(0, height),
        r: random(2, 6),
        rotation: random(0, Math.PI * 2),
        alpha: random(0.35, 0.9),
        shade: randomInt(0, 3)
      });
    }

    const lineCount = Math.floor((width * height) / 900);

    for (let i = 0; i < lineCount; i++) {
      strawLines.push({
        x: random(0, width),
        y: random(0, height),
        length: random(12, 30),
        angle: random(0, Math.PI * 2),
        alpha: random(0.18, 0.55)
      });
    }
  }

  function createNeedle() {
    const padding = Math.min(width, height) * 0.12;

    needle = {
      x: random(padding, width - padding),
      y: random(padding, height - padding),
      angle: random(-0.5, 0.5),
      radius: 9,
      revealed: false
    };
  }

  function createTraps() {
    traps.length = 0;

    const count = Math.max(7, Math.floor(width * height / 30000));

    for (let i = 0; i < count; i++) {
      traps.push({
        x: random(30, width - 30),
        y: random(40, height - 40),
        type: Math.random() < 0.5 ? "scorpion" : "nail",
        radius: random(10, 18),
        triggered: false,
        visible: false
      });
    }
  }

  function resetGame() {
    running = false;
    gameWon = false;

    elapsed = 0;
    energy = MAX_ENERGY;
    score = 0;

    pointerDown = false;
    shake = 0;

    holes.length = 0;
    particles.length = 0;

    createHay();
    createNeedle();
    createTraps();

    updateHUD();

    centerMessage.classList.remove("hidden");
    resultModal.classList.add("hidden");

    drawBackground();
  }

  function startGame() {
    if (running) return;

    initAudio();

    running = true;
    gameWon = false;

    startTime = performance.now();
    lastFrame = startTime;
    lastMove = 0;

    centerMessage.classList.add("hidden");
    resultModal.classList.add("hidden");

    requestAnimationFrame(loop);
  }

  function updateHUD() {
    timeValue.textContent = formatTime(elapsed);
    scoreValue.textContent = Math.max(0, Math.floor(score));

    const roundedEnergy = Math.ceil(energy);

    energyValue.textContent = roundedEnergy + "%";
    energyFill.style.width = clamp(energy, 0, 100) + "%";

    const closest = getClosestDistance();

    const maxDistance = Math.max(width, height) * 0.65;

    const heat = clamp(1 - closest / maxDistance, 0, 1);

    radarFill.style.width = (heat * 100) + "%";

    if (heat < 0.15) {
      radarText.textContent = "COLD";
      radarText.style.color = "#8fd14f";
    } else if (heat < 0.35) {
      radarText.textContent = "WARM";
      radarText.style.color = "#d8c45a";
    } else if (heat < 0.6) {
      radarText.textContent = "HOT";
      radarText.style.color = "#ff9d32";
    } else {
      radarText.textContent = "BURNING";
      radarText.style.color = "#ff4d4d";
    }
  }

  function getClosestDistance() {
    if (!needle) {
      return Math.max(width, height);
    }

    if (holes.length === 0) {
      return Math.max(width, height);
    }

    let closest = Infinity;

    for (const hole of holes) {
      closest = Math.min(
        closest,
        distance(hole, needle)
      );
    }

    return closest;
  }

  function drawBackground() {
    ctx.save();

    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(
      0,
      0,
      width,
      height
    );

    gradient.addColorStop(0, "#d2a44c");
    gradient.addColorStop(0.5, "#ad7c2d");
    gradient.addColorStop(1, "#76501e");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (const p of hayParticles) {
      ctx.save();

      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      const colors = [
        "#f0c66b",
        "#d9a94e",
        "#b9812d",
        "#9b6823"
      ];

      ctx.fillStyle = colors[p.shade];
      ctx.globalAlpha = p.alpha;

      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        p.r * 2.2,
        p.r * 0.75,
        0,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();
    }

    for (const line of strawLines) {
      ctx.save();

      ctx.translate(line.x, line.y);
      ctx.rotate(line.angle);

      ctx.strokeStyle = "#f1c866";
      ctx.globalAlpha = line.alpha;
      ctx.lineWidth = 1.4;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(line.length, 0);
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  function drawHoles() {
    for (const hole of holes) {
      const gradient = ctx.createRadialGradient(
        hole.x,
        hole.y,
        0,
        hole.x,
        hole.y,
        hole.radius
      );

      gradient.addColorStop(0, "rgba(42,29,11,0.95)");
      gradient.addColorStop(0.7, "rgba(66,44,15,0.8)");
      gradient.addColorStop(1, "rgba(66,44,15,0)");

      ctx.fillStyle = gradient;

      ctx.beginPath();
      ctx.arc(
        hole.x,
        hole.y,
        hole.radius,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }
  }

  function drawTraps() {
    for (const trap of traps) {
      if (!trap.visible) continue;

      ctx.save();

      ctx.translate(trap.x, trap.y);

      if (trap.type === "scorpion") {
        ctx.font = `${trap.radius * 1.7}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillStyle = "rgba(30,20,8,0.9)";
        ctx.fillText("🦂", 0, 0);
      } else {
        ctx.rotate(-0.5);

        ctx.strokeStyle = "#4e3415";
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.moveTo(-8, -8);
        ctx.lineTo(8, 8);
        ctx.stroke();

        ctx.strokeStyle = "#c59a52";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(-8, -8);
        ctx.lineTo(8, 8);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  function drawNeedle() {
    if (!needle || !needle.revealed) return;

    ctx.save();

    ctx.translate(needle.x, needle.y);
    ctx.rotate(needle.angle);

    ctx.shadowColor = "rgba(255,255,255,0.9)";
    ctx.shadowBlur = 15;

    ctx.strokeStyle = "#f4f4f4";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(13, 0);
    ctx.stroke();

    ctx.fillStyle = "#f4f4f4";

    ctx.beginPath();
    ctx.arc(
      -12,
      0,
      4,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save();

      ctx.globalAlpha = p.alpha;

      ctx.fillStyle = p.color;

      ctx.beginPath();

      ctx.arc(
        p.x,
        p.y,
        p.size,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();
    }
  }

  function draw() {
    ctx.save();

    if (shake > 0) {
      ctx.translate(
        random(-shake, shake),
        random(-shake, shake)
      );
    }

    drawBackground();
    drawHoles();
    drawTraps();
    drawNeedle();
    drawParticles();

    ctx.restore();
  }

  function addHole(x, y) {
    const closest = getClosestDistance();

    const holeRadius = clamp(
      18 + (energy < 30 ? 5 : 0),
      18,
      25
    );

    holes.push({
      x,
      y,
      radius: holeRadius
    });

    if (holes.length > 220) {
      holes.shift();
    }

    createDigParticles(x, y);

    const newDistance = distance(
      { x, y },
      needle
    );

    if (newDistance < 24) {
      needle.revealed = true;
      winGame();
      return;
    }

    if (newDistance < 45) {
      needle.revealed = true;
      showToast("🪡 IT'S RIGHT HERE!");
      vibrate([30, 20, 30]);
    }

    const improvement = Math.max(
      0,
      closest - newDistance
    );

    score += improvement * 0.05;

    energy -= 0.22;

    if (energy <= 0) {
      energy = 0;
      loseGame();
    }

    if (newDistance < Math.min(width, height) * 0.22) {
      maybeTriggerTrap(x, y);
    }
  }

  function createDigParticles(x, y) {
    for (let i = 0; i < 4; i++) {
      particles.push({
        x,
        y,
        vx: random(-1.8, 1.8),
        vy: random(-2.5, -0.5),
        size: random(1, 3),
        alpha: 0.8,
        color: Math.random() > 0.4
          ? "#e5b658"
          : "#f2cf7a"
      });
    }

    if (particles.length > 300) {
      particles.splice(
        0,
        particles.length - 300
      );
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;

      p.vy += 0.08 * dt * 60;

      p.alpha -= 0.025 * dt * 60;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function maybeTriggerTrap(x, y) {
    for (const trap of traps) {
      if (trap.triggered) continue;

      if (
        distance(
          { x, y },
          trap
        ) < trap.radius + 18
      ) {
        trap.triggered = true;
        trap.visible = true;

        energy = Math.max(
          0,
          energy - 7
        );

        score = Math.max(
          0,
          score - 30
        );

        shake = 8;

        vibrate([50, 30, 50]);

        if (trap.type === "scorpion") {
          showToast("🦂 FAKE SCORPION! -7 ENERGY");
        } else {
          showToast("🔩 FAKE NAIL! -7 ENERGY");
        }
      }
    }
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();

    let clientX;
    let clientY;

    if (event.touches && event.touches.length) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if (
      event.changedTouches &&
      event.changedTouches.length
    ) {
      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    return {
      x: clamp(
        clientX - rect.left,
        0,
        width
      ),
      y: clamp(
        clientY - rect.top,
        0,
        height
      )
    };
  }

  function handlePointerDown(event) {
    if (!running || gameWon) return;

    event.preventDefault();

    pointerDown = true;

    const point = pointerPosition(event);

    lastMove = performance.now();

    addHole(point.x, point.y);
  }

  function handlePointerMove(event) {
    if (!running || !pointerDown || gameWon) {
      return;
    }

    event.preventDefault();

    const now = performance.now();

    if (now - lastMove < 30) {
      return;
    }

    lastMove = now;

    const point = pointerPosition(event);

    addHole(point.x, point.y);

    playDigSound();
    updateRadarFeedback();
  }

  function handlePointerUp(event) {
    pointerDown = false;
  }

  function updateRadarFeedback() {
    const d = getClosestDistance();

    const threshold =
      Math.max(width, height) * 0.28;

    if (d < threshold) {
      const intensity =
        1 - clamp(d / threshold, 0, 1);

      const interval =
        Math.max(
          70,
          500 - intensity * 430
        );

      if (
        performance.now() % interval < 40
      ) {
        vibrate(
          Math.random() > 0.5
            ? 12
            : 5
        );
      }
    }
  }

  function vibrate(pattern) {
    try {
      if (
        navigator.vibrate &&
        typeof navigator.vibrate === "function"
      ) {
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  }

  function initAudio() {
    if (audioReady) return;

    try {
      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContext) return;

      audioContext = new AudioContext();

      audioReady = true;
    } catch (_) {}
  }

  function playDigSound() {
    if (!audioContext) return;

    if (
      audioContext.state === "suspended"
    ) {
      audioContext.resume();
    }

    const oscillator =
      audioContext.createOscillator();

    const gain =
      audioContext.createGain();

    oscillator.type = "triangle";

    oscillator.frequency.value =
      random(90, 170);

    gain.gain.setValueAtTime(
      0.0001,
      audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.025,
      audioContext.currentTime + 0.008
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      audioContext.currentTime + 0.08
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(
      audioContext.currentTime + 0.09
    );
  }

  function showToast(message) {
    toast.textContent = message;

    toast.classList.add("visible");

    clearTimeout(showToast.timer);

    showToast.timer =
      setTimeout(() => {
        toast.classList.remove("visible");
      }, 1200);
  }

  function winGame() {
    if (!running) return;

    running = false;
    gameWon = true;

    elapsed =
      (performance.now() - startTime) / 1000;

    score +=
      Math.max(0, energy) * 10;

    score +=
      Math.max(0, 300 - elapsed * 4);

    score = Math.floor(score);

    needle.revealed = true;

    vibrate([
      50,
      50,
      100,
      50,
      180
    ]);

    showResult(true);
  }

  function loseGame() {
    if (!running) return;

    running = false;
    gameWon = false;

    elapsed =
      (performance.now() - startTime) / 1000;

    needle.revealed = false;

    vibrate([
      100,
      70,
      100
    ]);

    showResult(false);
  }

  function showResult(won) {
    const stored =
      Number(
        localStorage.getItem(
          "needleBestScore"
        ) || 0
      );

    let best = stored;

    if (won && score > stored) {
      best = score;

      localStorage.setItem(
        "needleBestScore",
        String(score)
      );
    }

    finalTime.textContent =
      formatTime(elapsed);

    finalScore.textContent =
      String(Math.floor(score));

    bestScore.textContent =
      String(Math.floor(best));

    if (won) {
      resultIcon.textContent = "🪡";
      resultTitle.textContent = "YOU FOUND IT!";
      resultDescription.textContent =
        "Against all odds, you found the needle.";
    } else {
      resultIcon.textContent = "💀";
      resultTitle.textContent = "HAY WINS!";
      resultDescription.textContent =
        "Your energy ran out. The needle remains hidden.";
    }

    resultModal.classList.remove("hidden");
  }

  function loop(timestamp) {
    if (!running) {
      draw();
      return;
    }

    const dt =
      Math.min(
        (timestamp - lastFrame) / 1000,
        0.05
      );

    lastFrame = timestamp;

    elapsed =
      (timestamp - startTime) / 1000;

    updateParticles(dt);

    shake *= 0.9;

    if (shake < 0.1) {
      shake = 0;
    }

    updateHUD();

    draw();

    requestAnimationFrame(loop);
  }

  startButton.addEventListener(
    "click",
    startGame
  );

  restartButton.addEventListener(
    "click",
    () => {
      resetGame();
    }
  );

  playAgainButton.addEventListener(
    "click",
    () => {
      resetGame();
      startGame();
    }
  );

  canvas.addEventListener(
    "pointerdown",
    handlePointerDown,
    { passive: false }
  );

  canvas.addEventListener(
    "pointermove",
    handlePointerMove,
    { passive: false }
  );

  canvas.addEventListener(
    "pointerup",
    handlePointerUp,
    { passive: false }
  );

  canvas.addEventListener(
    "pointercancel",
    handlePointerUp,
    { passive: false }
  );

  canvas.addEventListener(
    "pointerleave",
    handlePointerUp,
    { passive: false }
  );

  window.addEventListener(
    "resize",
    resizeCanvas
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.hidden &&
        running
      ) {
        pointerDown = false;
      }
    }
  );

  resizeCanvas();
  resetGame();

})();
