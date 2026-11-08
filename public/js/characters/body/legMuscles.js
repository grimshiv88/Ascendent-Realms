// The muscles of the hip, thigh, leg and foot, each shaped as it really is and running from its
// real origin to its real insertion (see muscleKit.js for how a belly and its tendons are made).
// Points are given on the bone that carries them (rest, drawing units, the body's left side;
// s = -1 mirrors). Plain numbers and arrays only (no three.js).
import { poseRig } from './muscles.js';
import { boneField } from './boneField.js';
import { muscleKit, softContact } from './muscleKit.js';
import { toeChain } from './legBones.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function goblinLegMuscles(S, { posed = true } = {}) {
  const rig = poseRig(S, posed), rest = poseRig(S, false);
  const B = boneField(S, rig.J); // (a muscle or tendon rests on a bone, never passes through it)
  const parts = [];
  for (const s of [-1, 1]) {
    const { muscle, belly, tendon } = muscleKit(S, { rig, rest, B, s, parts });
    // (the goblin is thickly muscled: the hip, thigh and calf muscles filled out so they meet)
    const big = (n) => { const M = muscle(n); M.sw = 1.3; return M; };
    const H = (p) => ['hips', p], T = (p) => ['UpperLeg', p], L = (p) => ['LowerLeg', p], F = (p) => ['Foot', p];
    // a toe's points (on the foot: the toes bend with it), along its top (up = 1) or its sole (-1)
    const toe = (i, up, from = 0) => toeChain(i).slice(from).flatMap((b) => [F(add(b.p, [0, up * b.rr * 1.1, 0])), F(add(lerp(b.p, b.q, 0.55), [0, up * b.rr * 0.95, 0]))]);

    // ============================ HIP ============================
    { // gluteus maximus: the big seat muscle, thick coarse bundles from the back of the ilium,
      // the sacrum and the tail bone, slanting down and out over the sitting bone and the greater
      // trochanter, into the iliotibial band and the gluteal tuberosity of the femur
      const M = big('GluteusMaximus'); M.sw = 1.45;
      const o = [[0.034, 0.556, -0.052], [0.024, 0.532, -0.06], [0.018, 0.506, -0.06], [0.014, 0.482, -0.056], [0.012, 0.462, -0.05]];
      const e = [[0.1005, 0.452, -0.004], [0.0985, 0.438, -0.006], [0.0905, 0.425, -0.008], [0.0855, 0.412, -0.0085], [0.0815, 0.398, -0.0085]];
      o.forEach((p, i) => {
        const t = i / 4, mid = [0.07 - t * 0.008, 0.5 - t * 0.03, -0.054 + t * 0.006];
        belly(M, [H(p), H(mid), T(lerp(mid, e[i], 0.6).map((v, j) => (j === 2 ? v - 0.012 : v))), T(e[i])], { w: 0.0075, d: 0.0078, di: 0.0058, ta: 0.04, tb: 0.12, peak: 0.45, out: ['hips', [0.3, 0, -1]], tw: 0.0032, tt: 0.0008, blend: 0.0055 });
      });
    }
    { // gluteus medius: a thick fan on the outside of the wing, from just under the crest down to
      // the outer face of the greater trochanter (it holds the pelvis level when standing on one leg)
      const M = big('GluteusMedius');
      const o = [[0.046, 0.562, -0.045], [0.062, 0.568, -0.036], [0.077, 0.566, -0.022], [0.0875, 0.56, -0.004], [0.092, 0.552, 0.016]];
      o.forEach((p, i) => belly(M, [H(p), H(lerp(p, [0.098, 0.5, -0.006], 0.55).map((v, j) => (j === 0 ? v + 0.006 : v))), T([0.1, 0.481, -0.003 + (i - 2) * 0.003])], { w: 0.0085, d: 0.0058, di: 0.0042, ta: 0.02, tb: 0.12, peak: 0.42, out: ['hips', [1, 0.15, -0.2]], tw: 0.0032, tt: 0.0008, form: 'fan', blend: 0.0055 }));
    }
    { // gluteus minimus: under the medius, lower on the wing, to the front of the greater trochanter
      const M = big('GluteusMinimus');
      [[0.056, 0.538, -0.028], [0.07, 0.542, -0.01], [0.08, 0.535, 0.012]].forEach((p) => belly(M, [H(p), H(lerp(p, [0.094, 0.49, 0.006], 0.5).map((v, j) => (j === 0 ? v + 0.004 : v))), T([0.0955, 0.4835, 0.0075])], { w: 0.0068, d: 0.0038, di: 0.003, ta: 0.02, tb: 0.15, peak: 0.42, out: ['hips', [1, 0.1, 0]], tw: 0.0026, tt: 0.0007, form: 'fan', blend: 0.004 }));
    }
    { // tensor fasciae latae: a short belly from beside the front point of the hip, into the
      // iliotibial band, the long tough strip down the outside of the thigh to Gerdy's tubercle
      const M = big('TensorFasciae');
      belly(M, [H([0.0868, 0.5385, 0.0345]), H([0.0965, 0.512, 0.024]), T([0.1035, 0.47, 0.012]), T([0.1095, 0.42, 0.006]), T([0.1105, 0.37, 0.002]), T([0.1025, 0.32, -0.001]), T([0.087, 0.282, -0.002]), L([0.0738, 0.2445, 0.0045])], { w: 0.0065, d: 0.0048, di: 0.0038, ta: 0.02, tb: 0.66, peak: 0.45, out: ['UpperLeg', [1, 0, 0.1]], tw: 0.0058, tt: 0.0007, form: 'strap' });
    }
    { // the deep hip rotators: piriformis from the front of the sacrum out through the greater
      // sciatic notch; the obturator internus round the lesser notch with the two gemelli beside
      // it; quadratus femoris from the sitting bone; all to the back of the greater trochanter
      const M = big('HipRotators');
      belly(M, [H([0.012, 0.512, -0.034]), H([0.04, 0.505, -0.048]), H([0.068, 0.496, -0.03]), T([0.0895, 0.4845, -0.0065])], { w: 0.0058, d: 0.0042, di: 0.0035, ta: 0.04, tb: 0.15, peak: 0.4, out: ['hips', [0, 0.2, -1]], tw: 0.0022, tt: 0.0008 });
      belly(M, [H([0.034, 0.452, 0.004]), H([0.044, 0.456, -0.026]), H([0.066, 0.464, -0.032]), T([0.0865, 0.4765, -0.0105])], { w: 0.0042, d: 0.0034, di: 0.0028, ta: 0.04, tb: 0.15, peak: 0.55, out: ['hips', [0, 0, -1]], tw: 0.002, tt: 0.0007 });
      belly(M, [H([0.056, 0.4425, -0.026]), H([0.07, 0.448, -0.028]), T([0.083, 0.4535, -0.0175])], { w: 0.0058, d: 0.0038, di: 0.0032, ta: 0.04, tb: 0.06, peak: 0.5, out: ['hips', [0, -0.3, -1]], tw: 0.003, tt: 0.0008 });
      belly(M, [H([0.034, 0.448, 0.022]), H([0.052, 0.452, 0.004]), T([0.072, 0.462, -0.002]), T([0.0855, 0.4745, -0.0072])], { w: 0.0042, d: 0.0032, di: 0.0026, ta: 0.04, tb: 0.15, peak: 0.4, out: ['hips', [0, -1, 0]], tw: 0.0018, tt: 0.0007 });
    }
    { // iliopsoas: psoas major from the sides of the lumbar spine, iliacus from the hollow inside
      // the wing; together over the front of the hip joint, beside the femoral vessels, to the
      // lesser trochanter
      const M = big('Iliopsoas');
      belly(M, [['spine', [0.016, 0.625, -0.004]], ['spine', [0.026, 0.585, 0.004]], H([0.036, 0.53, 0.012]), H([0.05, 0.495, 0.036]), T([0.064, 0.468, 0.018]), T([0.0755, 0.4465, -0.0045])], { w: 0.0068, d: 0.0068, di: 0.0058, ta: 0.02, tb: 0.12, peak: 0.42, out: ['hips', [0, 0, 1]], tw: 0.0028, tt: 0.0012 });
      [[0.045, 0.55, -0.022], [0.062, 0.556, -0.01], [0.075, 0.548, 0.008]].forEach((p) => belly(M, [H(p), H([0.054, 0.51, 0.022]), H([0.056, 0.49, 0.036]), T([0.068, 0.466, 0.016]), T([0.0755, 0.4465, -0.0045])], { w: 0.0068, d: 0.0045, di: 0.0035, ta: 0.02, tb: 0.15, peak: 0.35, out: ['hips', [-0.3, 0.2, 1]], tw: 0.0026, tt: 0.001, form: 'fan', blend: 0.005 }));
    }

    // ============================ THIGH: inside (adductors) ============================
    { // pectineus: from the pubis's sharp upper line to just below the lesser trochanter
      const M = big('Pectineus');
      belly(M, [H([0.0305, 0.4815, 0.0425]), H([0.05, 0.47, 0.034]), T([0.0745, 0.4345, -0.0025])], { w: 0.0062, d: 0.0042, di: 0.0035, ta: 0.04, tb: 0.1, peak: 0.45, out: ['hips', [0, 0, 1]], tw: 0.0028, tt: 0.0008, form: 'strap' });
    }
    { // adductor longus (the cord felt in the groin) from the front of the pubis to the middle of
      // the rough line; adductor brevis behind it, higher
      const M = big('AdductorLongus');
      belly(M, [H([0.0145, 0.4705, 0.0478]), H([0.028, 0.452, 0.04]), T([0.05, 0.405, 0.018]), T([0.0705, 0.362, -0.0035])], { w: 0.0078, d: 0.0055, di: 0.0045, ta: 0.08, tb: 0.06, peak: 0.45, out: ['UpperLeg', [-0.6, 0, 0.8]], tw: 0.0035, tt: 0.0009, form: 'fan' });
      const N = big('AdductorBrevis');
      belly(N, [H([0.016, 0.4515, 0.0345]), H([0.035, 0.442, 0.026]), T([0.064, 0.42, 0.006]), T([0.0785, 0.4115, -0.0035])], { w: 0.0072, d: 0.0045, di: 0.0038, ta: 0.04, tb: 0.06, peak: 0.45, out: ['UpperLeg', [-0.6, 0, 0.8]], tw: 0.0035, tt: 0.0009, form: 'fan' });
    }
    { // adductor magnus: the biggest, from the ischiopubic ramus and the sitting bone, its upper
      // part fanning out along the whole rough line, its lower "hamstring" part down to the
      // adductor tubercle above the inner knee
      const M = big('AdductorMagnus'); M.sw = 1.4;
      const o = [[0.022, 0.4395, 0.026], [0.03, 0.4365, 0.012], [0.04, 0.435, -0.004], [0.048, 0.436, -0.014]];
      const e = [[0.0805, 0.43, -0.0035], [0.077, 0.4, -0.0035], [0.0718, 0.36, -0.003], [0.067, 0.325, -0.003]];
      o.forEach((p, i) => belly(M, [H(p), T(lerp(lerp(p, e[i], 0.5), [0.05, 0.4, -0.02], 0.4)), T(e[i])], { w: 0.0075, d: 0.0065, di: 0.0055, ta: 0.04, tb: 0.06, peak: 0.45, out: ['UpperLeg', [-0.6, 0, -0.8]], tw: 0.0035, tt: 0.0009, form: 'fan', blend: 0.005 }));
      belly(M, [H([0.052, 0.437, -0.018]), T([0.048, 0.38, -0.02]), T([0.041, 0.318, -0.016]), T([0.037, 0.282, -0.009])], { w: 0.0075, d: 0.0068, di: 0.0055, ta: 0.04, tb: 0.22, peak: 0.42, out: ['UpperLeg', [-0.7, 0, -0.7]], tw: 0.0028, tt: 0.0012 });
    }
    { // gracilis: the long thin strap down the inner thigh, from the pubis to the inner tibia
      // (the middle of the three tendons of the "goose foot", pes anserinus)
      const M = big('Gracilis');
      belly(M, [H([0.0095, 0.4555, 0.039]), H([0.014, 0.432, 0.028]), T([0.024, 0.38, 0.008]), T([0.03, 0.31, -0.008]), T([0.032, 0.275, -0.012]), L([0.0372, 0.24, -0.0065]), L([0.0458, 0.2205, 0.0068])], { w: 0.0042, d: 0.0032, di: 0.0028, ta: 0.04, tb: 0.32, peak: 0.42, out: ['UpperLeg', [-1, 0, 0]], tw: 0.0016, tt: 0.0008, form: 'strap' });
    }

    // ============================ THIGH: front ============================
    { // sartorius: the longest muscle, a strap from the front point of the hip slanting across the
      // front of the thigh, behind the inner knee, to the goose foot on the inner tibia
      const M = big('Sartorius');
      belly(M, [H([0.0848, 0.5355, 0.0398]), T([0.0835, 0.48, 0.033]), T([0.072, 0.43, 0.03]), T([0.054, 0.38, 0.024]), T([0.039, 0.33, 0.012]), T([0.0315, 0.29, -0.002]), T([0.031, 0.266, -0.008]), L([0.0352, 0.2405, -0.004]), L([0.0462, 0.2235, 0.0095])], { w: 0.0045, d: 0.0028, di: 0.0024, ta: 0.02, tb: 0.12, peak: 0.45, out: ['UpperLeg', [-0.3, 0, 1]], tw: 0.0022, tt: 0.0008, form: 'strap' });
    }
    { // quadriceps femoris: four heads into one tendon over the knee cap.
      // rectus femoris: from the knob below the front point of the hip (AIIS), straight down the
      // middle, feather-shaped
      const R = big('RectusFemoris');
      belly(R, [H([0.0742, 0.5148, 0.0315]), T([0.0772, 0.47, 0.0255]), T([0.0745, 0.42, 0.0285]), T([0.068, 0.37, 0.0285]), T([0.061, 0.322, 0.0265]), T([0.0558, 0.2885, 0.0255])], { w: 0.0082, d: 0.0078, di: 0.0058, ta: 0.08, tb: 0.15, peak: 0.45, out: ['UpperLeg', [0, 0, 1]], tw: 0.0045, tt: 0.0012 });
      // vastus lateralis: the biggest head, wrapped round the outside of the thigh from the
      // greater trochanter and the rough line, to the outer edge of the knee cap
      const VL = big('VastusLateralis'); VL.sw = 1.5;
      belly(VL, [T([0.0955, 0.466, 0.006]), T([0.1012, 0.43, 0.004]), T([0.0995, 0.38, 0.003]), T([0.0915, 0.33, 0.006]), T([0.0785, 0.295, 0.012]), T([0.0655, 0.279, 0.0185])], { w: 0.0105, d: 0.0088, di: 0.0062, ta: 0.04, tb: 0.12, peak: 0.42, out: ['UpperLeg', [1, 0, 0.2]], tw: 0.0045, tt: 0.0012 });
      belly(VL, [T([0.086, 0.448, -0.002]), T([0.0905, 0.4, -0.006]), T([0.087, 0.35, -0.004]), T([0.0795, 0.305, 0.004]), T([0.067, 0.281, 0.016])], { w: 0.0085, d: 0.0068, di: 0.0055, ta: 0.04, tb: 0.12, peak: 0.42, out: ['UpperLeg', [0.7, 0, -0.7]], tw: 0.004, tt: 0.0011 });
      // vastus medialis: from the inner rough line, low and full: the "teardrop" above the inner knee
      const VM = big('VastusMedialis'); VM.sw = 1.45;
      belly(VM, [T([0.075, 0.432, 0.004]), T([0.064, 0.39, 0.004]), T([0.052, 0.345, 0.006]), T([0.0425, 0.305, 0.0115]), T([0.0438, 0.2835, 0.0172]), T([0.0478, 0.2745, 0.0198])], { w: 0.0088, d: 0.0078, di: 0.006, ta: 0.04, tb: 0.06, peak: 0.72, out: ['UpperLeg', [-0.8, 0, 0.6]], tw: 0.0045, tt: 0.0012 });
      // vastus intermedius: under rectus femoris, on the front of the shaft
      const VI = big('VastusIntermedius');
      belly(VI, [T([0.084, 0.448, 0.0125]), T([0.0792, 0.41, 0.0138]), T([0.0715, 0.36, 0.0138]), T([0.0645, 0.32, 0.0132]), T([0.0568, 0.2925, 0.0168])], { w: 0.0088, d: 0.0055, di: 0.0042, ta: 0.04, tb: 0.15, peak: 0.45, out: ['UpperLeg', [0, 0, 1]], tw: 0.0052, tt: 0.0011 });
    }

    // ============================ THIGH: back (hamstrings) ============================
    { // biceps femoris: the long head from the sitting bone, the short head from the lower rough
      // line, together round the outside of the back of the knee to the head of the fibula
      const M = big('BicepsFemoris');
      belly(M, [H([0.0548, 0.4405, -0.0285]), T([0.064, 0.4, -0.031]), T([0.0725, 0.35, -0.028]), T([0.0775, 0.3, -0.022]), T([0.0795, 0.268, -0.0175]), L([0.0805, 0.2395, -0.0158])], { w: 0.0075, d: 0.0078, di: 0.006, ta: 0.08, tb: 0.15, peak: 0.42, out: ['UpperLeg', [0.4, 0, -1]], tw: 0.0028, tt: 0.0012 });
      belly(M, [T([0.0715, 0.36, -0.0075]), T([0.0785, 0.33, -0.014]), T([0.0818, 0.29, -0.0158]), T([0.0812, 0.266, -0.0142]), L([0.0802, 0.2405, -0.0138])], { w: 0.0058, d: 0.0055, di: 0.0045, ta: 0.04, tb: 0.15, peak: 0.45, out: ['UpperLeg', [1, 0, -0.6]], tw: 0.0026, tt: 0.0011 });
    }
    { // semitendinosus: from the sitting bone, its belly ending half way down in a long round
      // tendon behind the inner knee to the goose foot; semimembranosus deep to it, starting as
      // a flat sheet of tendon, its thick belly low, to the back of the inner tibial condyle
      const M = big('Semitendinosus');
      belly(M, [H([0.0512, 0.4395, -0.0285]), T([0.0545, 0.39, -0.034]), T([0.0505, 0.34, -0.0315]), T([0.0425, 0.295, -0.025]), T([0.0345, 0.268, -0.0175]), L([0.0352, 0.2405, -0.0085]), L([0.0465, 0.2215, 0.0045])], { w: 0.0068, d: 0.0068, di: 0.0052, ta: 0.04, tb: 0.42, peak: 0.35, out: ['UpperLeg', [-0.3, 0, -1]], tw: 0.0018, tt: 0.0012 });
      const N = big('Semimembranosus');
      belly(N, [H([0.0555, 0.4425, -0.0205]), T([0.0555, 0.395, -0.0245]), T([0.0505, 0.345, -0.0255]), T([0.0435, 0.3, -0.0225]), T([0.0385, 0.272, -0.0168]), L([0.0372, 0.2435, -0.0128])], { w: 0.0078, d: 0.0072, di: 0.0058, ta: 0.32, tb: 0.1, peak: 0.6, out: ['UpperLeg', [-0.5, 0, -1]], tw: 0.0045, tt: 0.0009 });
    }

    // ============================ LEG: back ============================
    { // popliteus: the small flat muscle behind the knee, from the outer femoral condyle to the
      // back of the tibia above the soleal line (it unlocks the straight knee)
      const M = big('Popliteus');
      belly(M, [T([0.0742, 0.2582, -0.0062]), L([0.0702, 0.2465, -0.0172]), L([0.056, 0.2305, -0.0178]), L([0.0455, 0.2175, -0.0142])], { w: 0.0068, d: 0.0032, di: 0.0028, ta: 0.15, tb: 0.04, peak: 0.6, out: ['LowerLeg', [0, 0, -1]], tw: 0.002, tt: 0.0008, form: 'fan' });
    }
    { // gastrocnemius: two heads from above the femoral condyles, the inner one bigger and lower,
      // bulging into the calf, then into the Achilles tendon to the back of the heel
      const M = big('Gastrocnemius'); M.sw = 1.5;
      belly(M, [T([0.0428, 0.2745, -0.0158]), T([0.0418, 0.258, -0.0255]), L([0.0428, 0.215, -0.0335]), L([0.0478, 0.17, -0.0335]), L([0.0525, 0.13, -0.0275]), L([0.0535, 0.09, -0.0228]), L([0.0542, 0.06, -0.0228]), F([0.0545, 0.0205, -0.0462])], { w: 0.0088, d: 0.0095, di: 0.0062, ta: 0.04, tb: 0.5, peak: 0.32, out: ['LowerLeg', [-0.3, 0, -1]], tw: 0.0042, tt: 0.0014 });
      belly(M, [T([0.0665, 0.2755, -0.015]), T([0.0675, 0.258, -0.0235]), L([0.067, 0.215, -0.031]), L([0.0612, 0.175, -0.0305]), L([0.0565, 0.135, -0.0262]), L([0.0545, 0.09, -0.0228]), L([0.0544, 0.06, -0.0228]), F([0.0545, 0.0205, -0.0462])], { w: 0.0075, d: 0.0082, di: 0.0058, ta: 0.04, tb: 0.55, peak: 0.3, out: ['LowerLeg', [0.3, 0, -1]], tw: 0.0042, tt: 0.0014 });
    }
    { // soleus: the broad flat muscle under the gastrocnemius, from the back of the fibula's head
      // and the tibia's soleal line, its sides showing either side of the calf, into the same tendon
      const M = big('Soleus'); M.sw = 1.5;
      belly(M, [L([0.0778, 0.2285, -0.0172]), L([0.0712, 0.19, -0.0215]), L([0.0618, 0.15, -0.0225]), L([0.0565, 0.11, -0.0212]), L([0.0545, 0.075, -0.02]), F([0.0545, 0.0225, -0.0438])], { w: 0.0082, d: 0.0062, di: 0.0052, ta: 0.04, tb: 0.38, peak: 0.42, out: ['LowerLeg', [0.4, 0, -1]], tw: 0.0042, tt: 0.0012 });
      belly(M, [L([0.0505, 0.2135, -0.0135]), L([0.0455, 0.18, -0.0182]), L([0.0465, 0.14, -0.0205]), L([0.0518, 0.105, -0.0205]), L([0.054, 0.075, -0.02]), F([0.0545, 0.0225, -0.0438])], { w: 0.0078, d: 0.0058, di: 0.0048, ta: 0.04, tb: 0.38, peak: 0.45, out: ['LowerLeg', [-0.4, 0, -1]], tw: 0.0042, tt: 0.0012 });
    }
    { // the deep back of the leg: tibialis posterior between the two bones, flexor digitorum
      // longus on the tibia, flexor hallucis longus on the fibula; their tendons pass behind the
      // inner ankle (FHL in the groove behind the talus and under the heel's shelf) into the sole
      const TP = big('TibialisPosterior');
      belly(TP, [L([0.064, 0.212, -0.0085]), L([0.0638, 0.17, -0.0095]), L([0.0605, 0.12, -0.0098]), L([0.052, 0.08, -0.0105]), L([0.0408, 0.058, -0.0072]), F([0.0362, 0.0405, -0.0062]), F([0.0322, 0.028, 0.0145]), F([0.0318, 0.0222, 0.0335])], { w: 0.0055, d: 0.0045, di: 0.0038, ta: 0.04, tb: 0.42, peak: 0.42, out: ['LowerLeg', [0, 0, -1]], tw: 0.0022, tt: 0.0012 });
      const FD = big('FlexorDigitorumLongus');
      belly(FD, [L([0.0465, 0.195, -0.0118]), L([0.0458, 0.15, -0.0135]), L([0.0462, 0.11, -0.0138]), L([0.0428, 0.075, -0.0135]), L([0.0388, 0.058, -0.0105]), F([0.0352, 0.039, -0.0085]), F([0.038, 0.0175, 0.0035]), F([0.048, 0.0095, 0.03])], { w: 0.0045, d: 0.0038, di: 0.0032, ta: 0.04, tb: 0.45, peak: 0.45, out: ['LowerLeg', [-0.4, 0, -1]], tw: 0.0018, tt: 0.001 });
      for (let i = 1; i < 5; i++) { const c = toeChain(i), m = c[0].p; tendon(FD, [F([0.048, 0.0095, 0.03]), F(lerp([0.048, 0.0095, 0.03], m, 0.5).map((v, j) => (j === 1 ? 0.0055 : v))), F(add(m, [0, -0.0062, -0.006])), ...toe(i, -1)], 0.0011, 0.0006, ['Foot', [0, -1, 0]]); }
      const FH = big('FlexorHallucisLongus');
      belly(FH, [L([0.0752, 0.17, -0.0145]), L([0.0712, 0.13, -0.0165]), L([0.065, 0.09, -0.0172]), L([0.0565, 0.064, -0.0168]), F([0.0505, 0.0335, -0.0198]), F([0.0405, 0.0195, -0.008]), F([0.0328, 0.0125, 0.03]), F([0.0262, 0.0075, 0.07])], { w: 0.0058, d: 0.0048, di: 0.004, ta: 0.04, tb: 0.42, peak: 0.55, out: ['LowerLeg', [0.2, 0, -1]], tw: 0.0018, tt: 0.0011 });
      tendon(FH, [F([0.0262, 0.0075, 0.07]), F([0.0255, 0.0058, 0.0955]), ...toe(0, -1)], 0.0015, 0.0008, ['Foot', [0, -1, 0]]);
    }

    // ============================ LEG: outside (peroneals) ============================
    { // peroneus longus: from the fibula's head and upper shaft, its tendon behind the outer ankle,
      // under the cuboid in its groove and right across the sole to the base of the first
      // metatarsal; peroneus brevis under it, from the lower fibula to the fifth metatarsal's knob
      const PL = big('PeroneusLongus');
      belly(PL, [L([0.0835, 0.226, -0.0095]), L([0.0845, 0.19, -0.0088]), L([0.0825, 0.15, -0.0085]), L([0.0782, 0.11, -0.0095]), L([0.0745, 0.07, -0.0118]), L([0.0732, 0.046, -0.0148]), F([0.0712, 0.026, -0.0105]), F([0.0718, 0.0095, 0.025]), F([0.058, 0.0065, 0.039]), F([0.037, 0.0105, 0.0592])], { w: 0.0055, d: 0.0048, di: 0.004, ta: 0.04, tb: 0.58, peak: 0.42, out: ['LowerLeg', [1, 0, 0]], tw: 0.0018, tt: 0.0011 });
      const PB = big('PeroneusBrevis');
      belly(PB, [L([0.0812, 0.155, -0.0055]), L([0.0802, 0.12, -0.0062]), L([0.0768, 0.085, -0.0085]), L([0.0748, 0.06, -0.0118]), L([0.0742, 0.044, -0.0135]), F([0.0752, 0.0265, -0.0072]), F([0.0772, 0.0158, 0.022]), F([0.0805, 0.0132, 0.0352])], { w: 0.0052, d: 0.0042, di: 0.0036, ta: 0.04, tb: 0.38, peak: 0.5, out: ['LowerLeg', [1, 0, 0]], tw: 0.002, tt: 0.0011 });
    }

    // ============================ LEG: front ============================
    { // tibialis anterior: the muscle right beside the shin's sharp edge, its tendon over the front
      // of the ankle to the inner side of the foot (medial cuneiform and first metatarsal)
      const M = big('TibialisAnterior');
      belly(M, [L([0.0642, 0.229, 0.0055]), L([0.0652, 0.2, 0.011]), L([0.064, 0.16, 0.0128]), L([0.0598, 0.12, 0.0128]), L([0.0525, 0.085, 0.0135]), L([0.046, 0.062, 0.0158]), F([0.0405, 0.0435, 0.0262]), F([0.0335, 0.0305, 0.0458]), F([0.0272, 0.0215, 0.0555])], { w: 0.0058, d: 0.0062, di: 0.005, ta: 0.04, tb: 0.42, peak: 0.38, out: ['LowerLeg', [0.4, 0, 1]], tw: 0.0022, tt: 0.0012 });
    }
    { // extensor digitorum longus: outside the tibialis anterior, from the tibia's outer condyle and
      // the front of the fibula, its tendon splitting in four over the top of the foot to the toes
      const M = big('ExtensorDigitorumLongus');
      belly(M, [L([0.0745, 0.2275, -0.0005]), L([0.0752, 0.19, 0.0025]), L([0.0735, 0.15, 0.0045]), L([0.0695, 0.11, 0.0062]), L([0.0632, 0.078, 0.0095]), L([0.058, 0.06, 0.0132]), F([0.0565, 0.0438, 0.0218])], { w: 0.0048, d: 0.0045, di: 0.0038, ta: 0.04, tb: 0.38, peak: 0.42, out: ['LowerLeg', [0.6, 0, 0.8]], tw: 0.0022, tt: 0.001 });
      for (let i = 1; i < 5; i++) { const m = toeChain(i)[0].p; tendon(M, [F([0.0565, 0.0438, 0.0218]), F(lerp([0.0565, 0.04, 0.03], m, 0.4).map((v, j) => (j === 1 ? v + 0.0035 : v))), F(add(m, [0, 0.0072, -0.006])), ...toe(i, 1)], 0.0011, 0.0006, ['Foot', [0, 1, 0]]); }
    }
    { // extensor hallucis longus: between the two, from the middle of the fibula, to the big toe
      const M = big('ExtensorHallucisLongus');
      belly(M, [L([0.0705, 0.165, 0.0025]), L([0.0682, 0.13, 0.0065]), L([0.0618, 0.095, 0.0098]), L([0.0532, 0.068, 0.0138]), L([0.049, 0.056, 0.0152]), F([0.0462, 0.0448, 0.0238]), F([0.0365, 0.0325, 0.0505]), F([0.0275, 0.0222, 0.0785])], { w: 0.0042, d: 0.0038, di: 0.0032, ta: 0.06, tb: 0.5, peak: 0.45, out: ['LowerLeg', [0.4, 0, 1]], tw: 0.0016, tt: 0.0009 });
      tendon(M, [F([0.0275, 0.0222, 0.0785]), F([0.0255, 0.0195, 0.0975]), ...toe(0, 1)], 0.0016, 0.0008, ['Foot', [0, 1, 0]]);
    }

    // ============================ FOOT ============================
    { // on top: extensor digitorum brevis (and hallucis brevis), a small fleshy pad from the heel
      // bone in front of the outer ankle, sending tendons to the first four toes
      const M = muscle('ExtensorDigitorumBrevis');
      for (let i = 0; i < 4; i++) {
        const m = toeChain(i)[0].p;
        belly(M, [F([0.0635 - i * 0.0018, 0.0262, 0.0118]), F(lerp([0.062, 0.031, 0.03], m, 0.18 + i * 0.03).map((v, j) => (j === 1 ? v + 0.004 : v))), F(lerp([0.06, 0.028, 0.04], m, 0.6).map((v, j) => (j === 1 ? v + 0.008 : v))), F(add(m, [0.002, 0.0062, -0.004]))], { w: 0.0028, d: 0.0022, di: 0.0018, ta: 0.02, tb: 0.55, peak: 0.35, out: ['Foot', [0, 1, 0]], tw: 0.0008, tt: 0.0005, blend: 0.0025 });
      }
    }
    { // the sole, first layer: abductor hallucis along the inner arch, flexor digitorum brevis in
      // the middle (four tendons to the middle bones of the toes), abductor digiti minimi along the
      // outer edge; all from the heel's tuber
      const AH = muscle('AbductorHallucis');
      belly(AH, [F([0.0435, 0.0065, -0.0315]), F([0.0335, 0.0105, -0.008]), F([0.0272, 0.0135, 0.025]), F([0.0232, 0.0105, 0.065]), F([0.0198, 0.0072, 0.1085])], { w: 0.0055, d: 0.0055, di: 0.0045, ta: 0.04, tb: 0.38, peak: 0.42, out: ['Foot', [-1, -0.4, 0]], tw: 0.0018, tt: 0.0009 });
      const FB = muscle('FlexorDigitorumBrevis');
      for (let i = 1; i < 5; i++) {
        const c = toeChain(i), m = c[0].p;
        belly(FB, [F([0.0545, 0.0005, -0.0278]), F(lerp([0.054, 0.0012, -0.01], m, 0.3).map((v, j) => (j === 1 ? 0.0015 : v))), F(lerp([0.052, 0.002, 0.0], m, 0.62).map((v, j) => (j === 1 ? 0.0022 : v))), F(add(m, [0, -0.0062, -0.004])), F(add(c[1].p, [0, -c[1].rr * 1.05, 0]))], { w: 0.0032, d: 0.0028, di: 0.0024, ta: 0.04, tb: 0.42, peak: 0.42, out: ['Foot', [0, -1, 0]], tw: 0.0009, tt: 0.0005, blend: 0.003 });
      }
      const AD = muscle('AbductorDigitiMinimi');
      belly(AD, [F([0.0648, 0.0035, -0.0305]), F([0.0712, 0.0055, -0.005]), F([0.0812, 0.0065, 0.028]), F([0.0868, 0.0055, 0.06]), F(add(toeChain(4)[0].p, [0.0035, -0.002, 0.0]))], { w: 0.0045, d: 0.0045, di: 0.0038, ta: 0.04, tb: 0.3, peak: 0.42, out: ['Foot', [1, -0.4, 0]], tw: 0.0015, tt: 0.0008 });
    }
    { // the sole, deeper layers: quadratus plantae pulling on the long flexor's tendon; flexor
      // hallucis brevis (two bellies, each with its sesamoid) and adductor hallucis to the big
      // toe; flexor digiti minimi brevis to the little toe
      const QP = muscle('QuadratusPlantae');
      belly(QP, [F([0.0505, 0.0082, -0.0225]), F([0.0498, 0.0078, 0.002]), F([0.048, 0.0088, 0.0262])], { w: 0.0055, d: 0.0032, di: 0.0028, ta: 0.04, tb: 0.1, peak: 0.42, out: ['Foot', [0, -1, 0]], tw: 0.0028, tt: 0.0007, form: 'fan' });
      const HB = muscle('FlexorHallucisBrevis');
      for (const dx of [-0.0035, 0.0035]) belly(HB, [F([0.0412, 0.0122, 0.044]), F([0.0318 + dx, 0.0062, 0.072]), F([0.0258 + dx, 0.0038, 0.0975]), F([0.0245 + dx * 0.6, 0.0052, 0.108])], { w: 0.003, d: 0.0028, di: 0.0024, ta: 0.04, tb: 0.25, peak: 0.42, out: ['Foot', [0, -1, 0]], tw: 0.0012, tt: 0.0006 });
      const AdH = muscle('AdductorHallucis');
      belly(AdH, [F([0.0565, 0.0115, 0.048]), F([0.0482, 0.0068, 0.072]), F([0.035, 0.0052, 0.096]), F([0.0295, 0.0052, 0.1065])], { w: 0.0042, d: 0.003, di: 0.0026, ta: 0.04, tb: 0.15, peak: 0.42, out: ['Foot', [0, -1, 0]], tw: 0.0015, tt: 0.0006 });
      belly(AdH, [F([0.0798, 0.0042, 0.0905]), F([0.062, 0.0032, 0.1012]), F([0.044, 0.0035, 0.1045]), F([0.0305, 0.0048, 0.1072])], { w: 0.0022, d: 0.0018, di: 0.0016, ta: 0.04, tb: 0.15, peak: 0.42, out: ['Foot', [0, -1, 0]], tw: 0.001, tt: 0.0005 });
      const DM = muscle('FlexorDigitiMinimi');
      belly(DM, [F([0.0752, 0.0085, 0.0395]), F([0.0822, 0.0048, 0.065]), F(add(toeChain(4)[0].p, [0.0005, -0.004, 0.0015]))], { w: 0.0028, d: 0.0025, di: 0.0022, ta: 0.04, tb: 0.15, peak: 0.42, out: ['Foot', [0.3, -1, 0]], tw: 0.001, tt: 0.0005 });
    }
    { // the interossei between the metatarsals: three on the sole, four on the top side between them
      const M = muscle('FootInterossei');
      for (let i = 0; i < 4; i++) {
        const a = toeChain(i)[0].p, b = toeChain(i + 1)[0].p, m = lerp(a, b, 0.5);
        belly(M, [F([m[0] + (i - 1.5) * -0.004, 0.017, 0.055 + (i > 2 ? -0.01 : 0)]), F([m[0], 0.0122, 0.075 - i * 0.004]), F(add(i < 2 ? b : a, [i < 2 ? -0.0028 : 0.0028, -0.0005, -0.0035]))], { w: 0.0022, d: 0.0024, di: 0.002, ta: 0.04, tb: 0.2, peak: 0.42, out: ['Foot', [0, 1, 0]], tw: 0.0009, tt: 0.0005, blend: 0.0015 });
      }
    }
    // ---- soft contact behind the knee: when it bends far, the calf presses into the hamstrings
    // and both flatten where they meet (muscleKit.js) ----
    const side = s > 0 ? 'left' : 'right';
    softContact(parts, rig, side, side + 'UpperLeg', side + 'LowerLeg', ['BicepsFemoris', 'Semitendinosus', 'Semimembranosus', 'AdductorMagnus', 'Gracilis', 'Sartorius'], ['Gastrocnemius', 'Soleus'], { from: 1.15, full: 2.0 });
  }
  return parts;
}
