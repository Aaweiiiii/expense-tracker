import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllExpenses, deleteExpense, updateExpense } from '../db';
import { formatAmount, formatLifespan, getToday } from '../utils/format';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type Expense } from '../types';
import { EXPENSE_ICONS, INCOME_ICONS, OtherIcon, OtherIncomeIcon } from '../components/Icon';
import { useDataRefresh } from '../hooks/useData';
import { DatePicker } from '../components/DatePicker';
import { LifespanPicker } from '../components/LifespanPicker';
import { generateDailyReview, getCachedDailyReview, setCachedDailyReview, hasApiKey } from '../utils/ai';

const GREETINGS: Record<number, string[]> = {
  0: ['夜深了，还没记账的话，记完就早点休息吧 🌙', '这么晚还在记账，真是辛苦了，明天也要加油呀 💤', '深夜的账单，藏着你白天的故事，记完好好睡一觉 🛌', '已经很晚了，简单记一笔，然后放下手机吧 🌃', '辛苦了，凌晨的每一笔记录，都是你认真生活的证据 ✨', '夜色最深的时候，也是和自己对话的最好时候，记一笔吧 📝'],
  1: ['夜深了，还没记账的话，记完就早点休息吧 🌙', '这么晚还在记账，真是辛苦了，明天也要加油呀 💤', '深夜的账单，藏着你白天的故事，记完好好睡一觉 🛌', '已经很晚了，简单记一笔，然后放下手机吧 🌃', '辛苦了，凌晨的每一笔记录，都是你认真生活的证据 ✨', '夜色最深的时候，也是和自己对话的最好时候，记一笔吧 📝'],
  2: ['夜深了，还没记账的话，记完就早点休息吧 🌙', '这么晚还在记账，真是辛苦了，明天也要加油呀 💤', '深夜的账单，藏着你白天的故事，记完好好睡一觉 🛌', '已经很晚了，简单记一笔，然后放下手机吧 🌃', '辛苦了，凌晨的每一笔记录，都是你认真生活的证据 ✨', '夜色最深的时候，也是和自己对话的最好时候，记一笔吧 📝'],
  3: ['夜深了，还没记账的话，记完就早点休息吧 🌙', '这么晚还在记账，真是辛苦了，明天也要加油呀 💤', '深夜的账单，藏着你白天的故事，记完好好睡一觉 🛌', '已经很晚了，简单记一笔，然后放下手机吧 🌃', '辛苦了，凌晨的每一笔记录，都是你认真生活的证据 ✨', '夜色最深的时候，也是和自己对话的最好时候，记一笔吧 📝'],
  4: ['夜深了，还没记账的话，记完就早点休息吧 🌙', '这么晚还在记账，真是辛苦了，明天也要加油呀 💤', '深夜的账单，藏着你白天的故事，记完好好睡一觉 🛌', '已经很晚了，简单记一笔，然后放下手机吧 🌃', '辛苦了，凌晨的每一笔记录，都是你认真生活的证据 ✨', '夜色最深的时候，也是和自己对话的最好时候，记一笔吧 📝'],
  5: ['夜深了，还没记账的话，记完就早点休息吧 🌙', '这么晚还在记账，真是辛苦了，明天也要加油呀 💤', '深夜的账单，藏着你白天的故事，记完好好睡一觉 🛌', '已经很晚了，简单记一笔，然后放下手机吧 🌃', '辛苦了，凌晨的每一笔记录，都是你认真生活的证据 ✨', '夜色最深的时候，也是和自己对话的最好时候，记一笔吧 📝'],
  6: ['早上好呀，新的一天，从记下第一笔开始吧 ☀️', '早安，愿你今天的每一笔都是心满意足 💛', '清晨的空气很新鲜，账单也是，来记一笔吧 🌿', '早上好，用记账开启清醒又从容的一天 📒', '新的一天已经送达，别忘了给你的花销做个小小记录 🛎️', '早安，今天也要好好花钱，好好记账哦 🥐'],
  7: ['早上好呀，新的一天，从记下第一笔开始吧 ☀️', '早安，愿你今天的每一笔都是心满意足 💛', '清晨的空气很新鲜，账单也是，来记一笔吧 🌿', '早上好，用记账开启清醒又从容的一天 📒', '新的一天已经送达，别忘了给你的花销做个小小记录 🛎️', '早安，今天也要好好花钱，好好记账哦 🥐'],
  8: ['早上好呀，新的一天，从记下第一笔开始吧 ☀️', '早安，愿你今天的每一笔都是心满意足 💛', '清晨的空气很新鲜，账单也是，来记一笔吧 🌿', '早上好，用记账开启清醒又从容的一天 📒', '新的一天已经送达，别忘了给你的花销做个小小记录 🛎️', '早安，今天也要好好花钱，好好记账哦 🥐'],
  9: ['上午好，精力最好的时候，顺手记一笔吧 ✍️', '阳光正好的上午，别忘了给你的账单也晒晒太阳 🌞', '上午过半，咖啡和记账，都是不错的提神方式 ☕', '上午好，今天的小目标：每一笔都记得清清楚楚 🎯', '忙了一上午，如果花了钱，记得给它留个位置 🗂️', '元气满满的上午，账单也要保持清爽整洁 📋'],
  10: ['上午好，精力最好的时候，顺手记一笔吧 ✍️', '阳光正好的上午，别忘了给你的账单也晒晒太阳 🌞', '上午过半，咖啡和记账，都是不错的提神方式 ☕', '上午好，今天的小目标：每一笔都记得清清楚楚 🎯', '忙了一上午，如果花了钱，记得给它留个位置 🗂️', '元气满满的上午，账单也要保持清爽整洁 📋'],
  11: ['上午好，精力最好的时候，顺手记一笔吧 ✍️', '阳光正好的上午，别忘了给你的账单也晒晒太阳 🌞', '上午过半，咖啡和记账，都是不错的提神方式 ☕', '上午好，今天的小目标：每一笔都记得清清楚楚 🎯', '忙了一上午，如果花了钱，记得给它留个位置 🗂️', '元气满满的上午，账单也要保持清爽整洁 📋'],
  12: ['中午好，午饭吃了吗？顺便把上午的账记一下吧 🍜', '午休时间到，花一分钟记个账，下午更轻松 🌤️', '中午是小小的分界线，上午的消费该入账啦 📥', '吃饱了才有力气记账，是不是呀 😋', '中午好，利用休息的间隙，给钱包做个快速盘点 👛', '半天过去了，你的账单今天长什么样了？记来看看 🔍'],
  13: ['下午好，漫长午后，喝杯水顺便记个账吧 🍵', '下午的能量条在下降，但记账习惯不能掉 ⚡', '太阳慢慢西斜，今天的小账本有没有新故事？📖', '下午茶时间，无论有没有消费，都来打个卡 🍰', '坚持到下午很棒了，记一笔给自己点个赞 👍', '下午好，把今天的零星花费收拢一下，晚上更安心 🌆'],
  14: ['下午好，漫长午后，喝杯水顺便记个账吧 🍵', '下午的能量条在下降，但记账习惯不能掉 ⚡', '太阳慢慢西斜，今天的小账本有没有新故事？📖', '下午茶时间，无论有没有消费，都来打个卡 🍰', '坚持到下午很棒了，记一笔给自己点个赞 👍', '下午好，把今天的零星花费收拢一下，晚上更安心 🌆'],
  15: ['下午好，漫长午后，喝杯水顺便记个账吧 🍵', '下午的能量条在下降，但记账习惯不能掉 ⚡', '太阳慢慢西斜，今天的小账本有没有新故事？📖', '下午茶时间，无论有没有消费，都来打个卡 🍰', '坚持到下午很棒了，记一笔给自己点个赞 👍', '下午好，把今天的零星花费收拢一下，晚上更安心 🌆'],
  16: ['下午好，漫长午后，喝杯水顺便记个账吧 🍵', '下午的能量条在下降，但记账习惯不能掉 ⚡', '太阳慢慢西斜，今天的小账本有没有新故事？📖', '下午茶时间，无论有没有消费，都来打个卡 🍰', '坚持到下午很棒了，记一笔给自己点个赞 👍', '下午好，把今天的零星花费收拢一下，晚上更安心 🌆'],
  17: ['下午好，漫长午后，喝杯水顺便记个账吧 🍵', '下午的能量条在下降，但记账习惯不能掉 ⚡', '太阳慢慢西斜，今天的小账本有没有新故事？📖', '下午茶时间，无论有没有消费，都来打个卡 🍰', '坚持到下午很棒了，记一笔给自己点个赞 👍', '下午好，把今天的零星花费收拢一下，晚上更安心 🌆'],
  18: ['晚上好，一天快结束了，把今天的账收个尾吧 🌇', '华灯初上，坐下来慢慢回忆今天的每一笔，很治愈 🕯️', '晚上好，今天的花销还满意吗？记完就翻篇啦 📖', '睡前最好的仪式感：清空今天的账单，安心入睡 🛁', '忙碌了一天，别忘了给今天的自己做个财务小结 📝', '晚上好，账单清零，烦恼清零，明天又是崭新的一天 ✨'],
  19: ['晚上好，一天快结束了，把今天的账收个尾吧 🌇', '华灯初上，坐下来慢慢回忆今天的每一笔，很治愈 🕯️', '晚上好，今天的花销还满意吗？记完就翻篇啦 📖', '睡前最好的仪式感：清空今天的账单，安心入睡 🛁', '忙碌了一天，别忘了给今天的自己做个财务小结 📝', '晚上好，账单清零，烦恼清零，明天又是崭新的一天 ✨'],
  20: ['晚上好，一天快结束了，把今天的账收个尾吧 🌇', '华灯初上，坐下来慢慢回忆今天的每一笔，很治愈 🕯️', '晚上好，今天的花销还满意吗？记完就翻篇啦 📖', '睡前最好的仪式感：清空今天的账单，安心入睡 🛁', '忙碌了一天，别忘了给今天的自己做个财务小结 📝', '晚上好，账单清零，烦恼清零，明天又是崭新的一天 ✨'],
  21: ['晚上好，一天快结束了，把今天的账收个尾吧 🌇', '华灯初上，坐下来慢慢回忆今天的每一笔，很治愈 🕯️', '晚上好，今天的花销还满意吗？记完就翻篇啦 📖', '睡前最好的仪式感：清空今天的账单，安心入睡 🛁', '忙碌了一天，别忘了给今天的自己做个财务小结 📝', '晚上好，账单清零，烦恼清零，明天又是崭新的一天 ✨'],
  22: ['晚上好，一天快结束了，把今天的账收个尾吧 🌇', '华灯初上，坐下来慢慢回忆今天的每一笔，很治愈 🕯️', '晚上好，今天的花销还满意吗？记完就翻篇啦 📖', '睡前最好的仪式感：清空今天的账单，安心入睡 🛁', '忙碌了一天，别忘了给今天的自己做个财务小结 📝', '晚上好，账单清零，烦恼清零，明天又是崭新的一天 ✨'],
  23: ['晚上好，一天快结束了，把今天的账收个尾吧 🌇', '华灯初上，坐下来慢慢回忆今天的每一笔，很治愈 🕯️', '晚上好，今天的花销还满意吗？记完就翻篇啦 📖', '睡前最好的仪式感：清空今天的账单，安心入睡 🛁', '忙碌了一天，别忘了给今天的自己做个财务小结 📝', '晚上好，账单清零，烦恼清零，明天又是崭新的一天 ✨'],
};

