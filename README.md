# SwiftRide - Cab Booking Platform Prototype

A modern, production-ready prototype for a premium cab booking service.

## Architecture

- **Backend**: Python with FastAPI, SQLAlchemy (SQLite/PostgreSQL ready), PyJWT for Authentication, and WebSockets for real-time tracking.
- **Frontend**: Vanilla JS with Tailwind CSS (via CDN) and Leaflet.js for interactive maps. Single-page application approach using pure DOM manipulation and responsive design.

## Project Structure

```
c:\Cab_Book_Proj
├── backend/
│   ├── main.py        # FastAPI entry point, endpoints, websockets
│   ├── models.py      # SQLAlchemy DB schemas
│   ├── schemas.py     # Pydantic data validation schemas
│   ├── auth.py        # JWT generation and dependency checking
│   ├── database.py    # DB connection setup
│   └── requirements.txt
└── frontend/
    ├── index.html     # Main UI, map container, dark mode layout
    ├── style.css      # Custom animations, scrollbars, glassmorphism
    └── app.js         # Leaflet setup, WebSocket client, API interaction
```

## Running the Application

### 1. Backend Setup

You need **Python 3.10+** installed.

```bash
python -m venv venv
# Activate the virtual environment
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```
The backend will run at `http://localhost:8000`.

### 2. Frontend Setup

Since the frontend is built with vanilla HTML/JS and Tailwind CDN, you can run it using any simple HTTP server.

Open a new terminal in the `frontend/` directory:

```bash
cd frontend
python -m http.server 8080
# Or using Node.js:
# npx serve
```
Then open your browser to `http://localhost:8080`.

## API Endpoints

- `POST /register`: Register a new user (customer/driver).
- `POST /login`: Get a JWT access token.
- `GET /cabs`: Filter available cabs by type or capacity.
- `POST /book`: Book a ride (requires authentication).
- `WS /ws/driver-location`: WebSocket endpoint for real-time coordinate streaming.
- `POST /seed`: Utility to inject mock driver and vehicle data for testing.
