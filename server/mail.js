// Emails the game sends: confirm your email, welcome, sign-in codes, password reset and alerts.
// They go out through Resend (resend.com). Three settings switch them on (set in Vercel, never in
// the code):
//   RESEND_API_KEY  the key from Resend (API Keys, "Sending access")
//   MAIL_FROM       who the emails come from, e.g. "Ascendant Realms <noreply@yourdomain.com>"
//   APP_URL         the game's address, for the links in the emails (e.g. https://ascendent-realms.vercel.app)
// Without RESEND_API_KEY no email is sent, and the game doesn't ask for codes it can't deliver.
// MAIL_SHOW_CODES=1 (only for testing on your own computer) puts each code in the server log
// instead; it must never be set on the live game.

const ready = () => !!process.env.RESEND_API_KEY;
const appUrl = () => (process.env.APP_URL || 'https://ascendent-realms.vercel.app').replace(/\/+$/, '');
const from = () => process.env.MAIL_FROM || 'Ascendant Realms <onboarding@resend.dev>';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// one look for every email: a dark card with a gold title, like the game
function page(title, paragraphs, { code = null, button = null } = {}) {
  const p = paragraphs.map((t) => `<p style="margin:0 0 14px;line-height:1.5">${t}</p>`).join('');
  const codeBox = code ? `<p style="margin:18px 0;text-align:center"><span style="display:inline-block;padding:12px 22px;border:1px solid #c9a24a;border-radius:8px;font:700 28px/1 monospace;letter-spacing:6px;color:#f3d98b;background:#1d1a14">${esc(code)}</span></p>` : '';
  const btn = button ? `<p style="margin:18px 0;text-align:center"><a href="${esc(button.href)}" style="display:inline-block;padding:12px 26px;border-radius:8px;background:#c9a24a;color:#1a140a;font-weight:700;text-decoration:none">${esc(button.text)}</a></p>` : '';
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#0f0d0a;font-family:Georgia,serif;color:#e8dfcc">
<div style="max-width:520px;margin:0 auto;padding:26px;background:#17140f;border:1px solid #3a3020;border-radius:12px">
<h1 style="margin:0 0 18px;font-size:22px;color:#f3d98b;letter-spacing:1px">${esc(title)}</h1>${p}${codeBox}${btn}
<p style="margin:22px 0 0;font-size:12px;color:#9a8f78">Ascendant Realms · If you didn't ask for this email, you can ignore it.</p>
</div></body></html>`;
}

async function send(to, subject, html, text) {
  if (!ready()) {
    if (process.env.MAIL_SHOW_CODES === '1') console.log(`[mail not set up] to ${to}: ${subject}\n${text}`);
    return { sent: false };
  }
  try {
    const res = await fetch(process.env.RESEND_API_URL || 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: from(), to: [to], subject, html, text }),
    });
    if (!res.ok) { console.error('email not sent:', res.status, await res.text().catch(() => '')); return { sent: false }; }
    return { sent: true };
  } catch (e) {
    console.error('email not sent:', e);
    return { sent: false };
  }
}

const link = (params) => `${appUrl()}/?${new URLSearchParams(params)}`;

// Many emails at once (the Weekly Championship's draw): Resend takes up to 100 in one go
async function sendMany(list) {
  if (!ready() || !list.length) return { sent: 0 };
  let sent = 0;
  for (let i = 0; i < list.length; i += 100) {
    const part = list.slice(i, i + 100).map((m) => ({ from: from(), ...m }));
    try {
      const res = await fetch(process.env.RESEND_BATCH_URL || 'https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(part),
      });
      if (res.ok) sent += part.length; else console.error('emails not sent:', res.status, await res.text().catch(() => ''));
    } catch (e) { console.error('emails not sent:', e); }
  }
  return { sent };
}
// (the Colosseum's emails say how to turn them off)
const OFF_NOTE = 'You can turn these emails off at the Colosseum\'s board in the game.';
const clock = (t) => { const d = new Date(t); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const dayClock = (t) => `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(t).getUTCDay()]} ${clock(t)} UTC`;
// the first fight of the Weekly Championship and the times of the rounds after it (sent with sendMany)
function cupScheduleMessage(to, name, { first, foe, bye, times, players }) {
  const later = times.filter((t) => t > first).map(clock).join(', ');
  const lines = [
    `The draw for this week's championship at the Colosseum is made, <b>${esc(name)}</b>. Every player is in it: ${players} in all. The winner takes the <b>No.1 medal</b> and keeps it until next week's champion.`,
    bye ? `You are one of the strongest, so you go straight through the first round. <b>Your first fight is on ${dayClock(first)}</b>, against whoever wins before you.` : `<b>Your first fight is on ${dayClock(first)}, against ${esc(foe)}.</b>`,
    'Be in the game at that time. The game calls you to the Colosseum; if you are not there within 3 minutes, you are out of the championship straight away.',
    later ? `Each win takes you to the next round, every 15 minutes: ${later} (UTC).` : 'It is the final.',
    'A fight in the Colosseum never costs a life: whoever is beaten just leaves the championship.',
    OFF_NOTE,
  ];
  const text = `${bye ? 'Your first championship fight' : `Your championship fight against ${foe}`} is on ${dayClock(first)}. Be in the game then, or you are out. ${later ? `Next rounds: ${later} UTC.` : ''}`;
  return { to: [to], subject: bye ? `Championship: your first fight is ${dayClock(first)}` : `Championship: you fight ${foe} on ${dayClock(first)}`, html: page('The Weekly Championship', lines, { button: { href: appUrl(), text: 'Open the game' } }), text };
}

const emails = {
  verify: (to, name, ticket, code) => send(to, `Confirm your email: ${code}`,
    page('Confirm your email', [`Welcome, <b>${esc(name)}</b>. Confirm this is your email to finish making your account.`, 'Click the button, or type this code in the game. It works for 5 minutes. If it runs out, ask the game to send a new one.'], { code, button: { href: link({ verify: ticket, code }), text: 'Confirm my email' } }),
    `Welcome, ${name}. Your code is ${code}, or open ${link({ verify: ticket, code })} (works for 5 minutes).`),
  welcome: (to, name) => send(to, 'Welcome to Ascendant Realms',
    page('Welcome to the realm', [`Your email is confirmed, <b>${esc(name)}</b>.`, 'Your story starts at birth: a family in one of the great cities, lucky or not. Grow up, train, find your class and climb as high as you can.', 'You can turn on 2-step sign-in in Options, then Settings, to keep your account safe.'], { button: { href: appUrl(), text: 'Enter the realm' } }),
    `Your email is confirmed, ${name}. Play at ${appUrl()}`),
  reset: (to, name, ticket, code) => send(to, `Reset your password: ${code}`,
    page('Reset your password', [`Someone (we hope you, <b>${esc(name)}</b>) asked to reset this account's password.`, 'Click the button, or type this code in the game. It works for 15 minutes.'], { code, button: { href: link({ reset: ticket, code }), text: 'Choose a new password' } }),
    `Your password reset code is ${code}, or open ${link({ reset: ticket, code })} (15 minutes).`),
  passwordChanged: (to, name) => send(to, 'Your password was changed',
    page('Your password was changed', [`The password of <b>${esc(name)}</b> was just changed, and every other device was signed out.`, 'If this wasn\'t you, use "Forgot password?" on the sign-in screen straight away to take your account back.']),
    `The password of ${name} was just changed. If this wasn't you, reset it with "Forgot password?".`),
  signInCode: (to, name, code) => send(to, `Your sign-in code: ${code}`,
    page('Your sign-in code', [`Someone is signing in to <b>${esc(name)}</b> with the right password. Type this code to finish. It works for 10 minutes.`, 'If this wasn\'t you, change your password: someone knows it.'], { code }),
    `Your sign-in code for ${name} is ${code} (10 minutes).`),
  confirmCode: (to, name, code) => send(to, `Your code: ${code}`,
    page('Confirm it\'s you', [`Type this code in the game to finish the change on <b>${esc(name)}</b>. It works for 10 minutes.`], { code }),
    `Your code for ${name} is ${code} (10 minutes).`),
  twofaChanged: (to, name, on) => send(to, on ? '2-step sign-in is on' : '2-step sign-in was turned off',
    page(on ? '2-step sign-in is on' : '2-step sign-in was turned off', [on ? `Signing in to <b>${esc(name)}</b> now needs a code as well as the password.` : `Signing in to <b>${esc(name)}</b> now needs only the password.`, 'If this wasn\'t you, change your password straight away.']),
    on ? `2-step sign-in is on for ${name}.` : `2-step sign-in was turned off for ${name}.`),
  emailChanged: (to, name, newEmail) => send(to, 'Your email was changed',
    page('Your email was changed', [`The email of <b>${esc(name)}</b> was changed to ${esc(newEmail)}.`, 'If this wasn\'t you, tell the game\'s owner straight away.']),
    `The email of ${name} was changed to ${newEmail}.`),
};

