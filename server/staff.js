// Who may use the Admin Board, and what each may do (see public/js/data/staff.mjs).
// The owner: the accounts whose emails are in ADMIN_EMAILS (once emails can be sent, only after
// confirming the email, so nobody else can sign up with it). The owner can do everything.
// Other admins: accounts the owner gave admin access to, each with only the permissions ticked for
// them (kept on the account, in admin_perms). Only the owner can give or take away admin access.
const mail = require('./mail');
const ST = require('../public/js/data/staff.mjs');

const ownerEmails = () => (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const isOwner = (row) => !!row && ownerEmails().includes(String(row.email).toLowerCase()) && (!!row.email_verified || !mail.ready());

// The admin access the owner gave this account: { perms, banDays }, or null
function staffOf(row) {
  if (!row?.admin_perms) return null;
  try {
    const s = ST.cleanStaff(JSON.parse(row.admin_perms));
    return s.perms.length ? s : null;
  } catch { return null; }
}
// Everything an account may do: the owner all of it; an admin what was ticked; anyone else nothing
function access(row) {
  if (isOwner(row)) return { owner: true, perms: [...ST.ALL_PERMS], banDays: null };
  const s = staffOf(row);
  return s ? { owner: false, perms: s.perms, banDays: s.banDays } : null;
}
// The powers in the game itself (fly, can't die, ...) this account has
const powersOf = (row) => (access(row)?.perms || []).filter((p) => ST.POWER_IDS.includes(p));
// May this account open the Admin Board at all? (an admin with only game powers has nothing to do there)
const canBoard = (a) => !!a && (a.owner || a.perms.some((p) => !ST.POWER_IDS.includes(p)));

module.exports = { ownerEmails, isOwner, staffOf, access, powersOf, canBoard };
