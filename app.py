# app.py
import streamlit as st
from utils import read_image, pil_from_array, basic_cartoon, smooth_cartoon, image_to_bytes
from PIL import Image
import os

st.set_page_config(page_title="Cartoonify (Streamlit)", layout="centered")

st.title("🖼️ Image → Cartoon (Streamlit)")
st.markdown("Upload an image and convert it to a cartoon. No external API required.")

uploaded = st.file_uploader("Choose an image (jpg / png)", type=["jpg", "jpeg", "png"])

mode = st.selectbox("Choose mode", ["Basic Cartoon (fast)", "Smooth Cartoon", "AnimeGAN2 (optional)"])

col1, col2 = st.columns(2)

if uploaded is not None:
    img_np = read_image(uploaded)
    with col1:
        st.subheader("Original")
        st.image(img_np, use_column_width=True)

    process_btn = st.button("Convert Image")

    if process_btn:
        with st.spinner("Processing..."):
            if mode == "Basic Cartoon (fast)":
                out_np = basic_cartoon(img_np)
            elif mode == "Smooth Cartoon":
                out_np = smooth_cartoon(img_np)
            else:
                # AnimeGAN2 path (optional)
                st.info("AnimeGAN2 mode requires a local model file at /models/animegan2.pth and PyTorch installed.")
                model_path = os.path.join("models", "animegan2.pth")
                if os.path.exists(model_path):
                    try:
                        import torch
                        # Minimal placeholder: user must provide a proper inference function
                        st.warning("Detected model file, but this app includes a placeholder anime-step — replace with your AnimeGAN2 inference code.")
                        # For now fall back to smooth_cartoon to avoid crash
                        out_np = smooth_cartoon(img_np)
                    except Exception as e:
                        st.error("PyTorch not installed in environment. Install torch to use AnimeGAN2.")
                        out_np = smooth_cartoon(img_np)
                else:
                    st.error("AnimeGAN2 model not found in /models/animegan2.pth. Using Smooth Cartoon instead.")
                    out_np = smooth_cartoon(img_np)

        with col2:
            st.subheader("Result")
            st.image(out_np, use_column_width=True)
            pil_out = pil_from_array(out_np)
            bytes_io = image_to_bytes(pil_out, fmt="JPEG")
            st.download_button("⬇️ Download Result", data=bytes_io, file_name="cartoon.jpg", mime="image/jpeg")
else:
    st.info("Upload an image to begin. Example images work best with faces or simple scenes.")
