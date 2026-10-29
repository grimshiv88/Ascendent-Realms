// Money: Copper, Silver and Gold coins. 100 Copper make 1 Silver, 100 Silver make 1 Gold.
// Every amount in the game (prices, purses, rewards) is counted in Copper; this file only shows it.
// Coins are also minted from ore at the Blacksmith (see MINT).

export const SILVER = 100;
export const GOLD = 100 * SILVER;

export const COIN_ICON = { gold: '🟡', silver: '⚪', copper: '🟤' };

// 16050 -> { gold: 1, silver: 60, copper: 50 }
export function coinsOf(n) {
  n = Math.max(0, Math.round(Number(n) || 0));
  return { gold: Math.floor(n / GOLD), silver: Math.floor((n % GOLD) / SILVER), copper: n % SILVER };
}

// Short, for prices and purses: "1🟡 60⚪ 50🟤" (only the coins it takes)
export function money(n) {
  const c = coinsOf(n);
  const parts = [];
  if (c.gold) parts.push(`${c.gold.toLocaleString()}${COIN_ICON.gold}`);
  if (c.silver) parts.push(`${c.silver}${COIN_ICON.silver}`);
  if (c.copper || !parts.length) parts.push(`${c.copper}${COIN_ICON.copper}`);
  return parts.join(' ');
}

// In words, for messages: "1 Gold, 60 Silver and 50 Copper"
export function moneyWords(n) {
  const c = coinsOf(n);
  const parts = [];
  if (c.gold) parts.push(`${c.gold.toLocaleString()} Gold`);
  if (c.silver) parts.push(`${c.silver} Silver`);
  if (c.copper || !parts.length) parts.push(`${c.copper} Copper`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
}

// What one piece of ore mints into at the Blacksmith, in Copper: Copper Ore makes Copper coins, four
// Silver Ore a Silver coin, and Gold Ore a Silver coin each (a hundred of them, a Gold coin).
export const MINT = { copper_ore: 2, silver_ore: SILVER / 4, gold_ore: SILVER };
