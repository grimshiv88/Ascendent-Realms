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

module.exports = { ready, appUrl, ...emails };
