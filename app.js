// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
const CONFIG = {
    IMG_PATH: 'https://image.tmdb.org/t/p/w342',
    NO_POSTER: 'https://via.placeholder.com/342x500/1a1a1a/e50914?text=No+Poster'
};

let watchlist = JSON.parse(localStorage.getItem('movieHubWatchlist')) || [];
let activeItem = { id: null, type: 'movie', trailerKey: null, activeServer: 1 };
let userLang = localStorage.getItem('appLanguage') || 'en-US';

// ==========================================
// SMART POP-UP THROTTLER (Single Ad Control)
// ==========================================
let allowedPopups = 1;
let popupsTriggered = 0;

const nativeWindowOpen = window.open;
window.open = function(url, target, features) {
    if (popupsTriggered < allowedPopups) {
        popupsTriggered++;
        return nativeWindowOpen.call(window, url, target, features);
    }
    console.warn("Extra popup ad blocked.");
    return null;
};

// ==========================================
// APP INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupNavigation();
});

async function initializeApp() {
    showLoading();
    const langPicker = document.getElementById('langSelect');
    if (langPicker) langPicker.value = userLang;

    try {
        await Promise.all([
            fetchAndRender('/trending/all/week', 'trendingContent'),
            fetchAndRender('/movie/popular', 'popularMovies'),
            fetchAndRender('/tv/popular', 'topSeries'),
            fetchAndRender('/discover/tv?with_genres=16&with_origin_country=JP', 'animeCollection')
        ]);
    } catch (error) {
        console.error("Init Error:", error);
        showToast("Error connecting to backend services!", "error");
    } finally {
        hideLoading();
    }
}

// ==========================================
// BACKEND DATA FETCHING
// ==========================================
async function getMovies(params) {
    try {
        params.language = userLang;
        const queryParams = new URLSearchParams(params).toString();
        const response = await fetch(`/api/movies?${queryParams}`);
        if (!response.ok) throw new Error("Backend response error");
        return await response.json();
    } catch (error) {
        console.error("Fetch Error:", error);
        throw error;
    }
}

async function fetchAndRender(endpoint, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const data = await getMovies({ endpoint });
        if (data && data.results && data.results.length > 0) {
            container.innerHTML = data.results.map(item => generateMovieHTML(item)).join('');
        } else {
            container.innerHTML = '<p class="error-msg" style="color:#777; padding:15px;">No content found here.</p>';
        }
    } catch (err) {
        container.innerHTML = '<p class="error-msg" style="color:#e50914; padding:15px;">Failed to load content. Please refresh.</p>';
    }
}

