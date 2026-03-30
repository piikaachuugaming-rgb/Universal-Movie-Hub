const CONFIG = {
    TMDB_IMAGE_BASE: 'https://image.tmdb.org/t/p/w342'
};

let watchlist = JSON.parse(localStorage.getItem('movieHubWatchlist')) || [];

document.addEventListener('DOMContentLoaded', () => {
    loadHomeContent();
    setupEventListeners();
});

// ==========================================
// BACKEND FETCH LOGIC (VPN Bypass)
// ==========================================
async function fetchFromBackend(params) {
    const queryString = new URLSearchParams(params).toString();
    const res = await fetch(`/api/movies?${queryString}`);
    return await res.json();
}

async function loadHomeContent() {
    showLoading();
    try {
        await Promise.all([
            renderSection('/trending/all/week', 'trendingContent'),
            renderSection('/movie/popular', 'popularMovies'),
            renderSection('/tv/popular', 'topSeries'),
            renderSection('/discover/tv?with_genres=16&with_origin_country=JP', 'animeCollection')
        ]);
    } catch(err) { console.error(err); }
    finally { hideLoading(); }
}

async function renderSection(endpoint, containerId) {
    const data = await fetchFromBackend({ endpoint });
    const container = document.getElementById(containerId);
    if (container && data.results) {
        container.innerHTML = data.results.map(item => createCard(item)).join('');
    }
}

function createCard(item) {
    const title = item.title || item.name;
    const type = item.type || (item.title ? 'movie' : 'tv');
    const poster = item.poster_path ? CONFIG.TMDB_IMAGE_BASE + item.poster_path : 'https://via.placeholder.com/342x500?text=No+Image';
    const rating = item.vote_average ? parseFloat(item.vote_average).toFixed(1) : "N/A";
    const year = (item.release_date || item.first_air_date || '2024').split('-')[0];

    return `
        <div class="content-card" onclick="viewDetails(${item.id}, '${type}')">
            <img src="${poster}" alt="${title}">
            <div class="content-card-info">
                <h4>${title}</h4>
                <div class="card-meta"><span>⭐ ${rating}</span><span>${year}</span></div>
            </div>
        </div>
    `;
}

async function searchMovies(query) {
    if (!query) return;
    showLoading();
    try {
        const data = await fetchFromBackend({ query });
        const container = document.getElementById('trendingContent');
        if(data.results && data.results.length > 0) {
            container.innerHTML = data.results.map(item => createCard(item)).join('');
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.getElementById('home').classList.add('active');
            container.previousElementSibling.innerHTML = `🔎 Results for: "${query}"`;
        }
    } catch(e) { console.error(e); }
    finally { hideLoading(); }
}

async function viewDetails(id, type) {
    showLoading();
    try {
        const data = await fetchFromBackend({ id, type });
        const modal = document.getElementById('detailsModal');
        const content = document.getElementById('detailsContent');
        const trailer = data.videos?.results.find(v => v.type === 'Trailer')?.key;
        const isListed = watchlist.some(i => i.id === data.id);

        content.innerHTML = `
            <div class="modal-body">
                <h2 style="color:#e50914;">${data.title || data.name}</h2>
                <div id="playerWrap" style="margin:15px 0; background:#000; min-height:250px; border-radius:10px; overflow:hidden;">
                    ${trailer ? `<iframe width="100%" height="300" src="https://www.youtube.com/embed/${trailer}" frameborder="0" allowfullscreen></iframe>` : '<p style="padding:100px; text-align:center; color:white;">No Trailer</p>'}
                </div>
                <p style="color:#ccc; margin-bottom:20px;">${data.overview || 'No description.'}</p>
                <div style="display:flex; gap:10px;">
                    <button class="btn" onclick="startStreaming('${id}', '${type}')" style="background:#e50914; color:white; padding:10px; border:none; cursor:pointer;">Watch Full Movie</button>
                    <button class="btn" onclick="closeModal()" style="background:#333; color:white; padding:10px; border:none;">Close</button>
                </div>
            </div>
        `;
        modal.classList.add('active');
    } catch(e) { console.error(e); }
    finally { hideLoading(); }
}

function startStreaming(id, type) {
    const wrap = document.getElementById('playerWrap');
    const url = type === 'movie' ? `https://vidsrc.me/embed/movie?tmdb=${id}` : `https://vidsrc.me/embed/tv?tmdb=${id}`;
    wrap.innerHTML = `<iframe src="${url}" width="100%" height="400" frameborder="0" allowfullscreen sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>`;
}

// Baki functions (setupEventListeners, closeModal, etc.) same rahenge jo pehle the.
function setupEventListeners() {
    document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            const sectionId = e.currentTarget.getAttribute('data-section');
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');
            if(sectionId === 'movies') renderSection('/discover/movie', 'moviesGrid');
            if(sectionId === 'series') renderSection('/discover/tv', 'seriesGrid');
        });
    });
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchMovies(e.target.value);
        });
    }
}
function closeModal() { document.getElementById('detailsModal').classList.remove('active'); }
function showLoading() { document.getElementById('loadingSpinner')?.classList.add('active'); }
function hideLoading() { document.getElementById('loadingSpinner')?.classList.remove('active'); }