export default async function handler(req, res) {
    const { endpoint, query, id, type, language } = req.query;
    const API_KEY = '5d6a8fd4550ba2aebf6a13d76d6be02c';
    const BASE_URL = 'https://api.themoviedb.org/3';
    const lang = language || 'en-US';

    let url = "";

    try {
        if (id && type) {
            // Fetching Movie or TV Show Details with Videos
            url = `${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=videos&language=${lang}`;
        } else if (query) {
            // Multi-search for Movies, TV, and Anime
            url = `${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=${lang}`;
        } else if (endpoint) {
            // Category fetching (Trending, Popular, Anime)
            url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${API_KEY}&language=${lang}`;
        } else {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const response = await fetch(url);
        const data = await response.json();
        
        // Final check before sending data
        if (data.success === false) {
            return res.status(404).json({ error: data.status_message });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error("Vercel Backend Error:", error);
        res.status(500).json({ error: 'Internal Server Error fetching from TMDB' });
    }
}