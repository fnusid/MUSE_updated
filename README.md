# HAI Demucs Audio Mixer

## Run Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Run Frontend
```bash
cd frontend
npm install
npm start
```

The frontend runs on http://localhost:3000 and connects to the backend at http://127.0.0.1:8000.