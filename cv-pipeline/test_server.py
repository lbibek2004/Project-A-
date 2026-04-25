# For local development testing only — not part of the production pipeline.

import requests

# Test health
health = requests.get("http://localhost:5000/health")
print(f"Health: {health.json()}")

# Test process endpoint
with open("test_images/good_img.jpg", "rb") as f:
    response = requests.post(
        "http://localhost:5000/process",
        files={"image": f}
    )

print(f"Status: {response.status_code}")
result = response.json()
print(f"Strategy: {result.get('strategy')}")
print(f"Words extracted: {result.get('word_count')}")
print(f"Text preview: {result.get('text', '')[:200]}")

# Test ask endpoint
ask_response = requests.post(
    "http://localhost:5000/ask",
    json={
        "text": result.get("text", ""),
        "question": "what is this note about?"
    }
)
print(f"\nQuestion: what is this note about?")
print(f"Answer: {ask_response.json().get('answer')}")