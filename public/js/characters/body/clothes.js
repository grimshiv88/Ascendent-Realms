// Clothes sculpted from the body itself: each piece is the body's own surface grown outwards by
// the cloth's thickness, kept only inside the piece's region (the trunk and arms for a shirt, the
// hips and legs for trousers) and cut off at its hems. So clothes fit every race and build, and bend
// with the body (they are skinned to the same bones). Skin a garment covers is not drawn.
// Plain numbers and arrays only (no three.js).
import { cone, ell } from './sdf.js';

// The pieces of an outfit. Each: thick (metres), region (shapes; the piece is inside any of them),
// cuts (bone, point, normal: the piece keeps the side the normal points away from), extra (shapes
// added to the piece, like a boot's sole), hole (shapes cut out, like the neck of a shirt).
// `o` picks the cut: { sleeves: 'long'|'short'|'none', legs: 'long'|'short', boots: true }
export function outfitPlan(plan, o = {}) {
  const pos = Object.fromEntries(plan.bones.map((b) => [b.name, b.pos]));
  // how big round the body is (the regions must hold a broad dwarf as well as a slim elf)
  const P = plan.P, wide = P.bulk * Math.max(P.shoulders, P.chest, P.hips, P.waist + P.belly * 0.3);
  const hipY = pos.hips[1], neckY = pos.neck[1], kneeL = pos.leftLowerLeg, ankleL = pos.leftFoot;
  const torsoTop = neckY + 0.02;
  const pieces = [];
  const sleeves = o.sleeves || 'long';
  const legs = o.legs || 'long';

  // shirt (or tunic)
  {
    const region = [cone([0, hipY - 0.4, 0], [0, torsoTop - 0.06, 0], 0.27 * wide, 0.25 * wide, { bone: 'spine' })];
    const cuts = [
      { bone: 'hips', p: [0, hipY - (o.tunic ? 0.16 : 0.07), 0], n: [0, -1, 0] }, // the hem
      { bone: 'upperChest', p: [0, neckY + 0.05, 0], n: [0, 1, 0] },
    ];
    for (const L of ['left', 'right']) {
      const sh = pos[`${L}UpperArm`], el = pos[`${L}LowerArm`], wr = pos[`${L}Hand`];
      if (sleeves === 'none') {
        // sleeveless: the arm's region is cut away at the shoulder
        continue;
      }
      region.push(cone(sh, el, 0.11, 0.1, { bone: `${L}UpperArm` }));
      if (sleeves === 'long') {
        region.push(cone(el, wr, 0.1, 0.09, { bone: `${L}LowerArm` }));
        cuts.push({ bone: `${L}LowerArm`, p: [wr[0], wr[1] + 0.035, wr[2]], n: [0, -1, 0], r: 0.1 * wide });
      } else {
        cuts.push({ bone: `${L}UpperArm`, p: [sh[0], (sh[1] + el[1]) / 2 - 0.02, sh[2]], n: [0, -1, 0], r: 0.1 * wide });
      }
    }
    const armholes = [];
    // (without sleeves, the shirt still runs over the tops of the shoulders)
    if (sleeves === 'none') region.push(cone(pos.leftUpperArm, pos.rightUpperArm, 0.1 * wide, 0.1 * wide, { bone: 'upperChest' }));
    if (sleeves === 'none') for (const L of ['left', 'right']) {
      // the armhole: down past the shoulder joint, rounded under the arm
      const sh = pos[`${L}UpperArm`], s = Math.sign(sh[0]);
      cuts.push({ bone: `${L}UpperArm`, p: [sh[0] + s * 0.01, sh[1], sh[2]], n: [s, 0, 0], r: 0.2 * wide });
      const el = pos[`${L}LowerArm`];
      armholes.push(cone([sh[0] + s * 0.012, sh[1] - 0.03, sh[2]], el, 0.06 * wide, 0.06 * wide, { bone: `${L}UpperArm` }));
    }
    // the neck of the shirt
    // (an ellipsoid reaching through front to back, so its edge meets the skin square on)
    const hole = [ell([0, neckY - 0.012, 0.09], [0.06, 0.062, 0.13], { bone: 'neck' }), ell([0, neckY + 0.015, -0.03], [0.064, 0.05, 0.16], { bone: 'neck' }), cone([0, neckY + 0.03, -0.01], [0, neckY + 0.3, -0.02], 0.06, 0.06, { bone: 'neck' }), ...armholes];
    pieces.push({ name: 'shirt', thick: o.tunic ? 0.012 : 0.006, region, cuts, hole, skirt: o.tunic ? [hipY + 0.06, hipY - 0.17, 0.035] : null, tubes: sleeves === 'none' ? [] : ['left', 'right'].flatMap((L) => [[`${L}UpperArm`, `${L}LowerArm`, 0.004], ...(sleeves === 'long' ? [[`${L}LowerArm`, `${L}Hand`, 0.01]] : [])]), colour: o.shirt || '#d8d0c0', cloth: 'linen' });
  }

  // trousers
  {
    const region = [cone([0, hipY - 0.16, 0], [0, hipY + 0.12, 0], 0.23 * wide, 0.23 * wide, { bone: 'hips' })];
    const cuts = [{ bone: 'hips', p: [0, hipY + 0.085, 0], n: [0, 1, 0] }];
    for (const L of ['left', 'right']) {
      const hp = pos[`${L}UpperLeg`], kn = pos[`${L}LowerLeg`], an = pos[`${L}Foot`];
      region.push(cone(hp, kn, 0.14, 0.11, { bone: `${L}UpperLeg` }));
      if (legs === 'long') {
        region.push(cone(kn, an, 0.11, 0.09, { bone: `${L}LowerLeg` }));
        // tucked into the boots, or down to the ankle
        const bootTop = kn[1] - (kn[1] - an[1]) * (o.tallBoots ? 0.15 : 0.42);
        cuts.push({ bone: `${L}LowerLeg`, p: [an[0], o.boots === false ? an[1] + 0.025 : bootTop - 0.04, an[2]], n: [0, -1, 0] });
      } else {
        cuts.push({ bone: `${L}UpperLeg`, p: [kn[0], kn[1] + 0.06, kn[2]], n: [0, -1, 0] });
      }
    }
    pieces.push({ name: 'trousers', thick: 0.008, region, cuts, tubes: ['left', 'right'].flatMap((L) => [[`${L}UpperLeg`, `${L}LowerLeg`, 0.004], ...(legs === 'long' ? [[`${L}LowerLeg`, `${L}Foot`, 0.007]] : [])]), colour: o.trousers || '#4a3a2c', cloth: 'wool' });
  }

  // boots, with a sole and a heel
  if (o.boots !== false) {
    const region = [], cuts = [], extra = [];
    for (const L of ['left', 'right']) {
      const kn = pos[`${L}LowerLeg`], an = pos[`${L}Foot`], toe = pos[`${L}Toes`];
      const top = kn[1] - (kn[1] - an[1]) * (o.tallBoots ? 0.15 : 0.42);
      region.push(cone([an[0], top + 0.05, an[2]], [an[0], an[1] - 0.06, an[2]], 0.1, 0.1, { bone: `${L}LowerLeg` }));
      region.push(cone([an[0], an[1] - 0.02, an[2] - 0.06], [toe[0], toe[1], toe[2] + 0.06], 0.08, 0.07, { bone: `${L}Foot` }));
      region.push(cone([toe[0], toe[1], toe[2] - 0.02], [toe[0], toe[1], toe[2] + 0.09], 0.07, 0.06, { bone: `${L}Toes` }));
      cuts.push({ bone: `${L}LowerLeg`, p: [an[0], top, an[2]], n: [0, 1, 0] });
      // the sole: a flat slab under the whole foot, thicker at the heel
      extra.push(ell([an[0], 0.012, (an[2] + toe[2]) / 2 + 0.01], [0.046, 0.013, 0.135], { bone: `${L}Foot`, blend: 0.01 }));
      extra.push(ell([an[0], 0.018, an[2] - 0.035], [0.036, 0.02, 0.04], { bone: `${L}Foot`, blend: 0.01 }));
    }
    const tubes = ['left', 'right'].map((L) => [`${L}LowerLeg`, `${L}Foot`, 0.012]);
    pieces.push({ name: 'boots', thick: 0.01, region, cuts, extra, tubes, colour: o.bootColour || '#3a2a1e', cloth: 'leather' });
  }
  return pieces;
}
