git # Notes Scanner App — CS4730

A mobile app that scans handwritten notes, extracts text via OCR, and generates study materials (Q&A, quizzes, flashcards) using a local LLM.

The project has two parts:
- **`NotesScannerApp/`** — React Native (Expo) mobile frontend
- **`cv-pipeline/`** — Python Flask backend with OpenCV preprocessing and Google Cloud Vision OCR

---

## CV Pipeline (Python Backend)

### Requirements

- Python 3.10+
- [Ollama](https://ollama.com) running locally with the `gemma3:4b` model
- A Google Cloud service account JSON with the **Cloud Vision API** enabled

### Installation

```bash
cd cv-pipeline
pip install flask opencv-python numpy scikit-image matplotlib google-cloud-vision requests
```

### Google Cloud Setup

1. Create a service account in [Google Cloud Console](https://console.cloud.google.com) with the **Cloud Vision API** enabled.
2. Download the JSON key and save it as `cv-pipeline/google_cloud.json`.

### Ollama Setup

```bash
# Install Ollama from https://ollama.com, then pull the model:
ollama pull gemma3:4b
```

### Running the Server

```bash
cd cv-pipeline
python server.py
```

Server starts at `http://localhost:5000`. Available endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/process` | Upload an image, get extracted text |
| POST | `/ask` | Ask a question about extracted notes |
| POST | `/generate-quiz` | Generate multiple-choice quiz questions |
| POST | `/generate-flashcards` | Generate flashcard pairs |
| GET | `/health` | Health check |

---

## NotesScannerApp (React Native / Expo)

### Requirements

- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Android emulator, iOS simulator, or the **Expo Go** app on a physical device

### Installation

```bash
cd NotesScannerApp
npm install
```

### Running the App

```bash
npx expo start
```

Then press:
- `a` to open in Android emulator
- `i` to open in iOS simulator
- Scan the QR code with Expo Go on a physical device

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `expo-camera` / `expo-image-picker` | Capture or pick images |
| `expo-sqlite` | Local note storage |
| `@react-native-ml-kit/text-recognition` | On-device OCR (offline fallback) |
| `llama.rn` / `react-native-executorch` | On-device LLM inference (offline mode) |
| `@react-native-community/netinfo` | Online/offline detection |
| `expo-image-manipulator` | Image preprocessing before upload |
| `react-native-reanimated` | Animations |

### Offline vs Online Mode

- **Online**: sends images to the Python backend (`cv-pipeline/server.py`) for OpenCV preprocessing + Google Cloud Vision OCR + Ollama LLM.
- **Offline**: uses on-device ML Kit OCR and a local LLM via `llama.rn` / ExecuTorch — no server required.
