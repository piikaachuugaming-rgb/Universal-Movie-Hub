// ==========================================
// CONFIG & GLOBAL STATE
// ==========================================
const CONFIG = {
    IMG: 'https://image.tmdb.org/t/p/w342',
    BLANK: 'https://via.placeholder.com/342x500/1a1a1a/e50914?text=No+Poster'
};

let watchlist = JSON.parse(localStorage.getItem('movieHubWatchlist')) || [];
let currentItem = { id: null, type: null };
let userLang = localStorage.getItem('userLang') || 'en-US';

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    loadHomeData();
    // Language dropdown ko set karna
    const langSelector = document.getElementById('langSelect');
    if(langSelector) langSelector.value = userLang;
}

// ==========================================
// CORE DATA FETCHING
// ==========================================
async function callBackend(params) {
    try {
        params.language = userLang;
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`/api/movies?${query}`);
        if (!res.ok) throw new Error("API Failed");
        return await res.json();
    } catch (err) {
        showToast("Error connecting to server!", "error");
        return { results: [] };
    }
}

async function loadHomeData() {
    showLoading();
    try {
        await Promise.all([
            renderSection('/trending/all/week', 'trendingContent'),
            renderSection('/movie/popular', 'popularMovies'),
            renderSection('/tv/popular', 'topSeries'),
            renderSection('/discover/tv?with_genres=16&with_origin_country=JP', 'animeCollection')
        ]);
    } finally { hideLoading(); }
}

async function renderSection(endpoint, containerId) {
    const data = await callBackend({ endpoint });
    const container = document.getElementById(containerId);
    if (container && data.results) {
        container.innerHTML = data.results.map(item => createCard(item)).join('');
    }
}

function createCard(item) {
    const title = item.title || item.name || "Unknown";
    const type = item.media_type || (item.title ? 'movie' : 'tv');
    const poster = item.poster_path ? CONFIG.IMG + item.poster_path : CONFIG.BLANK;
    const rating = item.vote_average ? item.vote_average.toFixed(1) : "NR";
    const year = (item.release_date || item.first_air_date || '2024').split('-')[0];

    return `
        <div class="content-card" onclick="openDetails(${item.id}, '${type}')">
            <img src="${poster}" alt="${title}" loading="lazy">
            <div class="content-card-info">
                <h4>${title}</h4>
                <div class="card-meta"><span>⭐ ${rating}</span><span>${year}</span></div>
            </div>
        </div>
    `;
}

// ==========================================
// MODAL & STREAMING (THE SHIN-CHAN FIX)
// ==========================================
async function openDetails(id, type) {
    showLoading();
    currentItem = { id, type };
    try {
        const data = await callBackend({ id, type });
        const modal = document.getElementById('detailsModal');
        const content = document.getElementById('detailsContent');
        const isListed = watchlist.some(i => i.id === data.id);
        const trailer = data.videos?.results.find(v => v.type === 'Trailer')?.key;

        content.innerHTML = `
            <div class="modal-body">
                <h2 style="color:#e50914;">${data.title || data.name}</h2>
                <div class="warning-box" style="background:rgba(255,193,7,0.1); color:#ffc107; padding:10px; border-radius:8px; font-size:0.8rem; margin:10px 0; border:1px solid #ffc10733;">
                    <b>Pro Tip:</b> If Server 1 fails (especially for Shin-chan), use <b>Server 3</b>. Use <b>Brave Browser</b> to stop ads.
                </div>
                <div id="playerWrap" style="background:#000; border-radius:10px; overflow:hidden; margin-bottom:15px;">
                    ${trailer ? `<iframe width="100%" height="300" src="https://www.youtube.com/embed/${trailer}" frameborder="0" allowfullscreen></iframe>` : '<div style="padding:80px; text-align:center;">Trailer Not Available</div>'}
                </div>
                <p style="color:#ccc; font-size:0.9rem; margin-bottom:20px;">${data.overview || 'No description available.'}</p>
                <div class="btn-group" style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="p-btn" onclick="play(1)" style="background:#e50914;">S1</button>
                    <button class="p-btn" onclick="play(2)" style="background:#007bff;">S2</button>
                    <button class="p-btn" onclick="play(3)" style="background:#ffc107; color:black;">S3 (Anime)</button>
                    <button class="p-btn" onclick="handleWatchlist(${JSON.stringify(data).replace(/"/g, '&quot;')})" style="background:#444;">
                        ${isListed ? '✓ Watchlisted' : '+ Watchlist'}
                    </button>
                    <button class="p-btn" onclick="closeModal()" style="background:#222;">Close</button>
                </div>
            </div>
        `;
        modal.classList.add('active');
    } finally { hideLoading(); }
}

