// The playable races as sculpted bodies: each race's build (body plan options for humanoid.js) and
// its usual look (hair, skin, eyes, clothes). The game's own colours for each race come from
// APPEARANCE (game-data.mjs); these are the shapes.
export const RACES = {
  // tall and slender, long-limbed, with long pointed ears
  elf: {
    body: { height: 1.95, legs: 1.06, arms: 1.02, torso: 0.98, bulk: 0.86, muscle: 0.22, shoulders: 0.94, hips: 0.95, waist: 0.95, neck: 0.9, ears: 'elf', earSize: 1, jaw: 0.9, chin: 0.92, head: 0.98, fingers: 1.08 },
    hair: 'long', eyes: { eyeShape: 1.06 },
    outfit: { sleeves: 'long', tunic: true, shirt: '#3f6b3a', trousers: '#4a3a28', bootColour: '#2e2318', tallBoots: true },
  },
  // short and broad: a deep chest, thick arms and neck, big hands, a heavy brow and a long beard
  dwarf: {
    body: { height: 1.35, legs: 0.74, arms: 0.9, torso: 1.04, bulk: 1.32, muscle: 0.68, shoulders: 1.22, chest: 1.16, waist: 1.18, hips: 1.08, belly: 0.35, neck: 1.35, hands: 1.15, feet: 1.05, head: 1.1, nose: 1.4, jaw: 1.12, brow: 0.8, beard: 1 },
    hair: 'short', eyes: { eyeShape: 0.92, eyeSize: 0.92 },
    outfit: { sleeves: 'short', tunic: true, shirt: '#7a2e22', trousers: '#4a3a2a', bootColour: '#2a2018' },
  },
  // small and round-faced, with curly hair, small pointed ears and big bare feet
  hobbit: {
    body: { height: 1.05, legs: 0.86, arms: 0.95, head: 1.16, bulk: 1.06, muscle: 0.12, belly: 0.3, feet: 1.4, hands: 0.95, ears: 'elf', earSize: 0.5, cheeks: 1.2, nose: 0.9, jaw: 0.95 },
    hair: 'curly', eyes: { eyeSize: 1.08 },
    outfit: { sleeves: 'long', shirt: '#c9a24a', trousers: '#5a4a2a', legs: 'short', boots: false },
  },
  // huge and heavy, broad-shouldered, a strong jaw with small tusks
  giant: {
    body: { height: 4.0, bulk: 1.28, muscle: 0.72, shoulders: 1.18, chest: 1.14, waist: 1.1, neck: 1.3, hands: 1.15, head: 0.94, jaw: 1.25, chin: 1.2, brow: 0.9, nose: 1.25, tusks: 1 },
    hair: 'short', eyes: { eyeSize: 0.9, eyeShape: 0.9 },
    outfit: { sleeves: 'none', tunic: true, shirt: '#6b5a42', trousers: '#4a3e30', bootColour: '#3a2e22' },
  },
  // a person with a wolf's ears and tail, sharp eyes and claws
  beastkin: {
    body: { height: 1.85, bulk: 1.02, muscle: 0.5, legs: 1.03, ears: 'none', animalEars: 'wolf', tail: 'wolf', claws: true },
    hair: 'spiky', eyes: { slit: false, eyeShape: 0.95 },
    outfit: { sleeves: 'short', shirt: '#4a3626', trousers: '#3a3a3a', boots: false },
  },
};
