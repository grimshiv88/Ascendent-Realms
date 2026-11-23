// Fix the dwarf sculpt's beard: strands hanging over the tunic were marked as tunic. Hair grows
// down into tunic vertices in front of the belly until it meets the crease where the beard rests on it.
// usage: node tools/sculpt/fix_dwarf_beard.mjs in.bin out.bin [iterations] [crease]
import fs from 'fs';
function load(path) {
  const b = fs.readFileSync(path); const buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
  const dv = new DataView(buf); const nv = dv.getUint32(4, true), nf = dv.getUint32(8, true);
  let o = 12; const q = new Int16Array(buf, o, nv * 3); o += nv * 6; const qn = new Int8Array(buf, o, nv * 3); o += nv * 3;
  const tagOff = o; const tag = new Uint8Array(buf, o, nv); o += nv;
  const index = nv < 65536 ? new Uint16Array(buf, o, nf * 3) : new Uint32Array(buf, o, nf * 3);
  return { b, nv, nf, q, qn, tag, tagOff, index };
}
function neighbours(nv, index) {
  const nb = Array.from({ length: nv }, () => new Set());
  for (let f = 0; f < index.length; f += 3) { const a = index[f], b = index[f + 1], c = index[f + 2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  return nb.map((s) => [...s]);
}
const [, , src, dst, iters = '25', conc = '0.15'] = process.argv;
const M = load(src); const nb = neighbours(M.nv, M.index);
const P = (i) => [M.q[i*3] / 30000, M.q[i*3+1] / 30000, M.q[i*3+2] / 30000], N = (i) => [M.qn[i*3] / 127, M.qn[i*3+1] / 127, M.qn[i*3+2] / 127];
const HAIR = 1, TUNIC = 3, SKIN = 0;
const reg = Uint8Array.from(M.tag, (t) => t & 15);
let grown = 0;
for (let it = 0; it < +iters; it++) {
  const add = [];
  for (let i = 0; i < M.nv; i++) {
    if (reg[i] !== HAIR) continue;
    const pi = P(i), ni = N(i);
    for (const j of nb[i]) {
      if (reg[j] !== TUNIC) continue;
      const pj = P(j); const ax = Math.abs(pj[0]);
      if (pj[1] < 0.455 || pj[1] > 0.62 || pj[2] < 0.03 || ax > 0.17 || pj[1] > pi[1] + 0.004) continue;
      const d = [pj[0]-pi[0], pj[1]-pi[1], pj[2]-pi[2]], l = Math.hypot(...d);
      if ((d[0]*ni[0] + d[1]*ni[1] + d[2]*ni[2]) / l > +conc) continue; // a crease: the beard ends here
      add.push(j);
    }
  }
  if (!add.length) break;
  for (const j of add) if (reg[j] !== HAIR) { reg[j] = HAIR; grown++; }
}
console.log('grown', grown);
const out = Buffer.from(M.b);
for (let i = 0; i < M.nv; i++) out[M.tagOff + i] = (M.tag[i] & 0xf0) | reg[i];
fs.writeFileSync(dst, out);
