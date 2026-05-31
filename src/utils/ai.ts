import OpenAI from 'openai';

const STORAGE_KEY = 'deepseek_api_key';
const MONTHLY_CACHE_PREFIX = 'ai_review_';
const DAILY_CACHE_PREFIX = 'ai_daily_';

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

interface ExpenseItem {
  date: string;
  description: string;
  amount: number;
  category: string;
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
  topItems: ExpenseItem[];
}

export async function generateMonthlyReview(data: MonthlyData): Promise<string> {
  const client = getClient();

  const catSummary = data.categoryBreakdown
    .map((c) => `${c.category} ¥${c.total.toFixed(0)}（${c.pct}%）`)
    .join('、');

  const balance = data.incomeTotal - data.expenseTotal;

  let detailBlock = '';
  if (data.topItems.length > 0) {
    detailBlock = '\n- 本月大额/代表性支出：\n' + data.topItems
      .map((e) => `  · ${e.date}「${e.description}」¥${e.amount.toFixed(0)}（${e.category}）`)
      .join('\n');
  }

  const name = localStorage.getItem('nickname') || '朋友';

  const prompt = `你是专业的个人财务分析师。用户的名字是「${name}」，请在复盘时用这个名字称呼用户。根据以下月度消费数据做简短复盘（不超过200字），语气温和但不油滑，像给朋友做财务建议。

结构要求：
1. 用「${name}」称呼用户，一句话总结本月消费特点（客观提炼，不要夸张调侃）
2. 指出消费结构的亮点或需要关注的地方（2-3 点）
3. 给一条具体可操作的省钱建议

数据：
- ${data.year}年${data.month}月
- 总支出 ¥${data.expenseTotal.toFixed(0)}，总收入 ¥${data.incomeTotal.toFixed(0)}，结余 ¥${balance.toFixed(0)}
- ${data.recordCount} 笔记录，日均 ¥${data.dailyAvg.toFixed(0)}
${data.topDay ? `- 单日消费最高：${data.topDay.date}（¥${data.topDay.total.toFixed(0)}）` : ''}
- 分类占比：${catSummary}${detailBlock}

直接输出复盘，不要加标题或署名。`;

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是专业的个人财务分析师，语气温和专业但不刻板，用用户的名字称呼他们。回复不超过200字，简洁有料。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content || 'AI 暂时无法生成分析，请稍后重试。';
}

// ── Daily Review ──

interface DailyData {
  date: string;
  expenseTotal: number;
  incomeTotal: number;
  recordCount: number;
  items: ExpenseItem[];
  incomeItems: ExpenseItem[];
}

export async function generateDailyReview(data: DailyData): Promise<string> {
  const client = getClient();

  const expenseBlock = data.items
    .map((e) => `${e.date}「${e.description}」¥${e.amount.toFixed(0)}（${e.category}）`)
    .join('\n');

  const incomeBlock = data.incomeItems
    .map((e) => `${e.date}「${e.description}」¥${e.amount.toFixed(0)}（${e.category}）`)
    .join('\n');

  const name = localStorage.getItem('nickname') || '朋友';
  const [y, m, d] = data.date.split('-');

  const haveIncome = data.incomeItems.length > 0 && data.incomeTotal > 0;

  const hasRecords = data.recordCount > 0;

  const prompt = `你是用户的记账伙伴。用户的名字是「${name}」。根据以下数据做一个今日消费小结（不超过150字）。要有信息量，不能只是复述数据。

${y}年${parseInt(m)}月${parseInt(d)}日
支出 ¥${data.expenseTotal.toFixed(0)}，${data.recordCount} 笔
${data.items.length > 0 ? `${expenseBlock}` : ''}
${haveIncome ? `收入：\n${incomeBlock}` : ''}
${!hasRecords ? '今天没有消费记录。' : ''}

${!hasRecords
  ? '今天没有消费，简单肯定这种节奏即可。'
  : `结构参考：
1. 概括今日支出（例如：笔数少但金额大 / 多笔小额 / 有固定支出 / 某类占比突出）
2. 点出值得关注的消费特征，比如"这笔支出在日常餐饮中属于较高水平"或"今天以日常消费为主、节奏正常"——观察事实，不做价值判断
3. 如果只有单笔支出，可以把它放在用户整体记账习惯中做一个中性参照，例如"单日单笔大额在记账记录里并不常见，值得留下一笔"
${haveIncome ? '4. 有收入的话，简要对比收支' : ''}`
}

约束：
- 不揣测消费动机（不猜测"为什么花"）
- 不说教（不用"建议""应该""可以留意""下次注意"）
- 不评判（不用"合理/不合理""好/不好"）

直接输出，不要标题和署名。`;

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是用户的记账伙伴，语气平和自然、不轻浮不油腻。用用户的名字称呼他们。回复不超过150字。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 400,
  });

  return response.choices[0]?.message?.content || 'AI 暂时无法生成分析，请稍后重试。';
}

// ── Caching ──

export function getCachedReview(key: string): string | null {
  return localStorage.getItem(MONTHLY_CACHE_PREFIX + key);
}

export function setCachedReview(key: string, text: string): void {
  localStorage.setItem(MONTHLY_CACHE_PREFIX + key, text);
}

export function getCachedDailyReview(date: string): string | null {
  return localStorage.getItem(DAILY_CACHE_PREFIX + date);
}

export function setCachedDailyReview(date: string, text: string): void {
  localStorage.setItem(DAILY_CACHE_PREFIX + date, text);
}
