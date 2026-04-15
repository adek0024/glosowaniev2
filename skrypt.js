// --- KONFIGURACJA ---
const PHOTO_COUNT = 19;

const myData = [];
for (let i = 1; i <= PHOTO_COUNT; i++) {
    myData.push({ id: i, img: `media/image${i}.jpg`, title: `Zdjęcie nr ${i}` });
}

let selectedId  = null;
let isExpired   = false;
let DEADLINE    = null;
let modalOpen   = null;

// --- PŁATKI KWIATÓW ---
const petalColors = ['#f48fb1', '#f8bbd0', '#a5d6a7', '#fff59d', '#ce93d8', '#ffcc80'];

function createPetals() {
    for (let i = 0; i < 18; i++) {
        const petal = document.createElement('div');
        petal.className = 'petal';
        petal.style.left              = Math.random() * 100 + 'vw';
        petal.style.background        = petalColors[Math.floor(Math.random() * petalColors.length)];
        petal.style.width             = (10 + Math.random() * 14) + 'px';
        petal.style.height            = (10 + Math.random() * 14) + 'px';
        petal.style.animationDuration = (6 + Math.random() * 10) + 's';
        petal.style.animationDelay    = (Math.random() * 8) + 's';
        document.body.appendChild(petal);
    }
}

// --- LICZNIK (deadline z backendu) ---
async function fetchDeadline() {
    try {
        const res  = await fetch('/api/deadline');
        const data = await res.json();
        DEADLINE = new Date(data.deadline).getTime();

        // Jeśli admin zresetował głosy, odblokuj przyciski
        const serverGen = String(data.vote_generation);
        if (localStorage.getItem('voted') && localStorage.getItem('vote_generation') !== serverGen) {
            localStorage.removeItem('voted');
        }
        localStorage.setItem('vote_generation', serverGen);
    } catch {
        DEADLINE = new Date('2026-03-14T15:40:00').getTime();
    }
    updateTimer();
}

