from PIL import Image
import numpy as np

def remove_background(image_path, output_path, threshold=240):
    img = Image.open(image_path).convert("RGBA")
    data = np.array(img)
    
    # Calculate difference from white
    r, g, b, a = data.T
    white_diff = (255 - r) + (255 - g) + (255 - b)
    
    # Create mask: True where pixel is NOT white-ish
    mask = white_diff > (255 * 3 - threshold * 3)
    
    # We want to keep the logo. For anti-aliasing, we can make the alpha proportional to the darkness
    # This is a simple version: hard threshold, but soften the edges slightly
    
    # Create new alpha channel
    new_a = np.where(white_diff < 30, 0, a) # anything very close to white becomes transparent
    
    # Try flood fill from corner instead for better results
    from PIL import ImageDraw
    ImageDraw.floodfill(img, (0, 0), (255, 255, 255, 0), thresh=30)
    ImageDraw.floodfill(img, (img.width-1, 0), (255, 255, 255, 0), thresh=30)
    ImageDraw.floodfill(img, (0, img.height-1), (255, 255, 255, 0), thresh=30)
    ImageDraw.floodfill(img, (img.width-1, img.height-1), (255, 255, 255, 0), thresh=30)
    
    img.save(output_path)

remove_background("apps/web/public/logo.png", "apps/web/public/logo_transparent.png")
