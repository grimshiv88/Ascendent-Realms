// Inside the Emperors' Castle the map shows the castle's own floor plan instead of the world:
// the reception with its grand staircase and gallery, the great hall, and the chambers behind.
import { CASTLE_ROOMS } from './data/interiors.mjs';

const W = 30, D = 34, R = 12, BACK = D + 10; // the castle's size in metres (see world/interiors.js)

export function renderCastlePlan(el, here) {
  // the plan is drawn with the great door at the bottom, the chambers at the top
  const y = (z) => BACK - z;
  const rw = W / CASTLE_ROOMS.length;
  const rect = (x0, z0, x1, z1, cls, extra = '') => `<rect x="${x0}" y="${y(z1)}" width="${x1 - x0}" height="${z1 - z0}" class="${cls}" ${extra}/>`;
  const label = (x, z, text, cls = 'cp-label') => `<text x="${x}" y="${y(z)}" class="${cls}" text-anchor="middle">${text}</text>`;
  const steps = Array.from({ length: 8 }, (_, i) => `<line x1="-2.6" x2="2.6" y1="${y(3.2 + i * 0.7)}" y2="${y(3.2 + i * 0.7)}" class="cp-step"/>`).join('');
  const chambers = CASTLE_ROOMS.map((room, i) => rect(-W / 2 + i * rw, D, -W / 2 + (i + 1) * rw, BACK, 'cp-room') + label(-W / 2 + (i + 0.5) * rw, D + 5, room.name, 'cp-room-label')).join('');
  const you = here ? `<g transform="translate(${here.x} ${y(here.z)})"><circle r="0.9" class="cp-you"/><text y="-1.4" class="cp-you-label" text-anchor="middle">You${here.up ? ' (gallery)' : ''}</text></g>` : '';
  el.innerHTML = `
    <div class="status-window map-window castle-plan" role="dialog" aria-label="Map of the Emperors' Castle">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>The Emperors' Castle</h2>
      <svg viewBox="${-W / 2 - 1} -1 ${W + 2} ${BACK + 3}" class="cp-svg" role="img" aria-label="Floor plan of the castle">
        ${rect(-W / 2, 0, W / 2, R, 'cp-reception')}
        ${rect(-W / 2, R, W / 2, D, 'cp-hall')}
        ${chambers}
        ${rect(-W / 2, R - 3.2, W / 2, R, 'cp-gallery')}
        ${rect(-2.6, 3.2, 2.6, R - 3.2, 'cp-stairs')}${steps}
        ${rect(-1.1, R + 5.5, 1.1, R + 16.5, 'cp-table')}
        ${rect(-0.8, D - 4.2, 0.8, D - 3, 'cp-throne')}
        ${rect(W / 2 - 6.5, 3, W / 2 - 3.5, 4, 'cp-desk')}
        <rect x="-1" y="${y(0) - 0.3}" width="2" height="0.6" class="cp-door"/>
        ${label(0, 1.6, 'Great door')}
        ${label(-9, 5.5, 'Reception')}
        ${label(W / 2 - 5, 5.2, 'Steward')}
        ${label(0, R - 1.3, 'Gallery')}
        ${label(5.2, 6.5, 'Grand stairs', 'cp-label cp-small')}
        ${label(-9, R + 9, 'Great Hall')}
        ${label(0, R + 18.2, 'Council table', 'cp-label cp-small')}
        ${label(0, D - 5.2, 'Throne', 'cp-label cp-small')}
        ${you}
      </svg>
      <p class="map-note">You are inside the castle, so the map shows its rooms. Step outside to see the world map again.</p>
    </div>`;
}
