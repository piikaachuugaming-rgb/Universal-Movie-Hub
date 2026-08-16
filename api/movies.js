module.exports = async (req, res) => {
    const { endpoint, query, id, type, language } = req.query;
    const API_KEY = '5d6a8fd4550ba2aebf6a13d76d6be02c';
    const BASE_URL = 'https://api.themoviedb.org/3';
    const lang = language || 'en-US';

    let url = '';

    if (id && type) {
        url = `${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=videos&language=${lang}`;
    } else if (query) {
        url = `${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=${lang}`;
    } else if (endpoint) {
        const joiner = endpoint.includes('?') ? '&' : '?';
        url = `${BASE_URL}${endpoint}${joiner}api_key=${API_KEY}&language=${lang}`;
    } else {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            return res.status(response.status).json({ error: 'TMDB Fetch Error' });
        }
        const data = await response.json();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};