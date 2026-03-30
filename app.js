// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const CONFIG = {
    TMDB_IMAGE_BASE: 'https://image.tmdb.org/t/p/w342',
    FALLBACK_POSTER: 'https://via.placeholder.com/342x500/1a1a1a/e50914?text=No+Poster+Available'
};

let watchlist = JSON.parse(localStorage.getItem('movieHubWatchlist')) || [];
let currentMovie = { id: null, type: null };

// ==========================================
// 2. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadHomeContent();
    setupEventListeners();
});

// ==========================================
// 3. BACKEND FETCH LOGIC (VPN BYPASS)
// ==========================================
async function fetchFromBackend(params) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const res = await fetch(`/api/movies?${queryString}`);
        if (!res.ok) throw new Error('Network response was not ok');
        return await res.json();
    } catch (error) {
        console.error("Fetch Error:", error);
        showToast("Connection error. Please refresh.", "error");
        return { results: [] };
    }
}

// ==========================================
// 4. CONTENT LOADING
// ==========================================
async function loadHomeContent() {
    showLoading();
    try {
        await Promise.all([
            renderSection('/trending/all/week', 'trendingContent'),
            renderSection('/movie/popular', 'popularMovies'),
            renderSection('/tv/popular', 'topSeries'),
            renderSection('/discover/tv?with_genres=16&with_origin_country=JP', 'animeCollection')
        ]);
    } catch(err) { 
        console.error(err); 
    } finally { 
        hideLoading(); 
    }
}

async function renderSection(endpoint, containerId) {
    const data = await fetchFromBackend({ endpoint });
    const container = document.getElementById(containerId);
    if (container) {
        if (data.results && data.results.length > 0) {
            container.innerHTML = data.results.map(item => createCard(item)).join('');
        } else {
            container.innerHTML = `<p style="color:#777; padding:20px;">Content unavailable right now.</p>`;
        }
    }
}

