import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BarChart3, Filter, Download, RefreshCw, ChevronDown, TrendingUp, AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Project {
  id: string;
  name: string;
  has_buildings: boolean;
  buildings: {
    name: string;
    layout: { floor: string; items: string[] }[];
  }[];
}

interface DefectRecord {
  building: string;
  floor: string;
  unit_number: string;
  pin_id: string;
  defect_id: string;
  category: string; // stored as "地 (地板) - 磁磚工程"
  name: string;     // stored as L4 name, e.g. "磁磚空鼓"
  area: string;
  description: string;
  status: string;
}

interface CategoryNode {
  code: string;
  name: string;
  children?: CategoryNode[];
}

interface ParetoItem {
  label: string;
  count: number;
  percentage: number;
  cumulative: number;
}

interface Props {
  token: string | null;
}

/**
 * Build a reverse lookup: L3 name → { l1Name, l2Name, l3Name }
 * And L4 name → { l1Name, l2Name, l3Name, l4Name }
 * This allows us to map defect records back to the category hierarchy.
 *
 * Defect category is stored as: "位置 (位置Label) - L3名稱"
 * Defect name is stored as L4 name.
 */
interface HierarchyInfo {
  l1Name: string;
  l2Name: string;
  l3Name: string;
}

function buildL3LookupMap(categories: CategoryNode[]): Map<string, HierarchyInfo> {
  const map = new Map<string, HierarchyInfo>();
  for (const l1 of categories) {
    if (!l1.children) continue;
    for (const l2 of l1.children) {
      if (!l2.children) continue;
      for (const l3 of l2.children) {
        map.set(l3.name, {
          l1Name: l1.name,
          l2Name: l2.name,
          l3Name: l3.name,
        });
      }
    }
  }
  return map;
}

/**
 * Parse a defect record's category string (e.g. "地 (地板) - 磁磚工程")
 * to extract position and L3 name.
 */
function parseCategoryString(category: string): { position: string; l3Name: string } {
  const dashIdx = category.indexOf(' - ');
  if (dashIdx >= 0) {
    return {
      position: category.substring(0, dashIdx).trim(),
      l3Name: category.substring(dashIdx + 3).trim(),
    };
  }
  return { position: '', l3Name: category };
}

