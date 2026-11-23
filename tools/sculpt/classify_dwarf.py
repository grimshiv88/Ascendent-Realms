import sys, numpy as np, struct
from scipy.spatial import cKDTree
d = np.load(sys.argv[1]); out = sys.argv[2]
v, f, r = d['v'], d['f'], d['r']
x, y, z = v[:, 0], v[:, 1], v[:, 2]
ax = np.abs(x)
R = np.full(len(v), 3, np.uint8)              # tunic by default
SKIN, HAIR, SHIRT, TUNIC, TROUS, BOOTS, BELT, METAL, LEATH, EYES = range(10)
T = float(sys.argv[3]) if len(sys.argv) > 3 else 0.03
legs = y < 0.30
R[legs & (ax < 0.24)] = TROUS
R[y < 0.185] = BOOTS
arm = (ax > 0.255) & (y < 0.66) & (y > 0.18)
R[arm & (y >= 0.43)] = SHIRT
R[arm & (y < 0.43) & (y >= 0.37)] = SHIRT
R[arm & (y < 0.37)] = SKIN
belt = (y > 0.405) & (y < 0.455) & (ax < 0.25) & ~arm
R[belt] = BELT
R[belt & (ax < 0.055) & (z > 0.05)] = METAL
head = (y > 0.765) & (ax < 0.15)
R[head] = SKIN
face = head & (z > 0.02) & (y > 0.8) & (y < 0.95) & (ax < 0.1)
hair = (r > T) & (y > 0.48) & ((head) | ((ax < 0.2) & (z > 0.0))) & ~(face & (r < T * 2.2))
R[hair] = HAIR
# the beard covers the middle of the chest, narrowing toward its tip
bw = 0.07 + np.clip((y - 0.5) / 0.29, 0, 1) * 0.13
beard = (y > 0.5) & (y < 0.8) & (ax < bw) & (z > 0.03) & ~arm
R[beard] = HAIR
# the back of the head and the top are hair even where smooth-ish
R[head & (z < -0.02) & (y > 0.8)] = HAIR
# the collar and shoulders below the head are tunic, never skin
R[(y > 0.6) & (y <= 0.79) & (R == SKIN)] = TUNIC
R[(y > 0.955)] = HAIR
# grow regions: a vertex surrounded by hair is hair (fills gaps in beard)
tree = cKDTree(v)
nb = tree.query(v, k=12)[1]
for _ in range(2):
    frac = (R[nb] == HAIR).mean(1)
    R[(frac > 0.6) & (y > 0.48) & ~arm] = HAIR
    R[(frac < 0.25) & (R == HAIR) & ~head] = TUNIC
print(np.bincount(R, minlength=10))
# vertex normals
fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
n = np.zeros_like(v)
for k in range(3): np.add.at(n, f[:, k], fn)
n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
q = np.round(v * 30000).astype(np.int16)
qn = np.round(n * 127).astype(np.int8)
with open(out, 'wb') as fh:
    fh.write(b'ARM1'); fh.write(struct.pack('<II', len(v), len(f)))
    fh.write(q.tobytes()); fh.write(qn.tobytes()); fh.write(R.tobytes())
    if len(f) * 3 % 2: pass
    fh.write(f.astype(np.uint16 if len(v) < 65536 else np.uint32).tobytes())