function play(server) {
    const wrap = document.getElementById('playerWrap');
    const { id, type } = currentItem;
    let url = "";
    if(server === 1) url = `https://vidsrc.me/embed/${type}?tmdb=${id}`;
    else if(server === 2) url = `https://vidsrc.in/embed/${type}?tmdb=${id}`;
    else url = `https://vidsrc.xyz/embed/${type}?tmdb=${id}`; // XYZ is best for old content
    
    wrap.innerHTML = `<iframe src="${url}" width="100%" height="400" frameborder="0" allowfullscreen></iframe>`;
    showToast(`Switching to Server ${server}...`);
}

// ==========================================
// PROFILE & LANGUAGE LOGIC
// ==========================================
function setLanguage(lang) {
    userLang = lang;
    localStorage.setItem('userLang', lang);
    showToast(`Language set to ${lang === 'hi-IN' ? 'Hindi' : 'English'}`);
    loadHomeData(); // Refresh content
}

function openProfile() {
    alert("User: Aman\nRole: Lead Developer\nProject: Universal Movie Hub v2.0");
}

// ==========================================
// UTILS
// ==========================================
function handleWatchlist(item) {
    const idx = watchlist.findIndex(i => i.id === item.id);
    if(idx > -1) {
        watchlist.splice(idx, 1);
        showToast("Removed from Watchlist", "error");
    } else {
        watchlist.push(item);
        showToast("Added to Watchlist! 🍿");
    }
    localStorage.setItem('movieHubWatchlist', JSON.stringify(watchlist));
    if(document.getElementById('watchlist').classList.contains('active')) renderWatchlist();
}

function renderWatchlist() {
    const grid = document.getElementById('watchlistGrid');
    grid.innerHTML = watchlist.length ? watchlist.map(i => createCard(i)).join('') : '<p style="padding:20px;">Empty...</p>';
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.currentTarget.getAttribute('data-section');
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.getElementById(section).classList.add('active');
            if(section === 'watchlist') renderWatchlist();
            window.scrollTo(0,0);
        });
    });

    // Search
    const sInput = document.getElementById('searchInput');
    if(sInput) sInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') searchMovies(e.target.value);
    });
}

async function searchMovies(q) {
    if(!q.trim()) return;
    showLoading();
    const data = await callBackend({ query: q });
    const container = document.getElementById('trendingContent');
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('home').classList.add('active');
    container.innerHTML = data.results.map(i => createCard(i)).join('');
    hideLoading();
}

function closeModal() { document.getElementById('detailsModal').classList.remove('active'); }
function showLoading() { document.getElementById('loadingSpinner')?.classList.add('active'); }
function hideLoading() { document.getElementById('loadingSpinner')?.classList.remove('active'); }

function showToast(m, type="success") {
    const toast = document.createElement('div');
    toast.innerText = m;
    Object.assign(toast.style, {
        position:'fixed', bottom:'100px', left:'50%', transform:'translateX(-50%)',
        background: type==='error'?'#ff4444':'#00C851', color:'white', padding:'12px 25px',
        borderRadius:'30px', zIndex:'9999', fontWeight:'bold', boxShadow:'0 4px 15px rgba(0,0,0,0.3)'
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}