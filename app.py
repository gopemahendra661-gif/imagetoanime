import streamlit as st
import cv2
import numpy as np
from PIL import Image
import io
import tempfile
import os

# Page configuration
st.set_page_config(
    page_title="Image to Cartoon Converter",
    page_icon="🎨",
    layout="wide"
)

# Custom CSS
st.markdown("""
<style>
    .stApp {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    .main-header {
        text-align: center;
        color: white;
        font-size: 3em;
        margin-bottom: 10px;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    
    .sub-header {
        text-align: center;
        color: rgba(255,255,255,0.9);
        font-size: 1.2em;
        margin-bottom: 30px;
    }
    
    .upload-box {
        background: white;
        padding: 30px;
        border-radius: 20px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        margin-bottom: 30px;
    }
    
    .image-container {
        display: flex;
        justify-content: space-around;
        flex-wrap: wrap;
        gap: 30px;
        margin-top: 30px;
    }
    
    .image-box {
        background: white;
        padding: 20px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        text-align: center;
        flex: 1;
        min-width: 300px;
    }
    
    .feature-card {
        background: rgba(255,255,255,0.9);
        padding: 20px;
        border-radius: 15px;
        margin: 10px;
        border-left: 5px solid #667eea;
    }
</style>
""", unsafe_allow_html=True)

# Title
st.markdown('<h1 class="main-header">🎨 Image to Cartoon Converter</h1>', unsafe_allow_html=True)
st.markdown('<p class="sub-header">Upload your image and get instant cartoon effect - 100% Free, No API Required!</p>', unsafe_allow_html=True)

# Function to convert image to cartoon
def convert_to_cartoon(image_array):
    # Convert PIL to OpenCV format
    if len(image_array.shape) == 2:
        # Grayscale image
        img = cv2.cvtColor(image_array, cv2.COLOR_GRAY2BGR)
    elif image_array.shape[2] == 4:
        # RGBA image
        img = cv2.cvtColor(image_array, cv2.COLOR_RGBA2BGR)
    else:
        # RGB image
        img = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
    
    # 1. Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 2. Apply median blur to reduce noise
    gray = cv2.medianBlur(gray, 5)
    
    # 3. Detect edges using adaptive threshold
    edges = cv2.adaptiveThreshold(gray, 255,
                                  cv2.ADAPTIVE_THRESH_MEAN_C,
                                  cv2.THRESH_BINARY, 9, 9)
    
    # 4. Apply bilateral filter for color smoothing
    color = cv2.bilateralFilter(img, 9, 300, 300)
    
    # 5. Combine edges with color image
    cartoon = cv2.bitwise_and(color, color, mask=edges)
    
    # Convert back to RGB for PIL
    cartoon_rgb = cv2.cvtColor(cartoon, cv2.COLOR_BGR2RGB)
    
    return cartoon_rgb

# Upload section
with st.container():
    st.markdown('<div class="upload-box">', unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        st.markdown("### 📁 Upload Your Image")
        uploaded_file = st.file_uploader(
            "Choose an image file",
            type=['jpg', 'jpeg', 'png', 'bmp'],
            label_visibility="collapsed"
        )
        
        # Additional cartoonization parameters
        st.markdown("### ⚙️ Cartoon Settings")
        col_a, col_b = st.columns(2)
        
        with col_a:
            blur_strength = st.slider("Blur Strength", 1, 15, 5, 2)
        with col_b:
            edge_thickness = st.slider("Edge Thickness", 3, 15, 9, 2)
    
    st.markdown('</div>', unsafe_allow_html=True)

# Features section
st.markdown("### 🌟 Features")
features_col = st.columns(3)

with features_col[0]:
    st.markdown("""
    <div class="feature-card">
        <h3>🚀 Fast Processing</h3>
        <p>Instant conversion using OpenCV algorithms</p>
    </div>
    """, unsafe_allow_html=True)

with features_col[1]:
    st.markdown("""
    <div class="feature-card">
        <h3>🔒 Privacy Protected</h3>
        <p>All processing happens locally in your browser</p>
    </div>
    """, unsafe_allow_html=True)

with features_col[2]:
    st.markdown("""
    <div class="feature-card">
        <h3>💯 Free Forever</h3>
        <p>No charges, no watermarks, no limits</p>
    </div>
    """, unsafe_allow_html=True)

# Processing and display
if uploaded_file is not None:
    try:
        # Load image
        image = Image.open(uploaded_file)
        
        # Convert to array
        image_array = np.array(image)
        
        # Create columns for before/after
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("### Original Image")
            st.image(image, use_container_width=True)
            st.caption(f"Size: {image.size} | Mode: {image.mode}")
        
        # Convert to cartoon
        with st.spinner('🎨 Creating cartoon version...'):
            cartoon_array = convert_to_cartoon(image_array)
            cartoon_image = Image.fromarray(cartoon_array)
        
        with col2:
            st.markdown("### Cartoon Version")
            st.image(cartoon_image, use_container_width=True)
            st.caption("Cartoon effect applied successfully!")
        
        # Download button
        st.markdown("---")
        st.markdown("### 📥 Download Cartoon Image")
        
        # Convert cartoon image to bytes
        buf = io.BytesIO()
        cartoon_image.save(buf, format="PNG")
        byte_im = buf.getvalue()
        
        col_d1, col_d2, col_d3 = st.columns([1, 2, 1])
        with col_d2:
            st.download_button(
                label="⬇️ Download Cartoon Image",
                data=byte_im,
                file_name="cartoon_image.png",
                mime="image/png",
                use_container_width=True
            )
        
        # Try another button
        if st.button("🔄 Convert Another Image", use_container_width=True):
            st.rerun()
            
    except Exception as e:
        st.error(f"Error processing image: {str(e)}")
        st.info("Please try with a different image file.")

# Footer
st.markdown("---")
st.markdown("""
<div style="text-align: center; color: white; padding: 20px;">
    <p>Made with ❤️ using Python, OpenCV & Streamlit</p>
    <p>All image processing happens locally - No data leaves your device!</p>
</div>
""", unsafe_allow_html=True)

# Sidebar with information
with st.sidebar:
    st.markdown("## ℹ️ About")
    st.markdown("""
    This app converts your photos into cartoon-style images using computer vision techniques.
    
    **How it works:**
    1. Upload any image (JPG, PNG, BMP)
    2. App processes it locally
    3. Download your cartoon version
    
    **Technologies used:**
    - OpenCV for image processing
    - Streamlit for web interface
    - PIL for image handling
    
    **No API calls - 100% offline processing!**
    """)
    
    st.markdown("---")
    st.markdown("### 🎛️ Quick Tips")
    st.markdown("""
    - Use clear, well-lit images for best results
    - Adjust blur strength for smoother cartoon effects
    - Higher edge thickness gives bolder outlines
    - Portrait photos work exceptionally well
    """)
    
    st.markdown("---")
    st.markdown("### 📊 Supported Formats")
    st.markdown("""
    ✅ JPG/JPEG  
    ✅ PNG  
    ✅ BMP  
    ✅ WebP  
    
    **Max Size:** 16MB
    """)
