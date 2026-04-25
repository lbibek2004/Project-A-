import cv2
import os
import sys
import numpy as np
from flask import Flask, request, jsonify

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from preprocess import correct_image, run_ocr_google
from qa import ask_question as qa_ask_question, generate_quiz as qa_generate_quiz, generate_flashcards as qa_generate_flashcards

app = Flask(__name__)


@app.route("/process", methods=["POST"])
def process_image():
    """
    Accepts an image file, runs CV pipeline + OCR
    Returns extracted text
    """
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    file = request.files["image"]
    
    # Read image from request
    file_bytes = np.frombuffer(file.read(), np.uint8)
    image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    
    if image is None:
        return jsonify({"error": "Could not decode image"}), 400

    # Run CV pipeline
    print("Running CV pipeline...")
    corrected, cropped, binary_sauvola, strategy, crop_worked = correct_image(image)
    
    # Run OCR
    print("Running OCR...")
    text, _ = run_ocr_google(binary_sauvola, "processed")
    
    if not text:
        return jsonify({"error": "No text extracted"}), 400

    print(f"Extracted {len(text.split())} words, strategy: {strategy}")
    
    return jsonify({
        "text": text,
        "word_count": len(text.split()),
        "strategy": strategy,
        "crop_worked": crop_worked
    })


@app.route("/ask", methods=["POST"])
def ask_question():
    """
    Accepts note text and a question
    Returns answer from Gemma
    """
    data = request.get_json()
    
    if not data or "text" not in data or "question" not in data:
        return jsonify({"error": "Missing text or question"}), 400

    note_text = data["text"]
    question = data["question"]
    full_ai = bool(data.get("full_ai", False))

    print(f"Question: {question} (full_ai={full_ai})")
    answer = qa_ask_question(note_text, question, full_ai=full_ai)
    print(f"Answer: {answer[:100]}...")

    return jsonify({"answer": answer})


@app.route("/generate-quiz", methods=["POST"])
def generate_quiz():
    """
    Accepts note text and a count, returns multiple-choice quiz questions as JSON.
    """
    data = request.get_json()
    if not data or "text" not in data:
        return jsonify({"error": "Missing text"}), 400
    count = max(5, min(20, int(data.get("count", 10))))
    print(f"Generating {count} quiz questions...")
    questions = qa_generate_quiz(data["text"], count)
    if not questions:
        return jsonify({"error": "Failed to generate quiz questions. Try again."}), 500
    return jsonify({"questions": questions})


@app.route("/generate-flashcards", methods=["POST"])
def generate_flashcards():
    """
    Accepts note text and a count, returns flashcard pairs as JSON.
    """
    data = request.get_json()
    if not data or "text" not in data:
        return jsonify({"error": "Missing text"}), 400
    count = max(5, min(20, int(data.get("count", 10))))
    print(f"Generating {count} flashcards...")
    cards = qa_generate_flashcards(data["text"], count)
    if not cards:
        return jsonify({"error": "Failed to generate flashcards. Try again."}), 500
    return jsonify({"cards": cards})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    print("Starting CV pipeline server on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)