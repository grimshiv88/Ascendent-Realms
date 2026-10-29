// The playable races as sculpted bodies: each race's build (body plan options for humanoid.js) and
// its usual look (hair, skin, eyes, clothes). The game's own colour choices for each race come from
// APPEARANCE (game-data.mjs); `look` is the race's usual colouring where that differs.
export const RACES = {
  // tall and slender, long-limbed and long-legged, with long pointed ears, sharp eyes and long silky hair
  elf: {
    body: { height: 1.95, legs: 1.08, arms: 1.02, torso: 0.97, bulk: 0.86, muscle: 0.38, shoulders: 0.96, hips: 0.94, waist: 0.92, neck: 0.88, ears: 'elf', earSize: 1.1, jaw: 0.88, chin: 0.88, head: 0.96, fingers: 1.08, nose: 0.95 },
    hair: 'long', eyes: { eyeShape: 1.04, sharp: 0.85 },
    look: { skin: '#f0d8c4', hair: '#e4e6ee', eyes: '#58d08a' },
    outfit: { sleeves: 'long', tunic: true, shirt: '#3f6b3a', trousers: '#4a3a28', bootColour: '#2e2318', tallBoots: true },
  },
  // short, broad and heavily muscled: a deep chest, thick arms and neck, big hands, a hard lined face
  // with a heavy brow and thick brows, a drooping moustache and a long, thick, braided beard
  dwarf: {
    body: { height: 1.35, legs: 0.74, arms: 0.9, torso: 1.04, bulk: 1.32, muscle: 0.8, shoulders: 1.24, chest: 1.18, waist: 1.16, hips: 1.08, belly: 0.25, neck: 1.4, hands: 1.18, feet: 1.05, head: 1.1, nose: 1.5, jaw: 1.14, cheeks: 1.1, brow: 1.2, beard: 1.4, moustache: 1, braid: 1, ridges: 1 },
    hair: 'short', eyes: { eyeShape: 0.92, eyeSize: 0.9, sharp: 0.7, browThick: 2.3, wrinkles: 1 },
    look: { skin: '#d9a888', hair: '#b5462a', eyes: '#6aa8e0' },
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
  // oni-like: a horn (or a pair) from the forehead, sharp eyes with dark circles under them, a fit,
  // slim body with long strong legs and strong arms
  beastkin: {
    body: { height: 1.85, bulk: 0.96, muscle: 0.62, legs: 1.05, shoulders: 1.04, waist: 0.92, hips: 0.95, jaw: 0.95, chin: 0.92, horns: 2, hornLen: 1 },
    hair: 'spiky', eyes: { eyeShape: 1, sharp: 0.95, darkCircles: 0.8 },
    look: { skin: '#ecc8aa', hair: '#b8322a', eyes: '#e8443a', horn: '#1c1a1e' },
    outfit: { sleeves: 'long', shirt: '#2a304a', trousers: '#24221e', bootColour: '#1e1a16' },
  },
};

// A goblin's six stages, from just born to the last evolution (see the Rulebook). Each is a full
// build; the game moves a goblin to the next one when it evolves. Green skin, big pointed ears, and
// only a ragged loincloth (with a fur vest at the third stage).
export const GOBLIN_STAGES = [
  // 1. just born: small and thin, a big bald head, a big hooked nose, long ears, bent over
  { name: 'Goblin', body: { height: 0.95, head: 1.32, legs: 0.86, arms: 1.06, bulk: 0.8, muscle: 0.12, shoulders: 0.86, chest: 0.88, waist: 0.86, hips: 0.88, neck: 0.8, ears: 'goblin', earSize: 1.25, nose: 2.2, jaw: 0.86, chin: 0.85, brow: 0.6, fingers: 1.1 },
    hair: 'bald', eyes: { eyeSize: 1.15, sharp: 0.6 }, stoop: 1,
    outfit: { shirt: false, trousers: false, boots: false, loincloth: { length: 0.2, colour: '#7a6a50' } } },
  // 2. hobgoblin: taller and lean, wiry muscle, spiky hair
  { name: 'Hobgoblin', body: { height: 1.4, head: 1.12, legs: 0.98, bulk: 0.88, muscle: 0.45, shoulders: 0.95, waist: 0.88, ears: 'goblin', earSize: 1.1, nose: 2, jaw: 0.95, brow: 0.7 },
    hair: 'spiky', eyes: { sharp: 0.8 }, stoop: 0.4,
    outfit: { shirt: false, trousers: false, boots: false, loincloth: { length: 0.26, colour: '#6a5a44' } } },
  // 3. goblin rider: fit and strong, a fur vest
  { name: 'Goblin Rider', body: { height: 1.5, head: 1.06, legs: 1, bulk: 0.94, muscle: 0.6, shoulders: 1.02, waist: 0.9, ears: 'goblin', earSize: 1, nose: 1.9, jaw: 1, brow: 0.8 },
    hair: 'spiky', eyes: { sharp: 0.85 }, stoop: 0.2,
    outfit: { sleeves: 'none', shirt: '#6a4a30', shirtCloth: 'leather', tunic: false, trousers: false, boots: false, loincloth: { length: 0.3, colour: '#5a4a38' } } },
  // 4. goblin lord: tall and muscular, long hair
  { name: 'Goblin Lord', body: { height: 1.8, head: 1, legs: 1.02, bulk: 1.04, muscle: 0.78, shoulders: 1.1, chest: 1.06, waist: 0.94, ears: 'goblin', earSize: 0.95, nose: 1.8, jaw: 1.08, brow: 0.9 },
    hair: 'long', eyes: { sharp: 0.9 }, stoop: 0,
    outfit: { shirt: false, trousers: false, boots: false, loincloth: { length: 0.36, colour: '#5a4a38' } } },
  // 5. ogre lord: huge and massively muscled, a thick neck, short hair, small tusks
  { name: 'Ogre Lord', body: { height: 2.05, head: 0.92, legs: 0.98, bulk: 1.34, muscle: 1, shoulders: 1.3, chest: 1.22, waist: 1.08, hips: 1.08, neck: 1.5, hands: 1.2, feet: 1.12, ears: 'goblin', earSize: 0.8, nose: 1.8, jaw: 1.25, chin: 1.15, brow: 1.1, tusks: 0.8 },
    hair: 'short', eyes: { eyeSize: 0.9, sharp: 0.9 }, stoop: 0.15,
    outfit: { shirt: false, trousers: false, boots: false, loincloth: { length: 0.36, colour: '#4a3e30' } } },
  // 6. goblin emperor: tall, broad and strong, long hair under a crown of bone spikes, a long cloth
  { name: 'Goblin Emperor', body: { height: 2.15, head: 0.98, legs: 1.04, bulk: 1.12, muscle: 0.9, shoulders: 1.16, chest: 1.1, waist: 0.96, neck: 1.2, ears: 'goblin', earSize: 0.9, nose: 1.7, jaw: 1.12, brow: 0.9, crown: 1 },
    hair: 'long', eyes: { sharp: 1 }, stoop: 0, horn: '#d8cba8',
    outfit: { shirt: false, trousers: false, boots: false, loincloth: { length: 0.5, colour: '#3e3428' } } },
];
