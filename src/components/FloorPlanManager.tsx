import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, Trash2, RefreshCw, CheckCircle2, AlertTriangle, ChevronDown, FolderOpen, FileImage, X, Package } from 'lucide-react';
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

interface FloorPlanFile {
  name: string;
  size: number;
  url: string;
}

interface Props {
  token: string | null;
}

/**
 * Given a building name like "A棟", extract the letter portion "A".
 * For names without "棟" suffix, return the original name sanitized.
 */
function extractBuildingLetter(building: string): string {
  return building.replace('棟', '');
}

/**
 * Given a unit number like "1戶" or "A", pad to 2 chars.
 * Strips "戶" suffix if present.
 */
function formatUnitNumber(unit: string): string {
  const stripped = unit.replace('戶', '');
  return stripped.padStart(2, '0');
}

/**
 * Build the expected filename for a given project/building/floor/unit.
 * Convention: {ProjectID}_{BuildingLetter}_{Floor}_{UnitNumber2digit}.jpg
 */
function buildExpectedFilename(projectId: string, building: string, floor: string, unit: string): string {
  const bLetter = extractBuildingLetter(building);
  const unitFormatted = formatUnitNumber(unit);
  return `${projectId}_${bLetter}_${floor}_${unitFormatted}.jpg`;
}

/**
 * Validate if a filename matches the expected pattern:
 * {ProjectID}_{BuildingPart}_{Floor}_{UnitPart}.jpg
 * Allows Chinese characters for building names like "無分" and unit names like "大廳"
 */
function validateFilename(filename: string, projectId: string): { valid: boolean; reason?: string } {
  const pattern = new RegExp(`^${projectId}_[A-Za-z0-9\u4e00-\u9fff]+_[A-Za-z0-9]+_[A-Za-z0-9\u4e00-\u9fff]+\\.jpg$`, 'i');
  if (!pattern.test(filename)) {
    return {
      valid: false,
      reason: `檔名「${filename}」不符合格式 [${projectId}_棟別_樓層_戶號.jpg]`
    };
  }
  return { valid: true };
}

