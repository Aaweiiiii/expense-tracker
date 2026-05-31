import { useRef, useState, useEffect, useCallback } from 'react';
import { getAllExpenses, addExpense, db } from '../db';
import type { Expense } from '../types';
import { useDataRefresh } from '../hooks/useData';
import { useTheme } from '../hooks/useTheme';
import { hasApiKey, saveApiKey } from '../utils/ai';
import { syncExpenses, hasToken, setToken, clearToken } from '../utils/cloud';

export function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { refresh } = useDataRefresh();
  const [deleting, setDeleting] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [syncReady, setSyncReady] = useState(hasToken());
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [ghToken, setGhToken] = useState('');
  const [showGhToken, setShowGhToken] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    setKeySaved(hasApiKey());
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMsg('同步中...');
    try {
      const locals = await getAllExpenses();
      const result = await syncExpenses(
        locals,
        async (expense) => {
          await addExpense({ ...expense, isBigPurchase: expense.isBigPurchase || false });
        },
      );
      const parts: string[] = [];
      parts.push(`本地 ${locals.length} 条`);
      if (result.uploaded > 0) parts.push(`上传 ${result.uploaded} 条`);
      if (result.downloaded > 0) parts.push(`下载 ${result.downloaded} 条`);
      if (result.uploaded === 0 && result.downloaded === 0) parts.push('已同步');
      setSyncMsg(parts.join(' · '));
      refresh();
    } catch (e: any) {
      const msg = e?.message || e?.toString() || '未知错误';
      setSyncMsg(`同步失败：${msg}`);
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

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

  function handleSaveGhToken() {
    const trimmed = ghToken.trim();
    if (!trimmed) { alert('请输入 Token'); return; }
    setToken(trimmed);
    setGhToken('');
    setSyncReady(true);
  }

  function handleClearGhToken() {
    if (!confirm('确定要清除同步配置吗？')) return;
    clearToken();
    setSyncReady(false);
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
        {/* Theme Toggle */}
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <span className="text-2xl">{theme === 'light' ? '☀️' : '🌙'}</span>
            <div className="flex-1">
              <div className="font-medium text-sm">
                {theme === 'light' ? '浅色模式' : '深色模式'}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                点击切换界面主题
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                theme === 'dark' ? 'bg-cyan-600' : 'bg-[var(--color-border)]'
              }`}
            >
              <div
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Nickname */}
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-2xl">👤</span>
            <div>
              <div className="font-medium text-sm">昵称</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                用于首页个性化问候
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              defaultValue={localStorage.getItem('nickname') || ''}
              placeholder="给自己取个名字吧"
              id="nickname-input"
              className="flex-1 bg-[var(--color-surface-alt)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-cyan-600 placeholder-[var(--color-text-faint)]"
            />
            <button
              onClick={() => {
                const input = document.getElementById('nickname-input') as HTMLInputElement;
                const val = input.value.trim();
                if (val) {
                  localStorage.setItem('nickname', val);
                  alert('昵称已保存');
                }
              }}
              className="bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium active:bg-cyan-700 shrink-0"
            >
              保存
            </button>
          </div>
        </div>

        {/* Export */}
        <button
          onClick={handleExport}
          className="w-full glass-card rounded-2xl p-4 text-left flex items-center gap-4 active:scale-[0.99]"
        >
          <span className="text-2xl">📤</span>
          <div>
            <div className="font-medium text-sm">导出数据</div>
            <div className="text-xs text-[var(--color-text-muted)]">将所有消费记录导出为 JSON 文件</div>
          </div>
        </button>

        {/* Import */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full glass-card rounded-2xl p-4 text-left flex items-center gap-4 active:scale-[0.99]"
        >
          <span className="text-2xl">📥</span>
          <div>
            <div className="font-medium text-sm">导入数据</div>
            <div className="text-xs text-[var(--color-text-muted)]">从 JSON 文件恢复消费记录</div>
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
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-2xl">🤖</span>
            <div>
              <div className="font-medium text-sm">DeepSeek API Key</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
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
                className="flex-1 bg-[var(--color-surface-alt)] rounded-lg px-3 py-2 text-sm outline-none placeholder-[var(--color-text-faint)] focus:ring-1 focus:ring-cyan-600"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] px-2"
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

        {/* Cloud Sync via GitHub Gist */}
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-2xl">☁️</span>
            <div>
              <div className="font-medium text-sm">云端同步</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {syncReady
                  ? '已配置 · 数据通过 GitHub Gist 同步'
                  : '手机电脑间同步数据，需要 GitHub Token'}
              </div>
            </div>
          </div>
          {syncReady ? (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 active:bg-cyan-600/40 disabled:opacity-50 transition-colors"
              >
                {syncing ? '⏳ 同步中...' : '🔄 立即同步'}
              </button>
              {syncMsg && (
                <div className="text-xs text-[var(--color-text-muted)] mt-2 text-center">{syncMsg}</div>
              )}
              <button
                onClick={handleClearGhToken}
                className="text-xs text-red-400 hover:text-red-300 mt-3 transition-colors"
              >
                清除配置
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type={showGhToken ? 'text' : 'password'}
                  value={ghToken}
                  onChange={(e) => setGhToken(e.target.value)}
                  placeholder="粘贴 GitHub Token..."
                  className="flex-1 bg-[var(--color-surface-alt)] rounded-lg px-3 py-2 text-sm outline-none placeholder-[var(--color-text-faint)] focus:ring-1 focus:ring-cyan-600"
                />
                <button
                  type="button"
                  onClick={() => setShowGhToken(!showGhToken)}
                  className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] px-2"
                >
                  {showGhToken ? '隐藏' : '显示'}
                </button>
                <button
                  onClick={handleSaveGhToken}
                  className="bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium active:bg-cyan-700 shrink-0"
                >
                  保存
                </button>
              </div>
              <p className="text-[10px] text-[var(--color-text-faint)] leading-relaxed">
                去 github.com/settings/tokens → Generate new token (classic) → 勾选 gist → 生成后粘贴到此处
              </p>
            </div>
          )}
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
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">清空所有消费记录，不可恢复</div>
          </div>
        </button>

        <div className="text-center text-xs text-[var(--color-text-faint)] pt-4">
          消费记录 v0.2 · 支持云端同步
        </div>
      </div>
    </div>
  );
}
