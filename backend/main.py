import os
import uuid
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from fastapi import FastAPI, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import torchaudio
import torch
from demucs.pretrained import get_model
from demucs.apply import apply_model

# -----------------------------
# Setup paths
# -----------------------------
BASE_DIR = Path(__file__).resolve().parent
SEPARATED_DIR = BASE_DIR / "separated"
MIXED_DIR = BASE_DIR / "mixed_outputs"
PROGRESS_FILE = BASE_DIR / "demucs_progress.json"
SEPARATED_DIR.mkdir(exist_ok=True)
MIXED_DIR.mkdir(exist_ok=True)

# Helper to update progress
def update_progress(progress: float):
    with open(PROGRESS_FILE, "w") as f:
        json.dump({"progress": progress}, f)

# -----------------------------
# FastAPI setup
# -----------------------------
app = FastAPI(title="Human Audio Mixer Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
app.mount("/separated", StaticFiles(directory=SEPARATED_DIR), name="separated")
app.mount("/mixed_outputs", StaticFiles(directory=MIXED_DIR), name="mixed_outputs")

# -----------------------------
# Load Demucs model once
# -----------------------------
try:
    torchaudio.set_audio_backend("sox_io")
    print("✅ Using sox_io backend for torchaudio")
except Exception as e:
    print("⚠️ Could not set sox_io backend:", e)

MODEL = get_model("htdemucs")
MODEL.eval()
print("✅ Demucs model loaded successfully")

# -----------------------------
# Helper: clean separated folder
# -----------------------------
def clean_separated_folder():
    for f in SEPARATED_DIR.glob("*.wav"):
        f.unlink()

# -----------------------------
# Route: Start separation (runs in thread pool)
# -----------------------------
def run_separation_sync(input_path: Path, session_id: str):
    """Run separation in background thread and update progress"""
    try:
        update_progress(0.1)  # 10% - File uploaded
        
        # Load audio (convert mono → stereo if needed)
        wav, sr = torchaudio.load(input_path)
        update_progress(0.2)  # 20% - Audio loaded
        
        if wav.shape[0] == 1:
            wav = wav.repeat(2, 1)
        wav = wav.unsqueeze(0)  # [1, 2, samples]
        update_progress(0.3)  # 30% - Audio preprocessed

        # Run Demucs (this is the slow part)
        update_progress(0.4)  # 40% - Starting separation
        with torch.no_grad():
            out = apply_model(MODEL, wav, device="cpu", segment=None)
        update_progress(0.8)  # 80% - Separation complete

        # Save separated stems
        stems = ["drums", "bass", "other", "vocals"]
        for i, name in enumerate(stems):
            torchaudio.save(SEPARATED_DIR / f"{name}.wav", out[0, i], sr)
            update_progress(0.8 + (i + 1) * 0.05)  # 85%, 90%, 95%, 100%

        update_progress(1.0)  # 100% - Complete
    except Exception as e:
        print(f"❌ Separation error: {e}")
        import traceback
        traceback.print_exc()
        update_progress(0.0)  # Reset on error

# Thread pool for CPU-intensive tasks
executor = ThreadPoolExecutor(max_workers=1)

@app.post("/start_separation")
async def start_separation(file: UploadFile):
    clean_separated_folder()
    update_progress(0.0)  # Reset progress
    session_id = str(uuid.uuid4())[:8]
    input_path = SEPARATED_DIR / f"input_{session_id}.wav"

    # Save uploaded file
    with open(input_path, "wb") as f:
        f.write(await file.read())

    # Run separation in thread pool (non-blocking)
    loop = asyncio.get_event_loop()
    loop.run_in_executor(executor, run_separation_sync, input_path, session_id)

    return {"session_id": session_id, "status": "processing"}

# -----------------------------
# Route: Get separation progress
# -----------------------------
@app.get("/separation_progress")
async def get_separation_progress():
    """Get current separation progress"""
    try:
        if PROGRESS_FILE.exists():
            with open(PROGRESS_FILE, "r") as f:
                data = json.load(f)
                progress = data.get("progress", 0.0)
                status = "completed" if progress >= 1.0 else "processing"
                return {"progress": progress, "status": status}
        return {"progress": 0.0, "status": "idle"}
    except Exception as e:
        return {"progress": 0.0, "status": "error", "error": str(e)}

# -----------------------------
# Route: Mix stems based on gains
# -----------------------------
@app.post("/mix")
async def mix_audio(
    vocals_gain: float = Form(...),
    drums_gain: float = Form(...),
    bass_gain: float = Form(...),
    other_gain: float = Form(...),
):
    try:
        stems = {
            "vocals": SEPARATED_DIR / "vocals.wav",
            "drums": SEPARATED_DIR / "drums.wav",
            "bass": SEPARATED_DIR / "bass.wav",
            "other": SEPARATED_DIR / "other.wav",
        }

        # Load stems and apply gain
        loaded = {}
        for name, path in stems.items():
            if not path.exists():
                raise HTTPException(status_code=404, detail=f"Stem not found: {name}")
            audio, sr = torchaudio.load(path)
            gain_db = locals()[f"{name}_gain"]
            gain = 10 ** (gain_db / 20)
            loaded[name] = audio * gain

        # Match lengths
        min_len = min(stem.shape[1] for stem in loaded.values())
        loaded = {k: v[:, :min_len] for k, v in loaded.items()}

        # Sum up stems
        mix = sum(loaded.values())

        # Normalize
        mix = mix / mix.abs().max()

        # Save with unique filename
        filename = f"final_mix_{uuid.uuid4().hex[:8]}.wav"
        out_path = MIXED_DIR / filename
        torchaudio.save(out_path, mix, sr)

        print(f"✅ Mix saved: {out_path}")
        return {"path": f"/mixed_outputs/{filename}"}

    except Exception as e:
        print("❌ Mixing error:", e)
        raise HTTPException(status_code=500, detail=str(e))
