const EVM_CA = /\b0x[a-fA-F0-9]{40}\b/g;

export function extractBaseAddresses(text: string): string[] {
  return [...new Set((text.match(EVM_CA) ?? []).map((x) => x.toLowerCase()))];
}

export function tickerMatches(text: string, ticker: string): boolean {
  const normalized = ticker.replace(/^\$/, '').trim().toUpperCase();
  if (!normalized) return false;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Z0-9_])\\$?${escaped}(?=$|[^A-Z0-9_])`, 'i').test(text);
}