function pickStageGreeting(totalDays: number): string {
  if (totalDays === 0) return '记下第一笔，开启你的记账之旅 ✍️';
  const pool =
    totalDays <= 7 ? STAGE_1_7 :
    totalDays <= 30 ? STAGE_8_30 :
    totalDays <= 180 ? STAGE_31_180 :
    STAGE_181_PLUS;
  const msg = pool[Math.floor(Math.random() * pool.length)];
  return msg.replace('${totalDays}', String(totalDays));
}

const STAGE_1_7 = [
  'Wow！你已经记账${totalDays}天了，小小的开始就是胜利 🌱',
  '记账${totalDays}天啦，你比想象中更有行动力 ✨',
  '才记账${totalDays}天，已经慢慢有模有样了，真不错 👍',
  '记账第${totalDays}天打卡，每一笔都是认真生活的痕迹 📝',
  '记账${totalDays}天了，习惯就是这样一天天养成的，你很棒 💪',
];

const STAGE_8_30 = [
  'Wow！已经坚持记账${totalDays}天，你比自己想的更有耐心 🌿',
  '累计记账${totalDays}天啦，这些小数字已经悄悄在帮你了解自己 🪞',
  '记账第${totalDays}天，记账慢慢变成生活里很自然的一部分了 ☕',
  '记账${totalDays}天，回头看每一笔，都是你认真生活的印记 👣',
  '不知不觉记账${totalDays}天了，你真的很擅长把小事坚持下去 🌟',
  '累计记账${totalDays}天，钱流看得见，心里更踏实了 🧘',
  '记账第${totalDays}天，账单像一本迷你日记，记录着你的每一天 📖',
  '坚持记账${totalDays}天，你没有半途而废，这已经赢了很多人 🏅',
  '已经坚持记账${totalDays}天，你正在养成一个受益很久的习惯 🌳',
  '记账第${totalDays}天，今天也轻松记一笔吧，你已经做得很好了 ✍️',
];

