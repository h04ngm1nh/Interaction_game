// --- GAME CONFIG & DATA ---
const maxRounds = 6;
const pointsPerCorrect = 25;
const targetScore = 100;
const correctDelayMs = 2800;
const wrongDelayMs = 2800;

const treatments = [
  {
    id: "niacinamide",
    name: "Niacinamide",
    bottle: "niacinamide.avif",
    original: "sam.png",
    healed: "sau-dieu-tri-sam.png",
    success: "Đúng rồi! Niacinamide giúp cải thiện da bị sạm và làm đều màu da.",
  },
  {
    id: "bha",
    name: "BHA",
    bottle: "bha.jpg",
    original: "mun-dau-den.jpg",
    healed: "sau-dieu-tri-mun-dau-den.jpg",
    success: "Đúng rồi! BHA (Salicylic Acid) làm sạch sâu, điều trị mụn đầu đen và sợi bã nhờn.",
  },
  {
    id: "azelaic",
    name: "Azelaic acid",
    bottle: "azelaic-acid.png",
    original: "mun-viem.png",
    healed: "sau-dieu-tri-mun-viem.png",
    success: "Đúng rồi! Azelaic acid kháng khuẩn, giảm sưng tấy cho da bị mụn viêm.",
  },
  {
    id: "retinoic",
    name: "Retinoic acid",
    bottle: "retinoic-acid.png",
    original: "lao-hoa.png",
    healed: "sau-dieu-tri-lao-hoa.png",
    success: "Đúng rồi! Retinoic acid tái tạo tế bào, làm mờ nếp nhăn và trẻ hóa làn da.",
  },
];

// --- DOM ELEMENTS ---
const board = document.querySelector("#board");
const bottle = document.querySelector("#bottle");
const bottleImg = document.querySelector("#bottleImg");
const bottleName = document.querySelector("#bottleName");
const faces = [...document.querySelectorAll(".face-card")];
const message = document.querySelector("#message");
const scoreEl = document.querySelector("#score");
const roundEl = document.querySelector("#round");
const totalEl = document.querySelector("#total");
const restart = document.querySelector("#restart");
const connectorLayer = document.querySelector("#connectorLayer");
const resultModal = document.querySelector("#resultModal");
const resultScore = document.querySelector("#resultScore");
const resultDesc = document.querySelector("#resultDesc");
const resultIcon = document.querySelector("#resultIcon");
const modalRestart = document.querySelector("#modalRestart");
const soundToggle = document.querySelector("#soundToggle");
const confettiCanvas = document.querySelector("#confettiCanvas");

// --- GAME STATE ---
let current = null;
let score = 0;
let round = 1;
let selected = false;
let solved = new Set();
let lastId = "";
let advanceTimer = null;
let isMuted = false;

// --- WEB AUDIO SYNTHESIZER ---
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type) {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    if (type === "correct") {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "triangle";
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc2.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc1.frequency.setValueAtTime(783.99, now + 0.2); // G5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.1);
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    } else if (type === "wrong") {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(180, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === "win") {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const now = ctx.currentTime + idx * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      });
    }
  } catch (e) {
    console.warn("Audio unavailable:", e);
  }
}

soundToggle.addEventListener("click", () => {
  isMuted = !isMuted;
  soundToggle.textContent = isMuted ? "🔇" : "🔊";
  soundToggle.title = isMuted ? "Bật âm thanh" : "Tắt âm thanh";
});

// --- HELPER FUNCTIONS ---
function pickNextTreatment() {
  const remaining = treatments.filter((item) => !solved.has(item.id));
  const pool = remaining.length ? remaining : treatments;
  const choices = pool.filter((item) => item.id !== lastId);
  const finalPool = choices.length ? choices : pool;
  return finalPool[Math.floor(Math.random() * finalPool.length)];
}

