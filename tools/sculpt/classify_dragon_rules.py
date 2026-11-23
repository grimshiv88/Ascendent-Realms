SC, HORN, BELLY, WING, CLOTH, CLAW, BELT, METAL, WBONE, EYES = range(10)
r = d['r']
wing = (y > 0.3) & ((ax > 0.24) | ((ax > 0.12) & (z < -0.03)) | ((ax > 0.17) & (y > 0.72) & (z < -0.01)))
# legs: close to the line from hip to knee to ankle on their side
def seg_dist(p, a, b):
    a, b = np.array(a), np.array(b); ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)
P = np.stack([ax, y, z], 1)
legd = np.minimum(seg_dist(P, [0.06, 0.39, 0.03], [0.09, 0.21, 0.06]) / 0.085, seg_dist(P, [0.09, 0.21, 0.06], [0.1, 0.06, 0.04]) / 0.065)
footd = seg_dist(P, [0.1, 0.06, 0.04], [0.11, 0.0, 0.16]) / 0.07
leg = (np.minimum(legd, footd) < 1) & (y < 0.42)
leg |= (y < 0.06) & (z > -0.03) & (ax < 0.17)
tail = (y < 0.36) & (((z < -0.04) & (ax < 0.12)) | ((y < 0.15) & (z < -0.04)) | ((y < 0.22) & (x < -0.15)) | ((y < 0.25) & (z < -0.25))) & ~leg
R[wing] = WING
belly = (((y > 0.43) & (y < 0.7) & (ax < 0.07)) | ((y >= 0.7) & (y < 0.78) & (ax < 0.05))) & (z > 0.07) & ~wing
R[belly] = BELLY
R[(y > 0.86) & (ax < 0.13) & ~wing] = HORN
# ridge spikes down the back and tail: sharp bits behind the body
spikes = (r > float(sys.argv[5])) & (z < -0.02) & (ax < 0.08) & (y < 0.82) & ~wing
R[spikes] = HORN
R[tail & (r > float(sys.argv[5]))] = HORN
# claws on the fingers and toes
R[(y < 0.38) & (y > 0.29) & (ax > 0.16) & ~tail & ~wing] = CLAW
R[(y < 0.02) & (z > 0.12)] = CLAW
tree = cKDTree(v); nb = tree.query(v, k=10)[1]
sp = (R == HORN) & (y < 0.82)
R[sp & ((R[nb] == HORN).mean(1) < 0.5)] = SC
np.save(out + '.groups.npy', np.stack([wing, tail]))
# skinning groups, stored in the high bits: 1 body, 2 wing, 3 tail, 4 arm
G = np.ones(len(v), np.uint8)
arm = ~tail & (y > 0.33) & (y < 0.69) & (ax > 0.10) & (z > -0.04) & ((y > 0.45) | (ax > 0.15)) & ((y < 0.58) | (ax < 0.17)) & (ax < 0.24)
# keep only the two biggest connected pieces (the arms), so bits of hip and wing drop out
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
e = np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]])
e = e[arm[e[:, 0]] & arm[e[:, 1]]]
nc, lab = connected_components(coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(len(v), len(v))), directed=False)
cnt = np.bincount(lab[arm], minlength=nc)
keep = np.argsort(cnt)[-2:]
arm = arm & np.isin(lab, keep)
# the wing group is generous: near the root the weights fade into the body anyway
wingG = ~arm & ~tail & (y > 0.28) & ((ax > 0.24) | ((ax > 0.1) & (z < 0.0)) | ((ax > 0.14) & (y > 0.72) & (z < 0.04)))
G[wingG] = 2; G[tail] = 3; G[arm] = 4
R = (R | (G << 4)).astype(np.uint8)
gf = G[f]
mixed = lambda a, b: ((gf == a).any(1) & (gf == b).any(1))
lowtail = (gf == 3).any(1) & (gf != 3).any(1) & (y[f].max(1) < 0.3)
cut = mixed(2, 3) | mixed(3, 4) | (mixed(2, 4) & (y[f].min(1) < 0.6)) | lowtail
print('cut faces', cut.sum())
f = f[~cut]
