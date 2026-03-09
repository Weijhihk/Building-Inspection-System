import React, { useState, useEffect } from 'react';
import { Building2, Layers, Unlock, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Project {
  id: string;
  name: string;
}

export default function AdminApp() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('A棟');
  
  // Format: "2F-1戶" -> { defectCount, isInspected, unitId }
  const [defectCounts, setDefectCounts] = useState<Record<string, { defectCount: number, isInspected: boolean, unitId: string }>>({});

  const BUILDINGS = ['A棟', 'B棟'];
  const FLOORS = Array.from({ length: 9 }, (_, i) => `${i + 2}F`);
  const UNITS = Array.from({ length: 6 }, (_, i) => `${i + 1}戶`);

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => setProjects(data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedProject && selectedBuilding) {
      fetchData();
    }
  }, [selectedProject, selectedBuilding]);

  const fetchData = async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/${selectedBuilding}/units-status`);
      const counts = await res.json();
      setDefectCounts(counts);
    } catch (err) {
      console.error('Failed to fetch defect counts', err);
    }
  };

  const handleToggleLock = async (unitKey: string, currentStatus: boolean, unitId: string) => {
    if (!unitId) {
      alert("此戶別尚未建立紀錄，無法操作！");
      return;
    }
    
    const newStatus = currentStatus ? 0 : 1;
    const actionName = currentStatus ? "解鎖" : "強制鎖定";
    
    if (!window.confirm(`確定要 ${actionName} 此戶別嗎？`)) return;

    try {
      const res = await fetch('/api/admin/toggle-inspection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId, status: newStatus })
      });
      if (res.ok) {
        // Refresh cell data locally
        setDefectCounts(prev => ({
          ...prev,
          [unitKey]: { ...prev[unitKey], isInspected: !currentStatus }
        }));
      }
    } catch (err) {
      console.error(err);
      alert('操作失敗！');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col no-print">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">系統管理員</h1>
            <span className="text-xs text-slate-400">驗收進度管控中控台</span>
          </div>
        </div>
        
        <div className="p-4 flex-1">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">切換專案</h2>
          <div className="space-y-2">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p)}
                className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${
                  selectedProject?.id === p.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <Layers size={18} />
                <span className="font-bold text-sm">[{p.id}] {p.name}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-800">
           <a href="/Building-Inspection-System/" className="w-full text-center block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-bold rounded-lg transition-colors">
             回驗收前台
           </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {!selectedProject ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Building2 size={64} className="mb-4 opacity-20" />
            <h2 className="text-xl font-bold">請由左側選擇專案進入管理</h2>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
            
            {/* Header & Building Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">{selectedProject.name}</h2>
                <p className="text-slate-500">網格狀態實時監控與鎖定管理</p>
              </div>
              
              <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                {BUILDINGS.map(b => (
                  <button
                    key={b}
                    onClick={() => setSelectedBuilding(b)}
                    className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                      selectedBuilding === b ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-4 px-4 font-bold text-slate-500 border-r border-slate-200 w-24">樓層 \\ 戶別</th>
                      {UNITS.map(u => (
                        <th key={u} className="py-4 px-2 font-bold text-slate-900">{u}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...FLOORS].reverse().map((f) => (
                      <tr key={f} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-900 border-r border-slate-200 bg-slate-50">{f}</td>
                        {UNITS.map(u => {
                          const key = `${f}-${u}`;
                          const status = defectCounts[key];
                          
                          return (
                            <td key={key} className="p-2 border-r border-slate-100 last:border-0 relative group">
                              {!status?.unitId ? (
                                <div className="text-xs text-slate-300 font-bold py-2">未建立</div>
                              ) : (
                                <div className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                                  status.isInspected 
                                    ? 'bg-green-50/50 border-green-200' 
                                    : status.defectCount > 0 
                                      ? 'bg-red-50/50 border-red-200' 
                                      : 'bg-white border-slate-200'
                                }`}>
                                  
                                  <div className="flex items-center gap-1 mb-2">
                                    {status.isInspected ? (
                                      <CheckCircle2 size={16} className="text-green-600" />
                                    ) : (
                                      <AlertCircle size={16} className={status.defectCount > 0 ? "text-red-500" : "text-slate-300"} />
                                    )}
                                    <span className={`text-sm font-bold ${
                                      status.isInspected ? 'text-green-700' : status.defectCount > 0 ? 'text-red-600' : 'text-slate-600'
                                    }`}>
                                      {status.isInspected ? '已鎖定' : status.defectCount > 0 ? `${status.defectCount} 缺失` : '未鎖定'}
                                    </span>
                                  </div>
                                  
                                  <button
                                    onClick={() => handleToggleLock(key, status.isInspected, status.unitId)}
                                    className={`flex items-center justify-center gap-1 w-full py-1.5 rounded-lg text-xs font-bold transition-all ${
                                      status.isInspected 
                                        ? 'bg-white border border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200' 
                                        : 'bg-slate-900 text-white hover:bg-slate-800'
                                    }`}
                                  >
                                    {status.isInspected ? (
                                      <><Unlock size={14} /> 強制解鎖</>
                                    ) : (
                                      <><Lock size={14} /> 強制鎖定</>
                                    )}
                                  </button>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </motion.div>
        )}
      </main>
    </div>
  );
}
