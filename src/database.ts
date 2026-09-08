import Database from 'better-sqlite3';

const db = new Database('bot.db');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  ca TEXT NOT NULL,
  status TEXT NOT NULL,
  tx_hash TEXT,
  error TEXT,
  spend_eth TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

// Migrate databases created by older versions.
try { db.exec('ALTER TABLE trades ADD COLUMN spend_eth TEXT'); } catch { /* already exists */ }

export function hasPost(id: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM posts WHERE id = ?').get(id));
}
export function savePost(id: string): void {
  db.prepare('INSERT OR IGNORE INTO posts (id, created_at) VALUES (?, ?)').run(id, new Date().toISOString());
}
export function getState(key: string): string | undefined {
  return (db.prepare('SELECT value FROM state WHERE key = ?').get(key) as { value?: string } | undefined)?.value;
}
export function setState(key: string, value: string): void {
  db.prepare('INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
export function hasTradeForCa(ca: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM trades WHERE lower(ca) = lower(?) AND status IN ('pending', 'success', 'simulated')").get(ca));
}
export function saveTrade(postId: string, ticker: string, ca: string, status: string, txHash?: string, error?: string, spendEth?: string): void {
  db.prepare('INSERT INTO trades (post_id, ticker, ca, status, tx_hash, error, spend_eth, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(postId, ticker, ca, status, txHash ?? null, error ?? null, spendEth ?? null, new Date().toISOString());
}
export function recentTradeCount(hours: number): number {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  return Number((db.prepare("SELECT COUNT(*) as c FROM trades WHERE status IN ('success', 'simulated') AND created_at >= ?").get(since) as { c: number }).c);
}
export function dailySpendEth(): number {
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const rows = db.prepare("SELECT spend_eth FROM trades WHERE status IN ('success', 'simulated') AND created_at >= ?").all(since.toISOString()) as Array<{ spend_eth: string | null }>;
  return rows.reduce((sum, row) => sum + Number(row.spend_eth ?? 0), 0);
}
