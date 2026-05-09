''' Test 1 - Canny edge detection (Raw OpenCV) '''


# import cv2
# import matplotlib.pyplot as plt
# img = cv2.imread("cv-pipeline/test_images/1000004739.jpg")
# gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
# edges = cv2.Canny(gray, 150, 300)
# img[edges == 255] = (255, 0, 0)
# plt.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
# plt.title('Canny Edges')
# plt.axis('off')
# plt.show()

''' Test 2 - Harris corner detection '''

# import cv2
# import numpy as np
# import matplotlib.pyplot as plt
# import os

# # Load the image
# _dir = os.path.dirname(os.path.abspath(__file__))
# img = cv2.imread(os.path.join(_dir, 'test_images', '1000004741.jpg'))

# # Convert to grayscale
# gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# # Detect corners using the Harris method
# dst = cv2.cornerHarris(gray, 3, 5, 0.1)

# # Create a boolean bitmap of corner positions
# corners = dst > 0.05 * dst.max()

# # Find the coordinates from the boolean bitmap
# coord = np.argwhere(corners)

# # Draw circles on the coordinates to mark the corners
# for y, x in coord:
#     cv2.circle(img, (x, y), 3, (0, 0, 255), -1)

# # Display the image with corners
# plt.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
# plt.title('Harris Corner Detection')
# plt.axis('off')
# plt.show()

''' Test 3 - Shi-Tomasi corner detection '''

# import cv2
# import numpy as np
# import matplotlib.pyplot as plt

# img = cv2.imread('cv-pipeline/test_images/1000004741.jpg')

# gray_img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# corners = cv2.goodFeaturesToTrack(gray_img, 100, 0.01, 10)
# corners = np.int32(corners)

# for i in corners:
#     x, y = i.ravel()
#     cv2.circle(img, (x, y), 3, (0, 0, 255), -1)  

# img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

# plt.imshow(img_rgb)
# plt.title('Shi-Tomasi Corner Detection')
# plt.axis('off')  
# plt.show()



'''Test 4 - Region Based Edge Detection'''


# code
# import numpy as np
# import matplotlib.pyplot as plt
# from skimage.feature import canny
# from skimage.filters import sobel
# from skimage import data
# from skimage.segmentation import watershed

# from skimage.color import rgb2gray
# from skimage.color import label2rgb
# import scipy.ndimage as nd
# plt.rcParams["figure.figsize"] = (12,8)


# # load images and convert grayscale
# # rocket = data.rocket()
# rocket = plt.imread("cv-pipeline/test_images/1000004739.jpg")
# rocket_wh = rgb2gray(rocket)

# # apply edge segmentation
# # plot canny edge detection
# edges = canny(rocket_wh)
# plt.imshow(edges, interpolation='gaussian')
# plt.title('Canny detector')

# # fill regions to perform edge segmentation
# fill_im = nd.binary_fill_holes(edges)
# plt.imshow(fill_im)
# plt.title('Region Filling')

# # Region Segmentation
# # First we print the elevation map
# elevation_map = sobel(rocket_wh)
# elevation_map = elevation_map.astype(np.float64)
# plt.imshow(elevation_map)

# # Since, the contrast difference is not much. Anyways we will perform it
# #
# markers = np.zeros_like(rocket_wh)
# markers = markers.astype(np.int32)
# markers[rocket_wh < 0.1171875] = 1 # 30/255
# markers[rocket_wh > 0.5859375] = 2 # 150/255



# #elevation_map = elevation_map.astype(np.float64)
# #markers = markers.astype(np.int32)
# #segmentation = watershed(elevation_map, markers)



# plt.imshow(markers)
# plt.title('markers')

# # Perform watershed region segmentation 
# segmentation = watershed(elevation_map, markers)

# plt.imshow(segmentation)
# plt.title('Watershed segmentation')

# # plot overlays and contour
# segmentation = nd.binary_fill_holes(segmentation - 1)
# label_rock, _ = nd.label(segmentation)
# # overlay image with different labels
# image_label_overlay = label2rgb(label_rock, image=rocket_wh)

# fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(24, 16), sharey=True)
# ax1.imshow(rocket_wh)
# ax1.contour(segmentation, [0.8], linewidths=1.8, colors='w')
# ax2.imshow(image_label_overlay)


# plt.tight_layout()
# plt.show()



'''
# Test 5 - Canny edge detection with skimage

import numpy as np
import matplotlib.pyplot as plt
from skimage.feature import canny

from skimage.color import rgb2gray
plt.rcParams["figure.figsize"] = (12,8)

# Load the image as rocket cause I do not want to change the name cause I am lazy
rocket = plt.imread("test_images/1000004741.jpg")
rocket_wh = rgb2gray(rocket)

# apply edge segmentation
# plot canny edge detection
edges = canny(rocket_wh)
plt.imshow(edges, interpolation='gaussian')
plt.title('Canny detector')

plt.tight_layout()
plt.show()

'''

