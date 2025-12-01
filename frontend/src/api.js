import axios from "axios";

export async function separateAudio(file) {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await axios.post("http://127.0.0.1:8000/separate", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch (err) {
    console.error("Demucs separation failed:", err);
    throw err;
  }
}