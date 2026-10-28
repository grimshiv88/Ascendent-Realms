# Regions for the True Dragon: 0 scales, 1 horns/spikes/claws, 2 belly, 3 wing membrane, 4 loincloth,
# 5 dark (claws), 6 belt, 7 metal (bracers), 8 wing bones, 9 eyes
import sys, numpy as np, struct
from scipy.spatial import cKDTree
d = np.load(sys.argv[1]); out = sys.argv[2]
v, f = d['v'].copy(), d['f']
v[:, 0] += 0.015; v[:, 2] -= 0.17
x, y, z = v[:, 0], v[:, 1], v[:, 2]; ax = np.abs(x)
R = np.zeros(len(v), np.uint8)
mode = sys.argv[3] if len(sys.argv) > 3 else ''
if mode != 'plain':
    exec(open(sys.argv[4]).read())
print(np.bincount(R & 15, minlength=10), np.bincount(R >> 4))
fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
n = np.zeros_like(v)
for k in range(3): np.add.at(n, f[:, k], fn)
n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
np.savez(out + '.npz', v=v, f=f, R=R)
with open(out, 'wb') as fh:
    fh.write(b'ARM1'); fh.write(struct.pack('<II', len(v), len(f)))
    fh.write(np.round(v * 30000).astype(np.int16).tobytes()); fh.write(np.round(n * 127).astype(np.int8).tobytes()); fh.write(R.tobytes())
    fh.write(f.astype(np.uint16).tobytes())
