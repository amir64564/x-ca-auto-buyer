import Database from 'better-sqlite3';

const db = new Database('bot.db');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  ca TEXT NOT NULL,
  status TEXT NOT NULL,
  tx_hash TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);
`);

export function hasPost(id: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM posts WHERE id = ?').get(id));
}

export function savePost(id: string): void {
  db.prepare('INSERT OR IGNORE INTO posts (id, created_at) VALUES (?, ?)').run(id, new Date().toISOString());
}

export function hasTradeForCa(ca: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM trades WHERE lower(ca) = lower(?) AND status IN (\'pending\', \'success\', \'simulated\')').get(ca));
}

export function saveTrade(postId: string, ticker: string, ca: string, status: string, txHash?: string, error?: string): void {
  db.prepare('INSERT INTO trades (post_id, ticker, ca, status, tx_hash, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(postId, ticker, ca, status, txHash ?? null, error ?? null, new Date().toISOString());
}

export function recentTradeCount(hours: number): number {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  return Number(db.prepare('SELECT COUNT(*) as c FROM trades WHERE status IN (\'success\', \'simulated\') AND created_at >= ?').get(since)?.c ?? 0);
}

export function dailySpendEth(): number {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const rows = db.prepare('SELECT error FROM trades WHERE status IN (\'success\', \'simulated\') AND created_at >= ?').all(since.toISOString()) as Array<{error: string | null}>;
  return rows.reduce((sum, row) => sum + Number(row.error ?? 0), 0);
}
