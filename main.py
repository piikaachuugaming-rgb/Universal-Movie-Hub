import os
import requests
import json
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from google import genai

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# API Keys
GOOGLE_KEY = os.getenv("GOOGLE_API_KEY")
TMDB_KEY = os.getenv("TMDB_API_KEY", "f0da50d7b0c16984ccab202db5b1a2b1")
OMDB_KEY = os.getenv("OMDB_API_KEY")

BASE_URL = "https://api.themoviedb.org/3"

# Initialize Gemini Client
client = genai.Client(api_key=GOOGLE_KEY) if GOOGLE_KEY else None

def fetch_trending_movies_data():
    """TMDB se fetch karta hai, fail hone par OMDb ya Static Backup par switch hota hai."""
    # 1. TMDB TRY
    if TMDB_KEY:
        try:
            url = f"{BASE_URL}/trending/movie/week?api_key={TMDB_KEY}"
            res = requests.get(url, timeout=4)
            if res.status_code == 200:
                data = res.json()
                movies = []
                for item in data.get('results', [])[:3]:
                    title = item.get('title', 'Unknown')
                    overview = item.get('overview', 'No overview')
                    movies.append(f"Title: {title} | Overview: {overview}")
                if movies:
                    return "\n".join(movies)
        except Exception as e:
            print(f"⚠️ TMDB Blocked/Error: {e}. Switching to OMDb...")

    # 2. OMDB FALLBACK
    if OMDB_KEY:
        try:
            url = f"https://www.omdbapi.com/?apikey={OMDB_KEY}&s=Avengers"
            res = requests.get(url, timeout=4)
            if res.status_code == 200:
                data = res.json()
                if data.get("Response") == "True":
                    movies = []
                    for item in data.get('Search', [])[:3]:
                        movies.append(f"Title: {item.get('Title')} | Year: {item.get('Year')}")
                    return "\n".join(movies)
        except Exception as e:
            print(f"⚠️ OMDb Error: {e}")

    # 3. STATIC BACKUP
    return (
        "Title: Inception | Overview: A thief who enters dreams to steal secrets.\n"
        "Title: Interstellar | Overview: A team travels through a wormhole in space.\n"
        "Title: Avatar | Overview: A Marine on Pandora's moon."
    )

def run_ai_movie_pipeline():
    # Step 1: Raw Movie Data (Researcher Tool replacement)
    raw_movie_data = fetch_trending_movies_data()

    # Step 2: AI Summarizer (Writer Agent replacement)
    if client:
        prompt = f"""
        You are an AI Content Strategist for Universal Movie Hub.
        Here is the trending movie data:
        {raw_movie_data}

        Task: Write short, 2-sentence viral and catchy summaries for each of these 3 movies for website users.
        """
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        ai_summary = response.text
    else:
        ai_summary = raw_movie_data

    final_data = {
        "status": "success",
        "recommendations": ai_summary
    }

    # Backup JSON save
    try:
        with open('ai_suggestions.json', 'w', encoding='utf-8') as f:
            json.dump(final_data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"File save error: {e}")

    return final_data

@app.route('/', methods=['GET'])
def home():
    return jsonify({"message": "Universal Movie Hub Backend is Live!"}), 200

@app.route('/api/trending', methods=['GET'])
def get_trending():
    try:
        data = run_ai_movie_pipeline()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 🌟 NEW ROUTE: Frontend Proxy Fetching (Posters + Search Results Load karne ke liye)
@app.route('/api/movies', methods=['GET'])
def get_movies_proxy():
    search_query = request.args.get('search', 'Avengers')
    try:
        url = f"{BASE_URL}/search/multi?api_key={TMDB_KEY}&query={search_query}"
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            return jsonify({"status": "success", "data": res.json().get('results', [])}), 200
    except Exception as e:
        print(f"TMDB Proxy Error: {e}")
    
    return jsonify({"status": "error", "message": "Failed to fetch movies from Proxy"}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)