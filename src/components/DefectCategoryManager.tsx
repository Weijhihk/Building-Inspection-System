import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, ChevronDown, Plus, Trash2, Edit2, Save, X,
  FolderTree, Layers, GripVertical, AlertCircle, CheckCircle2,
  FolderOpen, FileText, Undo2
} from 'lucide-react';

// ---- Types ----
interface CategoryNode {
  code: string;
  name: string;
  children?: CategoryNode[];
}

interface CategoryData {
  version: number;
  categories: CategoryNode[];
}

interface Props {
  token: string | null;
}

// Generate next letter code (A, B, C, ...)
function nextLetterCode(existing: string[]): string {
  const letters = existing
    .map(c => {
      const parts = c.split('-');
      return parts[parts.length - 1];
    })
    .filter(l => /^[A-Z]$/.test(l));
  if (letters.length === 0) return 'A';
  const maxChar = letters.sort().pop()!;
  return String.fromCharCode(maxChar.charCodeAt(0) + 1);
}

// Generate next numeric code (1, 2, 3, ...)
function nextNumericCode(existing: string[]): string {
  const nums = existing
    .map(c => {
      const parts = c.split('-');
      return parseInt(parts[parts.length - 1]);
    })
    .filter(n => !isNaN(n));
  if (nums.length === 0) return '1';
  return String(Math.max(...nums) + 1);
}

// ---- Inline Editing Component ----
function InlineEdit({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  useEffect(() => { setText(value); }, [value]);

  if (!editing) {
    return (
      <span
        className={`cursor-pointer hover:bg-blue-50 hover:text-blue-700 px-1 rounded transition-colors ${className || ''}`}
        onDoubleClick={() => setEditing(true)}
        title="雙擊編輯名稱"
      >
        {value}
      </span>
    );
  }

  return (
    <input
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { onSave(text); setEditing(false); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { onSave(text); setEditing(false); }
        if (e.key === 'Escape') { setText(value); setEditing(false); }
      }}
      className="px-2 py-0.5 border border-blue-400 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white w-48"
    />
  );
}

// ---- Code Edit Component ----
function CodeEdit({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  useEffect(() => { setText(value); }, [value]);

  if (!editing) {
    return (
      <span
        className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors"
        onDoubleClick={() => setEditing(true)}
        title="雙擊編輯代碼"
      >
        {value}
      </span>
    );
  }

  return (
    <input
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { onSave(text); setEditing(false); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { onSave(text); setEditing(false); }
        if (e.key === 'Escape') { setText(value); setEditing(false); }
      }}
      className="px-2 py-0.5 border border-blue-400 rounded text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white w-24"
    />
  );
}

