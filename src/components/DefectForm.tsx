import React, { useState } from 'react';
import { X, Plus, Camera, Trash2 } from 'lucide-react';
import { DefectItem, DefectCategory, Pin } from '../types';
import { DEFAULT_DEFECT_ITEMS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';

interface DefectFormProps {
  pin: Pin;
  onClose: () => void;
  onSave: (defects: DefectItem[]) => void;
}

const DefectForm: React.FC<DefectFormProps> = ({ pin, onClose, onSave }) => {
  const [defects, setDefects] = useState<DefectItem[]>(pin.defects);
  const [activeCategory, setActiveCategory] = useState<DefectCategory>(DefectCategory.CEILING);
  const [customItem, setCustomItem] = useState('');

  const handleAddDefect = (name: string, category: DefectCategory) => {
    const newDefect: DefectItem = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      category,
      description: '',
      photos: [],
      status: 'pending'
    };
    setDefects([...defects, newDefect]);
  };

  const handleRemoveDefect = (id: string) => {
    setDefects(defects.filter(d => d.id !== id));
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

        <div className="flex-1 flex overflow-hidden">
          {/* Left: Category & Items Selection */}
          <div className="w-1/3 border-right bg-zinc-50 p-4 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex gap-1 p-1 bg-zinc-200 rounded-lg">
                {Object.values(DefectCategory).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      activeCategory === cat ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">常用項目</p>
                {DEFAULT_DEFECT_ITEMS[activeCategory].map(item => (
                  <button
                    key={item}
                    onClick={() => handleAddDefect(item, activeCategory)}
                    className="w-full text-left p-3 text-sm bg-white border border-zinc-200 rounded-xl hover:border-zinc-400 hover:shadow-sm transition-all flex items-center justify-between group"
                  >
                    {item}
                    <Plus size={16} className="text-zinc-300 group-hover:text-zinc-900" />
                  </button>
                ))}
              </div>

              <div className="pt-4 border-top">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">自定義項目</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customItem}
                    onChange={(e) => setCustomItem(e.target.value)}
                    placeholder="輸入項目名稱..."
                    className="flex-1 text-sm p-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <button
                    onClick={() => {
                      if (customItem) {
                        handleAddDefect(customItem, activeCategory);
                        setCustomItem('');
                      }
                    }}
                    className="p-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Selected Defects Details */}
          <div className="flex-1 p-6 overflow-y-auto bg-white">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              已選項目 <span className="text-sm font-normal text-zinc-400">({defects.length})</span>
            </h3>
            
            {defects.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-100 rounded-2xl">
                <Plus size={48} className="mb-2 opacity-20" />
                <p>請從左側選擇或新增缺失項目</p>
              </div>
            ) : (
              <div className="space-y-6">
                <AnimatePresence>
                  {defects.map((defect) => (
                    <motion.div
                      key={defect.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-4 border border-zinc-200 rounded-2xl space-y-4 relative group"
                    >
                      <button
                        onClick={() => handleRemoveDefect(defect.id)}
                        className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-zinc-100 text-[10px] font-bold rounded uppercase text-zinc-500">
                          {defect.category}
                        </span>
                        <h4 className="font-bold">{defect.name}</h4>
                      </div>

                      <textarea
                        value={defect.description}
                        onChange={(e) => handleDescriptionChange(defect.id, e.target.value)}
                        placeholder="補充說明缺失細節..."
                        className="w-full text-sm p-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[80px]"
                      />

                      <div className="flex flex-wrap gap-3">
                        {defect.photos.map((photo, idx) => (
                          <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-zinc-200">
                            <img src={photo} alt="Defect" className="w-full h-full object-cover" />
                            <button
                              onClick={() => {
                                setDefects(defects.map(d => 
                                  d.id === defect.id ? { ...d, photos: d.photos.filter((_, i) => i !== idx) } : d
                                ));
                              }}
                              className="absolute top-1 right-1 p-0.5 bg-black/50 text-white rounded-full hover:bg-black"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50 hover:border-zinc-400 transition-all">
                          <Camera size={20} className="text-zinc-400" />
                          <span className="text-[10px] text-zinc-400 mt-1">上傳照片</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handlePhotoUpload(defect.id, e)}
                          />
                        </label>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
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