// the Colosseum's own emails
emails.duelChallenge = (to, name, by) => send(to, `${by} challenges you to a duel`,
  page('A challenge at the Colosseum', [`<b>${esc(by)}</b> challenges you, <b>${esc(name)}</b>, to a duel in the Colosseum of the Central City.`, 'Open the game within a day to accept or turn it down. If you accept, you are both called to the sand to fight. A Colosseum fight never costs a life.', OFF_NOTE], { button: { href: appUrl(), text: 'Answer the challenge' } }),
  `${by} challenges you to a duel in the Colosseum. Open ${appUrl()} within a day to answer.`);
emails.duelAccepted = (to, name, by) => send(to, `${by} accepted your challenge`,
  page('Your challenge was accepted', [`<b>${esc(by)}</b> accepted your challenge, <b>${esc(name)}</b>.`, 'Come into the game within the hour: you are both called to the Colosseum, and the fight starts as soon as you are both there.', OFF_NOTE], { button: { href: appUrl(), text: 'Go and fight' } }),
  `${by} accepted your challenge. Come into the game within the hour to fight: ${appUrl()}`);
emails.cupChampion = (to, name) => send(to, 'You won the Weekly Championship',
  page('Champion of the Colosseum', [`You won this week's championship, <b>${esc(name)}</b>. The <b>No.1 medal</b> is yours, and it shows by your name until next week's champion takes it.`, OFF_NOTE], { button: { href: appUrl(), text: 'Enter the realm' } }),
  `You won this week's championship, ${name}. The No.1 medal is yours until next week.`);

module.exports = { ready, appUrl, sendMany, cupScheduleMessage, ...emails };
