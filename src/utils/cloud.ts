import type { Expense } from '../types';

const GIST_ID_KEY = 'sync_gist_id';
const SYNC_TOKEN_KEY = 'sync_token';

// Store data as a GitHub Gist (free, no backend needed)

export async function initCloud(): Promise<boolean> {
  return true; // GitHub API always available
}

export function getInitError(): string | null {
  return null;
}

let gistId: string | null = localStorage.getItem(GIST_ID_KEY);
let syncToken: string | null = localStorage.getItem(SYNC_TOKEN_KEY);

export function hasToken(): boolean {
  return !!syncToken;
}

export function setToken(token: string): void {
  syncToken = token;
  localStorage.setItem(SYNC_TOKEN_KEY, token);
}

export function clearToken(): void {
  syncToken = null;
  gistId = null;
  localStorage.removeItem(SYNC_TOKEN_KEY);
  localStorage.removeItem(GIST_ID_KEY);
}

async function githubAPI(path: string, options: RequestInit = {}): Promise<any> {
  if (!syncToken) throw new Error('请先设置 GitHub Token');
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${syncToken}`,
      'Accept': 'application/vnd.github.v3+json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const msg = res.status === 401 ? 'Token 无效' : res.status === 404 ? '数据不存在' : `错误 ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

async function findOrCreateGist(filename: string, content: string): Promise<string> {
  // Search for existing sync gist by description (ignoring any stored gistId)
  const gists = await githubAPI('/gists?per_page=100');
  const existing = (gists as any[]).find((g: any) =>
    g.description === 'expense-tracker-sync' &&
    g.files?.[filename]
  );
  if (existing) {
    gistId = existing.id as string;
    localStorage.setItem(GIST_ID_KEY, gistId);
    return gistId;
  }

  // Not found: create new
  const result = await githubAPI('/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: 'expense-tracker-sync',
      public: false,
      files: { [filename]: { content } },
    }),
  });
  gistId = result.id as string;
  localStorage.setItem(GIST_ID_KEY, gistId);
  return gistId;
}

export async function uploadAllExpenses(expenses: Expense[]): Promise<void> {
  if (!syncToken) throw new Error('no token');

  const clean = expenses.map(({ id, cloudId, ...rest }) => rest);
  const content = JSON.stringify(clean);
  const filename = 'expenses.json';
  const id = await findOrCreateGist(filename, content);

  await githubAPI(`/gists/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      description: 'expense-tracker-sync',
      files: { [filename]: { content } },
    }),
  });
}

export async function downloadAllExpenses(): Promise<Expense[]> {
  if (!syncToken) throw new Error('no token');

  // Always search for sync gist by description
  const gists = await githubAPI('/gists?per_page=100');
  const existing = (gists as any[]).find((g: any) =>
    g.description === 'expense-tracker-sync' &&
    g.files?.['expenses.json']
  );
  const id = existing?.id as string | undefined;
  if (id) {
    gistId = id;
    localStorage.setItem(GIST_ID_KEY, id);
  }
  if (!id) return [];

  const result = await githubAPI(`/gists/${id}`);
  const file = result.files?.['expenses.json'];
  if (!file?.content) return [];

  const data = JSON.parse(file.content);
  if (!Array.isArray(data)) return [];

  return data.map((item: any) => ({
    ...item,
    type: item.type || 'expense',
    isBigPurchase: item.isBigPurchase || false,
  })) as Expense[];
}

export async function syncExpenses(
  localExpenses: Expense[],
  _onUploaded: (expense: Expense, cloudId: string) => Promise<void>,
  onNewLocal: (expense: Expense) => Promise<void>,
): Promise<{ uploaded: number; downloaded: number }> {
  const cloudExpenses = await downloadAllExpenses();

  const cloudSet = new Set<string>();
  for (const ce of cloudExpenses) {
    cloudSet.add(`${ce.date}|${ce.category}|${ce.amount}|${ce.description}`);
  }

  const localSet = new Set<string>();
  for (const le of localExpenses) {
    localSet.add(`${le.date}|${le.category}|${le.amount}|${le.description}`);
  }

  let uploaded = 0;
  let downloaded = 0;

  // Merge: add missing records to cloud
  let changed = false;
  for (const le of localExpenses) {
    const key = `${le.date}|${le.category}|${le.amount}|${le.description}`;
    if (!cloudSet.has(key)) {
      cloudExpenses.push(le);
      cloudSet.add(key);
      changed = true;
      uploaded++;
    }
  }

  // Merge: add missing cloud records to local
  for (const ce of cloudExpenses) {
    const key = `${ce.date}|${ce.category}|${ce.amount}|${ce.description}`;
    if (!localSet.has(key)) {
      await onNewLocal(ce);
      downloaded++;
    }
  }

  // Upload merged data back to gist
  if (changed) {
    await uploadAllExpenses(cloudExpenses);
  }

  return { uploaded, downloaded };
}