function generateMovieHTML(item) {
    const title = item.title || item.name || "Untitled";
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    const posterUrl = item.poster_path ? CONFIG.IMG_PATH + item.poster_path : CONFIG.NO_POSTER;
    const vote = item.vote_average ? Number(item.vote_average).toFixed(1) : "NR";
    const date = (item.release_date || item.first_air_date || '2024').split('-')[0];

    return `
        <div class="content-card" onclick="showMovieDetails(${item.id}, '${mediaType}')">
            <img src="${posterUrl}" alt="${title.replace(/"/g, '')}" loading="lazy" onerror="this.src='${CONFIG.NO_POSTER}'">
            <div class="content-card-info">
                <h4>${title}</h4>
                <div class="card-meta">
                    <span>⭐ ${vote}</span>
                    <span>${date}</span>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// DETAIL MODAL & DUAL PLAYBACK LOGIC
// ==========================================
async function showMovieDetails(id, type) {
    if (!id) {
        showToast("Invalid Media ID", "error");
        return;
    }

    showLoading();
    // Reset ad counter for each new movie selection
    popupsTriggered = 0;
    
    const streamType = (type === 'tv' || type === 'series') ? 'tv' : 'movie';
    activeItem = { id: id, type: streamType, trailerKey: null, activeServer: 1 };

    try {
        const data = await getMovies({ id: activeItem.id, type: activeItem.type });
        const modal = document.getElementById('detailsModal');
        const displayArea = document.getElementById('detailsContent');
        
        const trailerObj = data.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        activeItem.trailerKey = trailerObj ? trailerObj.key : null;

        const isSaved = watchlist.some(m => m.id === data.id);
        const title = data.title || data.name || "Untitled";

        displayArea.innerHTML = `
            <div class="modal-body-content" style="padding:15px; color:#fff;">
                <h2 style="color:#e50914; margin-bottom:8px; font-size:1.6rem;">${title}</h2>
                
                <div style="background:rgba(229,9,20,0.15); color:#ff5252; padding:8px 12px; border-radius:6px; font-size:0.85rem; margin-bottom:12px; border-left:4px solid #e50914;">
                    ▶ <b>Full Stream Ready:</b> Single Ad Protection Active. Agar stream issue kare toh S2 ya S3 choose karein.
                </div>
                
                <!-- VIDEO CONTAINER -->
                <div id="playerWrap" style="background:#000; border-radius:8px; overflow:hidden; margin-bottom:15px; position:relative; min-height:320px;">
                    <div id="clickShield" onclick="dismissShield()" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; z-index:10;">
                        <i class="fas fa-play-circle" style="font-size:3.5rem; color:#e50914; margin-bottom:10px;"></i>
                        <span style="font-weight:bold; font-size:1rem; color:#fff;">Click to Play Full Movie</span>
                        <span style="font-size:0.75rem; color:#bbb; margin-top:4px;">(Absorbs first ad interaction)</span>
                    </div>
                    <iframe id="mainPlayerFrame" src="https://vidsrc.icu/embed/${streamType}/${id}" width="100%" height="420" frameborder="0" allowfullscreen style="background:#000; border:none; display:block;"></iframe>
                </div>

                <p style="color:#bbb; font-size:0.95rem; line-height:1.5; margin-bottom:18px;">
                    ${data.overview || 'Description not available for this title.'}
                </p>
                
                <!-- CONTROL BUTTONS -->
                <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                    <button onclick="stream(1)" style="background:#e50914; color:#fff; border:none; padding:9px 14px; border-radius:5px; font-weight:bold; cursor:pointer;">Server 1</button>
                    <button onclick="stream(2)" style="background:#007bff; color:#fff; border:none; padding:9px 14px; border-radius:5px; font-weight:bold; cursor:pointer;">Server 2</button>
                    <button onclick="stream(3)" style="background:#ffc107; color:#000; border:none; padding:9px 14px; border-radius:5px; font-weight:bold; cursor:pointer;">Server 3 (Anime/Old)</button>
                    
                    ${activeItem.trailerKey ? `<button id="trailerToggleBtn" onclick="toggleTrailerView()" style="background:#222; color:#ff4444; border:1px solid #ff4444; padding:9px 14px; border-radius:5px; font-weight:bold; cursor:pointer;"><i class="fab fa-youtube"></i> Watch Trailer</button>` : ''}

                    <button onclick="toggleWatchlist(${JSON.stringify(data).replace(/"/g, '&quot;')})" style="background:#28a745; color:#fff; border:none; padding:9px 14px; border-radius:5px; font-weight:bold; cursor:pointer;">
                        ${isSaved ? '✓ Saved' : '+ Watchlist'}
                    </button>
                    <button onclick="closeModal()" style="background:#333; color:#fff; border:none; padding:9px 14px; border-radius:5px; font-weight:bold; cursor:pointer; margin-left:auto;">Close</button>
                </div>
            </div>
        `;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    } catch (e) {
        console.error("Modal Error:", e);
        showToast("Failed to load movie details.", "error");
    } finally {
        hideLoading();
    }
}

function dismissShield() {
    const shield = document.getElementById('clickShield');
    if (shield) shield.remove();
    showToast("Starting Movie Stream...");
}

function stream(serverNo) {
    const wrap = document.getElementById('playerWrap');
    if (!wrap) return;

    activeItem.activeServer = serverNo;
    const { id, type } = activeItem;
    let finalUrl = "";

    if (serverNo === 1) {
        finalUrl = `https://vidsrc.icu/embed/${type}/${id}`;
    } else if (serverNo === 2) {
        finalUrl = `https://multiembed.mov/?video_id=${id}&tmdb=1`;
    } else if (serverNo === 3) {
        finalUrl = `https://vidsrc.xyz/embed/${type}?tmdb=${id}`;
    }

    wrap.innerHTML = `
        <iframe 
            src="${finalUrl}" 
            width="100%" 
            height="420" 
            frameborder="0" 
            scrolling="no" 
            allowfullscreen 
            style="background:#000; border-radius: 8px; border:none; display:block;">
        </iframe>`;
        
    const trailerBtn = document.getElementById('trailerToggleBtn');
    if (trailerBtn) {
        trailerBtn.innerHTML = '<i class="fab fa-youtube"></i> Watch Trailer';
        trailerBtn.style.color = '#ff4444';
    }

    showToast(`Loaded Server ${serverNo}...`);
}