export default function FloorPlanManager({ token }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [existingFiles, setExistingFiles] = useState<FloorPlanFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Single upload state
  const [singleBuilding, setSingleBuilding] = useState<string>('');
  const [singleFloor, setSingleFloor] = useState<string>('');
  const [singleUnit, setSingleUnit] = useState<string>('');
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singlePreview, setSinglePreview] = useState<string>('');
  const singleInputRef = useRef<HTMLInputElement>(null);

  // Batch upload state
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchValidation, setBatchValidation] = useState<{ file: File; valid: boolean; reason?: string }[]>([]);
  const batchInputRef = useRef<HTMLInputElement>(null);

  // Tab state
  const [activeMode, setActiveMode] = useState<'single' | 'batch'>('single');

  // Preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Fetch projects
  useEffect(() => {
    if (!token) return;
    fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setProjects(data);
        if (data.length > 0 && !selectedProjectId) {
          setSelectedProjectId(data[0].id);
        }
      })
      .catch(console.error);
  }, [token]);

  // Fetch existing floorplan files when project changes
  const fetchExistingFiles = useCallback(async () => {
    if (!token || !selectedProjectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/floorplans/${selectedProjectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExistingFiles(data.files || []);
      }
    } catch (err) {
      console.error('Failed to fetch floorplan files', err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedProjectId]);

  useEffect(() => {
    fetchExistingFiles();
  }, [fetchExistingFiles]);

  // Auto-clear message
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Get selected project
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // For single-building (無分棟) projects, use '無分棟' to match front-end convention
  const isSingleBuilding = selectedProject ? !selectedProject.has_buildings : false;

  // Get actual DB building data (maps '無分棟' back to the real building entry)
  const getActualBuilding = () => {
    if (!selectedProject) return undefined;
    if (isSingleBuilding) {
      return selectedProject.buildings?.[0];
    }
    return selectedProject.buildings?.find(b => b.name === singleBuilding);
  };

  // Get available buildings/floors/units
  const getBuildings = (): string[] => {
    if (!selectedProject) return [];
    if (isSingleBuilding) {
      return ['無分棟'];
    }
    return selectedProject.buildings?.map(b => b.name) || [];
  };

  const getFloors = (): string[] => {
    if (!selectedProject || !singleBuilding) return [];
    const building = getActualBuilding();
    return building?.layout?.map(l => l.floor) || [];
  };

  const getUnits = (): string[] => {
    if (!selectedProject || !singleBuilding || !singleFloor) return [];
    const building = getActualBuilding();
    const floor = building?.layout?.find(l => l.floor === singleFloor);
    return floor?.items || [];
  };

  // Reset single upload selections when project changes
  // For single-building projects, auto-select '無分棟'
  useEffect(() => {
    if (isSingleBuilding) {
      setSingleBuilding('無分棟');
    } else {
      setSingleBuilding('');
    }
    setSingleFloor('');
    setSingleUnit('');
    setSingleFile(null);
    setSinglePreview('');
  }, [selectedProjectId, isSingleBuilding]);

  // Handle single file selection
  const handleSingleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: '請選擇圖片檔案 (JPG/PNG)' });
      return;
    }

    setSingleFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSinglePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Convert a File to base64 data URL
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle single upload
  const handleSingleUpload = async () => {
    if (!token || !selectedProjectId || !singleBuilding || !singleFloor || !singleUnit || !singleFile) {
      setMessage({ type: 'error', text: '請先選擇專案、棟別、樓層、戶別，並選擇圖檔' });
      return;
    }

    const expectedName = buildExpectedFilename(selectedProjectId, singleBuilding, singleFloor, singleUnit);

    setUploading(true);
    try {
      const base64Data = await fileToBase64(singleFile);

      const res = await fetch('/api/admin/floorplans/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          targetFilename: expectedName,
          fileData: base64Data
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: `上傳成功！已自動命名為 ${expectedName}` });
        setSingleFile(null);
        setSinglePreview('');
        if (singleInputRef.current) singleInputRef.current.value = '';
        fetchExistingFiles();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: `上傳失敗: ${data.error || '未知錯誤'}` });
      }
    } catch (err) {
      console.error('Upload error:', err);
      setMessage({ type: 'error', text: '上傳失敗，請檢查網路連線' });
    } finally {
      setUploading(false);
    }
  };

  // Handle batch file selection
  const handleBatchFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length < files.length) {
      setMessage({ type: 'info', text: `已過濾 ${files.length - imageFiles.length} 個非圖片檔案` });
    }

    setBatchFiles(imageFiles);

    // Validate each file
    const validation = imageFiles.map(file => {
      const result = validateFilename(file.name, selectedProjectId);
      return { file, ...result };
    });
    setBatchValidation(validation);
  };

  // Handle batch upload
  const handleBatchUpload = async () => {
    if (!token || !selectedProjectId || batchFiles.length === 0) return;

    const validFiles = batchValidation.filter(v => v.valid);
    if (validFiles.length === 0) {
      setMessage({ type: 'error', text: '沒有符合格式的檔案可上傳' });
      return;
    }

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const { file } of validFiles) {
        try {
          const base64Data = await fileToBase64(file);

          const res = await fetch('/api/admin/floorplans/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              projectId: selectedProjectId,
              targetFilename: file.name,
              fileData: base64Data
            })
          });
          if (res.ok) successCount++;
          else errorCount++;
        } catch {
          errorCount++;
        }
      }

      setMessage({
        type: errorCount === 0 ? 'success' : 'error',
        text: `批次上傳完成：成功 ${successCount} 件${errorCount > 0 ? `，失敗 ${errorCount} 件` : ''}`
      });

      setBatchFiles([]);
      setBatchValidation([]);
      if (batchInputRef.current) batchInputRef.current.value = '';
      fetchExistingFiles();
    } catch (err) {
      setMessage({ type: 'error', text: '批次上傳過程中出現錯誤' });
    } finally {
      setUploading(false);
    }
  };

  // Handle delete
  const handleDeleteFile = async (filename: string) => {
    if (!window.confirm(`確定要刪除平面圖「${filename}」嗎？`)) return;

    try {
      const res = await fetch(`/api/admin/floorplans/${selectedProjectId}/${filename}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `已刪除 ${filename}` });
        fetchExistingFiles();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || '刪除失敗' });
      }
    } catch {
      setMessage({ type: 'error', text: '刪除失敗，請檢查網路連線' });
    }
  };

  // Compute coverage stats
  const getCoverageStats = () => {
    if (!selectedProject) return { total: 0, covered: 0 };
    let total = 0;
    const existingSet = new Set(existingFiles.map(f => f.name.toLowerCase()));

    for (const building of (selectedProject.buildings || [])) {
      for (const floor of (building.layout || [])) {
        for (const unit of (floor.items || [])) {
          total++;
          const expectedName = buildExpectedFilename(selectedProjectId, building.name, floor.floor, unit).toLowerCase();
          if (existingSet.has(expectedName)) {
            // covered
          }
        }
      }
    }

    // Count how many existing files match any expected name
    let covered = 0;
    for (const building of (selectedProject.buildings || [])) {
      for (const floor of (building.layout || [])) {
        for (const unit of (floor.items || [])) {
          const expectedName = buildExpectedFilename(selectedProjectId, building.name, floor.floor, unit).toLowerCase();
          if (existingSet.has(expectedName)) {
            covered++;
          }
        }
      }
    }

    return { total, covered };
  };

  const coverage = getCoverageStats();
  const coveragePercent = coverage.total > 0 ? Math.round((coverage.covered / coverage.total) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">平面圖檔管理</h2>
          <p className="text-slate-500">上傳與管理各專案戶別的平面圖檔案</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchExistingFiles}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 font-bold rounded-xl hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>重新整理</span>
          </button>
        </div>
      </div>

      {/* Message Banner */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-6 p-4 rounded-2xl flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : message.type === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-800'
                  : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <span className="font-bold text-sm">{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto p-1 hover:opacity-70">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Selector + Coverage Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Project Selector */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">選擇專案</label>
          <div className="relative">
            <select
              id="floorplan-project-select"
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold appearance-none pr-10 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>[{p.id}] {p.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Coverage Stats */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <FileImage size={22} className="text-blue-600" />
          </div>
          <div>
            <div className="text-xs font-bold text-blue-500 uppercase tracking-wider">已上傳圖檔</div>
            <div className="text-2xl font-black text-blue-900">{existingFiles.length}</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Package size={22} className="text-emerald-600" />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider">戶別覆蓋率</div>
            <div className="text-2xl font-black text-emerald-900">
              {coveragePercent}%
              <span className="text-sm font-bold text-emerald-500 ml-1">({coverage.covered}/{coverage.total})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        {/* Tab Switcher */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Upload size={16} className="text-white" />
            </div>
            <h3 className="font-bold text-slate-900">上傳平面圖</h3>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveMode('single')}
              className={`px-5 py-2 rounded-lg font-bold text-sm transition-all ${
                activeMode === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              單戶上傳
            </button>
            <button
              onClick={() => setActiveMode('batch')}
              className={`px-5 py-2 rounded-lg font-bold text-sm transition-all ${
                activeMode === 'batch' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              批次上傳
            </button>
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {activeMode === 'single' ? (
              <motion.div
                key="single"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Selectors */}
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500 mb-2">
                      選擇目標戶別後上傳圖片，系統將自動將檔案命名為正確格式。
                    </p>

                    {/* Building */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">棟別</label>
                      <div className="relative">
                        <select
                          id="single-building-select"
                          value={singleBuilding}
                          onChange={e => {
                            setSingleBuilding(e.target.value);
                            setSingleFloor('');
                            setSingleUnit('');
                          }}
                          className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium appearance-none pr-10 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        >
                          <option value="">請選擇棟別</option>
                          {getBuildings().map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Floor */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">樓層</label>
                      <div className="relative">
                        <select
                          id="single-floor-select"
                          value={singleFloor}
                          onChange={e => {
                            setSingleFloor(e.target.value);
                            setSingleUnit('');
                          }}
                          disabled={!singleBuilding}
                          className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium appearance-none pr-10 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
                        >
                          <option value="">請選擇樓層</option>
                          {getFloors().map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Unit */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">戶別</label>
                      <div className="relative">
                        <select
                          id="single-unit-select"
                          value={singleUnit}
                          onChange={e => setSingleUnit(e.target.value)}
                          disabled={!singleFloor}
                          className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium appearance-none pr-10 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
                        >
                          <option value="">請選擇戶別</option>
                          {getUnits().map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Expected filename preview */}
                    {singleBuilding && singleFloor && singleUnit && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">自動命名為</span>
                        <code className="text-sm font-mono font-bold text-blue-600">
                          {buildExpectedFilename(selectedProjectId, singleBuilding, singleFloor, singleUnit)}
                        </code>
                      </div>
                    )}

                    {/* File input */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">選擇圖檔</label>
                      <input
                        ref={singleInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSingleFileSelect}
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 file:transition-all file:cursor-pointer"
                      />
                    </div>

                    {/* Upload button */}
                    <button
                      onClick={handleSingleUpload}
                      disabled={!singleFile || !singleBuilding || !singleFloor || !singleUnit || uploading}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? (
                        <><RefreshCw size={18} className="animate-spin" /> 上傳中...</>
                      ) : (
                        <><Upload size={18} /> 上傳平面圖</>
                      )}
                    </button>
                  </div>

                  {/* Right: Preview */}
                  <div className="flex items-center justify-center">
                    {singlePreview ? (
                      <div className="w-full">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">預覽</span>
                        <div className="relative group">
                          <img
                            src={singlePreview}
                            alt="預覽"
                            className="w-full max-h-[320px] object-contain rounded-2xl border border-slate-200 bg-slate-50"
                          />
                          <button
                            onClick={() => {
                              setSingleFile(null);
                              setSinglePreview('');
                              if (singleInputRef.current) singleInputRef.current.value = '';
                            }}
                            className="absolute top-3 right-3 w-8 h-8 bg-red-500 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        {singleFile && (
                          <p className="text-xs text-slate-400 mt-2">
                            原始檔名: {singleFile.name} ({(singleFile.size / 1024).toFixed(0)} KB)
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-[300px] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                        <ImageIcon size={48} className="mb-3 opacity-30" />
                        <p className="font-bold text-sm">選擇圖檔後將顯示預覽</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="batch"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800">
                        <p className="font-bold mb-1">批次上傳注意事項</p>
                        <p>檔案名稱必須已經符合格式才能上傳，命名規則：</p>
                        <code className="bg-amber-100 px-2 py-0.5 rounded text-xs font-mono mt-1 inline-block">
                          {selectedProjectId}_棟別_樓層_戶號兩碼.jpg
                        </code>
                        <p className="mt-1 text-xs">範例：{selectedProjectId}_A_2F_01.jpg、{selectedProjectId}_B_3F_0A.jpg</p>
                      </div>
                    </div>
                  </div>

                  {/* Batch file input */}
                  <div
                    className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer"
                    onClick={() => batchInputRef.current?.click()}
                  >
                    <FolderOpen size={40} className="mx-auto mb-3 text-slate-300" />
                    <p className="font-bold text-slate-600 mb-1">點擊選擇多個圖檔</p>
                    <p className="text-xs text-slate-400">支援 JPG / PNG 格式，可一次選擇多個檔案</p>
                    <input
                      ref={batchInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleBatchFileSelect}
                      className="hidden"
                    />
                  </div>

                  {/* Batch validation results */}
                  {batchValidation.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-700">
                          驗證結果：{batchValidation.filter(v => v.valid).length} / {batchValidation.length} 個檔案符合格式
                        </span>
                        <button
                          onClick={() => {
                            setBatchFiles([]);
                            setBatchValidation([]);
                            if (batchInputRef.current) batchInputRef.current.value = '';
                          }}
                          className="text-xs text-slate-400 hover:text-red-500 font-bold"
                        >
                          清除全部
                        </button>
                      </div>

                      <div className="max-h-[280px] overflow-y-auto space-y-1.5 pr-2">
                        {batchValidation.map((item, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm ${
                              item.valid
                                ? 'bg-green-50 border border-green-100'
                                : 'bg-red-50 border border-red-100'
                            }`}
                          >
                            {item.valid ? (
                              <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                            ) : (
                              <AlertTriangle size={16} className="text-red-500 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <span className={`font-bold truncate block ${item.valid ? 'text-green-800' : 'text-red-800'}`}>
                                {item.file.name}
                              </span>
                              {!item.valid && item.reason && (
                                <span className="text-xs text-red-500">{item.reason}</span>
                              )}
                            </div>
                            <span className="text-xs text-slate-400 shrink-0">
                              {(item.file.size / 1024).toFixed(0)} KB
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Batch upload button */}
                      <button
                        onClick={handleBatchUpload}
                        disabled={batchValidation.filter(v => v.valid).length === 0 || uploading}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                      >
                        {uploading ? (
                          <><RefreshCw size={18} className="animate-spin" /> 批次上傳中...</>
                        ) : (
                          <><Upload size={18} /> 上傳 {batchValidation.filter(v => v.valid).length} 個符合格式的檔案</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Existing Files Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg flex items-center justify-center">
              <FolderOpen size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">已有圖檔一覽</h3>
              <p className="text-xs text-slate-400">專案 [{selectedProjectId}] 目前的平面圖清單</p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-medium">共 {existingFiles.length} 個檔案</span>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <RefreshCw size={24} className="animate-spin mr-3" />
              <span className="font-bold">載入中...</span>
            </div>
          ) : existingFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <ImageIcon size={48} className="mb-4 opacity-20" />
              <p className="font-bold text-slate-400">此專案尚未上傳任何平面圖</p>
              <p className="text-sm text-slate-300 mt-1">請在上方選擇模式上傳圖檔</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {existingFiles.map(file => (
                <div
                  key={file.name}
                  className="group relative bg-slate-50 rounded-xl border border-slate-200 overflow-hidden hover:shadow-md hover:border-slate-300 transition-all"
                >
                  {/* Thumbnail */}
                  <div
                    className="aspect-[4/3] overflow-hidden cursor-pointer"
                    onClick={() => setPreviewImage(file.url)}
                  >
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
                  <div className="p-2.5">
                    <p className="text-[11px] font-bold text-slate-700 truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {file.size > 1024 * 1024
                        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                        : `${(file.size / 1024).toFixed(0)} KB`
                      }
                    </p>
                  </div>

                  {/* Delete button on hover */}
                  <button
                    onClick={() => handleDeleteFile(file.name)}
                    className="absolute top-2 right-2 w-7 h-7 bg-red-500/90 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                    title="刪除此檔案"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewImage(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] w-full"
            >
              <img
                src={previewImage}
                alt="平面圖預覽"
                className="w-full h-full object-contain rounded-2xl"
              />
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-white/90 text-slate-900 rounded-xl flex items-center justify-center shadow-lg hover:bg-white transition-all"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
