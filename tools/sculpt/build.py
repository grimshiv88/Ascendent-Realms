# Turn the sculpted dwarf STL into a light game mesh: Y up, feet on the ground, height 1, facing +Z,
# with a region id per vertex (skin, hair, shirt, ...) so the game can colour it.
import sys, numpy as np, trimesh, fast_simplification, struct, json
from scipy.spatial import cKDTree
src, out, target = sys.argv[1], sys.argv[2], int(sys.argv[3])
m = trimesh.load(src)
V = m.vertices.copy()
V = np.stack([V[:, 0], V[:, 2], -V[:, 1]], 1)       # Z-up -> Y-up, front to +Z
V[:, 1] -= V[:, 1].min(); H = V[:, 1].max(); V /= H
V[:, 0] -= (V[:, 0].min() + V[:, 0].max()) / 2; V[:, 2] -= (V[:, 2].min() + V[:, 2].max()) / 2
F = m.faces
full = trimesh.Trimesh(V, F, process=False)
N = full.vertex_normals
# how busy the surface is around each point: hair and beard strands are, cloth and skin aren't
e = full.edges_unique
d = 1 - np.einsum('ij,ij->i', N[e[:, 0]], N[e[:, 1]])
acc = np.zeros(len(V)); cnt = np.zeros(len(V))
np.add.at(acc, e[:, 0], d); np.add.at(acc, e[:, 1], d); np.add.at(cnt, e[:, 0], 1); np.add.at(cnt, e[:, 1], 1)
rough = acc / np.maximum(cnt, 1)
tree = cKDTree(V)
# smooth it over a small neighbourhood
idx = tree.query(V[::1], k=40)[1]
rough_s = rough[idx].mean(1)
np.save(out + '.rough.npy', rough_s)
v2, f2 = fast_simplification.simplify(V.astype(np.float32), F.astype(np.int32), target_reduction=1 - target / len(F))
dec = trimesh.Trimesh(v2, f2, process=True)
v2, f2 = dec.vertices, dec.faces
r2 = rough_s[tree.query(v2)[1]]
print('faces', len(f2), 'verts', len(v2), 'rough pct', np.percentile(r2, [10, 50, 75, 90, 95]))
np.savez(out + '.npz', v=v2, f=f2, r=r2)
