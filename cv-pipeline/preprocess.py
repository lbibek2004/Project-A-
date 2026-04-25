import cv2
import numpy as np
import matplotlib.pyplot as plt
import os
from skimage.filters import threshold_sauvola

import os
from google.cloud import vision
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "google_cloud.json"
client = vision.ImageAnnotatorClient()


'''OCR Test 1 - Tesseract
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
'''

'''OCR Test 2 - EasyOCR
import easyocr
reader = easyocr.Reader(['en']) 
'''

SUPPORTED_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp')

def load_images_from_folder(folder_path):
    images = []
    for filename in os.listdir(folder_path):
        if filename.lower().endswith(SUPPORTED_EXTENSIONS):
            full_path = os.path.join(folder_path, filename)
            image = cv2.imread(full_path)
            if image is not None:
                images.append((filename, image))
                print(f"Loaded: {filename}")
            else:
                print(f"Skipped (could not read): {filename}")
    return images

def order_corners(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect
def crop_page(image):
    h, w = image.shape[:2]
    
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Heavy blur to ignore text and small details
    blurred = cv2.GaussianBlur(gray, (51, 51), 0)
    
    # Lower threshold to 140 to catch shadowed page regions
    _, bright_mask = cv2.threshold(blurred, 140, 255, cv2.THRESH_BINARY)
    
    # Much larger kernel to bridge shadow gaps across the page
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (60, 60))
    cleaned = cv2.morphologyEx(bright_mask, cv2.MORPH_CLOSE, kernel)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)
    
    # Find contours of bright regions
    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    print(f"  Crop: found {len(contours)} bright contours")
    
    if not contours:
        print("  Crop: no bright region found, returning original")
        return image, False
    
    largest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest)
    
    if area < (w * h * 0.20):
        print("  Crop: bright region too small, returning original")
        return image, False
    
    x, y, cw, ch = cv2.boundingRect(largest)
    
    pad = 10
    x = max(0, x - pad)
    y = max(0, y - pad)
    cw = min(w - x, cw + 2 * pad)
    ch = min(h - y, ch + 2 * pad)
    
    cropped = image[y:y+ch, x:x+cw]
    print(f"  Crop: {w}x{h} → {cw}x{ch}")
    return cropped, True

def try_perspective_correction(image):
    h, w = image.shape[:2]
    image_area = h * w

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 30, 100)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    dilated = cv2.dilate(edged, kernel, iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]

    page_contour = None
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 0.15 * image_area:
            continue

        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)

        if len(approx) == 4:
            corners = order_corners(approx.reshape(4, 2))
            top_left, top_right, bottom_right, bottom_left = corners

            width_top = np.linalg.norm(top_right - top_left)
            width_bottom = np.linalg.norm(bottom_right - bottom_left)
            height_left = np.linalg.norm(bottom_left - top_left)
            height_right = np.linalg.norm(bottom_right - top_right)

            output_width = int(max(width_top, width_bottom))
            output_height = int(max(height_left, height_right))

            if output_width < 100 or output_height < 100:
                continue

            aspect_ratio = output_width / output_height
            if not (0.3 < aspect_ratio < 3.0):
                continue

            page_contour = approx
            break

    if page_contour is None:
        return None, "no valid contour found"

    corners = order_corners(page_contour.reshape(4, 2))
    top_left, top_right, bottom_right, bottom_left = corners

    width_top = np.linalg.norm(top_right - top_left)
    width_bottom = np.linalg.norm(bottom_right - bottom_left)
    height_left = np.linalg.norm(bottom_left - top_left)
    height_right = np.linalg.norm(bottom_right - top_right)

    output_width = int(max(width_top, width_bottom))
    output_height = int(max(height_left, height_right))

    dst_points = np.array([
        [0, 0],
        [output_width - 1, 0],
        [output_width - 1, output_height - 1],
        [0, output_height - 1]
    ], dtype="float32")

    transform_matrix = cv2.getPerspectiveTransform(corners, dst_points)
    warped = cv2.warpPerspective(image, transform_matrix, (output_width, output_height))
    return warped, "perspective"

def try_rotation_correction(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)

    lines = cv2.HoughLinesP(edges, 1, np.pi/180,
                             threshold=100,
                             minLineLength=100,
                             maxLineGap=10)

    if lines is None:
        return image, "no lines found"

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        if -15 < angle < 15:
            angles.append(angle)

    if not angles:
        return image, "no valid angles"

    median_angle = np.median(angles)

    if abs(median_angle) < 2.0:
        return image, "skew too small"

    if abs(median_angle) > 4.5:
        return image, "angle detection error (>4.5°)"

    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    rotation_matrix = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    rotated = cv2.warpAffine(image, rotation_matrix, (w, h),
                              flags=cv2.INTER_CUBIC,
                              borderMode=cv2.BORDER_REPLICATE)
    return rotated, f"rotation ({median_angle:.2f} degrees)"

def sharpen_and_binarize(image):
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    blurred = cv2.GaussianBlur(gray, (0, 0), 3)
    sharpened = cv2.addWeighted(gray, 1.5, blurred, -0.5, 0)

    thresh_sauvola = threshold_sauvola(sharpened, window_size=25)
    binary_sauvola = (sharpened > thresh_sauvola).astype(np.uint8) * 255

    return binary_sauvola, sharpened

