export default async function handler(req, res) {
    const { endpoint, query, id, type, language } = req.query;
    const API_KEY = '5d6a8fd4550ba2aebf6a13d76d6be02c';
    const BASE_URL = 'https://api.themoviedb.org/3';
    const lang = language || 'en-US';

    let url = "";

    try {
        if (id && type) {
            // Movie/TV Details Fetching
            url = `${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=videos&language=${lang}`;
        } else if (query) {
            // Search Logic
            url = `${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=${lang}`;
        } else if (endpoint) {
            // Trending/Category Logic
            url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${API_KEY}&language=${lang}`;
        } else {
            return res.status(400).json({ error: "Missing parameters" });
        }

        const response = await fetch(url);
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}