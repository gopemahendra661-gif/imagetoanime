# utils.py
import cv2
import numpy as np
from PIL import Image
import io

def read_image(file):
    # file: streamlit uploaded file-like
    image = Image.open(file).convert("RGB")
    return np.array(image)

def pil_from_array(arr):
    return Image.fromarray(arr.astype('uint8'))

def basic_cartoon(img_np):
    """Simple cartoon effect using bilateralFilter + adaptiveThreshold edges"""
    img = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
    # smooth color
    color = cv2.bilateralFilter(img, d=9, sigmaColor=75, sigmaSpace=75)
    # edges
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.medianBlur(gray, 7)
    edges = cv2.adaptiveThreshold(blur, 255,
                                  cv2.ADAPTIVE_THRESH_MEAN_C,
                                  cv2.THRESH_BINARY, 9, 2)
    edges_colored = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
    cartoon = cv2.bitwise_and(color, edges_colored)
    cartoon_rgb = cv2.cvtColor(cartoon, cv2.COLOR_BGR2RGB)
    return cartoon_rgb

def smooth_cartoon(img_np):
    """Smooth / stylized variant using edge-preserving filter + detail enhance"""
    img = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
    # edge-preserving filter (fast)
    smooth = cv2.edgePreservingFilter(img, flags=1, sigma_s=60, sigma_r=0.4)
    # detail enhance
    detail = cv2.detailEnhance(smooth, sigma_s=10, sigma_r=0.15)
    # edges (lighter)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (3,3), 0)
    edges = cv2.Canny(blur, 100, 200)
    edges = cv2.dilate(edges, np.ones((2,2), np.uint8))
    edges_colored = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
    combined = cv2.bitwise_and(detail, detail, mask=edges)
    # blend detail + smooth with edges overlay
    blended = cv2.addWeighted(detail, 0.8, smooth, 0.2, 0)
    final = cv2.bitwise_or(blended, edges_colored)
    final_rgb = cv2.cvtColor(final, cv2.COLOR_BGR2RGB)
    return final_rgb

def image_to_bytes(pil_img, fmt="JPEG"):
    buf = io.BytesIO()
    pil_img.save(buf, format=fmt, quality=95)
    buf.seek(0)
    return buf