def correct_image(image):
    result, reason = try_perspective_correction(image)

    if result is not None:
        print(f"  Geometry: perspective correction")
        corrected = result
        strategy = "perspective"
    else:
        print(f"  Perspective failed ({reason}), trying rotation")
        corrected, reason = try_rotation_correction(image)
        print(f"  Geometry: rotation — {reason}")
        strategy = "rotation"

    cropped, crop_worked = crop_page(corrected)
    binary_sauvola, sharpened = sharpen_and_binarize(cropped)

    return corrected, cropped, binary_sauvola, strategy, crop_worked


def show_comparison(original, corrected, binary_sauvola, binary_otsu, strategy, filename):
    fig, axes = plt.subplots(1, 4, figsize=(20, 6))
    fig.suptitle(f"{filename}  |  strategy: {strategy}", fontsize=11)

    axes[0].imshow(cv2.cvtColor(original, cv2.COLOR_BGR2RGB))
    axes[0].set_title("Original")
    axes[0].axis("off")

    axes[1].imshow(cv2.cvtColor(corrected, cv2.COLOR_BGR2RGB))
    axes[1].set_title(f"Geometry corrected ({strategy})")
    axes[1].axis("off")

    axes[2].imshow(binary_sauvola, cmap="gray")
    axes[2].set_title("Sauvola binarization")
    axes[2].axis("off")

    axes[3].imshow(binary_otsu, cmap="gray")
    axes[3].set_title("Otsu binarization")
    axes[3].axis("off")

    plt.tight_layout()
    plt.show()

def save_processed(binary_sauvola, filename, output_folder):
    os.makedirs(output_folder, exist_ok=True)
    output_path = os.path.join(output_folder, f"processed_{filename}")
    cv2.imwrite(output_path, binary_sauvola)
    print(f"  Saved: {output_path}")


'''PyTeaseract OCR Reading'''

'''
def run_ocr(image, label):
    text = pytesseract.image_to_string(image)
    words = [w for w in text.split() if len(w) > 2]
    print(f"\n  OCR ({label}) — {len(words)} words detected")
    print(f"  Preview: {' '.join(words[:20])}...")
    return text, words

'''

'''EasyOCR OCR Reading
def run_ocr(image, label):
    # EasyOCR expects RGB, so convert if color image
    if len(image.shape) == 3:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    else:
        rgb = image  # already grayscale, easyocr handles it

    results = reader.readtext(rgb)
    
    # Each result is (bounding_box, text, confidence)
    words = [text for (_, text, confidence) in results if confidence > 0.2 and len(text) > 2]
    full_text = ' '.join(words)
    
    print(f"\n  OCR ({label}) — {len(words)} words detected")
    print(f"  Preview: {full_text[:100]}...")
    return full_text, words
    '''

'''Google Cloud OCR Reading'''
def run_ocr_google(image, label):
    # Encode image to bytes
    _, encoded = cv2.imencode('.jpg', image)
    content = encoded.tobytes()
    
    # Send to Google Vision API
    vision_image = vision.Image(content=content)
    response = client.document_text_detection(image=vision_image)
    
    if response.error.message:
        print(f"  OCR ({label}) — API error: {response.error.message}")
        return "", []
    
    # Extract full text
    full_text = response.full_text_annotation.text
    words = [w for w in full_text.split() if len(w) > 2]
    
    print(f"\n  OCR ({label}) — {len(words)} words detected")
    print(f"  Preview: {' '.join(words[:20])}...")
    return full_text, words



# --- Run all images ---
if __name__ == "__main__":
    input_folder = "test_images"
    output_folder = "processed_images"

    images = load_images_from_folder(input_folder)
    print(f"\nFound {len(images)} images\n")

    strategy_counts = {"perspective": 0, "rotation": 0}
    results = []

    for filename, image in images:
        print(f"\nProcessing: {filename}")
        corrected, cropped, binary_sauvola, strategy, crop_worked = correct_image(image)
        strategy_counts[strategy] += 1

        text_raw, words_raw = run_ocr_google(image, "raw")
        text_sauvola, words_sauvola = run_ocr_google(binary_sauvola, "sauvola")

        results.append({
            "filename": filename,
            "strategy": strategy,
            "raw_words": len(words_raw),
            "sauvola_words": len(words_sauvola),
            "difference": len(words_sauvola) - len(words_raw)
        })

    print(f"\n{'='*60}")
    print(f"{'File':<25} {'Strategy':<15} {'Raw':>6} {'Sauvola':>8} {'Diff':>6}")
    print(f"{'='*60}")
    for r in results:
        print(f"{r['filename']:<25} {r['strategy']:<15} {r['raw_words']:>6} {r['sauvola_words']:>8} {r['difference']:>+6}")

    total_raw = sum(r['raw_words'] for r in results)
    total_sauvola = sum(r['sauvola_words'] for r in results)
    print(f"{'='*60}")
    print(f"{'TOTAL':<25} {'':>15} {total_raw:>6} {total_sauvola:>8} {total_sauvola - total_raw:>+6}")

    print(f"\n--- Summary ---")
    print(f"Perspective correction used: {strategy_counts['perspective']} images")
    print(f"Rotation fallback used:      {strategy_counts['rotation']} images")