const STAGE_31_180 = [
  'Wow！你已经记账${totalDays}天了，这可不是谁都能做到的 🌸',
  '记账${totalDays}天，你已经把记账变成了一件很酷的日常 😎',
  '累计记账${totalDays}天，时间看得见，你的消费越来越有数了 📊',
  '坚持记账${totalDays}天，你比自己以为的更擅长长期主义 🌄',
  '记账第${totalDays}天，回头看，每一步都算数，真的很了不起 💎',
  '累计记账${totalDays}天，账单像老朋友一样，陪你走过了四季 🍂',
  '不知不觉记账${totalDays}天了，你已经不是当初那个记两笔就忘的人了 🧠',
  '累计记账${totalDays}天，每一页都写满了你对自己生活的掌控感 🎛️',
  '记账${totalDays}天，数字知道，你有多认真地在经营生活 💼',
  '记账第${totalDays}天，继续这样轻松记下去吧，你已经做得足够好了 ☀️',
  'Wow！记账${totalDays}天了，你的耐心值得一个大大的赞 👍',
  '坚持记账${totalDays}天，你对钱的感知力一定变强了不少 🔍',
  '记账${totalDays}天，账本里藏着你所有踏实过日子的证据 🧾',
  '累计记账${totalDays}天，你正在用最温柔的方式，和钱好好相处 🤝',
  '记账第${totalDays}天，你已经比想象中走得更远，也更稳了 🛤️',
  '记账${totalDays}天，生活里的每一笔小确幸，都被你好好记住了 🍀',
  'Wow！记账${totalDays}天了，这个习惯已经悄悄长成你的一部分了 🧩',
  '累计记账${totalDays}天，继续保持就好，不用完美，只要持续 🌊',
  '记账第${totalDays}天，今天也随手记一笔，你已经是个很棒的记录者了 📸',
  '记账${totalDays}天，你认真记账的样子，真的很迷人 ✨',
];