function startGame() {
  clearTimeout(advanceTimer);
  current = null;
  score = 0;
  round = 1;
  selected = false;
  solved = new Set();
  lastId = "";
  connectorLayer.replaceChildren();
  resultModal.hidden = true;
  totalEl.textContent = maxRounds;
  scoreEl.textContent = score;
  roundEl.textContent = round;
  
  faces.forEach((face) => {
    const treatment = treatments.find((item) => item.id === face.dataset.id);
    face.classList.remove("active", "correct", "wrong");
    const imgEl = face.querySelector("img");
    if (imgEl && treatment) {
      imgEl.src = treatment.original;
    }
  });
  nextBottle();
}

function nextBottle() {
  selected = false;
  bottle.classList.remove("selected");

  if (score >= targetScore || round > maxRounds) {
    endGame();
    return;
  }

  current = pickNextTreatment();
  lastId = current.id;
  bottle.hidden = false;
  bottle.style.display = "flex";
  bottle.dataset.id = current.id;
  bottleImg.src = current.bottle;
  bottleImg.alt = `Chai ${current.name}`;
  bottleName.textContent = current.name;
  roundEl.textContent = round;
  message.textContent = "Kéo chai thuốc vào đúng khuôn mặt";
  message.className = "message";
}

function endGame() {
  current = null;
  bottle.hidden = true;
  bottle.style.display = "none";
  roundEl.textContent = Math.min(round - 1, maxRounds);

  const isWin = score >= targetScore;
  if (isWin) {
    message.textContent = "🎉 Xuất sắc! Bạn đạt 100 điểm tuyệt đối!";
    message.className = "message good";
    resultIcon.textContent = "🏆";
    resultTitle.textContent = "Chiến Thắng Rực Rỡ!";
    resultDesc.textContent = "Bạn có kiến thức skincare tuyệt vời! Tất cả các tình trạng da đều được điều trị chính xác.";
    playSound("win");
    triggerConfetti();
  } else {
    message.textContent = `Hết lượt! Bạn đạt ${score}/${targetScore} điểm.`;
    message.className = "message bad";
    resultIcon.textContent = "💡";
    resultTitle.textContent = "Hoàn Thành Ván Chơi";
    resultDesc.textContent = `Bạn đã hoàn thành ván chơi với số điểm ${score}/${targetScore}. Hãy bấm chơi lại để cải thiện điểm số nhé!`;
  }

  resultScore.textContent = `Điểm số của bạn: ${score}/${targetScore} điểm`;
  resultModal.hidden = false;
}

function consumeRound(delayMs) {
  round += 1;
  advanceTimer = setTimeout(nextBottle, delayMs);
}

function tryMatch(face) {
  if (!current) return;
  const answered = current;
  current = null;
  const isCorrect = face.dataset.id === answered.id;

  // Draw visual SVG line connector
  drawConnector(face, isCorrect);

  if (isCorrect) {
    playSound("correct");
    if (!solved.has(answered.id)) {
      score += pointsPerCorrect;
      solved.add(answered.id);
      face.classList.add("correct");
      const imgEl = face.querySelector("img");
      if (imgEl) imgEl.src = answered.healed;
    }
    scoreEl.textContent = score;
    message.textContent = answered.success;
    message.className = "message good";
    consumeRound(correctDelayMs);
    return;
  }

  // Incorrect match
  playSound("wrong");
  face.classList.add("wrong");
  message.textContent = "Chưa đúng! Thử lại ở câu tiếp theo nhé.";
  message.className = "message bad";
  setTimeout(() => face.classList.remove("wrong"), 400);
  consumeRound(wrongDelayMs);
}

// --- CONNECTOR LINE DRAWING ---
function centerOf(element) {
  const boardRect = board.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - boardRect.left,
    y: rect.top + rect.height / 2 - boardRect.top,
  };
}

function drawConnector(face, isCorrect) {
  const start = centerOf(bottle);
  const end = centerOf(face);
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", start.x);
  line.setAttribute("y1", start.y);
  line.setAttribute("x2", end.x);
  line.setAttribute("y2", end.y);
  line.setAttribute("stroke", isCorrect ? "#0d9488" : "#f43f5e");
  line.setAttribute("stroke-width", "6");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-dasharray", isCorrect ? "0" : "8, 8");
  line.setAttribute("opacity", "0.95");
  connectorLayer.append(line);

  if (!isCorrect) {
    setTimeout(() => line.remove(), 600);
  }
}

