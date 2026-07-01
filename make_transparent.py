from PIL import Image
import numpy as np

def make_transparent():
    # Load image
    img = Image.open('apps/mobile/assets/3d_logo.jpg').convert('RGBA')
    
    # We will do a simple flood fill from the corners
    data = np.array(img)
    
    # Create a mask of the same size, initially 0
    h, w = data.shape[:2]
    mask = np.zeros((h, w), dtype=bool)
    
    # Threshold for black (euclidean distance from 0,0,0)
    # JPEG artifacts might make it not exactly 0.
    def is_bg(r, g, b):
        return r < 20 and g < 20 and b < 20
        
    stack = [(0,0), (0, w-1), (h-1, 0), (h-1, w-1)]
    
    while stack:
        y, x = stack.pop()
        if y < 0 or y >= h or x < 0 or x >= w:
            continue
        if mask[y, x]:
            continue
            
        r, g, b, _ = data[y, x]
        if is_bg(r, g, b):
            mask[y, x] = True
            stack.append((y+1, x))
            stack.append((y-1, x))
            stack.append((y, x+1))
            stack.append((y, x-1))
            
    # Also add some anti-aliasing / feathering if possible, but simple alpha 0 is fine
    data[mask, 3] = 0
    
    out = Image.fromarray(data)
    out.save('apps/mobile/assets/3d_logo_transparent.png')
    print("Done")

make_transparent()