export default function DefectAnalysis({ token }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [allDefects, setAllDefects] = useState<Record<string, DefectRecord[]>>({});
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState<string>('__all__');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('__all__');
  const [selectedLevel, setSelectedLevel] = useState<'position' | 'level1' | 'level2' | 'level3' | 'level4'>('level3');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('__all__');

  // Pareto data
  const [paretoData, setParetoData] = useState<ParetoItem[]>([]);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Totals
  const [totalDefects, setTotalDefects] = useState(0);
  const [topCategory, setTopCategory] = useState('');
  const [above80Count, setAbove80Count] = useState(0);

  // Build the L3 lookup map from categories
  const l3LookupMap = useMemo(() => buildL3LookupMap(categories), [categories]);

  // Fetch projects
  useEffect(() => {
    if (!token) return;
    fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setProjects(data))
      .catch(console.error);
  }, [token]);

  // Fetch categories
  useEffect(() => {
    fetch('/api/defect-categories')
      .then(r => r.json())
      .then(data => {
        setCategories(data.categories || []);
      })
      .catch(console.error);
  }, []);

  // Fetch defects for all projects
  const fetchAllDefects = useCallback(async () => {
    if (!token || projects.length === 0) return;
    setLoading(true);
    try {
      const results: Record<string, DefectRecord[]> = {};
      for (const p of projects) {
        const res = await fetch(`/api/admin/projects/${p.id}/defects`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        results[p.id] = data;
      }
      setAllDefects(results);
    } catch (err) {
      console.error('Failed to fetch defects:', err);
    } finally {
      setLoading(false);
    }
  }, [token, projects]);

  useEffect(() => {
    fetchAllDefects();
  }, [fetchAllDefects]);

  // Compute Pareto data when filters change
  useEffect(() => {
    // 1. Filter defects
    let filteredDefects: DefectRecord[] = [];
    if (selectedProjectId === '__all__') {
      Object.values(allDefects).forEach(d => filteredDefects.push(...d));
    } else {
      filteredDefects = [...(allDefects[selectedProjectId] || [])];
    }

    if (selectedBuilding !== '__all__') {
      filteredDefects = filteredDefects.filter(d => d.building === selectedBuilding);
    }

    // Apply category filter (based on L1 or L2 name)
    if (selectedCategoryFilter !== '__all__') {
      filteredDefects = filteredDefects.filter(d => {
        const { l3Name } = parseCategoryString(d.category);
        const hierarchy = l3LookupMap.get(l3Name);
        if (!hierarchy) return false;
        // Filter matches if L1 name or L2 name matches
        return hierarchy.l1Name === selectedCategoryFilter || hierarchy.l2Name === selectedCategoryFilter;
      });
    }

    // 2. Group by selected hierarchy level
    const counts: Record<string, number> = {};
    filteredDefects.forEach(d => {
      const { position, l3Name } = parseCategoryString(d.category);
      const hierarchy = l3LookupMap.get(l3Name);

      let key = '';
      if (selectedLevel === 'position') {
        // Group by position: 天(天花)/地(地板)/牆(牆面)/其他
        key = position || '未分類';
      } else if (selectedLevel === 'level1') {
        // Group by L1: 結構工程/裝修工程/機電工程/...
        key = hierarchy ? hierarchy.l1Name : '未分類';
      } else if (selectedLevel === 'level2') {
        // Group by L2: 內部裝修工程/電氣工程/...
        key = hierarchy ? hierarchy.l2Name : '未分類';
      } else if (selectedLevel === 'level3') {
        // Group by L3: 磁磚工程/油漆工程/... (with position prefix for clarity)
        key = hierarchy ? `${position} - ${hierarchy.l3Name}` : d.category;
      } else {
        // level4: Group by exact defect name
        key = hierarchy ? `${d.name}` : d.name || '未分類';
      }

      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });

    // 3. Sort descending
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1]);

    const total = sorted.reduce((s, [, c]) => s + c, 0);
    let cum = 0;
    const pareto: ParetoItem[] = sorted.map(([label, count]) => {
      cum += count;
      return {
        label,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        cumulative: total > 0 ? (cum / total) * 100 : 0,
      };
    });

    setParetoData(pareto);
    setTotalDefects(total);
    setTopCategory(pareto[0]?.label || '-');
    setAbove80Count(pareto.filter(p => p.cumulative <= 80).length || pareto.length);
  }, [allDefects, selectedProjectId, selectedBuilding, selectedLevel, selectedCategoryFilter, l3LookupMap]);

  // Get available buildings for selected project
  const getAvailableBuildings = (): string[] => {
    if (selectedProjectId === '__all__') {
      const allBuildings = new Set<string>();
      Object.values(allDefects).forEach(defects => {
        defects.forEach(d => { if (d.building) allBuildings.add(d.building); });
      });
      return Array.from(allBuildings).sort();
    }
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return [];
    return project.buildings?.map(b => b.name) || [];
  };

  // Get category filter options (L1 and L2 names)
  const getCategoryFilterOptions = (): { value: string; label: string }[] => {
    const options: { value: string; label: string }[] = [];
    categories.forEach(cat => {
      options.push({ value: cat.name, label: cat.name });
      if (cat.children) {
        cat.children.forEach(sub => {
          options.push({ value: sub.name, label: `  └ ${sub.name}` });
        });
      }
    });
    return options;
  };

  // Draw Pareto chart on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || paretoData.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = container.clientWidth;
    const displayHeight = 420;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Chart dimensions
    const marginLeft = 60;
    const marginRight = 60;
    const marginTop = 30;
    const marginBottom = 100;
    const chartWidth = displayWidth - marginLeft - marginRight;
    const chartHeight = displayHeight - marginTop - marginBottom;

    // Clear
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const maxCount = Math.max(...paretoData.map(d => d.count), 1);
    const barWidth = Math.min(Math.max(chartWidth / paretoData.length - 4, 8), 50);
    const barGap = (chartWidth - barWidth * paretoData.length) / (paretoData.length + 1);

    // Gradient colors for bars
    const colors = [
      '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
      '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6',
      '#a855f7', '#6366f1', '#84cc16', '#f59e0b', '#10b981',
    ];

    // Grid lines
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = marginTop + (chartHeight * i) / 5;
      ctx.beginPath();
      ctx.moveTo(marginLeft, y);
      ctx.lineTo(marginLeft + chartWidth, y);
      ctx.stroke();
    }

    // Y-axis labels (left - count)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const val = Math.round(maxCount * (5 - i) / 5);
      const y = marginTop + (chartHeight * i) / 5;
      ctx.fillText(String(val), marginLeft - 8, y + 4);
    }

    // Y-axis labels (right - percentage)
    ctx.textAlign = 'left';
    for (let i = 0; i <= 5; i++) {
      const val = (5 - i) * 20;
      const y = marginTop + (chartHeight * i) / 5;
      ctx.fillText(`${val}%`, marginLeft + chartWidth + 8, y + 4);
    }

    // Draw bars
    paretoData.forEach((item, idx) => {
      const x = marginLeft + barGap + idx * (barWidth + barGap);
      const barHeight = (item.count / maxCount) * chartHeight;
      const y = marginTop + chartHeight - barHeight;

      const isHovered = hoveredBar === idx;

      // Bar shadow
      if (isHovered) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
      }

      // Gradient fill
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      const color = colors[idx % colors.length];
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color + 'BB');
      ctx.fillStyle = gradient;

      // Rounded rect
      const radius = Math.min(barWidth / 3, 6);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, y + barHeight);
      ctx.lineTo(x, y + barHeight);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // 80% highlight region
      if (item.cumulative <= 80) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
        ctx.fillRect(x - barGap / 2, marginTop, barWidth + barGap, chartHeight);
      }

      // Count labels atop bars
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(item.count), x + barWidth / 2, y - 6);

      // X labels
      ctx.save();
      ctx.translate(x + barWidth / 2, marginTop + chartHeight + 10);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      const maxLabelLen = 12;
      const truncLabel = item.label.length > maxLabelLen ? item.label.slice(0, maxLabelLen) + '…' : item.label;
      ctx.fillText(truncLabel, 0, 0);
      ctx.restore();
    });

    // Cumulative line
    if (paretoData.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      paretoData.forEach((item, idx) => {
        const x = marginLeft + barGap + idx * (barWidth + barGap) + barWidth / 2;
        const y = marginTop + chartHeight - (item.cumulative / 100) * chartHeight;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Dots on cumulative line
      paretoData.forEach((item, idx) => {
        const x = marginLeft + barGap + idx * (barWidth + barGap) + barWidth / 2;
        const y = marginTop + chartHeight - (item.cumulative / 100) * chartHeight;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cumulative % label
        if (idx % Math.max(1, Math.floor(paretoData.length / 10)) === 0 || idx === paretoData.length - 1 || item.cumulative <= 80 && (idx === 0 || paretoData[idx - 1].cumulative > 80 || paretoData[idx + 1]?.cumulative > 80)) {
          ctx.fillStyle = '#ea580c';
          ctx.font = 'bold 10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${item.cumulative.toFixed(0)}%`, x, y - 10);
        }
      });
    }

    // 80% line
    const y80 = marginTop + chartHeight - 0.8 * chartHeight;
    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#ef444480';
    ctx.lineWidth = 1.5;
    ctx.moveTo(marginLeft, y80);
    ctx.lineTo(marginLeft + chartWidth, y80);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('80%', marginLeft + chartWidth + 8, y80 + 4);

  }, [paretoData, hoveredBar]);

  // Handle canvas hover for tooltip
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || paretoData.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const displayWidth = container.clientWidth;
    const marginLeft = 60;
    const marginRight = 60;
    const chartWidth = displayWidth - marginLeft - marginRight;
    const barWidth = Math.min(Math.max(chartWidth / paretoData.length - 4, 8), 50);
    const barGap = (chartWidth - barWidth * paretoData.length) / (paretoData.length + 1);

    let found = -1;
    paretoData.forEach((_, idx) => {
      const bx = marginLeft + barGap + idx * (barWidth + barGap);
      if (x >= bx && x <= bx + barWidth) found = idx;
    });
    setHoveredBar(found >= 0 ? found : null);
  };

  // Export CSV — detailed per-defect records
  const handleExportCSV = () => {
    // Gather filtered defects (same logic as Pareto computation)
    let filteredDefects: (DefectRecord & { projectName: string })[] = [];
    const projectIds = selectedProjectId === '__all__' ? Object.keys(allDefects) : [selectedProjectId];

    for (const pid of projectIds) {
      const proj = projects.find(p => p.id === pid);
      const projName = proj ? `[${pid}] ${proj.name}` : pid;
      const defects = allDefects[pid] || [];
      defects.forEach(d => {
        filteredDefects.push({ ...d, projectName: projName });
      });
    }

    if (selectedBuilding !== '__all__') {
      filteredDefects = filteredDefects.filter(d => d.building === selectedBuilding);
    }

    if (selectedCategoryFilter !== '__all__') {
      filteredDefects = filteredDefects.filter(d => {
        const { l3Name } = parseCategoryString(d.category);
        const hierarchy = l3LookupMap.get(l3Name);
        if (!hierarchy) return false;
        return hierarchy.l1Name === selectedCategoryFilter || hierarchy.l2Name === selectedCategoryFilter;
      });
    }

    if (filteredDefects.length === 0) return;

    const bom = '\uFEFF';
    const header = '專案,棟別,樓層,戶別,區域,缺失項目第一階,缺失項目第二階,缺失項目第三階,缺失項目第四階';
    const rows = filteredDefects.map(d => {
      const { position, l3Name } = parseCategoryString(d.category);
      const hierarchy = l3LookupMap.get(l3Name);

      const l1 = hierarchy ? hierarchy.l1Name : '';
      const l2 = hierarchy ? hierarchy.l2Name : '';
      const l3 = hierarchy ? hierarchy.l3Name : l3Name;
      const l4 = d.name || '';

      // Escape CSV fields (wrap in quotes if contains comma)
      const esc = (s: string) => s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;

      return [
        esc(d.projectName),
        esc(d.building || ''),
        esc(d.floor || ''),
        esc(d.unit_number || ''),
        esc(d.area || ''),
        esc(l1),
        esc(l2),
        esc(l3),
        esc(l4),
      ].join(',');
    });

    const csv = bom + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `缺失統計明細_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">缺失統計分析</h2>
          <p className="text-slate-500">依據品管柏拉圖手法，歸納影響較大的缺失項目</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAllDefects}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 font-bold rounded-xl hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>重新載入</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={totalDefects === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg transition-all disabled:opacity-50"
          >
            <Download size={16} />
            <span>匯出明細 CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <BarChart3 size={22} className="text-blue-600" />
          </div>
          <div>
            <div className="text-xs font-bold text-blue-500 uppercase tracking-wider">缺失總數</div>
            <div className="text-2xl font-black text-blue-900">{totalDefects}</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
            <AlertTriangle size={22} className="text-red-600" />
          </div>
          <div>
            <div className="text-xs font-bold text-red-500 uppercase tracking-wider">最大宗缺失</div>
            <div className="text-lg font-black text-red-900 truncate max-w-[180px]" title={topCategory}>{topCategory}</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <TrendingUp size={22} className="text-amber-600" />
          </div>
          <div>
            <div className="text-xs font-bold text-amber-500 uppercase tracking-wider">80% 累計項數</div>
            <div className="text-2xl font-black text-amber-900">{above80Count} <span className="text-sm font-bold text-amber-500">/ {paretoData.length} 項</span></div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4 text-slate-600">
          <Filter size={16} />
          <span className="font-bold text-sm">篩選條件</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Project filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">專案</label>
            <div className="relative">
              <select
                id="filter-project"
                value={selectedProjectId}
                onChange={e => {
                  setSelectedProjectId(e.target.value);
                  setSelectedBuilding('__all__');
                }}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium appearance-none pr-10 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="__all__">全部專案</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>[{p.id}] {p.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Building filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">棟別</label>
            <div className="relative">
              <select
                id="filter-building"
                value={selectedBuilding}
                onChange={e => setSelectedBuilding(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium appearance-none pr-10 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="__all__">全部棟別</option>
                {getAvailableBuildings().map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Category hierarchy filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">工項類別篩選</label>
            <div className="relative">
              <select
                id="filter-category"
                value={selectedCategoryFilter}
                onChange={e => setSelectedCategoryFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium appearance-none pr-10 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="__all__">全部工項</option>
                {getCategoryFilterOptions().map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Analysis granularity */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">分析階層</label>
            <div className="relative">
              <select
                id="filter-level"
                value={selectedLevel}
                onChange={e => setSelectedLevel(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium appearance-none pr-10 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="position">依位置 (天/地/牆)</option>
                <option value="level1">第一層 (大分類)</option>
                <option value="level2">第二層 (工項)</option>
                <option value="level3">第三層 (細項)</option>
                <option value="level4">第四層 (缺失項目)</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Pareto Chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">柏拉圖 (Pareto Chart)</h3>
              <p className="text-xs text-slate-400">長條圖 = 各項數量, 折線 = 累計百分比, 紅色虛線 = 80% 基準線</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gradient-to-b from-blue-500 to-blue-400 inline-block" />
              <span className="text-slate-500 font-medium">數量</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-0.5 bg-orange-500 inline-block rounded" />
              <span className="text-slate-500 font-medium">累計%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-0 border-t-2 border-dashed border-red-400 inline-block" />
              <span className="text-slate-500 font-medium">80%線</span>
            </span>
          </div>
        </div>

        <div ref={containerRef} className="p-6 relative">
          {loading ? (
            <div className="flex items-center justify-center py-32 text-slate-400">
              <RefreshCw size={24} className="animate-spin mr-3" />
              <span className="font-bold">載入資料中...</span>
            </div>
          ) : paretoData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
              <BarChart3 size={48} className="mb-4 opacity-20" />
              <p className="font-bold">目前無缺失資料，請調整篩選條件</p>
            </div>
          ) : (
            <>
              <canvas
                ref={canvasRef}
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={() => setHoveredBar(null)}
                className="w-full cursor-crosshair"
              />
              {/* Tooltip */}
              <AnimatePresence>
                {hoveredBar !== null && paretoData[hoveredBar] && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-4 right-8 bg-slate-900 text-white p-4 rounded-xl shadow-xl text-sm min-w-[200px] pointer-events-none z-10"
                  >
                    <div className="font-bold text-base mb-2">{paretoData[hoveredBar].label}</div>
                    <div className="space-y-1 text-slate-300">
                      <div className="flex justify-between">
                        <span>數量</span>
                        <span className="font-bold text-white">{paretoData[hoveredBar].count} 件</span>
                      </div>
                      <div className="flex justify-between">
                        <span>佔比</span>
                        <span className="font-bold text-white">{paretoData[hoveredBar].percentage.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>累計</span>
                        <span className="font-bold text-orange-400">{paretoData[hoveredBar].cumulative.toFixed(1)}%</span>
                      </div>
                    </div>
                    {paretoData[hoveredBar].cumulative <= 80 && (
                      <div className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-red-400 font-bold uppercase tracking-wider">
                        ⚠ 屬於 80% 關鍵少數
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>

      {/* Data Table */}
      {paretoData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg flex items-center justify-center">
              <Layers size={16} className="text-white" />
            </div>
            <h3 className="font-bold text-slate-900">缺失排名明細表</h3>
            <span className="ml-auto text-xs text-slate-400 font-medium">共 {paretoData.length} 項</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-3 px-4 font-bold text-slate-500 text-xs uppercase tracking-wider w-16 text-center">排名</th>
                  <th className="py-3 px-4 font-bold text-slate-500 text-xs uppercase tracking-wider">缺失項目</th>
                  <th className="py-3 px-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-right w-20">數量</th>
                  <th className="py-3 px-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-right w-20">佔比</th>
                  <th className="py-3 px-4 font-bold text-slate-500 text-xs uppercase tracking-wider w-[200px]">累計佔比</th>
                  <th className="py-3 px-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-center w-24">影響等級</th>
                </tr>
              </thead>
              <tbody>
                {paretoData.map((item, idx) => (
                  <tr
                    key={idx}
                    onMouseEnter={() => setHoveredBar(idx)}
                    onMouseLeave={() => setHoveredBar(null)}
                    className={`border-b border-slate-100 transition-colors ${
                      hoveredBar === idx ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                    } ${item.cumulative <= 80 ? 'bg-red-50/30' : ''}`}
                  >
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${
                        idx === 0 ? 'bg-red-100 text-red-700' :
                        idx === 1 ? 'bg-orange-100 text-orange-700' :
                        idx === 2 ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{item.label}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">{item.count}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-600">{item.percentage.toFixed(1)}%</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${item.cumulative}%`,
                              background: item.cumulative <= 80
                                ? 'linear-gradient(90deg, #ef4444, #f97316)'
                                : 'linear-gradient(90deg, #94a3b8, #cbd5e1)',
                            }}
                          />
                        </div>
                        <span className={`text-xs font-bold min-w-[42px] text-right ${
                          item.cumulative <= 80 ? 'text-red-600' : 'text-slate-400'
                        }`}>
                          {item.cumulative.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.cumulative <= 80 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 border border-red-100 rounded-full text-[10px] font-black uppercase tracking-wider">
                          <AlertTriangle size={10} />
                          關鍵
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-400 border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-wider">
                          <CheckCircle2 size={10} />
                          一般
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
            <span className="font-bold">分析說明：</span>
            依據柏拉圖法則（80/20 法則），標記為「關鍵」的缺失項目累計佔總數的 80%，為優先改善對象。建議針對這些項目制定改善計畫以達到最大效益。
          </div>
        </div>
      )}
    </motion.div>
  );
}