// ==========================================
// 5. UI COMPONENTS (CARDS)
// ==========================================
function createCard(item) {
    const title = item.title || item.name || "Unknown Title";
    const type = item.type || (item.title ? 'movie' : 'tv');
    const poster = item.poster_path ? CONFIG.TMDB_IMAGE_BASE + item.poster_path : CONFIG.FALLBACK_POSTER;
    const rating = (item.vote_average && item.vote_average > 0) ? parseFloat(item.vote_average).toFixed(1) : "NR";
    const year = (item.release_date || item.first_air_date || '').split('-')[0] || "TBA";

    return `
        <div class="content-card" onclick="viewDetails(${item.id}, '${type}')">
            <img src="${poster}" alt="${title.replace(/"/g, '')}" loading="lazy">
            <div class="content-card-info">
                <h4>${title}</h4>
                <div class="card-meta">
                    <span class="rating">⭐ ${rating}</span>
                    <span class="year">${year}</span>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// 6. SEARCH LOGIC
// ==========================================
async function searchMovies(query) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    
    showLoading();
    try {
        const data = await fetchFromBackend({ query: trimmedQuery });
        const container = document.getElementById('trendingContent'); 
        
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById('home').classList.add('active');
        
        container.previousElementSibling.innerHTML = `🔎 Search Results for: <span style="color:#e50914">"${trimmedQuery}"</span>`;
        
        if(data.results && data.results.length > 0) {
            const filteredResults = data.results.filter(item => item.media_type !== 'person');
            container.innerHTML = filteredResults.map(item => createCard(item)).join('');
        } else {
            container.innerHTML = `<p style="color:#aaa; padding: 20px;">No results found for "${trimmedQuery}".</p>`;
        }
    } catch(e) { 
        console.error(e); showToast("Search failed.", "error");
    } finally { hideLoading(); }
}

// ==========================================
// 7. MODAL & DETAILED VIEW (WITH PRO WARNING)
// ==========================================
async function viewDetails(id, type) {
    showLoading();
    currentMovie = { id, type }; 
    
    try {
        const data = await fetchFromBackend({ id, type });
        const modal = document.getElementById('detailsModal');
        const content = document.getElementById('detailsContent');
        
        const trailer = data.videos?.results.find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key;
        const title = data.title || data.name || "Details";
        const safeTitle = title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const releaseStr = data.release_date || data.first_air_date || '';
        const isListed = watchlist.some(i => i.id === data.id);
        const overview = data.overview || 'Plot summary is not available for this title.';

        content.innerHTML = `
            <div class="modal-body" style="animation: fadeIn 0.3s ease;">
                <h2 style="color:#e50914; font-size: 1.8rem; margin-bottom: 5px;">${title}</h2>
                <p style="color:#888; margin-bottom: 15px; font-size: 0.9rem;">
                    ${releaseStr.split('-')[0] || 'TBA'} • ⭐ ${data.vote_average ? data.vote_average.toFixed(1) : 'NR'} 
                </p>
                
                <div style="background: rgba(255, 193, 7, 0.1); color: #ffc107; padding: 12px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 15px; border: 1px solid rgba(255, 193, 7, 0.3); display: flex; align-items: flex-start; gap: 10px; line-height: 1.4;">
                    <i class="fas fa-shield-alt" style="font-size: 1.4rem; margin-top: 2px;"></i> 
                    <div>
                        <strong style="display: block; font-size: 0.95rem; margin-bottom: 3px;">Ad-Free Experience Tip</strong>
                        This is a free streaming server. For the best experience without pop-up ads, we recommend using <b>Brave Browser</b> or an Ad-Blocker extension. If a new tab opens, close it and return here.
                    </div>
                </div>

                <div id="playerWrap" style="margin:15px 0; background:#000; min-height:250px; border-radius:10px; overflow:hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                    ${trailer ? `<iframe width="100%" height="300" src="https://www.youtube.com/embed/${trailer}?autoplay=0&rel=0" frameborder="0" allowfullscreen></iframe>` : `<div style="padding:100px 20px; text-align:center; color:#777;"><i class="fas fa-video-slash fa-3x"></i><p style="margin-top:10px;">Trailer not available</p></div>`}
                </div>
                
                <p style="color:#ddd; line-height:1.5; margin-bottom:25px; font-size:1rem;">${overview}</p>
                
                <div style="display:flex; gap:12px; flex-wrap: wrap; align-items: center;">
                    <button class="btn" onclick="startStreaming(1)" style="background:#e50914; color:white; padding:12px 20px; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                        <i class="fas fa-play"></i> Watch Server 1
                    </button>
                    <button class="btn" onclick="startStreaming(2)" style="background:#007bff; color:white; padding:12px 20px; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                        <i class="fas fa-server"></i> Server 2
                    </button>
                    <button id="watchlistBtn" class="btn" onclick="toggleWatchlist(${data.id}, '${safeTitle}', '${data.poster_path || ''}', ${data.vote_average || 0}, '${releaseStr}', '${type}')" style="background:${isListed ? '#28a745' : '#444'}; color:white; padding:12px 20px; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                        <i class="fas fa-${isListed ? 'check' : 'plus'}"></i> ${isListed ? 'In Watchlist' : 'Watchlist'}
                    </button>
                </div>
            </div>
        `;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; 
    } catch(e) { 
        console.error(e); showToast("Could not load details.", "error");
    } finally { hideLoading(); }
}

function startStreaming(serverNum) {
    const wrap = document.getElementById('playerWrap');
    const { id, type } = currentMovie;
    
    let url = "";
    if (serverNum === 1) {
        url = type === 'movie' ? `https://vidsrc.me/embed/movie?tmdb=${id}` : `https://vidsrc.me/embed/tv?tmdb=${id}`;
        showToast("Starting Server 1...", "success");
    } else {
        url = type === 'movie' ? `https://vidsrc.in/embed/movie?tmdb=${id}` : `https://vidsrc.in/embed/tv?tmdb=${id}`;
        showToast("Switched to Server 2...", "success");
    }
    
    wrap.innerHTML = `<iframe src="${url}" width="100%" height="400" frameborder="0" allowfullscreen style="background:#000;"></iframe>`;
}

