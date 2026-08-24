const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const haystack = document.getElementById('haystack');
const timerEl = document.getElementById('timer');
const energyEl = document.getElementById('energy');
const radarHint = document.getElementById('radar-hint');
const hintMsg = document.getElementById('hint-msg');

let timer;
let timeLeft = 30;
let energy = 100;
let gameActive = false;

// إحداثيات الإبرة والعقبات
let needleX = 0;
let needleY = 0;
let traps = []; // عقارب ومقالب وهمية

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

function startGame() {
    startScreen.classList.remove('active');
    endScreen.classList.remove('active');
    gameScreen.classList.add('active');

    timeLeft = 30;
    energy = 100;
    gameActive = true;
    timerEl.textContent = timeLeft;
    energyEl.textContent = energy;
    radarHint.textContent = "الاقتراب من الإبرة: ابدأ بالحفر...";
    hintMsg.style.display = 'block';

    generateHaystack();

    // بدء العد التنازلي
    clearInterval(timer);
    timer = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 0) {
            endGame(false, "انتهى الوقت! أكلتك العقارب داخل القش.");
        }
    }, 1000);
}

function generateHaystack() {
    haystack.innerHTML = '';
    haystack.appendChild(hintMsg);

    const rect = haystack.getBoundingClientRect();
    const width = rect.width || 350;
    const height = rect.height || 450;

    // تحديد مكان عشوائي للإبرة
    needleX = Math.floor(Math.random() * (width - 40)) + 20;
    needleY = Math.floor(Math.random() * (height - 40)) + 20;

    // توليد عوائق ومقالب (عقارب أو مسامير وهمية)
    traps = [];
    for (let i = 0; i < 5; i++) {
        traps.push({
            x: Math.floor(Math.random() * (width - 40)) + 20,
            y: Math.floor(Math.random() * (height - 40)) + 20
        });
    }

    // توليد قطع القش الوهمية التي تحجب الرؤية
    for (let i = 0; i < 40; i++) {
        const straw = document.createElement('div');
        straw.classList.add('hay-piece');
        const pWidth = Math.random() * 60 + 40;
        const pHeight = Math.random() * 15 + 10;
        straw.style.width = `${pWidth}px`;
        straw.style.height = `${pHeight}px`;
        straw.style.left = `${Math.random() * (width - pWidth)}px`;
        straw.style.top = `${Math.random() * (height - pHeight)}px`;
        straw.style.transform = `rotate(${Math.random() * 360}deg)`;
        
        // تفاعل إزاحة القش باللمس أو الماوس
        straw.addEventListener('pointerdown', (e) => {
            if (!gameActive) return;
            removeStraw(straw, e.clientX, e.clientY);
        });

        haystack.appendChild(straw);
    }
}

function removeStraw(straw, clientX, clientY) {
    hintMsg.style.display = 'none';
    straw.style.transform += ' scale(0) rotate(720deg)';
    straw.style.opacity = '0';
    setTimeout(() => straw.remove(), 300);

    // استهلاك طاقة اليد مع كل حفرة
    energy = Math.max(0, energy - 3);
    energyEl.textContent = energy;

    if (energy <= 0) {
        endGame(false, "فقدت طاقتك كلياً وتعبت يداك وسط القش!");
        return;
    }

    const rect = haystack.getBoundingClientRect();
    const touchX = clientX - rect.left;
    const touchY = clientY - rect.top;

    // فحص المسافة للإبرة
    const distanceToNeedle = Math.hypot(touchX - needleX, touchY - needleY);

    if (distanceToNeedle < 35) {
        // وجد الإبرة!
        endGame(true, "كفوو! عثرت على الإبرة المجنونة بنجاح!");
        return;
    }

    // فحص المقالب والعقارب
    let hitTrap = traps.some(trap => Math.hypot(touchX - trap.x, touchY - trap.y) < 30);
    if (hitTrap) {
        energy = Math.max(0, energy - 15);
        energyEl.textContent = energy;
        triggerVibration([100, 50, 100]);
        radarHint.textContent = "عقرب لَسَعَ اصبعك! (-15% طاقة)";
        radarHint.style.color = '#e74c3c';
        return;
    }

    // تحديث مؤشر الرادار بناءً على القرب
    if (distanceToNeedle < 70) {
        radarHint.textContent = "🔥 تحرق! الإبرة قريبة جداً جداً!";
        radarHint.style.color = '#e67e22';
        triggerVibration(100);
    } else if (distanceToNeedle < 140) {
        radarHint.textContent = "⚡ دافئ.. أنت تقترب تدريجياً.";
        radarHint.style.color = '#f1c40f';
        triggerVibration(40);
    } else {
        radarHint.textContent = "❄️ بارد جداً.. ابحث في مكان آخر!";
        radarHint.style.color = '#3498db';
    }
}

function triggerVibration(pattern) {
    if ("vibrate" in navigator) {
        navigator.vibrate(pattern);
    }
}

function endGame(isWin, message) {
    gameActive = false;
    clearInterval(timer);
    gameScreen.classList.remove('active');
    endScreen.classList.add('active');

    const endTitle = document.getElementById('end-title');
    const endDesc = document.getElementById('end-desc');

    if (isWin) {
        endTitle.textContent = "🎉 فوز ساحر!";
        endTitle.style.color = '#2ecc71';
    } else {
        endTitle.textContent = "💀 خسارة نكراء!";
        endTitle.style.color = '#e74c3c';
    }
    endDesc.textContent = message;
}
