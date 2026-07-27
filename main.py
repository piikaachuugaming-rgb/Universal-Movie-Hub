import os
import requests
import json
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from crewai import Agent, Task, Crew, Process
from crewai.tools import tool

# Load environment variables
load_dotenv()

# Initialize Flask App
app = Flask(__name__)
CORS(app)  # Mobile/Frontend cross-origin requests allow karne ke liye

# Fetch keys safely
GOOGLE_KEY = os.getenv("GOOGLE_API_KEY")
TMDB_KEY = os.getenv("TMDB_API_KEY")

if GOOGLE_KEY:
    os.environ["GOOGLE_API_KEY"] = GOOGLE_KEY

BASE_URL = "https://api.themoviedb.org/3"

# ==========================================
# CUSTOM TMDB TOOL
# ==========================================
@tool("fetch_trending_movies")
def fetch_trending_movies(query: str = ""):
    """Useful to fetch the top 3 trending movies of the week from TMDB API."""
    url = f"{BASE_URL}/trending/movie/week?api_key={TMDB_KEY}"
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        movies = []
        for item in data.get('results', [])[:3]:
            title = item.get('title', 'Unknown')
            overview = item.get('overview', 'No overview')
            movies.append(f"Title: {title} | Overview: {overview}")
        return "\n".join(movies) if movies else "No trending movies found."
    except Exception as e:
        return f"Error fetching data: {e}"

# ==========================================
# AGENTS & TASKS CREATION FUNCTION
# ==========================================
def run_movie_crew():
    MODEL_NAME = "gemini/gemini-2.5-flash"

    researcher = Agent(
        role='Movie Data Analyst',
        goal='Get the latest trending movies from TMDB.',
        backstory="You are the data brain of Universal Movie Hub. You fetch real facts using APIs.",
        tools=[fetch_trending_movies],
        llm=MODEL_NAME,
        verbose=True,
        allow_delegation=False
    )

    writer = Agent(
        role='AI Content Strategist',
        goal='Write short, viral summaries for the movies provided.',
        backstory="Creative writer for Universal Movie Hub. You make movies sound exciting.",
        llm=MODEL_NAME,
        verbose=True
    )

    task1 = Task(
        description="Use the fetch_trending_movies tool to get the top 3 trending movies right now.",
        expected_output="A list containing 3 movie titles and their official descriptions.",
        agent=researcher
    )

    task2 = Task(
        description="Create 2-sentence catchy summaries for each movie to display on the hub.",
        expected_output="3 high-energy summaries formatted for website users.",
        agent=writer
    )

    movie_crew = Crew(
        agents=[researcher, writer],
        tasks=[task1, task2],
        process=Process.sequential,
        verbose=True
    )

    result = movie_crew.kickoff()
    
    final_data = {
        "status": "success",
        "recommendations": str(result.raw) if hasattr(result, 'raw') else str(result)
    }

    # Backup JSON save
    try:
        with open('ai_suggestions.json', 'w', encoding='utf-8') as f:
            json.dump(final_data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"File save error: {e}")

    return final_data

# ==========================================
# FLASK API ROUTES
# ==========================================
@app.route('/', methods=['GET'])
def home():
    return jsonify({"message": "Universal Movie Hub Backend is Live!"}), 200

@app.route('/api/trending', methods=['GET'])
def get_trending():
    try:
        data = run_movie_crew()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================
# SERVER RUNNER (RENDER COMPATIBLE)
# ==========================================
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)