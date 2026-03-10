import React, { useState, useEffect, useCallback } from 'react';
import FloorPlanViewer from './components/FloorPlanViewer';
import DefectForm from './components/DefectForm';
import ReportView from './components/ReportView';
import ProjectSelector from './components/ProjectSelector';
import Login from './components/Login';
import { Pin, DefectItem } from './types';
import { Building2, ChevronLeft, LogOut, UploadCloud, Printer, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Selection {
  projectId: string;
  building: string;
  floor: string;
  unitNum: string;
  unitId: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('inspect_token'));
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('inspect_user') || 'null'));
  
  const [view, setView] = useState<'selector' | 'editor' | 'report'>('selector');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [floorPlan, setFloorPlan] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [printMode, setPrintMode] = useState<'all' | 'floorplan' | 'table'>('all');

  const handleLogin = (newToken: string, newUser: any) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('inspect_token', newToken);
    localStorage.setItem('inspect_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('inspect_token');
    localStorage.removeItem('inspect_user');
    setSelection(null);
    setFloorPlan(null);
    setPins([]);
    setSelectedPin(null);
    setView('selector');
  };

  const handleSelectUnit = async (projectId: string, building: string, floor: string, unitNum: string) => {
    try {
      const resUnit = await fetch(`/api/units/${projectId}/${building}/${floor}/${unitNum}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!resUnit.ok) throw new Error('Failed to fetch unit data');
      const unitData = await resUnit.json();
      
      const sessionSelection = { projectId, building, floor, unitNum, unitId: unitData.id };
      setSelection(sessionSelection);

      const buildingLetter = building.replace('棟', '');
      const unitNumberStr = unitNum.replace('戶', '');
      const unitNumberFormatted = unitNumberStr.padStart(2, '0');
      const staticImageUrl = `/Building-Inspection-System/floorplans/${projectId}_${buildingLetter}_${floor}_${unitNumberFormatted}.jpg`;
      
      setFloorPlan(staticImageUrl);

      if (unitData.id) {
        const resPins = await fetch(`/api/pins/${unitData.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const pinsData = await resPins.json();
        setPins(pinsData || []);
      } else {
        setPins([]);
      }
      
      setView('editor');
    } catch (err) {
      console.error('Failed to load unit data', err);
      alert('載入資料失敗，請確認目前處於登入狀態');
    }
  };

  const handleAddPin = useCallback((x: number, y: number) => {
    const newPin: Pin = {
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      defects: [],
      createdAt: Date.now()
    };
    setPins(prev => [...prev, newPin]);
    setSelectedPin(newPin);
  }, []);

  const handleSaveDefects = async (defects: DefectItem[]) => {
    if (selectedPin && selection) {
      let newPins;
      if (defects.length === 0) {
        newPins = pins.filter(p => p.id !== selectedPin.id);
      } else {
        newPins = pins.map(p => p.id === selectedPin.id ? { ...p, defects } : p);
      }
      
      setPins(newPins);
      setSelectedPin(null);

      try {
        await fetch(`/api/pins/${selection.unitId}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ pins: newPins })
        });
      } catch (err) {
        console.error('Failed to save pins', err);
      }
    }
  };

  const handlePrint = (mode: 'floorplan' | 'table') => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleExportData = async () => {
    if (!selection) return;
    
    const flatExportData = [];
    for (const pin of pins) {
      for (const defect of pin.defects) {
        const categoryParts = defect.category.split(' - ');
        const category_1 = categoryParts[0] || defect.category;
        const category_2 = categoryParts[1] || '';
        
        flatExportData.push({
          project_id: selection.projectId,
          building: selection.building,
          floor: selection.floor,
          unit_number: selection.unitNum,
          defect_id: defect.id,
          pin_coords: JSON.stringify({ x: pin.x, y: pin.y }),
          area: defect.area || '',
          category_1,
          category_2,
          defect_name: defect.name,
          description: defect.description || '',
          photos_base64: JSON.stringify(defect.photos || [])
        });
      }
    }
    
    if (flatExportData.length === 0) {
      alert('無缺失資料可匯出！');
      return;
    }

    try {
      const resp = await fetch('/api/export-defects', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ defects: flatExportData })
      });
      if (!resp.ok) throw new Error('API return not OK');
      const data = await resp.json();
      if (data.success) {
        alert('驗收完成！資料已彙整上傳，此戶別將被鎖定。');
      }
    } catch (err) {
      console.error(err);
      alert('上傳失敗，請確認後端連線狀況！');
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b border-zinc-100 flex items-center justify-between px-6 sticky top-0 z-50 shadow-sm no-print">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-lg">
            <Building2 className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-bold text-zinc-900 text-lg leading-tight uppercase tracking-tight">KYCC 驗收系統</h1>
            <div className="flex items-center gap-2">
               <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">V 2.0 ENTERPRISE</span>
               <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{user.name} ({user.role})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user.role === 'admin' && (
             <a 
               href="/Building-Inspection-System/admin" 
               className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-xl transition-all"
               title="後台管理"
             >
               <Settings size={20} />
             </a>
          )}
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all text-sm font-bold"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">登出</span>
          </button>
        </div>
      </header>

      {!selection ? (
        <ProjectSelector onSelectUnit={handleSelectUnit} token={token} />
      ) : (
        <>
          {/* Navigation Bar */}
          <nav className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between sticky top-0 z-40 no-print">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelection(null)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500"
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 className="font-bold text-sm leading-tight hidden sm:block">
                  {selection.building} - {selection.floor} - {selection.unitNum}
                </h1>
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">驗收進行中</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl">
              <button
                onClick={() => setView('editor')}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${
                  view === 'editor' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                平面圖編輯
              </button>
              <button
                onClick={() => setView('report')}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${
                  view === 'report' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                缺失清單
              </button>
            </div>

            <div className="flex items-center gap-3">
              {view === 'report' && (
                <>
                  <button
                    onClick={handleExportData}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md mr-4"
                  >
                    <UploadCloud size={18} />
                    <span className="hidden sm:inline">驗收完成</span>
                  </button>
                  <button
                    onClick={() => handlePrint('floorplan')}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 border border-zinc-200 text-sm font-bold rounded-xl hover:bg-zinc-50 transition-all shadow-sm"
                  >
                    <Printer size={18} />
                    <span className="hidden sm:inline">列印平面圖</span>
                  </button>
                  <button
                    onClick={() => handlePrint('table')}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-bold rounded-xl hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                  >
                    <Printer size={18} />
                    <span className="hidden sm:inline">列印項目總表</span>
                  </button>
                </>
              )}
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 relative overflow-hidden">
            {!floorPlan ? (
              <div className="h-full flex items-center justify-center p-6">
                <div className="text-zinc-500">載入平面圖中...</div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {view === 'editor' ? (
                  <motion.div 
                    key="editor"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0"
                  >
                    <FloorPlanViewer
                      imageUrl={floorPlan}
                      pins={pins}
                      onAddPin={handleAddPin}
                      onSelectPin={setSelectedPin}
                    />
                  </motion.div>
                ) : (
                  <motion.div 
                    key="report"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute inset-0 overflow-y-auto bg-white"
                  >
                    <ReportView 
                      imageUrl={floorPlan} 
                      pins={pins} 
                      printMode={printMode}
                      building={selection.building}
                      floor={selection.floor}
                      unit={selection.unitNum}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </main>

          {/* Defect Form Modal */}
          <AnimatePresence>
            {selectedPin && (
              <DefectForm
                pin={selectedPin}
                onClose={() => {
                  const currentPin = pins.find(p => p.id === selectedPin.id);
                  if (currentPin && currentPin.defects.length === 0) {
                    setPins(prev => prev.filter(p => p.id !== selectedPin.id));
                  }
                  setSelectedPin(null);
                }}
                onSave={handleSaveDefects}
              />
            )}
          </AnimatePresence>

          {/* Floating Stats */}
          {view === 'editor' && (
            <div className="fixed bottom-6 left-6 bg-zinc-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 no-print">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-zinc-400">總缺失數</span>
                <span className="text-xl font-bold">{pins.filter(p => p.defects.length > 0).length}</span>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-zinc-400">標記點</span>
                <span className="text-xl font-bold">{pins.length}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