'''
import cv2

# Load image
image = cv2.imread("test_images/1000004739.jpg")  # replace with your image path
if image is None:
    print("Error: Image not found")
    exit()

# Convert to grayscale
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

# Blur to reduce noise
blur = cv2.GaussianBlur(gray, (5, 5), 0)

# Edge detection
edges = cv2.Canny(blur, 50, 150)

# Find contours
contours, _ = cv2.findContours(
    edges,
    cv2.RETR_EXTERNAL,
    cv2.CHAIN_APPROX_NONE  # keep all contour points
)

# Copy image for drawing
output = image.copy()

# Draw red dots for each contour point
for contour in contours:
    for point in contour:
        x, y = point[0]
        cv2.circle(output, (x, y), 1, (0, 0, 255), -1)  # red dots

# Show results
cv2.imshow("Edges", edges)
cv2.imshow("Contour Points (Red Dots)", output)

cv2.waitKey(0)
cv2.destroyAllWindows()


'''

'''
import cv2

# Load image
image = cv2.imread("test_images/good_img.jpg")  # replace with your path
if image is None:
    print("Error: Image not found")
    exit()

# Resize (optional but helps consistency)
image = cv2.resize(image, (800, 1000))

# Convert to grayscale
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

# Blur (reduce noise)
blur = cv2.GaussianBlur(gray, (5, 5), 0)

# Adaptive threshold (better for uneven lighting)
thresh = cv2.adaptiveThreshold(
    blur,
    255,
    cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv2.THRESH_BINARY,
    11,   # block size
    2     # constant
)

# Invert if needed (documents often work better white background)
thresh = cv2.bitwise_not(thresh)

# Find contours
contours, _ = cv2.findContours(
    thresh,
    cv2.RETR_EXTERNAL,
    cv2.CHAIN_APPROX_NONE
)


# Draw red dots for contour points
output = image.copy()
# for contour in contours:
#     for i, point in enumerate(contour):
#         if i % 3 == 0:  # reduce density
#             x, y = point[0]
#             cv2.circle(output, (x, y), 2, (0, 0, 255), -1)

# Get largest contour (likely the document)
contours = sorted(contours, key=cv2.contourArea, reverse=True)

doc_contour = contours[0]

# Draw only that one
for point in doc_contour:
    x, y = point[0]
    cv2.circle(output, (x, y), 2, (0, 0, 255), -1)

# Show results
cv2.imshow("Threshold", thresh)
cv2.imshow("Contours (Red Dots)", output)

cv2.waitKey(0)
cv2.destroyAllWindows()

'''

import cv2
import numpy as np
import matplotlib.pyplot as plt

def order_points(pts):
    """
    Orders the 4 coordinates in a consistent way:
    [top-left, top-right, bottom-right, bottom-left]
    """
    rect = np.zeros((4, 2), dtype="float32")

    # The top-left point will have the smallest sum,
    # and the bottom-right point will have the largest sum
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    # The top-right point will have the smallest difference,
    # and the bottom-left will have the largest difference
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]

    return rect

def four_point_transform(image, pts):
    """
    Calculates the homography matrix and warps the perspective.
    """
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    # Calculate the width of the new flat image
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))

    # Calculate the height of the new flat image
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))

    # Define the dimensions of the new flat destination rectangle
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")

    # Get the 3x3 transformation matrix and apply it
    matrix = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, matrix, (maxWidth, maxHeight))

    return warped

def scan_document(image_path):
    # 1. Load the image and keep original for final warp
    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: Could not load image at {image_path}")
        return

    orig = image.copy()

    # Downscale for contour detection (faster, more stable)
    scale = 800 / max(image.shape[:2])
    small = cv2.resize(image, (0, 0), fx=scale, fy=scale)

    # 2. Edge Detection
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(gray, 75, 200)
    # Dilate to close small gaps in document border
    edged = cv2.dilate(edged, np.ones((3, 3), np.uint8), iterations=1)

    # 3. Find Contours — require area > 20% of frame to skip small noise
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
        print("Error: Could not find a document outline. Try a photo with higher contrast against the background.")
        return

    # Scale contour points back up to original image coordinates
    document_contour = (document_contour / scale).astype("float32")

    # 4. The Perspective Transformation
    # Reshape the contour points to be a simple 4x2 array and warp
    warped_image = four_point_transform(orig, document_contour.reshape(4, 2))

    # 5. Post-Processing and Thresholding
    # Convert to grayscale and apply adaptive thresholding for the "scanned" look
    warped_gray = cv2.cvtColor(warped_image, cv2.COLOR_BGR2GRAY)
    
    # This turns the background white and the text crisp black
    scanned_effect = cv2.adaptiveThreshold(
        warped_gray, 255, 
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY, 11, 2
    )

    _, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 6))
    ax1.imshow(cv2.cvtColor(orig, cv2.COLOR_BGR2RGB))
    ax1.set_title("Original")
    ax1.axis("off")
    ax2.imshow(scanned_effect, cmap="gray")
    ax2.set_title("Scanned Document")
    ax2.axis("off")
    plt.tight_layout()
    plt.show()

# Run the scanner
import os
_dir = os.path.dirname(os.path.abspath(__file__))
scan_document(os.path.join(_dir, "test_images", "test_image_2.jpg"))