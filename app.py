from flask import Flask, render_template, request, send_file, url_for
import cv2
import numpy as np
from PIL import Image
import io
import os

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

# Create uploads directory if not exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def convert_to_cartoon(image_path, output_path):
    # Read image
    img = cv2.imread(image_path)
    
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
    
    # Save cartoon image
    cv2.imwrite(output_path, cartoon)
    
    return output_path

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_image():
    if 'file' not in request.files:
        return 'No file uploaded', 400
    
    file = request.files['file']
    
    if file.filename == '':
        return 'No file selected', 400
    
    if file:
        # Save uploaded file
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], 'input.jpg')
        output_path = os.path.join(app.config['UPLOAD_FOLDER'], 'cartoon_output.jpg')
        
        file.save(input_path)
        
        # Convert to cartoon
        cartoon_path = convert_to_cartoon(input_path, output_path)
        
        return render_template('result.html', 
                             original=url_for('static', filename='uploads/input.jpg'),
                             cartoon=url_for('static', filename='uploads/cartoon_output.jpg'))

@app.route('/download')
def download_image():
    return send_file('static/uploads/cartoon_output.jpg', 
                     as_attachment=True, 
                     download_name='cartoon_image.jpg')

if __name__ == '__main__':
    app.run(debug=True)
