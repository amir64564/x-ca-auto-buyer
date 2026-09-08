import { config } from './config.js';

export type XPost = { id: string; text: string; created_at?: string };

const SEARCH_URL = 'https://api.x.com/2/tweets/search/recent';

export async function fetchRecentPosts(sinceId?: string): Promise<XPost[]> {
  const query = `from:${config.xUsername} -is:retweet`;
  const params = new URLSearchParams({
    query,
    max_results: '10',
    'tweet.fields': 'created_at,author_id',
  });
  if (sinceId) params.set('since_id', sinceId);

  const res = await fetch(`${SEARCH_URL}?${params}`, {
    headers: { Authorization: `Bearer ${config.xBearerToken}` },
  });
  if (!res.ok) throw new Error(`X API ${res.status}: ${await res.text()}`);
  const body = await res.json() as { data?: XPost[] };
  return (body.data ?? []).sort((a, b) => a.id.localeCompare(b.id));
}