function updateTimer() {
    if (!DEADLINE) return;
    const now  = new Date().getTime();
    const diff = DEADLINE - now;
    const el   = document.getElementById('countdown');

    if (diff <= 0) {
        el.innerHTML         = 'GŁOSOWANIE ZAKOŃCZONE';
        el.style.color       = '#e91e8c';
        el.style.borderColor = '#e91e8c';
        isExpired = true;
        disableButtons();
        return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    el.innerHTML = `Koniec za: ${d}d ${h}h ${m}m ${s}s`;
}

setInterval(updateTimer, 1000);

// --- GALERIA ---
function buildGallery() {
    const gallery = document.getElementById('gallery');
    myData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="img-wrapper">
                <span class="card-label">Nr ${item.id}</span>
                <img src="${item.img}"
                     alt="${item.title}"
                     loading="lazy"
                     onerror="this.src='https://placehold.co/400x300/fce4ec/e91e8c?text=Zdjęcie+${item.id}'">
            </div>
            <div class="button-area">
                <span class="card-title">${item.title}</span>
                <button class="vote-btn">🌷 GŁOSUJ</button>
            </div>
        `;
        card.querySelector('img').addEventListener('click', () => openImg(item.img));
        card.querySelector('.vote-btn').addEventListener('click', () => askVote(item.id));
        gallery.appendChild(card);
    });
}

function disableButtons() {
    document.querySelectorAll('.vote-btn').forEach(btn => {
        btn.disabled  = true;
        btn.innerText = 'ZAKOŃCZONO';
    });
}

// --- ZARZĄDZANIE MODALAMI (obsługa przycisku Wstecz) ---
function openModal(id) {
    modalOpen = id;
    history.pushState({ modal: id }, '');
    document.getElementById(id).style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal(id, fromPopstate = false) {
    const el = document.getElementById(id);
    if (!el || el.style.display !== 'flex') return;
    el.style.display = 'none';
    document.body.style.overflow = '';
    modalOpen = null;
    if (!fromPopstate) history.back();
}

window.addEventListener('popstate', function () {
    if (modalOpen) closeModal(modalOpen, true);
});

// --- MODAL ZDJĘCIA ---
function openImg(src) {
    const img = document.getElementById('fullImg');
    img.src = src;
    img.classList.remove('full-zoom');
    openModal('imgModal');
}

document.getElementById('imgModal').addEventListener('click', function (e) {
    if (e.target === this) closeModal('imgModal');
});

document.getElementById('imgModalClose').addEventListener('click', function (e) {
    e.stopPropagation();
    closeModal('imgModal');
});

document.getElementById('fullImg').addEventListener('click', function (e) {
    e.stopPropagation();
    if (!('ontouchstart' in window)) this.classList.toggle('full-zoom');
});

// Swipe zamyka modal zdjęcia
(function () {
    let startX, startY;
    const imgModal = document.getElementById('imgModal');

    imgModal.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    imgModal.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dy) > 80 || Math.abs(dx) > 80) closeModal('imgModal');
    }, { passive: true });
})();

// --- MODAL POTWIERDZENIA ---
function askVote(id) {
    if (isExpired) return;
    if (localStorage.getItem('voted')) {
        showToast('Już oddałeś swój głos! 🌸');
        return;
    }
    selectedId = id;
    document.getElementById('confirmText').innerText =
        `Czy na pewno chcesz oddać głos na zdjęcie nr ${id}?`;
    openModal('confirmModal');
}

function closeConfirm() { closeModal('confirmModal'); }

document.getElementById('confirmModal').addEventListener('click', function (e) {
    if (e.target === this) closeConfirm();
});

document.getElementById('cancelBtn').addEventListener('click', closeConfirm);

document.getElementById('finalOk').addEventListener('click', async function () {
    this.disabled  = true;
    this.innerText = 'Wysyłanie…';

    try {
        const res  = await fetch('/vote', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ photo_id: selectedId })
        });
        const data = await res.json();

        closeConfirm();

        if (data.success) {
            localStorage.setItem('voted', '1');
            localStorage.setItem('vote_generation', localStorage.getItem('vote_generation') || '1');
            showToast(`Dziękujemy! 🌸 Głos na nr ${selectedId} zapisany!`);
            // Wyłącz wszystkie przyciski po oddaniu głosu
            document.querySelectorAll('.vote-btn').forEach(btn => {
                btn.disabled  = true;
                btn.innerText = 'Zagłosowano';
            });
        } else {
            showToast(data.message || 'Błąd wysyłania głosu', 'error');
        }
    } catch {
        closeConfirm();
        showToast('Błąd połączenia z serwerem', 'error');
    }

    this.disabled  = false;
    this.innerText = 'TAK, GŁOSUJ';
});

// --- TOAST ---
function showToast(msg, type = 'success') {
    let toast = document.getElementById('toast-notif');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notif';
        toast.style.cssText = `
            position:fixed; bottom:30px; left:50%; transform:translateX(-50%) translateY(80px);
            background:#2e7d32; color:white; padding:14px 28px; border-radius:50px;
            font-size:14px; font-weight:600; font-family:'Poppins',sans-serif;
            box-shadow:0 8px 24px rgba(0,0,0,0.2); transition:transform 0.3s ease;
            z-index:9999; white-space:nowrap; pointer-events:none;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.background = type === 'error' ? '#c62828' : '#2e7d32';
    setTimeout(() => { toast.style.transform = 'translateX(-50%) translateY(0)'; }, 10);
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(80px)';
    }, 3500);
}

// Zablokuj przyciski jeśli już głosował (localStorage)
function checkAlreadyVoted() {
    if (localStorage.getItem('voted')) {
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.disabled  = true;
            btn.innerText = 'Zagłosowano';
        });
    }
}

// --- INIT ---
createPetals();
buildGallery();
fetchDeadline();
checkAlreadyVoted();
