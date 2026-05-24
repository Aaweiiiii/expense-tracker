import OpenAI from 'openai';

const STORAGE_KEY = 'deepseek_api_key';
const CACHE_PREFIX = 'ai_review_';

function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function saveApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

function getClient(): OpenAI {
  const key = getApiKey();
  if (!key) throw new Error('未设置 API Key');
  return new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: key,
    dangerouslyAllowBrowser: true,
  });
}

interface MonthlyData {
  year: number;
  month: number;
  expenseTotal: number;
  incomeTotal: number;
  recordCount: number;
  categoryBreakdown: { category: string; total: number; pct: number }[];
  dailyAvg: number;
  topDay: { date: string; total: number } | null;
}

export async function generateMonthlyReview(data: MonthlyData): Promise<string> {
  const client = getClient();

  const catSummary = data.categoryBreakdown
    .map((c) => `${c.category} ¥${c.total.toFixed(0)}（${c.pct}%）`)
    .join('、');

  const prompt = `你是个人财务顾问。请根据以下月度消费数据，用轻松有温度的语气做简短复盘（不超过250字），包括：整体评价、消费结构是否健康、值得注意的地方、一个实用省钱建议。

数据：
- ${data.year}年${data.month}月
- 总支出：¥${data.expenseTotal.toFixed(0)}
- 总收入：¥${data.incomeTotal.toFixed(0)}
- 结余：¥${(data.incomeTotal - data.expenseTotal).toFixed(0)}
- 共${data.recordCount}笔记录，日均支出 ¥${data.dailyAvg.toFixed(0)}
${data.topDay ? `- 最高消费日：${data.topDay.date}（¥${data.topDay.total.toFixed(0)}）` : ''}
- 分类排行：${catSummary}

请直接输出复盘内容，不要带标题或前缀。`;

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是个人财务顾问，回复简洁有温度，不超过250字。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.8,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content || 'AI 暂时无法生成分析，请稍后重试。';
}

export function getCachedReview(key: string): string | null {
  return localStorage.getItem(CACHE_PREFIX + key);
}

export function setCachedReview(key: string, text: string): void {
  localStorage.setItem(CACHE_PREFIX + key, text);
}
