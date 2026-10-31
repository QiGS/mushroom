from PIL import Image
import sys
im = Image.open(sys.argv[1]).convert('RGB')
size = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
im.thumbnail((size, size), Image.Resampling.LANCZOS)
im.save(sys.argv[2], quality=87, optimize=True)
