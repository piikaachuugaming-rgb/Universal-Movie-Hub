// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
const CONFIG = {
    API_KEY: 'f0da50d7b0c16984ccab202db5b1a2b1', // Stable working key
    BASE_URL: 'https://api.themoviedb.org/3',
    IMG_PATH: 'https://image.tmdb.org/t/p/w342',
    NO_POSTER: 'https://via.placeholder.com/342x500/1a1a1a/e50914?text=No+Poster'
};

let watchlist = JSON.parse(localStorage.getItem('movieHubWatchlist')) || [];
let activeItem = { id: null, type: 'movie' };
let userLang = localStorage.getItem('appLanguage') || 'en-US';

// ==========================================
// INITIALIZATION
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
    } finally {
        hideLoading();
    }
}

// ==========================================
// CORE DATA FETCHING (DIRECT TMDB)
// ==========================================
async function getMovies(params) {
    let url = "";

    if (params.id && params.type) {
        url = `${CONFIG.BASE_URL}/${params.type}/${params.id}?api_key=${CONFIG.API_KEY}&append_to_response=videos&language=${userLang}`;
    } else if (params.query) {
        url = `${CONFIG.BASE_URL}/search/multi?api_key=${CONFIG.API_KEY}&query=${encodeURIComponent(params.query)}&language=${userLang}`;
    } else if (params.endpoint) {
        const joiner = params.endpoint.includes('?') ? '&' : '?';
        url = `${CONFIG.BASE_URL}${params.endpoint}${joiner}api_key=${CONFIG.API_KEY}&language=${userLang}`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error("TMDB Fetch Failed");
    return await response.json();
}

async function fetchAndRender(endpoint, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const data = await getMovies({ endpoint });
        if (data && data.results && data.results.length > 0) {
            container.innerHTML = data.results.map(item => generateMovieHTML(item)).join('');
        } else {
            container.innerHTML = '<p style="color:#777; padding:15px;">No content found.</p>';
        }
    } catch (err) {
        container.innerHTML = '<p style="color:#e50914; padding:15px;">Failed to load. Refresh page.</p>';
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
// DETAILS & STREAMING MODAL
// ==========================================
async function showMovieDetails(id, type) {
    if (!id) return;
    showLoading();

    const streamType = (type === 'tv' || type === 'series') ? 'tv' : 'movie';
    activeItem = { id: id, type: streamType };

    try {
        const data = await getMovies({ id: activeItem.id, type: activeItem.type });
        const modal = document.getElementById('detailsModal');
        const displayArea = document.getElementById('detailsContent');
        const isSaved = watchlist.some(m => m.id === data.id);
        const title = data.title || data.name || "Untitled";

        const streamUrl = `https://vidsrc.me/embed/${streamType}?tmdb=${id}`;

        displayArea.innerHTML = `
            <div class="modal-body-content" style="padding:15px; color:#fff;">
                <h2 style="color:#e50914; margin-bottom:8px; font-size:1.6rem;">${title}</h2>
                
                <div id="playerWrap" style="background:#000; border-radius:8px; overflow:hidden; margin-bottom:15px; min-height:300px;">
                    <iframe src="${streamUrl}" width="100%" height="420" frameborder="0" scrolling="no" allowfullscreen style="background:#000; border:none; display:block;"></iframe>
                </div>

                <p style="color:#bbb; font-size:0.95rem; line-height:1.5; margin-bottom:18px;">
                    ${data.overview || 'Description not available for this title.'}
                </p>
                
                <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                    <button onclick="stream(1)" style="background:#e50914; color:#fff; border:none; padding:9px 14px; border-radius:5px; font-weight:bold; cursor:pointer;">Server 1</button>
                    <button onclick="stream(2)" style="background:#007bff; color:#fff; border:none; padding:9px 14px; border-radius:5px; font-weight:bold; cursor:pointer;">Server 2</button>
                    <button onclick="stream(3)" style="background:#ffc107; color:#000; border:none; padding:9px 14px; border-radius:5px; font-weight:bold; cursor:pointer;">Server 3 (Anime)</button>

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
        showToast("Failed to load details.", "error");
    } finally {
        hideLoading();
    }
}

function stream(serverNo) {
    const wrap = document.getElementById('playerWrap');
    if (!wrap) return;

    const { id, type } = activeItem;
    let finalUrl = "";

    if (serverNo === 1) finalUrl = `https://vidsrc.me/embed/${type}?tmdb=${id}`;
    else if (serverNo === 2) finalUrl = `https://vidsrc.cc/v2/embed/${type}/${id}`;
    else finalUrl = `https://vidsrc.xyz/embed/${type}?tmdb=${id}`;

    wrap.innerHTML = `<iframe src="${finalUrl}" width="100%" height="420" frameborder="0" scrolling="no" allowfullscreen style="background:#000; border-radius: 8px; border:none; display:block;"></iframe>`;
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
            homeContainer.innerHTML = '<p style="color:#aaa; padding:20px;">Nothing found for this search.</p>';
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

function setLanguage(lang) {
    userLang = lang;
    localStorage.setItem('appLanguage', lang);
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
        grid.innerHTML = '<div style="padding:40px; text-align:center; color:#777;">Your Watchlist is empty. Add some movies!</div>';
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