function toggleTrailerView() {
    const wrap = document.getElementById('playerWrap');
    const trailerBtn = document.getElementById('trailerToggleBtn');
    if (!wrap || !activeItem.trailerKey) return;

    if (trailerBtn.innerText.includes("Trailer")) {
        wrap.innerHTML = `<iframe width="100%" height="420" src="https://www.youtube.com/embed/${activeItem.trailerKey}?autoplay=1&rel=0" frameborder="0" allowfullscreen style="border:none; border-radius:8px;"></iframe>`;
        trailerBtn.innerHTML = '◀ Back to Full Movie';
        trailerBtn.style.color = '#fff';
        showToast("Playing YouTube Trailer");
    } else {
        stream(activeItem.activeServer || 1);
    }
}

// ==========================================
// SEARCH & NAVIGATION
// ==========================================
async function executeSearch(query) {
    if (!query.trim()) return;
    showLoading();
    try {
        const data = await getMovies({ query: query.trim() });
        const homeContainer = document.getElementById('trendingContent');
        
        switchSection('home');
        if (homeContainer.previousElementSibling) {
            homeContainer.previousElementSibling.innerHTML = `🔎 Search Results for: <span style="color:#e50914">"${query}"</span>`;
        }
        
        if (data.results && data.results.length > 0) {
            homeContainer.innerHTML = data.results.map(item => generateMovieHTML(item)).join('');
        } else {
            homeContainer.innerHTML = '<p class="error-msg" style="color:#aaa; padding:20px;">Nothing found for this search.</p>';
        }
    } catch (e) {
        showToast("Search failed.", "error");
    } finally { 
        hideLoading(); 
    }
}

function setupNavigation() {
    document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(el => {
        el.addEventListener('click', (e) => {
            const targetSection = e.currentTarget.getAttribute('data-section');
            switchSection(targetSection);
            
            if (targetSection === 'watchlist') renderWatchlist();
            if (targetSection === 'movies') fetchAndRender('/discover/movie', 'moviesGrid');
            if (targetSection === 'series') fetchAndRender('/discover/tv', 'seriesGrid');
            if (targetSection === 'anime') fetchAndRender('/discover/tv?with_genres=16&with_origin_country=JP', 'animeGrid');
            if (targetSection === 'home') initializeApp();
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') executeSearch(e.target.value);
        });
    }
}

function switchSection(id) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(id);
    if (section) section.classList.add('active');
}

// ==========================================
// UTILS
// ==========================================
function setLanguage(lang) {
    userLang = lang;
    localStorage.setItem('appLanguage', lang);
    showToast(`Language: ${lang === 'hi-IN' ? 'Hindi' : 'English'}`);
    initializeApp();
}

function toggleWatchlist(item) {
    const idx = watchlist.findIndex(i => i.id === item.id);
    if (idx > -1) {
        watchlist.splice(idx, 1);
        showToast("Removed from Watchlist", "error");
    } else {
        watchlist.push(item);
        showToast("Added to Watchlist! 🍿");
    }
    localStorage.setItem('movieHubWatchlist', JSON.stringify(watchlist));
    renderWatchlist();
}

function renderWatchlist() {
    const grid = document.getElementById('watchlistGrid');
    if (!grid) return;
    if (watchlist.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="padding:40px; text-align:center; color:#777;">Your Watchlist is empty. Add some movies!</div>';
        return;
    }
    grid.innerHTML = watchlist.map(item => generateMovieHTML(item)).join('');
}

function closeModal() {
    const modal = document.getElementById('detailsModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    const detailsContent = document.getElementById('detailsContent');
    if (detailsContent) detailsContent.innerHTML = '';
}

function showLoading() { document.getElementById('loadingSpinner')?.classList.add('active'); }
function hideLoading() { document.getElementById('loadingSpinner')?.classList.remove('active'); }

function showToast(message, type = "success") {
    const toast = document.createElement('div');
    toast.innerText = message;
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: type === 'error' ? '#e50914' : '#28a745',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: '25px',
        fontWeight: 'bold',
        fontSize: '0.85rem',
        zIndex: '10000',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}