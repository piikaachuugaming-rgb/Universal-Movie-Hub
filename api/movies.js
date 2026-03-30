export default async function handler(req, res) {
    const { endpoint, query, id, type } = req.query;
    const API_KEY = '5d6a8fd4550ba2aebf6a13d76d6be02c';
    const BASE_URL = 'https://api.themoviedb.org/3';

    let url = "";

    // Logic to build URL based on request type
    if (id && type) {
        // Details fetch karne ke liye
        url = `${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=videos&language=en-US`;
    } else if (query) {
        // Search karne ke liye
        url = `${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=en-US`;
    } else {
        // Trending/Discover ke liye
        url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${API_KEY}&language=en-US`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Backend Fetch Failed' });
    }
}