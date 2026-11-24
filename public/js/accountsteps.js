// The steps between typing the password and entering the realm: the 2-step sign-in code, adding an
// email (accounts from before it was required), confirming the email, and "Forgot password?".
// They all show in the one panel #auth-step on the title screen.
import * as api from './api.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const codeInput = (value = '') => `<label>Code<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" value="${esc(value)}" required></label>`;
const pwInput = (name, label, auto) => `<label>${label}<input name="${name}" type="password" autocomplete="${auto}" required></label>`;
// in the preview no email can be sent, so the code is shown here (the live game never does this)
const previewNote = (r) => (r?.previewCode ? `<p class="preview-code">Preview only, no real email is sent here. Your code is <b>${esc(r.previewCode)}</b></p>` : '');

// `show(panelId)` switches the title-screen panel, `enter(result)` goes into the realm
export function accountSteps({ el, show, enter }) {
  function render(html, onSubmit, buttons = {}) {
    el.innerHTML = html;
    show('auth-step');
    const form = el.querySelector('form');
    const error = el.querySelector('.error');
    const submit = form.querySelector('button[type=submit]');
    const run = async (fn) => {
      error.textContent = '';
      if (submit) submit.disabled = true;
      try { await fn(); } catch (err) { error.textContent = err.message; } finally { if (submit) submit.disabled = false; }
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); run(() => onSubmit(Object.fromEntries(new FormData(form)))); });
    for (const [sel, fn] of Object.entries(buttons)) el.querySelector(sel)?.addEventListener('click', () => run(fn));
  }
  const logOut = async () => { await api.signOut(); show('choose'); };

  // what comes next after signing in or up
  function next(r) {
    if (r.twofa) return askSignInCode(r);
    if (r.account.needsBirthdate) return askBirthdate(r);
    if (r.account.needsEmail) return askEmail(r);
    if (r.account.mustVerify) return askVerify(r, r);
    return enter(r);
  }

  // accounts from before the birth date was asked
  function askBirthdate(r) {
    render(`<h2>Your birth date</h2><form novalidate>
      <p class="hint">Every account needs a birth date now. Others never see it. It keeps age rules fair, like voice chat for players 16 and over. It can't be changed later, so please make sure it's right.</p>
      <label>Birth date<input name="birthdate" type="date" min="1900-01-01" max="${new Date().toISOString().slice(0, 10)}" required></label>
      <p class="error" role="alert"></p>
      <button class="gold-button" type="submit">Save</button>
      <button class="link-button" type="button" data-logout>Log out</button></form>`,
    async ({ birthdate }) => next({ ...r, account: (await api.setBirthdate(birthdate)).account }), { '[data-logout]': logOut });
  }

  function askSignInCode(t) {
    const app = t.twofa === 'app';
    render(`<h2>2-step sign-in</h2><form novalidate>
      <p class="hint">${app ? 'Open your authenticator app and type the 6-digit code it shows for Ascendant Realms.' : `We emailed a code to <b>${esc(t.sentTo)}</b>. Type it here. It works for 10 minutes.`}</p>
      ${previewNote(t)}${codeInput()}
      <p class="error" role="alert"></p>
      <button class="gold-button" type="submit">Sign In</button>
      ${app && t.canEmail ? '<button class="link-button" type="button" data-by-email>Lost your phone? Email me a code instead</button>' : ''}
      <button class="link-button" type="button" data-back>Back</button></form>`,
    async ({ code }) => next(await api.signInCode(t.ticket, code)),
    { '[data-by-email]': async () => askSignInCode(await api.signInByEmail(t.ticket)), '[data-back]': () => show('signin') });
  }

  // `r` is the sign-in; `change` asks for the password too (changing an email that was already there)
  function askEmail(r, change = false) {
    render(`<h2>${change ? 'Change your email' : 'Add your email'}</h2><form novalidate>
      <p class="hint">${change ? 'Type the new email and your password. We send a code to the new one.' : 'Every account needs an email now. It confirms the account is yours and gets it back if you forget your password. Others never see it.'}</p>
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      ${change ? pwInput('password', 'Password', 'current-password') : ''}
      <p class="error" role="alert"></p>
      <button class="gold-button" type="submit">${change ? 'Change email' : 'Add email'}</button>
      ${change ? '<button class="link-button" type="button" data-back>Back</button>' : '<button class="link-button" type="button" data-logout>Log out</button>'}</form>`,
    async ({ email, password }) => {
      const res = await api.setEmail(email, password);
      const now = { ...r, account: res.account };
      if (res.account.mustVerify) askVerify(res, now); else enter(now);
    }, { '[data-logout]': logOut, '[data-back]': () => askVerify({}, r) });
  }

  // `sent` is the answer of whatever sent the email (it may carry the preview code)
  function askVerify(sent, r, message = '') {
    const email = r.account.email;
    render(`<h2>Confirm your email</h2><form novalidate>
      <p class="hint">Type the code from the email we sent to <b>${esc(email)}</b>, or click the button in that email. Check your spam folder too. The code works for 24 hours.</p>
      ${previewNote(sent)}${message ? `<p class="hint"><b>${esc(message)}</b></p>` : ''}${codeInput()}
      <p class="error" role="alert"></p>
      <button class="gold-button" type="submit">Confirm</button>
      <button class="link-button" type="button" data-again>Send the email again</button>
      <button class="link-button" type="button" data-change>Wrong email? Change it</button>
      <button class="link-button" type="button" data-logout>Log out</button></form>`,
    async ({ code }) => {
      const v = await api.verifyEmail({ code });
      enter({ ...r, account: v.account || { ...r.account, mustVerify: false, emailVerified: true } });
    }, {
      '[data-again]': async () => { const s = await api.sendVerify(); askVerify(s, r, s.already ? 'Your email is already confirmed.' : 'Sent. Look for the newest email.'); },
      '[data-change]': () => askEmail(r, true),
      '[data-logout]': logOut,
    });
  }

  // after "Forgot password?" (`f` holds the ticket), or the link in the reset email (with its code)
  function askReset(f, code = '') {
    render(`<h2>Choose a new password</h2><form novalidate>
      <p class="hint">${code ? 'Type your new password.' : 'If the account has an email, we sent it a code. Type it here with your new password. The code works for 15 minutes.'}</p>
      ${previewNote(f)}${codeInput(code)}
      ${pwInput('password', 'New password', 'new-password')}${pwInput('confirm', 'Type it again', 'new-password')}
      <p class="error" role="alert"></p>
      <button class="gold-button" type="submit">Save new password</button>
      <button class="link-button" type="button" data-back>Back</button></form>`,
    async ({ code: c, password, confirm }) => {
      if (password !== confirm) throw new Error('The two passwords don\'t match.');
      const r = await api.resetPassword({ ticket: f.ticket, code: c, password });
      done('Password changed', `Sign in as <b>${esc(r.username)}</b> with your new password. Every device was signed out.`);
    }, { '[data-back]': () => show('signin') });
  }

  function done(title, text) {
    render(`<h2>${esc(title)}</h2><form novalidate><p class="hint">${text}</p><p class="error" role="alert"></p>
      <button class="gold-button" type="submit">Sign In</button></form>`, () => show('signin'));
  }

  // the link in an email opens the game with ?verify=... or ?reset=...
  async function fromLink() {
    const q = new URLSearchParams(location.search);
    const verify = q.get('verify'), reset = q.get('reset'), code = q.get('code') || '';
    if (!verify && !reset) return false;
    history.replaceState(null, '', location.pathname);
    if (reset) { askReset({ ticket: reset }, code); return true; }
    try {
      await api.verifyEmail({ ticket: verify, code });
      const me = await api.resume();
      if (me?.account && !me.account.mustVerify) {
        render(`<h2>Email confirmed</h2><form novalidate><p class="hint">Thank you. Your account is ready.</p><p class="error" role="alert"></p>
          <button class="gold-button" type="submit">Enter the realm</button></form>`, () => next(me));
      } else done('Email confirmed', 'Thank you. Sign in to play.');
    } catch (err) {
      done('That link didn\'t work', `${esc(err.message)} Sign in, and you can send a new email from there.`);
    }
    return true;
  }

  return { next, askReset, fromLink };
}
