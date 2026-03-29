const CONFIG = {
    TMDB_API_KEY: '5d6a8fd4550ba2aebf6a13d76d6be02c', 
    TMDB_BASE_URL: 'https://api.themoviedb.org/3',
    TMDB_IMAGE_BASE: 'https://image.tmdb.org/t/p/w342'
};

// Watchlist Array (Browser ke local storage se fetch karega)
let watchlist = JSON.parse(localStorage.getItem('movieHubWatchlist')) || [];

// ==========================================
// 1. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadHomeContent();
    setupEventListeners();
});

// ==========================================
// 2. HOME CONTENT FETCHING
// ==========================================
async function loadHomeContent() {
    showLoading();
    try {
         await Promise.all([
            fetchAndDisplay('/trending/all/week', 'trendingContent'),
            fetchAndDisplay('/movie/popular', 'popularMovies'),
            fetchAndDisplay('/tv/popular', 'topSeries'),
            fetchAndDisplay('/discover/tv?with_genres=16&with_origin_country=JP', 'animeCollection')
        ]);
    } catch(err) { console.error(err); }
    finally { hideLoading(); }
}

async function fetchAndDisplay(endpoint, containerId) {
    try {
        const url = `${CONFIG.TMDB_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${CONFIG.TMDB_API_KEY}&language=en-US`;
        const res = await fetch(url);
        const data = await res.json();
        const container = document.getElementById(containerId);
        if (container && data.results) {
            container.innerHTML = data.results.map(item => createCard(item)).join('');
        }
    } catch (e) { console.error(e); }
}