const STAGE_181_PLUS = [
  'Wow！你已经记账${totalDays}天了，这绝对是件了不起的事 🏆',
  '记账${totalDays}天，你是真正的长期主义者，超越绝大多数人 🗼',
  '累计记账${totalDays}天，数字背后，是一个越来越清醒的你 🪬',
  '坚持记账${totalDays}天，记账早就不是任务，而是和你朝夕相处的伙伴 🤗',
  '记账第${totalDays}天，回头看看，你一定会感谢当初没有放弃的自己 💌',
  '记账${totalDays}天，这份耐心和自律，会在很多地方悄悄回报你 🎁',
  'Wow！记账${totalDays}天了，你已经把"认真生活"刻进了日常里 🌞',
  '累计记账${totalDays}天，账单变成了一本关于你自己的成长故事 📚',
  '记账${totalDays}天，数字很诚实，你的坚持更诚实，真的很厉害 👏',
  '记账第${totalDays}天，无论今天花没花钱，你都值得被好好肯定 🌷',
  '坚持记账${totalDays}天，你比想象中更擅长把一件小事变成习惯 🌱',
  '记账${totalDays}天，你已经和钱建立了一种松弛又清醒的关系 🤍',
  '累计记账${totalDays}天，一路记下来，你对自己的了解早就不同了 🧭',
  '记账第${totalDays}天，谢谢你一直没丢下这个小习惯，它也在陪着你 🌙',
  'Wow！记账${totalDays}天了，这已经是传说级别的坚持了，真心佩服你 🫡',
  '记账${totalDays}天，你的账单里，写满了一个人认真生活的全部浪漫 💐',
  '累计记账${totalDays}天，继续这样不慌不忙地记下去吧，一切都刚刚好 🕊️',
  '记账第${totalDays}天，你早就不是需要被督促的人了，记账已是本能 ⚡',
  '记账${totalDays}天，时间花在哪里，都是看得见的，你花在了看清自己上 🪞',
  'Wow！记账${totalDays}天了，今天也来轻轻松松记一笔，你做得已经超级棒了 🍦',
];

