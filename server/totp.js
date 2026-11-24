// Codes from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, ...):
// the standard 6-digit code that changes every 30 seconds (TOTP, RFC 6238).
const crypto = require('node:crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function unbase32(s) {
  let bits = 0, val = 0; const out = [];
  for (const ch of String(s).toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    val = (val << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

function codeAt(secret, step) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', unbase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}

const newSecret = () => base32(crypto.randomBytes(20));
// the code now, or one step either side (a phone clock a little off)
function check(secret, code, now = Date.now()) {
  code = String(code || '').replace(/\D/g, '');
  if (!secret || code.length !== 6) return false;
  const step = Math.floor(now / 30000);
  return [-1, 0, 1].some((d) => crypto.timingSafeEqual(Buffer.from(codeAt(secret, step + d)), Buffer.from(code)));
}
// the link an authenticator app understands (also drawn as the QR code)
const uri = (secret, username) => `otpauth://totp/${encodeURIComponent(`Ascendant Realms:${username}`)}?secret=${secret}&issuer=${encodeURIComponent('Ascendant Realms')}&digits=6&period=30`;

module.exports = { newSecret, check, uri, codeAt };