// ==========================================
// 3. UI CARD CREATION
// ==========================================
function createCard(item) {
    const title = item.title || item.name;
    const type = item.type || (item.title ? 'movie' : 'tv');
    const poster = item.poster_path ? CONFIG.TMDB_IMAGE_BASE + item.poster_path : 'https://via.placeholder.com/342x500?text=No+Image';
    const rating = item.vote_average ? parseFloat(item.vote_average).toFixed(1) : "N/A";
    const releaseDate = (item.release_date || item.first_air_date || '2024').split('-')[0];

    return `
        <div class="content-card" onclick="viewDetails(${item.id}, '${type}')">
            <img src="${poster}" alt="${title}">
            <div class="content-card-info">
                <h4>${title}</h4>
                <div class="card-meta">
                    <span class="rating">⭐ ${rating}</span>
                    <span class="year">${releaseDate}</span>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// 4. SEARCH & NAVIGATION LOGIC
// ==========================================
async function searchMovies(query) {
    if (!query) return;
    showLoading();
    try {
        const url = `${CONFIG.TMDB_BASE_URL}/search/multi?api_key=${CONFIG.TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US`;
        const res = await fetch(url);
        const data = await res.json();
        
        const container = document.getElementById('trendingContent');
        
        if(data.results && data.results.length > 0) {
            container.innerHTML = data.results.map(item => createCard(item)).join('');
            
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.getElementById('home').classList.add('active');
            
            container.previousElementSibling.innerHTML = `🔎 Search Results for: "${query}"`;
        } else {
            container.innerHTML = `<p style="color:white; padding: 20px;">No results found for "${query}"</p>`;
        }
    } catch(e) { console.error(e); }
    finally { hideLoading(); }
}

function setupEventListeners() {
    document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = e.currentTarget.getAttribute('data-section');
            
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');
            
            document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');

            if(sectionId === 'movies') fetchAndDisplay('/discover/movie', 'moviesGrid');
            if(sectionId === 'series') fetchAndDisplay('/discover/tv', 'seriesGrid');
            if(sectionId === 'anime') fetchAndDisplay('/discover/tv?with_genres=16&with_origin_country=JP', 'animeGrid');
            if(sectionId === 'home') loadHomeContent();
            if(sectionId === 'watchlist') renderWatchlist(); 
        });
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.value.trim().length > 1) {
                searchMovies(e.target.value);
            }
        });
    }

    const voiceBtn = document.getElementById('voiceSearch');
    if (voiceBtn && searchInput) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'en-US'; 
            recognition.interimResults = false;

            voiceBtn.addEventListener('click', () => {
                recognition.start();
                voiceBtn.classList.add('recording');
                searchInput.placeholder = "Listening... Speak now...";
            });

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                searchInput.value = transcript;
                voiceBtn.classList.remove('recording');
                searchInput.placeholder = "Search movies, series, anime...";
                
                if(transcript.trim().length > 0) searchMovies(transcript); 
            };

            recognition.onerror = () => {
                voiceBtn.classList.remove('recording');
                searchInput.placeholder = "Try again...";
            };
        } else {
            voiceBtn.style.display = 'none';
        }
    }
}

// ==========================================
// 5. WATCHLIST LOGIC
// ==========================================
function toggleWatchlist(id, title, poster_path, vote_average, release_date, type) {
    const index = watchlist.findIndex(item => item.id === id);
    
    if (index > -1) {
        watchlist.splice(index, 1); 
        alert(`"${title}" removed from your Watchlist!`);
    } else {
        watchlist.push({ id, title, poster_path, vote_average, release_date, type });
        alert(`"${title}" added to your Watchlist! 🍿`);
    }
    
    localStorage.setItem('movieHubWatchlist', JSON.stringify(watchlist));
    
    const btn = document.getElementById('watchlistBtn');
    if(btn) {
        const isListed = watchlist.some(i => i.id === id);
        btn.innerHTML = isListed ? '<i class="fas fa-check"></i> In Watchlist' : '<i class="fas fa-plus"></i> Add to Watchlist';
        btn.style.background = isListed ? '#28a745' : '#444';
    }

    if(document.getElementById('watchlist').classList.contains('active')) {
        renderWatchlist();
    }
}

function renderWatchlist() {
    const container = document.getElementById('watchlistGrid');
    if(watchlist.length === 0) {
        container.innerHTML = '<p style="color:#ccc; font-size:1.2rem; padding: 20px;">Your Watchlist is empty. Go add some movies! 🎬</p>';
        return;
    }
    container.innerHTML = watchlist.map(item => createCard(item)).join('');
}

// ==========================================
// 6. MODAL & STREAMING LOGIC (WITH POP-UP BLOCKER)
// ==========================================
async function viewDetails(id, type) {
    showLoading();
    try {
        const res = await fetch(`${CONFIG.TMDB_BASE_URL}/${type}/${id}?api_key=${CONFIG.TMDB_API_KEY}&append_to_response=videos&language=en-US`);
        const data = await res.json();
        
        const modal = document.getElementById('detailsModal');
        const content = document.getElementById('detailsContent');
        const trailer = data.videos?.results.find(v => v.type === 'Trailer')?.key;
        
        const safeTitle = (data.title || data.name).replace(/'/g, "\\'");
        const releaseStr = (data.release_date || data.first_air_date || '2024');
        const isListed = watchlist.some(i => i.id === data.id);

        content.innerHTML = `
            <div class="modal-body">
                <h2 style="color:#e50914; margin-bottom:10px;">${data.title || data.name}</h2>
                <div id="playerWrap" style="margin:15px 0; background:#000; min-height:250px; border-radius:10px; overflow:hidden;">
                    ${trailer ? `<iframe width="100%" height="300" src="https://www.youtube.com/embed/${trailer}?autoplay=0" frameborder="0" allowfullscreen></iframe>` : '<p style="padding:100px; text-align:center; color:white;">Trailer not available</p>'}
                </div>
                <p style="color:#ccc; line-height:1.4; margin-bottom:20px;">${data.overview || 'Description not available.'}</p>
                <div style="display:flex; gap:10px; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="startStreaming('${id}', '${type}')" style="background:#e50914; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">
                        <i class="fas fa-play"></i> Watch Full Movie
                    </button>
                    <button id="watchlistBtn" class="btn btn-secondary" onclick="toggleWatchlist(${data.id}, '${safeTitle}', '${data.poster_path}', ${data.vote_average || 0}, '${releaseStr}', '${type}')" style="background:${isListed ? '#28a745' : '#444'}; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">
                        <i class="fas fa-${isListed ? 'check' : 'plus'}"></i> ${isListed ? 'In Watchlist' : 'Add to Watchlist'}
                    </button>
                    <button class="btn btn-secondary" onclick="closeModal()" style="background:#333; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;
        modal.classList.add('active');
    } catch(e) { console.error("Error loading details: ", e); } 
    finally { hideLoading(); }
}

function startStreaming(id, type) {
    const wrap = document.getElementById('playerWrap');
    const url = type === 'movie' ? `https://vidsrc.me/embed/movie?tmdb=${id}` : `https://vidsrc.me/embed/tv?tmdb=${id}`;
    
    // 🔥 YAHAN HAIN ASLI MAGIC: sandbox attribute lagaya hai pop-ups rokne ke liye
    wrap.innerHTML = `<iframe src="${url}" width="100%" height="400" frameborder="0" scrolling="no" allowfullscreen sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>`;
}

// ==========================================
// 7. HELPER FUNCTIONS
// ==========================================
function closeModal() { 
    const modal = document.getElementById('detailsModal');
    modal.classList.remove('active');
    setTimeout(() => { document.getElementById('detailsContent').innerHTML = ''; }, 300);
}
function showLoading() { document.getElementById('loadingSpinner')?.classList.add('active'); }
function hideLoading() { document.getElementById('loadingSpinner')?.classList.remove('active'); }