# AirVintage — Local Development Guide (Without Docker)

This project is configured to run fully on your local machine without Docker. This setup resolves performance overhead, speeds up page reloads, and runs cleanly with minimal resource usage.

---

## 🛠️ Prerequisites

Make sure you have the following installed on your system:
1. **Python 3.9+**
2. **Node.js 18+ (with npm)**

---

## 🚀 Running the Application

Follow these steps to run both the backend and frontend services.

### 1. Backend Setup & Run

The backend is built with FastAPI. It is configured to automatically create and use a lightweight local SQLite database (`airvintage.db`) inside the `backend` folder, so **no external PostgreSQL database server setup is required.**

1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # Activate on Windows:
   .\venv\Scripts\activate
   # Activate on macOS/Linux:
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI development server:
   ```bash
   python -m uvicorn app.main:app --reload
   ```

The backend API will be running at **`http://localhost:8000`**. The SQLite database file will be created on startup automatically.

---

### 2. Frontend Setup & Run

The frontend is a React application.

1. Open a new terminal window/tab and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the React development server:
   ```bash
   npm start
   ```

The web application will open automatically in your browser at **`http://localhost:3000`** and will seamlessly connect to your local backend API.