import { useRef, useState, useEffect } from 'react';
import { getAllExpenses, addExpense, db } from '../db';
import type { Expense } from '../types';
import { useDataRefresh } from '../hooks/useData';
import { hasApiKey, saveApiKey } from '../utils/ai';

export function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { refresh } = useDataRefresh();
  const [deleting, setDeleting] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setKeySaved(hasApiKey());
  }, []);

  function handleSaveKey() {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      alert('请输入有效的 API Key');
      return;
    }
    saveApiKey(trimmed);
    setApiKey('');
    setKeySaved(true);
  }

  function handleClearKey() {
    if (!confirm('确定要清除已保存的 API Key 吗？')) return;
    localStorage.removeItem('deepseek_api_key');
    setKeySaved(false);
  }

  async function handleDeleteAll() {
    if (!confirm('确定要删除所有消费记录吗？此操作不可撤销！')) return;
    if (!confirm('再次确认：真的要清空全部数据吗？')) return;
    setDeleting(true);
    try {
      await db.expenses.clear();
      refresh();
      alert('所有数据已删除');
    } catch {
      alert('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport() {
    const data = await getAllExpenses();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    a.download = `消费记录备份_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('导入将合并数据到当前记录（不会删除已有数据）。确定继续吗？')) {
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const data: Expense[] = JSON.parse(text);
      let count = 0;
      for (const item of data) {
        const { id, createdAt, ...rest } = item;
        await addExpense({ ...rest, isBigPurchase: rest.isBigPurchase || false });
        count++;
      }
      alert(`成功导入 ${count} 条消费记录`);
      refresh();
    } catch {
      alert('导入失败：文件格式不正确');
    }
    e.target.value = '';
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-5">设置</h1>

      <div className="space-y-3">
        {/* Export */}
        <button
          onClick={handleExport}
          className="w-full bg-gray-900 rounded-2xl p-4 text-left flex items-center gap-4 active:bg-gray-800"
        >
          <span className="text-2xl">📤</span>
          <div>
            <div className="font-medium text-sm">导出数据</div>
            <div className="text-xs text-gray-500">将所有消费记录导出为 JSON 文件</div>
          </div>
        </button>

        {/* Import */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-gray-900 rounded-2xl p-4 text-left flex items-center gap-4 active:bg-gray-800"
        >
          <span className="text-2xl">📥</span>
          <div>
            <div className="font-medium text-sm">导入数据</div>
            <div className="text-xs text-gray-500">从 JSON 文件恢复消费记录</div>
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />

        {/* DeepSeek API Key */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-2xl">🤖</span>
            <div>
              <div className="font-medium text-sm">DeepSeek API Key</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {keySaved ? '已配置 · 用于 AI 月度复盘功能' : '用于 AI 月度复盘功能，去 platform.deepseek.com 注册获取'}
              </div>
            </div>
          </div>
          {keySaved ? (
            <button
              onClick={handleClearKey}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              清除已保存的 Key
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="粘贴 API Key..."
                className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-600 focus:ring-1 focus:ring-cyan-600"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-xs text-gray-600 hover:text-gray-400 px-2"
              >
                {showKey ? '隐藏' : '显示'}
              </button>
              <button
                onClick={handleSaveKey}
                className="bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium active:bg-cyan-700 shrink-0"
              >
                保存
              </button>
            </div>
          )}
        </div>

        {/* Data info */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <span className="text-2xl">🔒</span>
            <div>
              <div className="font-medium text-sm">数据存储说明</div>
              <div className="text-xs text-gray-500 mt-1">
                当前数据存储在浏览器本地。换手机前请先导出备份，在新手机上导入即可恢复。
                后续将支持云端自动同步。
              </div>
            </div>
          </div>
        </div>

        {/* Delete All Data */}
        <button
          onClick={handleDeleteAll}
          disabled={deleting}
          className="w-full bg-red-950/30 rounded-2xl p-4 text-left flex items-center gap-4 active:bg-red-950/50 border border-red-900/30 disabled:opacity-50"
        >
          <span className="text-2xl">🗑️</span>
          <div>
            <div className="font-medium text-sm text-red-400">删除所有数据</div>
            <div className="text-xs text-gray-500 mt-0.5">清空所有消费记录，不可恢复</div>
          </div>
        </button>

        <div className="text-center text-xs text-gray-700 pt-4">
          消费记录 v0.1 · 数据仅保存在本地浏览器
        </div>
      </div>
    </div>
  );
}
