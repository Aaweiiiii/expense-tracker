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

  const prompt = `你是专业的个人财务分析师。用户的名字是「${name}」，请在复盘时用这个名字称呼用户。根据以下单日消费数据做简短复盘（不超过120字），只关注当天的支出情况。

数据：
- 日期：${y}年${parseInt(m)}月${parseInt(d)}日
- 当日支出 ¥${data.expenseTotal.toFixed(0)}，共 ${data.recordCount} 笔
${data.items.length > 0 ? `- 支出明细：\n${expenseBlock}` : ''}
${haveIncome ? `- 当日有收入：\n${incomeBlock}` : ''}
${!hasRecords ? '\n注意：今天还没有任何消费记录。' : ''}

要求：
${!hasRecords
  ? '1. 今天还没有消费记录，用一句温暖简短的话肯定这种"无支出日"\n2. 聊聊零消费日对财务健康的意义（20字内）'
  : `1. 一句话点评当日消费
2. 如果当日有大额支出，指出并关联类别
3. 如果当日没有消费，肯定这种克制
${haveIncome ? '4. 如果当日有工资、兼职等劳动收入，用温暖的语气肯定一下，比如"今天的努力得到了回报，值得开心"' : ''}`
}

规则：
- 不要提"没有收入"，大部分日子本就没有入账，这是正常的
- 不要分析月度趋势或累计数据，只聊今天

直接输出复盘，不要加标题或署名。`;

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是专业的个人财务分析师，语气温和有人情味，用用户的名字称呼他们。回复不超过120字。' },
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