export function Home() {
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const navigate = useNavigate();
  const { refreshKey, refresh } = useDataRefresh();

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editType, setEditType] = useState<'expense' | 'income'>('expense');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState(getToday());
  const [editIsAsset, setEditIsAsset] = useState(false);
  const [editLifespanY, setEditLifespanY] = useState(0);
  const [editLifespanM, setEditLifespanM] = useState(0);
  const [editSaving, setEditSaving] = useState(false);

  function startEdit(expense: Expense) {
    setEditingId(expense.id!);
    const t = expense.type || 'expense';
    setEditType(t);
    setEditAmount(String(expense.amount));
    setEditCategory(expense.category);
    setEditDesc(expense.description);
    setEditDate(expense.date);
    if (expense.isBigPurchase) {
      setEditIsAsset(true);
      const ly = expense.lifespanYears || 0;
      setEditLifespanY(Math.floor(ly));
      setEditLifespanM(Math.round((ly - Math.floor(ly)) * 12));
    } else {
      setEditIsAsset(false);
      setEditLifespanY(0);
      setEditLifespanM(0);
    }
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleEditSave() {
    const num = parseFloat(editAmount);
    if (!num || num <= 0) { alert('请输入有效的金额'); return; }
    if (editType === 'expense' && editIsAsset && editLifespanY === 0 && editLifespanM === 0) {
      alert('请填写预计使用时间');
      return;
    }
    setEditSaving(true);
    try {
      const groupKey = (editType === 'expense' && editIsAsset)
        ? `${editCategory}:${editDesc.trim() || editCategory}`
        : undefined;
      await updateExpense(editingId!, {
        type: editType,
        amount: num,
        category: editCategory,
        description: editDesc.trim() || editCategory,
        date: editDate,
        isBigPurchase: editType === 'expense' && editIsAsset,
        lifespanYears: (editType === 'expense' && editIsAsset)
          ? (editLifespanY + editLifespanM / 12)
          : undefined,
        groupKey,
      });
      setEditingId(null);
      refresh();
    } catch {
      alert('保存失败');
    } finally {
      setEditSaving(false);
    }
  }

  // Daily review
  const [dailyReview, setDailyReview] = useState('');
  const [dailyReviewLoading, setDailyReviewLoading] = useState(false);
  const [dailyReviewError, setDailyReviewError] = useState('');

  useEffect(() => {
    const cached = getCachedDailyReview(selectedDate);
    setDailyReview(cached || '');
    setDailyReviewError('');
  }, [selectedDate]);

  useEffect(() => {
    loadExpenses();
  }, [refreshKey]);

  async function loadExpenses() {
    setLoading(true);
    const data = await getAllExpenses();
    setAllExpenses(data);
    setLoading(false);
  }

  async function handleDelete(id: number) {
    if (!confirm('确定删除这条记录吗？')) return;
    await deleteExpense(id);
    await loadExpenses();
  }

  // All dates that have at least one record, sorted descending (newest first)
  const recordedDates = useMemo(() => {
    const set = new Set<string>();
    set.add(getToday());
    for (const e of allExpenses) {
      set.add(e.date);
    }
    return Array.from(set).sort().reverse();
  }, [allExpenses]);

  const recordedDatesSet = useMemo(() => new Set(recordedDates), [recordedDates]);

  // Records for selected date
  const dayRecords = useMemo(() => {
    return allExpenses.filter((e) => e.date === selectedDate);
  }, [allExpenses, selectedDate]);

  const dayExpense = useMemo(() =>
    dayRecords.filter((e) => (e.type || 'expense') === 'expense').reduce((s, e) => s + e.amount, 0),
    [dayRecords]);
  const dayIncome = useMemo(() =>
    dayRecords.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0),
    [dayRecords]);

  const today = getToday();
  const isToday = selectedDate === today;

  // Total unique days with records (before today) for streak greeting
  const totalDays = useMemo(() => {
    const dates = new Set<string>();
    for (const e of allExpenses) {
      if (e.date < today) dates.add(e.date);
    }
    return dates.size;
  }, [allExpenses, today]);

  // Nickname & greeting
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const pool = GREETINGS[h] || GREETINGS[18];
    return pool[Math.floor(Math.random() * pool.length)];
  }, []);
  const moodText = useMemo(() => {
    if (!isToday) return null;
    if (dayExpense === 0 && dayIncome === 0) return pickStageGreeting(totalDays);
    if (dayExpense === 0) return '今天还没花钱，继续保持';
    if (dayExpense < 100) return '小额消费，节奏不错';
    if (dayExpense < 300) return '今天花得还挺克制';
    if (dayExpense < 800) return '今日消费正常水平';
    return '今天花得有点多哦，注意预算';
  }, [isToday, dayExpense, dayIncome, totalDays]);

  // Daily review data
  const dailyReviewData = useMemo(() => {
    const expItems = dayRecords
      .filter((e) => (e.type || 'expense') === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map((e) => ({ date: e.date, description: e.description || e.category, amount: e.amount, category: e.category }));
    const incItems = dayRecords
      .filter((e) => e.type === 'income')
      .sort((a, b) => b.amount - a.amount)
      .map((e) => ({ date: e.date, description: e.description || e.category, amount: e.amount, category: e.category }));
    return { date: selectedDate, expenseTotal: dayExpense, incomeTotal: dayIncome, recordCount: dayRecords.length, items: expItems, incomeItems: incItems };
  }, [selectedDate, dayExpense, dayIncome, dayRecords]);

  async function handleGenerateDailyReview() {
    setDailyReviewLoading(true);
    setDailyReviewError('');
    try {
      const result = await generateDailyReview(dailyReviewData);
      setDailyReview(result);
      setCachedDailyReview(selectedDate, result);
    } catch {
      setDailyReviewError('生成失败，请检查网络后重试');
    } finally {
      setDailyReviewLoading(false);
    }
  }

  // Day navigation
  function goPrevDay() {
    const idx = recordedDates.indexOf(selectedDate);
    if (idx >= 0 && idx < recordedDates.length - 1) {
      setSelectedDate(recordedDates[idx + 1]);
    }
  }

  function goNextDay() {
    const idx = recordedDates.indexOf(selectedDate);
    if (idx > 0) {
      setSelectedDate(recordedDates[idx - 1]);
    }
  }

  const canGoPrev = recordedDates.indexOf(selectedDate) < recordedDates.length - 1;
  const canGoNext = recordedDates.indexOf(selectedDate) > 0 && !isToday;

  // Format selected date for display
  const [, sm, sd] = selectedDate.split('-').map(Number);

  const recordItem = (expense: Expense) => {
    const isIncome = expense.type === 'income';
    const isEditing = editingId === expense.id;

    if (isEditing) {
      const cats = editType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
      const catIcons = editType === 'expense' ? EXPENSE_ICONS : INCOME_ICONS;
      const isExpense = editType === 'expense';
      return (
        <div key={expense.id} className="bg-[var(--color-surface)] rounded-xl p-4 space-y-3">
          {/* Type toggle */}
          <div className="bg-[var(--color-surface-alt)] rounded-lg p-0.5 flex">
            <button
              type="button"
              onClick={() => setEditType('expense')}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${isExpense ? 'bg-cyan-600 text-white' : 'text-[var(--color-text-muted)]'}`}
            >支出</button>
            <button
              type="button"
              onClick={() => setEditType('income')}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${!isExpense ? 'bg-green-600 text-white' : 'text-[var(--color-text-muted)]'}`}
            >收入</button>
          </div>
          {/* Amount */}
          <div className="flex items-center gap-2">
            <span className={`font-bold text-lg ${isExpense ? 'text-cyan-400' : 'text-green-400'}`}>¥</span>
            <input
              type="number" step="0.01" inputMode="decimal"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              className="flex-1 bg-[var(--color-surface-alt)] rounded-lg px-3 py-2 text-lg font-bold outline-none focus:ring-1 focus:ring-cyan-600"
            />
          </div>
          {/* Category */}
          <div className="flex flex-wrap gap-1.5">
            {cats.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setEditCategory(cat)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                  editCategory === cat
                    ? (isExpense ? 'bg-cyan-600/20 text-cyan-400 ring-1 ring-cyan-600/50' : 'bg-green-600/20 text-green-400 ring-1 ring-green-600/50')
                    : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
                }`}
              >
                {(() => { const CI = catIcons[cat]; return <CI size={16} />; })()}
                {cat}
              </button>
            ))}
          </div>
          {/* Description */}
          <input
            type="text"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="描述"
            className="w-full bg-[var(--color-surface-alt)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-cyan-600 placeholder-[var(--color-text-faint)]"
          />
          {/* Date */}
          <DatePicker value={editDate} onChange={setEditDate} />
          {/* Asset toggle */}
          {isExpense && (
            <div className="bg-[var(--color-surface-alt)] rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium">标记为资产消费</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditIsAsset(!editIsAsset)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${editIsAsset ? 'bg-cyan-600' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${editIsAsset ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {editIsAsset && (
                <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                  <label className="text-xs text-[var(--color-text-muted)] block mb-2">预计使用时间</label>
                  <LifespanPicker
                    years={editLifespanY}
                    months={editLifespanM}
                    onYearsChange={setEditLifespanY}
                    onMonthsChange={setEditLifespanM}
                  />
                </div>
              )}
            </div>
          )}
          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleEditSave}
              disabled={editSaving}
              className={`flex-1 py-2 rounded-lg text-sm font-medium text-white active:opacity-80 disabled:opacity-50 ${isExpense ? 'bg-cyan-600' : 'bg-green-600'}`}
            >{editSaving ? '保存中...' : '保存'}</button>
            <button
              onClick={cancelEdit}
              className="flex-1 py-2 rounded-lg text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-alt)] active:bg-[var(--color-surface-alt)]"
            >取消</button>
          </div>
        </div>
      );
    }

    const IconComp = isIncome
      ? (INCOME_ICONS[expense.category] || OtherIncomeIcon)
      : (EXPENSE_ICONS[expense.category] || OtherIcon);
    return (
      <div
        key={expense.id}
        className="flex items-center gap-3 bg-[var(--color-surface)] rounded-xl px-4 py-3 active:scale-[0.98] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      >
        <IconComp size={24} className="shrink-0 text-[var(--color-icon)]" />
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate flex items-center gap-1.5">
            {expense.description || expense.category}
            {isIncome && (
              <span className="shrink-0 text-[10px] bg-green-600/20 text-green-400 px-1.5 py-0.5 rounded">
                收入
              </span>
            )}
            {!isIncome && expense.isBigPurchase && (
              <span className="shrink-0 text-[10px] bg-cyan-600/20 text-cyan-400 px-1.5 py-0.5 rounded">
                资产
              </span>
            )}
          </div>
          {expense.subcategory && (
            <div className="text-xs text-[var(--color-text-muted)]">{expense.subcategory}</div>
          )}
          {!isIncome && expense.isBigPurchase && (
            <div className="text-xs text-[var(--color-text-faint)]">
              预计使用 {expense.lifespanYears ? formatLifespan(expense.lifespanYears) : '未设置'}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className={`font-semibold ${isIncome ? 'text-green-400' : ''}`}>
            {isIncome ? '+' : ''}{formatAmount(expense.amount)}
          </div>
          {expense.tags && expense.tags.length > 0 && (
            <div className="text-xs text-[var(--color-text-faint)]">{expense.tags[0]}</div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); startEdit(expense); }}
          className="text-[var(--color-text-faint)] hover:text-cyan-400 text-sm shrink-0"
          title="编辑"
        >
          ✎
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(expense.id!); }}
          className="text-[var(--color-text-faint)] hover:text-red-400 text-sm ml-0.5 shrink-0"
        >
          ✕
        </button>
      </div>
    );
  };

  return (
    <div>
      {/* Greeting */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-[var(--color-text)]">
            {greeting}
          </span>
        </div>
        {moodText && (
          <p className="text-sm text-[var(--color-text-muted)] mt-1 leading-relaxed">
            {moodText}
          </p>
        )}
      </div>

      {/* Day Navigator */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-3 mb-4">
        <div className="flex items-center gap-1">
          <button
            onClick={goPrevDay}
            disabled={!canGoPrev}
            className={`text-xl px-1 ${canGoPrev ? 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'}`}
          >
            ＜
          </button>
          <div className="flex-1">
            <DatePicker value={selectedDate} onChange={setSelectedDate} availableDates={recordedDatesSet} />
          </div>
          <button
            onClick={goNextDay}
            disabled={!canGoNext}
            className={`text-xl px-1 ${canGoNext ? 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'}`}
          >
            ＞
          </button>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(today)}
              className="text-xs text-cyan-400 hover:text-cyan-300 px-1 shrink-0"
            >
              📍
            </button>
          )}
        </div>
      </div>

      {/* Daily Summary Card */}
      <div className="bg-gradient-to-br from-cyan-600 to-blue-700 rounded-2xl p-5 mb-5 shadow-lg">
        <div className="text-cyan-200 text-xs mb-1">
          {isToday ? '今天' : `${sm}月${sd}日`}
        </div>
        <div className="flex justify-between items-end">
          <div>
            <div className="text-cyan-200/80 text-xs mb-0.5">支出</div>
            <div className="text-3xl font-extrabold tracking-tight">{formatAmount(dayExpense)}</div>
          </div>
          <div className="text-right">
            <div className="text-green-200/80 text-xs mb-0.5">收入</div>
            <div className="text-3xl font-extrabold tracking-tight text-green-300">{formatAmount(dayIncome)}</div>
          </div>
        </div>
      </div>

      {/* Records List */}
      <div className="space-y-2 stagger-children">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[var(--color-surface)] rounded-xl px-4 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg animate-shimmer shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded animate-shimmer" />
                  <div className="h-3 w-16 rounded animate-shimmer" />
                </div>
                <div className="h-5 w-14 rounded animate-shimmer" />
              </div>
            ))}
          </div>
        ) : dayRecords.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📝</div>
            <div className="text-[var(--color-text-muted)]">
              {sm}月{sd}日暂无记录
            </div>
            <button
              onClick={() => navigate('/add')}
              className="mt-4 inline-block bg-cyan-600 text-white px-6 py-2 rounded-full text-sm font-medium"
            >
              记一笔
            </button>
          </div>
        ) : (
          dayRecords.map(recordItem)
        )}

        {/* Daily Review */}
        {!loading && (
          <div className="bg-[var(--color-surface)] rounded-2xl p-5 mt-4 animate-fade-in-up">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-[var(--color-text-muted)]">📊 本日复盘</h2>
              {dailyReview && hasApiKey() && (
                <button
                  onClick={handleGenerateDailyReview}
                  disabled={dailyReviewLoading}
                  className="text-xs text-[var(--color-text-faint)] hover:text-cyan-400 transition-colors"
                >
                  🔄 再次复盘
                </button>
              )}
            </div>

            {dailyReview ? (
              <p className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-line">{dailyReview}</p>
            ) : dailyReviewLoading ? (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] py-4">
                <span className="animate-pulse">🧠</span>
                正在分析今日消费...
              </div>
            ) : dailyReviewError ? (
              <div>
                <p className="text-sm text-red-400 mb-3">{dailyReviewError}</p>
                <button onClick={handleGenerateDailyReview} className="text-sm text-cyan-400 hover:text-cyan-300">重试</button>
              </div>
            ) : !hasApiKey() ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                请先在「设置」页配置 DeepSeek API Key
              </p>
            ) : (
              <button
                onClick={handleGenerateDailyReview}
                className="w-full py-3 rounded-xl text-sm font-medium bg-cyan-600/10 text-cyan-400 hover:bg-cyan-600/20 active:bg-cyan-600/30 transition-colors"
              >
                📊 生成本日复盘
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
