"""Render a textured orthographic catalog portrait from the supplied GLB, on CPU."""
import io
import json
import struct
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

data = Path(sys.argv[1]).read_bytes()
length = struct.unpack_from('<I', data, 12)[0]
gltf = json.loads(data[20:20 + length])
binary = memoryview(data)[28 + length:]
dtypes = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}
components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def accessor(index):
    a = gltf['accessors'][index]
    v = gltf['bufferViews'][a['bufferView']]
    dtype = np.dtype(dtypes[a['componentType']])
    count = components[a['type']]
    offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return np.ndarray((a['count'], count), dtype, buffer=binary, offset=offset,
                      strides=(v.get('byteStride', dtype.itemsize * count), dtype.itemsize)).copy()

prim = gltf['meshes'][0]['primitives'][0]
points = accessor(prim['attributes']['POSITION']).astype(float)
normals = accessor(prim['attributes']['NORMAL']).astype(float)
uv = accessor(prim['attributes']['TEXCOORD_0']).astype(float)
faces = accessor(prim['indices']).reshape(-1, 3)
mat = gltf['materials'][prim.get('material', 0)]
tex = gltf['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]
view = gltf['bufferViews'][gltf['images'][tex['source']]['bufferView']]
texture = np.asarray(Image.open(io.BytesIO(binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']])).convert('RGB'))
minimum, maximum = points.min(axis=0), points.max(axis=0)
points -= (minimum + maximum) / 2
forward = np.array([2.8, 1.5, 4.5]); forward /= np.linalg.norm(forward)
right = np.cross([0, 1, 0], forward); right /= np.linalg.norm(right)
up = np.cross(forward, right)
rotation = np.stack([right, up, forward], axis=1)
camera = points @ rotation
width = height = 512
extent = np.ptp(camera[:, :2], axis=0)
scale = min(408 / extent[0], 402 / extent[1])
screen = camera.copy()
screen[:, 0] = camera[:, 0] * scale + width / 2
screen[:, 1] = -camera[:, 1] * scale + 248
zbuffer = np.full((height, width), -np.inf)
pixels = np.zeros((height, width, 4), dtype=np.uint8)
light = np.array([-0.45, 0.8, 0.65]); light /= np.linalg.norm(light)
shade = np.clip(0.58 + 0.45 * (normals @ light) + 0.12 * (normals @ forward), 0.36, 1.15)
for face in faces:
    p = screen[face]
    x0, y0 = np.maximum(np.floor(p[:, :2].min(axis=0)).astype(int), 0)
    x1, y1 = np.minimum(np.ceil(p[:, :2].max(axis=0)).astype(int), [width - 1, height - 1])
    if x1 < x0 or y1 < y0:
        continue
    xx, yy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    denom = (p[1, 1] - p[2, 1]) * (p[0, 0] - p[2, 0]) + (p[2, 0] - p[1, 0]) * (p[0, 1] - p[2, 1])
    if abs(denom) < 1e-9:
        continue
    a = ((p[1, 1] - p[2, 1]) * (xx - p[2, 0]) + (p[2, 0] - p[1, 0]) * (yy - p[2, 1])) / denom
    b = ((p[2, 1] - p[0, 1]) * (xx - p[2, 0]) + (p[0, 0] - p[2, 0]) * (yy - p[2, 1])) / denom
    c = 1 - a - b
    depth = a * p[0, 2] + b * p[1, 2] + c * p[2, 2]
    current = zbuffer[y0:y1+1, x0:x1+1]
    mask = (a >= -1e-5) & (b >= -1e-5) & (c >= -1e-5) & (depth > current)
    if not mask.any():
        continue
    texcoord = a[..., None] * uv[face[0]] + b[..., None] * uv[face[1]] + c[..., None] * uv[face[2]]
    tx = np.clip((texcoord[..., 0] * (texture.shape[1]-1)).astype(int), 0, texture.shape[1]-1)
    ty = np.clip((texcoord[..., 1] * (texture.shape[0]-1)).astype(int), 0, texture.shape[0]-1)
    brightness = a * shade[face[0]] + b * shade[face[1]] + c * shade[face[2]]
    color = np.clip(texture[ty, tx] * brightness[..., None], 0, 255).astype(np.uint8)
    tile = pixels[y0:y1+1, x0:x1+1]
    tile[mask, :3] = color[mask]
    tile[mask, 3] = 255
    current[mask] = depth[mask]
shadow = Image.new('RGBA', (width, height))
draw = ImageDraw.Draw(shadow)
draw.ellipse((135, 415, 377, 450), fill=(37, 42, 24, 58))
shadow = shadow.filter(ImageFilter.GaussianBlur(13))
shadow.alpha_composite(Image.fromarray(pixels))
shadow.save(sys.argv[2], 'WEBP', quality=92, method=6)
print('Portrait:', Path(sys.argv[2]).name, flush=True)
