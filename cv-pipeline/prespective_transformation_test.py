# Edge detection and contour mapping

import cv2
import numpy as np


def find_document_contour(image):
    # 1. Grayscale + blur to suppress text noise
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (11, 11), 0)

    # cv2.imwrite("blurred.png", blurred)
    # cv2.imshow("Blurred Image", blurred)
    # cv2.waitKey(0)
    # cv2.destroyAllWindows()


    # 2. Canny finds pixels where intensity changes sharply
    edges = cv2.Canny(blurred, threshold1=85, threshold2=200)

    # cv2.imwrite("edges.png", edges)
    # cv2.imshow("Canny Edges", edges)
    # cv2.waitKey(0)
    # cv2.destroyAllWindows()

    # 3. Dilate slightly to close gaps in the document border
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
    dilated = cv2.dilate(edges, kernel, iterations=2)

    # 4. Find all closed contours, keep only the largest
    contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    print(f"Found {len(contours)} contours, largest areas: {[cv2.contourArea(c) for c in contours]}")

    image_area = image.shape[0] * image.shape[1]
    for contour in contours:
        perimeter = cv2.arcLength(contour, closed=True)
        approx = cv2.approxPolyDP(contour, epsilon=0.02 * perimeter, closed=True)
        if len(approx) == 4:
            area = cv2.contourArea(approx)
            if area > 0.15 * image_area:  # must be at least 15% of frame
                return approx

    return None  # No document found

# Identifying the corners and ordering them

def order_corners(pts):
    # pts is shape (4, 1, 2) from OpenCV — flatten first
    pts = pts.reshape(4, 2).astype("float32")
    ordered = np.zeros((4, 2), dtype="float32")

    # Top-left has smallest x+y sum; bottom-right has largest
    s = pts.sum(axis=1)
    ordered[0] = pts[np.argmin(s)]   # top-left
    ordered[2] = pts[np.argmax(s)]   # bottom-right

    # Top-right has smallest x-y diff; bottom-left has largest
    diff = np.diff(pts, axis=1)
    ordered[1] = pts[np.argmin(diff)]  # top-right
    ordered[3] = pts[np.argmax(diff)]  # bottom-left

    print("Ordered corners:", ordered)

    return ordered

# Four point perspective transform to get a top-down view of the document

def four_point_transform(image, pts):
    (tl, tr, br, bl) = order_corners(pts)

    # Compute the width of the output image:
    # max of bottom-edge width and top-edge width
    width_bottom = np.linalg.norm(br - bl)
    width_top    = np.linalg.norm(tr - tl)
    max_width = int(max(width_bottom, width_top))

    # Compute the height similarly
    height_left  = np.linalg.norm(tl - bl)
    height_right = np.linalg.norm(tr - br)
    max_height = int(max(height_left, height_right))

    # Source: the 4 distorted corners we found
    src = np.array([tl, tr, br, bl], dtype="float32")

    # Destination: a perfect rectangle starting at (0, 0)
    dst = np.array([
        [0,          0         ],
        [max_width-1, 0         ],
        [max_width-1, max_height-1],
        [0,          max_height-1]
    ], dtype="float32")

    # OpenCV solves the 8 equations needed to fill the 3×3 matrix
    M = cv2.getPerspectiveTransform(src, dst)

    # Apply the matrix to every pixel in the image
    warped = cv2.warpPerspective(image, M, (max_width, max_height))

    cv2.imwrite("warped_output.png", warped)
    cv2.imshow("Warped Document", warped)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

    return warped

# Post processing and thresholding

def clean_scan(warped):
    gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)

    # Adaptive threshold: for each 11×11 pixel region, pixels darker
    # than (local_mean - 10) become black; the rest become white.
    # This handles uneven lighting and shadows gracefully.
    thresh = cv2.adaptiveThreshold(
        gray,
        maxValue=255,
        adaptiveMethod=cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        thresholdType=cv2.THRESH_BINARY,
        blockSize=11,   # size of the local region
        C=10            # constant subtracted from the mean
    )
    return thresh


# Main function to run the whole pipeline

def scan_document(image_path):
    image = cv2.imread(image_path)
    original = image.copy()

    # 1. Find the document
    contour = find_document_contour(image)
    if contour is None:
        raise ValueError("No document detected in image")

    # 2–3. Order corners, then warp
    warped = four_point_transform(original, contour)

    # 4. Clean up
    scanned = clean_scan(warped)

    cv2.imwrite("scanned_output.png", scanned)
    return scanned

# Usage
result = scan_document("test_images/good_img.jpg")

cv2.imshow("Scanned Document", result)
cv2.waitKey(0)
cv2.destroyAllWindows()