// ---- Tree Node Component ----
function TreeNode({
  node,
  depth,
  onUpdate,
  onDelete,
  onAddChild,
  path,
}: {
  node: CategoryNode;
  depth: number;
  onUpdate: (path: number[], field: 'code' | 'name', value: string) => void;
  onDelete: (path: number[]) => void;
  onAddChild: (path: number[]) => void;
  path: number[];
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isLeaf = depth >= 3; // Level 4 items (0-indexed depth 3) are the leaf defect items
  const maxDepth = 3; // 0-indexed, so 4 levels total

  // Color coding by depth
  const depthColors = [
    { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700', hoverBg: 'hover:bg-indigo-100' },
    { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-700', hoverBg: 'hover:bg-sky-100' },
    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', hoverBg: 'hover:bg-emerald-100' },
    { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', hoverBg: 'hover:bg-amber-100' },
  ];
  const levelLabels = ['第一階 (大分類)', '第二階 (中分類)', '第三階 (小分類)', '第四階 (缺失項目)'];

  const colors = depthColors[depth] || depthColors[3];

  return (
    <div className={`${depth > 0 ? 'ml-4 md:ml-6' : ''}`}>
      <div
        className={`group flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${colors.bg} ${colors.border} ${colors.hoverBg} mb-1`}
      >
        {/* Expand/Collapse Toggle */}
        {!isLeaf ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`p-1 rounded-lg transition-colors ${colors.text} hover:bg-white/50`}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="w-7 flex items-center justify-center">
            <FileText size={14} className="text-slate-400" />
          </span>
        )}

        {/* Level Badge */}
        <span className={`hidden md:inline-flex text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${colors.badge} shrink-0`}>
          {levelLabels[depth]?.split(' ')[0]}
        </span>

        {/* Code */}
        <CodeEdit value={node.code} onSave={(v) => onUpdate(path, 'code', v)} />

        {/* Name */}
        <InlineEdit
          value={node.name}
          onSave={(v) => onUpdate(path, 'name', v)}
          className={`font-bold text-sm ${colors.text} flex-1`}
        />

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {depth < maxDepth && (
            <button
              onClick={() => onAddChild(path)}
              className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"
              title={`新增子項目 (${levelLabels[depth + 1]})`}
            >
              <Plus size={14} />
            </button>
          )}
          <button
            onClick={() => {
              if (window.confirm(`確定要刪除「${node.code} ${node.name}」及其所有子項目嗎？`)) {
                onDelete(path);
              }
            }}
            className="p-1.5 text-red-400 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
            title="刪除此項目"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Children Count */}
        {hasChildren && (
          <span className="text-[10px] text-slate-400 font-bold shrink-0">
            ({node.children!.length})
          </span>
        )}
      </div>

      {/* Children */}
      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {node.children!.map((child, idx) => (
              <TreeNode
                key={`${child.code}-${idx}`}
                node={child}
                depth={depth + 1}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onAddChild={onAddChild}
                path={[...path, idx]}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Main Component ----
export default function DefectCategoryManager({ token }: Props) {
  const [data, setData] = useState<CategoryData>({ version: 1, categories: [] });
  const [originalData, setOriginalData] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandAll, setExpandAll] = useState(false);

  // Stats
  const countNodes = useCallback((nodes: CategoryNode[]): { total: number; leafs: number } => {
    let total = 0;
    let leafs = 0;
    for (const n of nodes) {
      total++;
      if (!n.children || n.children.length === 0) {
        leafs++;
      } else {
        const sub = countNodes(n.children);
        total += sub.total;
        leafs += sub.leafs;
      }
    }
    return { total, leafs };
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/defect-categories');
      const json = await res.json();
      setData(json);
      setOriginalData(JSON.stringify(json));
    } catch (err) {
      console.error('Failed to fetch categories', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const hasChanges = JSON.stringify(data) !== originalData;

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/defect-categories', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setSaveStatus('success');
        setOriginalData(JSON.stringify(data));
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        const errData = await res.json();
        alert(`儲存失敗: ${errData.error || '未知錯誤'}`);
      }
    } catch (err) {
      setSaveStatus('error');
      console.error('Save failed:', err);
      alert('儲存失敗，請檢查網路連線');
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = () => {
    if (!window.confirm('確定要放棄所有修改，恢復為上次儲存的版本嗎？')) return;
    setData(JSON.parse(originalData));
  };

  // Deep clone + update helpers
  const deepClone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

  const getNodeAtPath = (categories: CategoryNode[], path: number[]): CategoryNode | null => {
    let current: CategoryNode[] = categories;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]?.children) return null;
      current = current[path[i]].children!;
    }
    return current[path[path.length - 1]] || null;
  };

  const handleUpdate = (path: number[], field: 'code' | 'name', value: string) => {
    const newData = deepClone(data);
    let current: CategoryNode[] = newData.categories;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]].children!;
    }
    current[path[path.length - 1]][field] = value;
    setData(newData);
  };

  const handleDelete = (path: number[]) => {
    const newData = deepClone(data);
    let current: CategoryNode[] = newData.categories;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]].children!;
    }
    current.splice(path[path.length - 1], 1);
    setData(newData);
  };

  const handleAddChild = (path: number[]) => {
    const newData = deepClone(data);
    let current: CategoryNode[] = newData.categories;
    let parentNode: CategoryNode | null = null;

    for (let i = 0; i < path.length; i++) {
      parentNode = current[path[i]];
      if (i < path.length - 1) {
        current = current[path[i]].children!;
      }
    }

    if (!parentNode) return;
    if (!parentNode.children) parentNode.children = [];

    const depth = path.length; // depth of new child
    const existingCodes = parentNode.children.map(c => c.code);
    let newCode: string;

    if (depth === 1) {
      // Level 2: parent code + letter
      const letter = nextLetterCode(existingCodes);
      newCode = `${parentNode.code}-${letter}`;
    } else {
      // Level 3, 4: parent code + number
      const num = nextNumericCode(existingCodes);
      newCode = `${parentNode.code}-${num}`;
    }

    parentNode.children.push({
      code: newCode,
      name: '新項目',
      ...(depth < 3 ? { children: [] } : {}),
    });

    setData(newData);
  };

  const handleAddLevel1 = () => {
    const newData = deepClone(data);
    const existingCodes = newData.categories.map((c: CategoryNode) => c.code);
    const num = nextNumericCode(existingCodes);
    newData.categories.push({
      code: num,
      name: '新分類',
      children: [],
    });
    setData(newData);
  };

  // Search / filter display
  const filterNodes = (nodes: CategoryNode[], term: string): CategoryNode[] => {
    if (!term) return nodes;
    return nodes.reduce<CategoryNode[]>((acc, node) => {
      const matchSelf = node.code.toLowerCase().includes(term.toLowerCase()) ||
                        node.name.toLowerCase().includes(term.toLowerCase());
      const filteredChildren = node.children ? filterNodes(node.children, term) : [];
      if (matchSelf || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: matchSelf ? node.children : filteredChildren,
        });
      }
      return acc;
    }, []);
  };

  const displayCategories = filterNodes(data.categories, searchTerm);
  const stats = countNodes(data.categories);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <FolderTree size={28} className="text-blue-600" />
            缺失項目管理
          </h2>
          <p className="text-slate-500">
            管理四階層缺失分類結構 — 雙擊代碼或名稱即可編輯
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {hasChanges && (
            <button
              onClick={handleUndo}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm"
            >
              <Undo2 size={16} />
              還原修改
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-xl shadow-lg transition-all text-sm ${
              hasChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            {saving ? (
              <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div>
            ) : saveStatus === 'success' ? (
              <CheckCircle2 size={16} />
            ) : (
              <Save size={16} />
            )}
            {saving ? '儲存中...' : saveStatus === 'success' ? '已儲存' : '儲存變更'}
          </button>
        </div>
      </div>

      {/* Stats + Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Stats Cards */}
        <div className="flex gap-3 flex-1">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Layers size={16} className="text-indigo-600" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold">第一階</div>
              <div className="text-lg font-black text-slate-900">{data.categories.length}</div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
              <FolderOpen size={16} className="text-emerald-600" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold">全部節點</div>
              <div className="text-lg font-black text-slate-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
              <FileText size={16} className="text-amber-600" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold">缺失項目</div>
              <div className="text-lg font-black text-slate-900">{stats.leafs}</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋代碼或名稱..."
            className="w-full md:w-72 px-4 py-3 pl-10 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Changes Indicator */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3"
        >
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span className="text-sm font-bold text-amber-800">您有未儲存的修改，請記得點擊「儲存變更」</span>
        </motion.div>
      )}

      {/* Hierarchy Legend */}
      <div className="mb-4 px-4 py-3 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center gap-4">
        <span className="text-xs font-bold text-slate-500">階層說明：</span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded bg-indigo-200 border border-indigo-300"></span>
          <span className="font-bold text-indigo-700">第一階</span>
          <span className="text-slate-400">大分類 (如: 基礎工程)</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded bg-sky-200 border border-sky-300"></span>
          <span className="font-bold text-sky-700">第二階</span>
          <span className="text-slate-400">中分類 (如: 外部裝修工程)</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-300"></span>
          <span className="font-bold text-emerald-700">第三階</span>
          <span className="text-slate-400">小分類 (如: 外牆石材工程)</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded bg-amber-200 border border-amber-300"></span>
          <span className="font-bold text-amber-700">第四階</span>
          <span className="text-slate-400">缺失項目 (如: 外牆石材髒汙)</span>
        </span>
      </div>

      {/* Tree Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        {displayCategories.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <FolderTree size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-bold text-lg mb-2">
              {searchTerm ? '找不到符合條件的分類項目' : '目前無任何缺失分類'}
            </p>
            {!searchTerm && (
              <p className="text-sm">點擊下方「新增第一階分類」開始建立</p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {displayCategories.map((cat, idx) => (
              <TreeNode
                key={`${cat.code}-${idx}`}
                node={cat}
                depth={0}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onAddChild={handleAddChild}
                path={[idx]}
              />
            ))}
          </div>
        )}

        {/* Add Level 1 Button */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <button
            onClick={handleAddLevel1}
            className="flex items-center gap-2 px-6 py-3 bg-slate-50 border-2 border-dashed border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all w-full justify-center"
          >
            <Plus size={18} />
            新增第一階分類
          </button>
        </div>
      </div>

      {/* Tip */}
      <div className="mt-6 text-center text-xs text-slate-400">
        💡 提示：雙擊代碼或名稱可直接編輯 • 將滑鼠移至項目上可看到新增/刪除按鈕 • 修改後請點「儲存變更」
      </div>
    </motion.div>
  );
}