// ==========================================
// 8. WATCHLIST MANAGEMENT
// ==========================================
function toggleWatchlist(id, title, poster_path, vote_average, release_date, type) {
    const index = watchlist.findIndex(item => item.id === id);
    if (index > -1) {
        watchlist.splice(index, 1);
        showToast(`Removed from Watchlist`, "error");
    } else {
        watchlist.push({ id, title, poster_path, vote_average, release_date, type });
        showToast(`Added to Watchlist 🍿`, "success");
    }
    
    localStorage.setItem('movieHubWatchlist', JSON.stringify(watchlist));
    
    const btn = document.getElementById('watchlistBtn');
    if(btn) {
        const isListed = watchlist.some(i => i.id === id);
        btn.innerHTML = `<i class="fas fa-${isListed ? 'check' : 'plus'}"></i> ${isListed ? 'In Watchlist' : 'Watchlist'}`;
        btn.style.background = isListed ? '#28a745' : '#444';
    }
    if(document.getElementById('watchlist').classList.contains('active')) renderWatchlist();
}

function renderWatchlist() {
    const container = document.getElementById('watchlistGrid');
    if(watchlist.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 50px 20px; grid-column: 1 / -1;"><i class="fas fa-film fa-3x" style="color:#444; margin-bottom:15px;"></i><h3 style="color:#aaa;">Your Watchlist is empty</h3></div>`;
        return;
    }
    container.innerHTML = [...watchlist].reverse().map(item => createCard(item)).join('');
}

// ==========================================
// 9. EVENT LISTENERS & UTILS
// ==========================================
function setupEventListeners() {
    document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = e.currentTarget.getAttribute('data-section');
            
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');
            
            document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(l => l.classList.remove('active'));
            document.querySelectorAll(`[data-section="${sectionId}"]`).forEach(el => el.classList.add('active'));

            if(sectionId === 'movies') renderSection('/discover/movie', 'moviesGrid');
            if(sectionId === 'series') renderSection('/discover/tv', 'seriesGrid');
            if(sectionId === 'anime') renderSection('/discover/tv?with_genres=16&with_origin_country=JP', 'animeGrid');
            if(sectionId === 'home') loadHomeContent();
            if(sectionId === 'watchlist') renderWatchlist();
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { searchMovies(e.target.value); searchInput.blur(); }
        });
    }

    const voiceBtn = document.getElementById('voiceSearch');
    if (voiceBtn && searchInput) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            voiceBtn.addEventListener('click', () => { recognition.start(); searchInput.placeholder = "Listening... 🎤"; voiceBtn.style.color = "#e50914"; });
            recognition.onresult = (e) => {
                const transcript = e.results[0][0].transcript;
                searchInput.value = transcript; searchInput.placeholder = "Search..."; voiceBtn.style.color = "white";
                if(transcript.trim().length > 0) searchMovies(transcript);
            };
            recognition.onerror = () => { searchInput.placeholder = "Search..."; voiceBtn.style.color = "white"; showToast("Voice search failed.", "error"); };
        } else { voiceBtn.style.display = 'none'; }
    }

    const modal = document.getElementById('detailsModal');
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('active')) closeModal(); });
}

function closeModal() { 
    const modal = document.getElementById('detailsModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto'; 
    setTimeout(() => { document.getElementById('detailsContent').innerHTML = ''; currentMovie = { id: null, type: null }; }, 300);
}

function showLoading() { document.getElementById('loadingSpinner')?.classList.add('active'); }
function hideLoading() { document.getElementById('loadingSpinner')?.classList.remove('active'); }

function showToast(message, type = "success") {
    const existingToast = document.getElementById('custom-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'custom-toast';
    toast.innerText = message;
    
    Object.assign(toast.style, {
        position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
        backgroundColor: type === 'success' ? '#28a745' : '#dc3545', color: 'white',
        padding: '10px 20px', borderRadius: '30px', fontSize: '0.9rem', fontWeight: 'bold',
        zIndex: '10000', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', opacity: '0',
        transition: 'opacity 0.3s ease, bottom 0.3s ease'
    });

    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '1'; toast.style.bottom = '90px'; }, 10);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.bottom = '80px'; setTimeout(() => toast.remove(), 300); }, 3000);
}