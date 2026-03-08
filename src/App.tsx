import React, { useState, useCallback } from 'react';
import { Upload, FileText, Printer, ChevronLeft, Plus, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FloorPlanViewer from './components/FloorPlanViewer';
import DefectForm from './components/DefectForm';
import ReportView from './components/ReportView';
import { Pin, DefectItem } from './types';

export default function App() {
  const [floorPlan, setFloorPlan] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [view, setView] = useState<'editor' | 'report'>('editor');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const MAX_SIZE = 4096;
          let width = img.width;
          let height = img.height;

          if (width > MAX_SIZE || height > MAX_SIZE) {
            const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
            width *= ratio;
            height *= ratio;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            setFloorPlan(canvas.toDataURL('image/jpeg', 0.8));
            setPins([]);
          } else {
            setFloorPlan(reader.result as string);
            setPins([]);
          }
        };
        img.onerror = () => {
          alert('無法載入圖片，請確保上傳的是有效的圖片檔案 (JPG, PNG)。');
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
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

  const handleSaveDefects = (defects: DefectItem[]) => {
    if (selectedPin) {
      if (defects.length === 0) {
        setPins(pins.filter(p => p.id !== selectedPin.id));
      } else {
        setPins(pins.map(p => p.id === selectedPin.id ? { ...p, defects } : p));
      }
      setSelectedPin(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!floorPlan) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-zinc-100 text-center"
        >
          <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-zinc-200">
            <Home className="text-white" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">建築驗收系統</h1>
          <p className="text-zinc-500 mb-8">請上傳建築平面圖作為底稿開始驗收</p>
          
          <label className="block w-full cursor-pointer group">
            <div className="p-8 border-2 border-dashed border-zinc-200 rounded-2xl group-hover:border-zinc-900 group-hover:bg-zinc-50 transition-all">
              <Upload className="mx-auto mb-4 text-zinc-400 group-hover:text-zinc-900 transition-colors" size={32} />
              <span className="text-sm font-bold text-zinc-900">選擇平面圖檔案</span>
              <p className="text-xs text-zinc-400 mt-1">支援 JPG, PNG, PDF 截圖</p>
            </div>
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          </label>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col">
      {/* Navigation Bar */}
      <nav className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between sticky top-0 z-40 no-print">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setFloorPlan(null)}
            className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="font-bold text-lg hidden sm:block">驗收進行中</h1>
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
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-bold rounded-xl hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
            >
              <Printer size={18} />
              <span className="hidden sm:inline">列印報表</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
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
              <ReportView imageUrl={floorPlan} pins={pins} />
            </motion.div>
          )}
        </AnimatePresence>
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
    </div>
  );
}