// --- DRAG AND DROP (DESKTOP) ---
bottle.addEventListener("dragstart", (event) => {
  if (!current) return;
  getAudioContext();
  event.dataTransfer.setData("text/plain", current.id);
  event.dataTransfer.effectAllowed = "move";
  bottle.classList.add("selected");
});

bottle.addEventListener("dragend", () => {
  bottle.classList.remove("selected");
});

faces.forEach((face) => {
  face.addEventListener("dragover", (event) => {
    event.preventDefault();
    face.classList.add("active");
  });

  face.addEventListener("dragleave", () => {
    face.classList.remove("active");
  });

  face.addEventListener("drop", (event) => {
    event.preventDefault();
    face.classList.remove("active");
    tryMatch(face);
  });

  face.addEventListener("click", () => {
    if (selected) {
      tryMatch(face);
    }
  });

  face.addEventListener("keydown", (event) => {
    if (selected && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      tryMatch(face);
    }
  });
});

bottle.addEventListener("click", () => {
  if (!current) return;
  getAudioContext();
  selected = !selected;
  bottle.classList.toggle("selected", selected);
  message.textContent = selected
    ? "Bấm vào khuôn mặt cần điều trị bằng hoạt chất này"
    : "Kéo chai thuốc vào đúng khuôn mặt";
  message.className = "message";
});

// --- TOUCH DRAG & DROP (MOBILE / TABLET) ---
let touchStartPos = { x: 0, y: 0 };
let activeTouchCard = null;

bottle.addEventListener("touchstart", (e) => {
  if (!current) return;
  getAudioContext();
  const touch = e.touches[0];
  touchStartPos = { x: touch.clientX, y: touch.clientY };
  bottle.classList.add("selected");
}, { passive: true });

bottle.addEventListener("touchmove", (e) => {
  if (!current) return;
  const touch = e.touches[0];
  const deltaX = touch.clientX - touchStartPos.x;
  const deltaY = touch.clientY - touchStartPos.y;
  
  bottle.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.05)`;

  // Check card under touch
  const element = document.elementFromPoint(touch.clientX, touch.clientY);
  const card = element ? element.closest(".face-card") : null;
  
  if (activeTouchCard && activeTouchCard !== card) {
    activeTouchCard.classList.remove("active");
  }
  if (card) {
    card.classList.add("active");
  }
  activeTouchCard = card;
}, { passive: true });

bottle.addEventListener("touchend", (e) => {
  if (!current) return;
  bottle.style.transform = "";
  bottle.classList.remove("selected");

  if (activeTouchCard) {
    const targetCard = activeTouchCard;
    activeTouchCard.classList.remove("active");
    activeTouchCard = null;
    tryMatch(targetCard);
  }
});

// --- CONFETTI ANIMATION ---
function triggerConfetti() {
  const ctx = confettiCanvas.getContext("2d");
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;

  const particles = Array.from({ length: 90 }, () => ({
    x: Math.random() * confettiCanvas.width,
    y: Math.random() * confettiCanvas.height - confettiCanvas.height,
    size: Math.random() * 8 + 4,
    color: ["#0d9488", "#f43f5e", "#f59e0b", "#3b82f6", "#10b981"][Math.floor(Math.random() * 5)],
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 4 + 3,
    rotation: Math.random() * 360,
    vRot: (Math.random() - 0.5) * 10
  }));

  let startTime = Date.now();
  function draw() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vRot;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    if (Date.now() - startTime < 3500) {
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }
  draw();
}

// --- EVENT LISTENERS ---
restart.addEventListener("click", startGame);
modalRestart.addEventListener("click", startGame);
window.addEventListener("resize", () => connectorLayer.replaceChildren());

// Start initial game
startGame();
