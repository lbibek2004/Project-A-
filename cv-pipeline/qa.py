import cv2
import os
import sys
import requests
import json
from google.cloud import vision

# Import your CV pipeline
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from preprocess import correct_image, sharpen_and_binarize

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "google_cloud.json"
vision_client = vision.ImageAnnotatorClient()

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "gemma3:4b"


def extract_text_from_image(image_path):
    # Step 1 — load image
    image = cv2.imread(image_path)

    # Step 2 — run your CV pipeline
    print("  Running CV pipeline...")
    corrected, cropped, binary_sauvola, strategy, crop_worked = correct_image(image)
    print(f"  Geometry strategy: {strategy}")
    print(f"  Crop worked: {crop_worked}")

    # Step 3 — send preprocessed binary image to OCR
    print("  Running OCR on preprocessed image...")
    _, encoded = cv2.imencode('.jpg', binary_sauvola)
    content = encoded.tobytes()

    vision_image = vision.Image(content=content)
    response = vision_client.document_text_detection(image=vision_image)

    if response.error.message:
        print(f"  OCR error: {response.error.message}")
        return ""

    text = response.full_text_annotation.text
    print(f"  Extracted {len(text.split())} words")
    return text


def ask_question(note_text, question, full_ai=False):
    if full_ai:
        prompt = f"""You are a helpful AI assistant. You have been given the following notes for context:

---
{note_text}
---

Answer the following question. You may use your general knowledge in addition to the notes above.

Question: {question}

Answer:"""
    else:
        prompt = f"""You are a helpful study assistant. You have been given the following handwritten notes:

---
{note_text}
---

Answer the following question based ONLY on the notes above. If the answer is not in the notes, say "I could not find that in the notes."

Question: {question}

Answer:"""

    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False
    }

    response = requests.post(OLLAMA_URL, json=payload)

    if response.status_code != 200:
        return f"Error: {response.status_code}"

    result = response.json()
    return result["response"].strip()


def generate_quiz(note_text, count=10):
    prompt = f"""You are a quiz generator. Given the following notes, create exactly {count} multiple-choice questions.

Notes:
---
{note_text}
---

Return ONLY a valid JSON array with no extra text, no markdown, no code fences. Each element must have:
- "question": string
- "options": array of exactly 4 strings (e.g. "A. ...")
- "answer": string matching one of the options exactly

Example:
[{{"question": "What is X?", "options": ["A. foo", "B. bar", "C. baz", "D. qux"], "answer": "A. foo"}}]

JSON:"""

    payload = {"model": MODEL, "prompt": prompt, "stream": False}
    response = requests.post(OLLAMA_URL, json=payload)
    if response.status_code != 200:
        print(f"Ollama error: {response.status_code}")
        return []

    raw = response.json().get("response", "").strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()
    try:
        questions = json.loads(raw)
        if isinstance(questions, list):
            return questions
    except Exception as e:
        print(f"Quiz JSON parse error: {e}\nRaw: {raw[:200]}")
    return []


def generate_flashcards(note_text, count=10):
    prompt = f"""You are a flashcard generator. Given the following notes, create exactly {count} flashcards.

Notes:
---
{note_text}
---

Return ONLY a valid JSON array with no extra text, no markdown, no code fences. Each element must have:
- "front": a term, concept, or question (string)
- "back": the definition or answer (string)

Example:
[{{"front": "Mitochondria", "back": "The powerhouse of the cell; produces ATP via cellular respiration."}}]

JSON:"""

    payload = {"model": MODEL, "prompt": prompt, "stream": False}
    response = requests.post(OLLAMA_URL, json=payload)
    if response.status_code != 200:
        print(f"Ollama error: {response.status_code}")
        return []

    raw = response.json().get("response", "").strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()
    try:
        cards = json.loads(raw)
        if isinstance(cards, list):
            return cards
    except Exception as e:
        print(f"Flashcard JSON parse error: {e}\nRaw: {raw[:200]}")
    return []


def interactive_qa(note_text):
    print("\n--- Q&A Session ---")
    print("Type your question and press Enter. Type 'quit' to exit.\n")

    while True:
        question = input("Your question: ").strip()

        if question.lower() == "quit":
            print("Ending Q&A session.")
            break

        if not question:
            continue

        print("\nThinking...")
        answer = ask_question(note_text, question)
        print(f"\nAnswer: {answer}\n")
        print("-" * 40)


if __name__ == "__main__":
    # --- Run on a real image ---
    image_path = "test_images/good_img.jpg"

    print(f"Processing: {image_path}\n")
    note_text = extract_text_from_image(image_path)

    if note_text:
        print(f"\nExtracted text preview:\n{note_text[:300]}...")
        interactive_qa(note_text)
    else:
        print("No text extracted")
