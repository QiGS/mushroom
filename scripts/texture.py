from PIL import Image
import sys
im = Image.open(sys.argv[1]).convert('RGB')
im.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
im.save(sys.argv[2], quality=87, optimize=True)
