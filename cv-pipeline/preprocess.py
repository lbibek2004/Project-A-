import cv2
import numpy as np
import matplotlib.pyplot as plt
import os
from skimage.filters import threshold_sauvola


def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def four_point_transform(image, pts):
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))

    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))

    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")

    matrix = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, matrix, (maxWidth, maxHeight))


def correct_image(image):
    scale = 800 / max(image.shape[:2])
    small = cv2.resize(image, (0, 0), fx=scale, fy=scale)

    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(gray, 75, 200)
    edged = cv2.dilate(edged, np.ones((3, 3), np.uint8), iterations=1)

    min_area = small.shape[0] * small.shape[1] * 0.2
    contours, _ = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]

    document_contour = None
    for c in contours:
        if cv2.contourArea(c) < min_area:
            continue
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            document_contour = approx
            break

    if document_contour is None:
        print("  No document contour found, returning original")
        corrected = image
        strategy = "none"
    else:
        document_contour = (document_contour / scale).astype("float32")
        corrected = four_point_transform(image, document_contour.reshape(4, 2))
        strategy = "contour"

    print(f"  Strategy: {strategy}")
    binary_sauvola, binary_otsu = sharpen_and_binarize(corrected)
    return corrected, binary_sauvola, binary_otsu, strategy


def sharpen_and_binarize(image):
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    blurred = cv2.GaussianBlur(gray, (0, 0), 3)
    sharpened = cv2.addWeighted(gray, 1.5, blurred, -0.5, 0)

    thresh_sauvola = threshold_sauvola(sharpened, window_size=25)
    binary_sauvola = (sharpened > thresh_sauvola).astype(np.uint8) * 255

    _, binary_otsu = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return binary_sauvola, binary_otsu


def show_comparison(original, corrected, binary_sauvola, binary_otsu, strategy, filename):
    fig, axes = plt.subplots(1, 4, figsize=(20, 6))
    fig.suptitle(f"{filename}  |  strategy: {strategy}", fontsize=11)

    axes[0].imshow(cv2.cvtColor(original, cv2.COLOR_BGR2RGB))
    axes[0].set_title("Original")
    axes[0].axis("off")

    axes[1].imshow(cv2.cvtColor(corrected, cv2.COLOR_BGR2RGB))
    axes[1].set_title(f"Corrected ({strategy})")
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


'''OCR Test 1 - Tesseract
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def run_ocr(image, label):
    text = pytesseract.image_to_string(image)
    words = [w for w in text.split() if len(w) > 2]
    print(f"\n  OCR ({label}) — {len(words)} words detected")
    print(f"  Preview: {' '.join(words[:20])}...")
    return text, words
'''

'''OCR Test 2 - EasyOCR
import easyocr
reader = easyocr.Reader(['en'])

def run_ocr(image, label):
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB) if len(image.shape) == 3 else image
    results = reader.readtext(rgb)
    words = [text for (_, text, confidence) in results if confidence > 0.2 and len(text) > 2]
    full_text = ' '.join(words)
    print(f"\n  OCR ({label}) — {len(words)} words detected")
    print(f"  Preview: {full_text[:100]}...")
    return full_text, words
'''


if __name__ == "__main__":
    _dir = os.path.dirname(os.path.abspath(__file__))
    image_path = os.path.join(_dir, "test_images", "1000004746.jpg")

    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: could not load {image_path}")
        exit()

    filename = "good_img.jpg"
    print(f"Processing: {filename}")
    corrected, binary_sauvola, binary_otsu, strategy = correct_image(image)

    show_comparison(image, corrected, binary_sauvola, binary_otsu, strategy, filename)
