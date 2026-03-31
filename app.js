// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
const CONFIG = {
    IMG_PATH: 'https://image.tmdb.org/t/p/w342',
    NO_POSTER: 'https://via.placeholder.com/342x500/1a1a1a/e50914?text=No+Poster'
};

let watchlist = JSON.parse(localStorage.getItem('movieHubWatchlist')) || [];
let activeItem = { id: null, type: null }; // Track for streaming
let userLang = localStorage.getItem('appLanguage') || 'en-US';

// ==========================================
// APP INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupNavigation();
});

async function initializeApp() {
    showLoading();
    // Set Language dropdown to saved value
    const langPicker = document.getElementById('langSelect');
    if(langPicker) langPicker.value = userLang;

    try {
        // Parallel Loading for speed
        await Promise.all([
            fetchAndRender('/trending/all/week', 'trendingContent'),
            fetchAndRender('/movie/popular', 'popularMovies'),
            fetchAndRender('/tv/popular', 'topSeries'),
            fetchAndRender('/discover/tv?with_genres=16&with_origin_country=JP', 'animeCollection')
        ]);
    } catch (error) {
        console.error("Init Error:", error);
        showToast("Error connecting to backend!", "error");
    } finally {
        hideLoading();
    }
}

// ==========================================
// CORE DATA FETCHING (Backend Bridge)
// ==========================================
async function getMovies(params) {
    params.language = userLang;
    const searchParams = new URLSearchParams(params).toString();
    const response = await fetch(`/api/movies?${searchParams}`);
    if (!response.ok) throw new Error("Backend response error");
    return await response.json();
}

async function fetchAndRender(endpoint, containerId) {
    const data = await getMovies({ endpoint });
    const container = document.getElementById(containerId);
    if (container && data.results) {
        if (data.results.length === 0) {
            container.innerHTML = '<p class="error-msg">No content found here.</p>';
            return;
        }
        container.innerHTML = data.results.map(item => generateMovieHTML(item)).join('');
    }
}

function generateMovieHTML(item) {
    const title = item.title || item.name || "Untitled";
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    const posterUrl = item.poster_path ? CONFIG.IMG_PATH + item.poster_path : CONFIG.NO_POSTER;
    const vote = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
    const date = (item.release_date || item.first_air_date || '2024').split('-')[0];

    return `
        <div class="content-card" onclick="showMovieDetails(${item.id}, '${mediaType}')">
            <img src="${posterUrl}" alt="${title}" loading="lazy">
            <div class="content-card-info">
                <h4>${title}</h4>
                <div class="card-meta">
                    <span><i class="fas fa-star"></i> ${vote}</span>
                    <span>${date}</span>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// DETAIL MODAL & PLAYER (SHINCHAN FIX)
// ==========================================
async function showMovieDetails(id, type) {
    showLoading();
    activeItem = { id, type };
    try {
        const data = await getMovies({ id, type });
        const modal = document.getElementById('detailsModal');
        const displayArea = document.getElementById('detailsContent');
        const trailerKey = data.videos?.results.find(v => v.type === 'Trailer')?.key;
        const isSaved = watchlist.some(m => m.id === data.id);

        displayArea.innerHTML = `
            <div class="modal-body-content">
                <h2 class="modal-title">${data.title || data.name}</h2>
                <div class="server-warning">
                    <i class="fas fa-info-circle"></i> 
                    <b>Note:</b> If S1 or S2 shows "Unavailable" (especially for old Anime), try <b>Server 3</b>.
                </div>
                
                <div id="playerWrap" class="video-container">
                    ${trailerKey ? `<iframe width="100%" height="350" src="https://www.youtube.com/embed/${trailerKey}?rel=0" frameborder="0" allowfullscreen></iframe>` : '<div class="no-trailer">Trailer not found on YouTube. Click a Server below to watch.</div>'}
                </div>

                <p class="modal-overview">${data.overview || 'Description not available for this title.'}</p>
                
                <div class="action-buttons">
                    <button class="play-btn s1" onclick="stream(1)">S1</button>
                    <button class="play-btn s2" onclick="stream(2)">S2</button>
                    <button class="play-btn s3" onclick="stream(3)">S3 (Anime Spec)</button>
                    <button class="watchlist-btn" onclick="toggleWatchlist(${JSON.stringify(data).replace(/"/g, '&quot;')})">
                        ${isSaved ? '<i class="fas fa-check"></i> Saved' : '<i class="fas fa-plus"></i> Watchlist'}
                    </button>
                    <button class="close-btn-mod" onclick="closeModal()">Close</button>
                </div>
            </div>
        `;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    } catch (e) {
        showToast("Failed to load details.", "error");
    } finally {
        hideLoading();
    }
}

function stream(serverNo) {
    const wrap = document.getElementById('playerWrap');
    const { id, type } = activeItem;
    let finalUrl = "";

    if (serverNo === 1) finalUrl = `https://vidsrc.me/embed/${type}?tmdb=${id}`;
    else if (serverNo === 2) finalUrl = `https://vidsrc.in/embed/${type}?tmdb=${id}`;
    else finalUrl = `https://vidsrc.xyz/embed/${type}?tmdb=${id}`;

    wrap.innerHTML = `<iframe src="${finalUrl}" width="100%" height="450" frameborder="0" allowfullscreen style="background:#000;"></iframe>`;
    showToast(`Loading Server ${serverNo}... Please wait.`);
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
        
        // Reset view to Home
        switchSection('home');
        homeContainer.previousElementSibling.innerHTML = `🔎 Results for: <span style="color:#e50914">"${query}"</span>`;
        
        if (data.results && data.results.length > 0) {
            homeContainer.innerHTML = data.results.map(item => generateMovieHTML(item)).join('');
        } else {
            homeContainer.innerHTML = '<p class="error-msg">Nothing found for this search.</p>';
        }
    } finally { hideLoading(); }
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
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    const searchInput = document.getElementById('searchInput');
    if(searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') executeSearch(e.target.value);
        });
    }
}

function switchSection(id) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(id);
    if(section) section.classList.add('active');
}

// ==========================================
// UTILS (Language, Watchlist, UI)
// ==========================================
function setLanguage(lang) {
    userLang = lang;
    localStorage.setItem('appLanguage', lang);
    showToast(`Language: ${lang === 'hi-IN' ? 'Hindi' : 'English'}`);
    initializeApp(); // Reload everything in new language
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
    if (watchlist.length === 0) {
        grid.innerHTML = '<div class="empty-state">Your Watchlist is empty. Add some movies!</div>';
        return;
    }
    grid.innerHTML = watchlist.map(item => generateMovieHTML(item)).join('');
}

function closeModal() {
    document.getElementById('detailsModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    document.getElementById('detailsContent').innerHTML = ''; // Stop video playback
}

function showLoading() { document.getElementById('loadingSpinner')?.classList.add('active'); }
function hideLoading() { document.getElementById('loadingSpinner')?.classList.remove('active'); }

function showToast(message, type = "success") {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}