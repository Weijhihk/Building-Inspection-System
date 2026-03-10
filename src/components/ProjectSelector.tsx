import React, { useState, useEffect } from 'react';
import { Building2, ChevronRight, Layers, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Project } from '../types';

interface ProjectSelectorProps {
  onSelectUnit: (projectId: string, building: string, floor: string, unitNum: string) => void;
  token?: string | null;
}

export default function ProjectSelector({ onSelectUnit, token }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [step, setStep] = useState<number>(0); // 0: Project, 1: Building, 2: Grid Selection
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedFloor, setSelectedFloor] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [defectCounts, setDefectCounts] = useState<Record<string, { defectCount: number, isInspected: boolean, unitId: string }>>({});

  useEffect(() => {
    fetch('/api/projects', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setProjects(data))
      .catch(err => console.error('Failed to load projects', err));
  }, [token]);

  const resetToStep = (s: number) => {
    setStep(s);
    if (s <= 0) { setSelectedProject(null); setSelectedBuilding(''); setSelectedFloor(''); setSelectedUnit(''); setDefectCounts({}); }
    if (s <= 1) { setSelectedBuilding(''); setSelectedFloor(''); setSelectedUnit(''); setDefectCounts({}); }
    if (s <= 2) { setSelectedFloor(''); setSelectedUnit(''); }
  };

  const getActiveBuildings = () => selectedProject?.buildings || [];

  const handleProjectSelect = async (p: Project) => {
    setSelectedProject(p);
    if (p.has_buildings && p.buildings && p.buildings.length > 0) {
      setStep(1);
    } else {
      setSelectedBuilding('無分棟'); 
      setStep(2);
      // Fetch status for the single '無分棟' building
      try {
        const res = await fetch(`/api/projects/${p.id}/%E7%84%A1%E5%88%86%E6%A3%9F/units-status`, { // %E7%84%A1%E5%88%86%E6%A3%9F = 無分棟
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const counts = await res.json();
        setDefectCounts(counts);
      } catch (err) {
        console.error('Failed to fetch defect counts', err);
      }
    }
  };

  const handleGridSelect = (f: string, u: string) => {
    setSelectedFloor(f);
    setSelectedUnit(u);
    if (selectedProject && selectedBuilding) {
      onSelectUnit(selectedProject.id, selectedBuilding, f, u);
    }
  };

  const renderBreadcrumbs = () => {
    const crumbs = [];
    if (selectedProject) crumbs.push({ label: selectedProject.name, step: 0 });
    if (selectedBuilding) crumbs.push({ label: selectedBuilding, step: 1 });
    if (selectedFloor) crumbs.push({ label: selectedFloor, step: 2 });
    
    return (
      <div className="flex items-center gap-2 mb-8 text-sm font-bold bg-white px-4 py-2 rounded-xl shadow-sm border border-zinc-100 max-w-fit mx-auto">
        <button onClick={() => resetToStep(0)} className="text-zinc-500 hover:text-zinc-900 transition-colors">所有專案</button>
        {crumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            <ChevronRight size={14} className="text-zinc-300" />
            <button 
              onClick={() => resetToStep(crumb.step + 1)} 
              className="text-zinc-900 hover:text-blue-600 transition-colors"
            >
              {crumb.label}
            </button>
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-zinc-200">
            <Building2 className="text-white" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">建築驗收系統</h1>
          <p className="text-zinc-500">請依序選擇要驗收的場域</p>
        </div>

        {step > 0 && renderBreadcrumbs()}

        <motion.div 
          className="bg-white rounded-3xl shadow-xl border border-zinc-100 p-8 min-h-[400px] flex flex-col"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {/* Step 0: Projects */}
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleProjectSelect(p)}
                      className="p-8 text-left border-2 border-zinc-100 rounded-2xl hover:border-zinc-900 hover:shadow-lg transition-all group"
                    >
                      <Layers className="text-zinc-400 group-hover:text-zinc-900 mb-4 transition-colors" size={32} />
                      <h3 className="text-xl font-bold text-zinc-900 mb-2">[{p.id}] {p.name}</h3>
                      <p className="text-sm text-zinc-500">點擊選擇專案</p>
                    </button>
                  ))}
                  {projects.length === 0 && (
                    <div className="col-span-2 text-center text-zinc-400 p-12">
                      載入專案資料中...確認後端伺服器是否正在運行。
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 1: Building */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="grid grid-cols-2 gap-4 max-w-2xl mx-auto"
                >
                  <div className="col-span-2 mb-4 text-center">
                    <h2 className="text-lg font-bold">選擇棟別</h2>
                  </div>
                  {getActiveBuildings().map((b: any) => (
                    <button
                      key={b.name}
                      onClick={async () => { 
                        const name = b.name;
                        setSelectedBuilding(name); 
                        setStep(2); 
                        // Fetch status exactly when advancing to step 2
                        if (selectedProject) {
                          try {
                            const res = await fetch(`/api/projects/${selectedProject.id}/${name}/units-status`, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const counts = await res.json();
                            setDefectCounts(counts);
                          } catch (err) {
                            console.error('Failed to fetch defect counts', err);
                          }
                        }
                      }}
                      className="p-6 text-center border-2 border-zinc-100 rounded-2xl hover:border-zinc-900 hover:bg-zinc-50 hover:shadow-lg transition-all"
                    >
                      <span className="text-2xl font-bold">{b.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}

              {/* Step 2: Grid Selection (Floors x Units) */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="w-full max-w-4xl mx-auto overflow-x-auto"
                >
                  <div className="mb-6 text-center">
                    <h2 className="text-lg font-bold text-zinc-900 mb-1">
                      [{selectedProject?.id}] {selectedProject?.name} - {selectedBuilding}
                    </h2>
                    <p className="text-zinc-500">請點擊選擇欲驗收的戶別/區域</p>
                  </div>
                  
                  <div className="space-y-4">
                    {(selectedProject?.has_buildings 
                      ? [...(selectedProject?.buildings?.find(b => b.name === selectedBuilding)?.layout || [])]
                      : [...(selectedProject?.buildings?.[0]?.layout || [])]
                    ).reverse().map((floorData, idx) => (
                      <div key={idx} className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center">
                        <div className="bg-zinc-100 px-4 py-2 rounded-xl font-bold text-zinc-800 text-lg w-full md:w-24 text-center shrink-0">
                          {floorData.floor}
                        </div>
                        <div className="flex-1 flex flex-wrap gap-2">
                          {floorData.items.map((item: string, itemIdx: number) => {
                            const key = `${floorData.floor}-${item}`;
                            const status = defectCounts[key];
                            
                            if (status?.isInspected) {
                              return (
                                <button
                                  key={itemIdx}
                                  disabled
                                  className="px-4 py-2 rounded-xl border border-transparent bg-green-50 text-green-600 font-bold opacity-80 cursor-not-allowed text-sm"
                                >
                                  {item}<br/><span className="text-xs font-normal">已驗收</span>
                                </button>
                              );
                            }
                            
                            if (status?.defectCount > 0) {
                              return (
                                <button
                                  key={itemIdx}
                                  onClick={() => handleGridSelect(floorData.floor, item)}
                                  className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all font-bold shadow-sm text-sm"
                                >
                                  {item}<br/><span className="text-xs">{status.defectCount}項缺失</span>
                                </button>
                              );
                            }
                            
                            return (
                              <button
                                key={itemIdx}
                                onClick={() => handleGridSelect(floorData.floor, item)}
                                className="px-4 py-2 rounded-xl border border-zinc-200 bg-white hover:border-zinc-900 hover:bg-zinc-900 hover:text-white transition-all font-bold text-zinc-600 text-sm"
                              >
                                {item}
                              </button>
                            );
                          })}
                          
                          {(!floorData.items || floorData.items.length === 0) && (
                            <span className="text-sm text-zinc-400 py-2">該樓層無設定戶別/公設</span>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {!(selectedProject?.has_buildings 
                      ? selectedProject?.buildings?.find(b => b.name === selectedBuilding)?.layout?.length
                      : selectedProject?.buildings?.[0]?.layout?.length
                    ) && (
                      <div className="text-center py-12 bg-white rounded-2xl border border-zinc-200 text-zinc-400">
                        管理員尚未設定此專案的樓層與戶別配置
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Navigation */}
          {step > 0 && (
            <div className="mt-8 pt-6 border-t border-zinc-100 flex items-center justify-between">
              <button 
                onClick={() => {
                  if (step === 2 && selectedProject && !selectedProject.has_buildings) {
                    resetToStep(0); // If no buildings step, Go straight back to project list
                  } else {
                    setStep(s => s - 1);
                  }
                }}
                className="flex items-center gap-2 px-6 py-3 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-xl font-bold transition-all"
              >
                <ArrowLeft size={18} />
                返回上一步
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
