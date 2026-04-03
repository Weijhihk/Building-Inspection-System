import React, { useState, useEffect, useMemo } from 'react';
import { X, Camera } from 'lucide-react';
import { DefectItem, Pin } from '../types';
import { motion } from 'motion/react';

const COMMON_AREAS = ['客廳', '餐廳', '廚房', '主臥室', '次臥室1', '次臥室2', '主浴', '次浴'];

// Position types (天/地/牆/其他) kept from old UI
const POSITIONS = [
  { key: '天', label: '天 (天花)' },
  { key: '地', label: '地 (地板)' },
  { key: '牆', label: '牆 (牆面)' },
  { key: '其他', label: '其他 (通用)' },
];

// ---- Category tree types ----
interface CategoryNode {
  code: string;
  name: string;
  children?: CategoryNode[];
}

interface Level3Item {
  code: string;
  name: string;
  l1Name: string; // e.g. "裝修工程"
  l2Name: string; // e.g. "外部裝修工程"
  children: CategoryNode[]; // L4 defect items
}

interface L1Group {
  code: string;
  name: string;
  level3Items: Level3Item[];
}

// ---- Props ----
interface DefectFormProps {
  pin: Pin;
  onClose: () => void;
  onSave: (defects: DefectItem[]) => void;
}

const DefectForm: React.FC<DefectFormProps> = ({ pin, onClose, onSave }) => {
  const [defects, setDefects] = useState<DefectItem[]>(pin.defects);

  // Position selection (天/地/牆/其他)
  const [position, setPosition] = useState<string>(POSITIONS[0].key);

  // Category hierarchy from API
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  const [selectedL1Code, setSelectedL1Code] = useState<string>('');
  const [selectedL3Code, setSelectedL3Code] = useState<string>('');

  const [selectedArea, setSelectedArea] = useState<string>(COMMON_AREAS[0]);
  const [customItem, setCustomItem] = useState('');

  // Fetch hierarchical categories
  useEffect(() => {
    fetch('/api/defect-categories')
      .then(res => res.json())
      .then(data => {
        const cats: CategoryNode[] = data.categories || [];
        setCategoryTree(cats);
        if (cats.length > 0) {
          setSelectedL1Code(cats[0].code);
          // Auto-select first L3
          const firstL3 = findFirstL3(cats[0]);
          if (firstL3) setSelectedL3Code(firstL3.code);
        }
      })
      .catch(err => console.error('Failed to load defect categories', err));
  }, []);

  // Find first L3 node inside an L1
  function findFirstL3(l1: CategoryNode): CategoryNode | null {
    if (!l1.children) return null;
    for (const l2 of l1.children) {
      if (l2.children && l2.children.length > 0) {
        return l2.children[0];
      }
    }
    return null;
  }

  // Build grouped L3 items for the selected L1
  const l1Groups: L1Group[] = useMemo(() => {
    return categoryTree.map(l1 => {
      const level3Items: Level3Item[] = [];
      if (l1.children) {
        for (const l2 of l1.children) {
          if (l2.children) {
            for (const l3 of l2.children) {
              level3Items.push({
                code: l3.code,
                name: l3.name,
                l1Name: l1.name,
                l2Name: l2.name,
                children: l3.children || [],
              });
            }
          }
        }
      }
      return { code: l1.code, name: l1.name, level3Items };
    });
  }, [categoryTree]);

  // Current L1 group and selected L3
  const currentL1 = l1Groups.find(g => g.code === selectedL1Code);
  const currentL3 = currentL1?.level3Items.find(l3 => l3.code === selectedL3Code);
  const currentL4Items = currentL3?.children || [];

  // When L1 changes, auto-select first L3
  const handleL1Change = (code: string) => {
    setSelectedL1Code(code);
    const group = l1Groups.find(g => g.code === code);
    if (group && group.level3Items.length > 0) {
      setSelectedL3Code(group.level3Items[0].code);
    } else {
      setSelectedL3Code('');
    }
  };

  const handleAddDefect = (name: string, categoryCombined: string) => {
    const newDefect: DefectItem = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      category: categoryCombined,
      description: '',
      area: selectedArea,
      photos: [],
      status: 'pending'
    };
    // Replace any existing defect to strictly enforce 1 defect per pin
    setDefects([newDefect]);
  };

  const handleRemoveDefect = () => {
    setDefects([]);
  };

  const handlePhotoUpload = (defectId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDefects(defects.map(d =>
          d.id === defectId ? { ...d, photos: [...d.photos, reader.result as string] } : d
        ));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDescriptionChange = (defectId: string, desc: string) => {
    setDefects(defects.map(d => d.id === defectId ? { ...d, description: desc } : d));
  };

  const handleAreaChange = (defectId: string, area: string) => {
    setDefects(defects.map(d => d.id === defectId ? { ...d, area } : d));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-bottom flex items-center justify-between bg-zinc-900 text-white">
          <div>
            <h2 className="text-xl font-bold">缺失項目輸入</h2>
            <p className="text-sm text-zinc-400">座標: ({pin.x.toFixed(2)}, {pin.y.toFixed(2)})</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-zinc-50 p-6">
          <div className="max-w-2xl mx-auto space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-zinc-100">

            {/* 1. 選擇區域 (Area) - UNCHANGED */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2 border-b border-zinc-100 pb-2">
                <div className="w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold">1</div>
                <h3 className="font-bold text-zinc-900">選擇發生區域</h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {COMMON_AREAS.map(area => (
                  <button
                    key={area}
                    onClick={() => {
                      setSelectedArea(area);
                      if (defects.length > 0) handleAreaChange(defects[0].id, area);
                    }}
                    className={`px-4 py-2 text-sm font-bold rounded-xl transition-all border ${
                      (defects.length > 0 ? defects[0].area === area : selectedArea === area)
                        ? 'bg-zinc-900 border-zinc-900 text-white shadow-md'
                        : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={defects.length > 0 ? (defects[0].area || '') : selectedArea}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedArea(val);
                  if (defects.length > 0) handleAreaChange(defects[0].id, val);
                }}
                placeholder="或在此輸入自訂區域名稱..."
                className="w-full text-sm p-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-medium text-zinc-900 bg-zinc-50/50"
              />
            </div>

            {/* 2. 選擇缺失項目 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2 border-b border-zinc-100 pb-2">
                <div className="w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold">2</div>
                <h3 className="font-bold text-zinc-900">選擇缺失項目</h3>
              </div>

              {/* Position tabs: 天/地/牆/其他 */}
              <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl mb-4">
                {POSITIONS.map(pos => (
                  <button
                    key={pos.key}
                    onClick={() => setPosition(pos.key)}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                      position === pos.key ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    {pos.key}
                  </button>
                ))}
              </div>

              {/* L1 tabs: 第一階大分類 */}
              <div className="flex flex-wrap gap-2 mb-3">
                {l1Groups.map(g => (
                  <button
                    key={g.code}
                    onClick={() => handleL1Change(g.code)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all border ${
                      selectedL1Code === g.code
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                        : 'bg-white border-zinc-200 text-zinc-500 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    <span className="font-mono mr-1 opacity-60">{g.code}</span>
                    {g.name}
                  </button>
                ))}
              </div>

              {/* L3 pills: 第三階小分類 */}
              {currentL1 && currentL1.level3Items.length > 0 && (
                <div className="space-y-2 mb-4">
                  {/* Group L3 items by their L2 parent */}
                  {(() => {
                    const l2Groups: { l2Name: string; items: Level3Item[] }[] = [];
                    for (const l3 of currentL1.level3Items) {
                      const existing = l2Groups.find(g => g.l2Name === l3.l2Name);
                      if (existing) {
                        existing.items.push(l3);
                      } else {
                        l2Groups.push({ l2Name: l3.l2Name, items: [l3] });
                      }
                    }
                    return l2Groups.map(group => (
                      <div key={group.l2Name}>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 pl-1">
                          {group.l2Name}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {group.items.map(l3 => (
                            <button
                              key={l3.code}
                              onClick={() => setSelectedL3Code(l3.code)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${
                                selectedL3Code === l3.code
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                  : 'bg-white border-zinc-200 text-zinc-600 hover:border-emerald-300 hover:bg-emerald-50'
                              }`}
                            >
                              <span className="font-mono mr-1 opacity-60">{l3.code}</span>
                              {l3.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* L4 grid: 第四階缺失項目 */}
              {currentL3 && currentL4Items.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                  {currentL4Items.map(l4 => {
                    // category combines position + L3 info
                    const combinedCat = `${POSITIONS.find(p => p.key === position)?.label || position} - ${currentL3.name}`;
                    const isSelected = defects.length > 0 && defects[0].name === l4.name && defects[0].category === combinedCat;
                    return (
                      <button
                        key={l4.code}
                        onClick={() => handleAddDefect(l4.name, combinedCat)}
                        className={`p-3 text-sm font-medium border rounded-xl transition-all text-left ${
                          isSelected
                            ? 'bg-zinc-900 border-zinc-900 text-white shadow-md'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50'
                        }`}
                      >
                        <span className="font-mono text-[10px] opacity-50 block mb-0.5">{l4.code}</span>
                        {l4.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {currentL3 && currentL4Items.length === 0 && (
                <div className="text-center py-6 text-sm text-zinc-400 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                  此小分類下尚無缺失項目
                </div>
              )}

              {/* Custom item input */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={customItem}
                  onChange={(e) => setCustomItem(e.target.value)}
                  placeholder="輸入自訂項目名稱..."
                  className="flex-1 text-sm p-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-zinc-50/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customItem) {
                      const combinedCat = currentL3
                        ? `${POSITIONS.find(p => p.key === position)?.label || position} - ${currentL3.name}`
                        : `${POSITIONS.find(p => p.key === position)?.label || position} - 自訂`;
                      handleAddDefect(customItem, combinedCat);
                      setCustomItem('');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (customItem) {
                      const combinedCat = currentL3
                        ? `${POSITIONS.find(p => p.key === position)?.label || position} - ${currentL3.name}`
                        : `${POSITIONS.find(p => p.key === position)?.label || position} - 自訂`;
                      handleAddDefect(customItem, combinedCat);
                      setCustomItem('');
                    }
                  }}
                  className="px-4 py-3 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-colors whitespace-nowrap"
                >
                  套用自訂
                </button>
              </div>

              {/* Selected defect indicator */}
              {defects.length > 0 && defects[0].name && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl flex justify-between items-center">
                  <span className="text-sm font-bold">目前選擇：[{defects[0].category}] {defects[0].name}</span>
                  <button
                    onClick={handleRemoveDefect}
                    className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded"
                  >
                    清除重選
                  </button>
                </div>
              )}
            </div>

            {/* If Item is selected, show 3 and 4 */}
            {defects.length > 0 && defects[0].name && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-8"
              >
                {/* 3. 備註 (Description) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2 border-b border-zinc-100 pb-2">
                    <div className="w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold">3</div>
                    <h3 className="font-bold text-zinc-900">備註說明</h3>
                  </div>
                  <textarea
                    value={defects[0].description}
                    onChange={(e) => handleDescriptionChange(defects[0].id, e.target.value)}
                    placeholder="補充說明缺失細節 (選填)"
                    className="w-full text-sm p-4 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[100px]"
                  />
                </div>

                {/* 4. 上傳照片 (Photos) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2 border-b border-zinc-100 pb-2">
                    <div className="w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold">4</div>
                    <h3 className="font-bold text-zinc-900">上傳照片</h3>
                    <span className="text-xs text-zinc-400 ml-auto">({defects[0].photos.length} 張)</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {defects[0].photos.map((photo, idx) => (
                      <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-zinc-200 shadow-sm">
                        <img src={photo} alt={`Defect photo ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => {
                            setDefects([{ ...defects[0], photos: defects[0].photos.filter((_, i) => i !== idx) }]);
                          }}
                          className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-black transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 rounded-xl cursor-pointer hover:bg-zinc-50 hover:border-zinc-500 transition-all text-zinc-500 hover:text-zinc-700">
                      <Camera size={24} className="mb-1" />
                      <span className="text-[10px] font-bold">新增照片</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(defects[0].id, e)}
                      />
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-top bg-zinc-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onSave(defects)}
            className="px-8 py-2 bg-zinc-900 text-white text-sm font-bold rounded-xl hover:bg-zinc-800 shadow-lg shadow-zinc-200 transition-all"
          >
            儲存變更
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DefectForm;
