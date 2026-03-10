import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import { Building2, Layers, Unlock, Lock, AlertCircle, CheckCircle2, LogOut, ArrowLeft, Users, UserPlus, Edit2, Trash2, X, Shield, Key, Printer, SortAsc } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Project {
  id: string;
  name: string;
}

export default function AdminApp() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('inspect_token'));
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('inspect_user') || 'null'));

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('A棟');
  const [defectCounts, setDefectCounts] = useState<Record<string, { defectCount: number, isInspected: boolean, unitId: string }>>({});
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users'>('dashboard');
  const [users, setUsers] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [activeUnitDefects, setActiveUnitDefects] = useState<any[]>([]);
  const [activeUnitInfo, setActiveUnitInfo] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [showProjectReportModal, setShowProjectReportModal] = useState(false);
  const [projectDefects, setProjectDefects] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'floor' | 'unit' | 'category'>('floor');

  const BUILDINGS = ['A棟', 'B棟'];
  const FLOORS = Array.from({ length: 9 }, (_, i) => `${i + 2}F`);
  const UNITS = Array.from({ length: 6 }, (_, i) => `${i + 1}戶`);

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
  };

  useEffect(() => {
    if (!user || user.role !== 'admin' || !token) return;
    fetch('/api/projects', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setProjects(data))
      .catch(err => console.error(err));
      
    fetchUsers();
  }, [user, token]);

  const fetchUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  useEffect(() => {
    if (selectedProject && selectedBuilding && token) {
      fetchData();
    }
  }, [selectedProject, selectedBuilding, token]);

  const fetchData = async () => {
    if (!selectedProject || !token) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/${selectedBuilding}/units-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const counts = await res.json();
      setDefectCounts(counts);
    } catch (err) {
      console.error('Failed to fetch defect counts', err);
    }
  };

  const handleToggleLock = async (unitKey: string, currentStatus: boolean, unitId: string) => {
    if (!unitId || !token) {
      alert("此戶別尚未建立紀錄，無法操作！");
      return;
    }
    
    const newStatus = currentStatus ? 0 : 1;
    const actionName = currentStatus ? "解鎖" : "強制鎖定";
    
    if (!window.confirm(`確定要 ${actionName} 此戶別嗎？`)) return;

    try {
      const res = await fetch('/api/admin/toggle-inspection', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ unitId, status: newStatus })
      });
      if (res.ok) {
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

  const handleSaveUser = async (userData: any) => {
    try {
      const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      });
      
      if (res.ok) {
        setShowUserModal(false);
        setEditingUser(null);
        fetchUsers();
      } else {
        const data = await res.json();
        console.error('Save failed:', data);
        alert(`儲存失敗: ${data.error || '未知錯誤'}`);
      }
    } catch (err) {
      console.error('Save error:', err);
      alert(`系統錯誤: ${err instanceof Error ? err.message : '連線失敗'}`);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`確定要刪除帳號「${name}」嗎？`)) return;
    
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchUsers();
      else {
        const data = await res.json();
        alert(data.error || '刪除失敗');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUnitDefects = async (unitId: string, unitKey: string) => {
    setActiveUnitInfo({ id: unitId, key: unitKey });
    try {
      const res = await fetch(`/api/pins/${unitId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const pins = await res.json();
      const defects = pins.flatMap((p: any) => p.defects.map((d: any) => ({ ...d, pinId: p.id })));
      setActiveUnitDefects(defects);
      setShowDefectModal(true);
    } catch (err) {
      console.error('Failed to fetch unit defects', err);
    }
  };

  const handleDeleteDefect = async (defectId: string) => {
    if (!window.confirm('確定要刪除這條缺失紀錄嗎？此操作不可復原。')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/defects/${defectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setActiveUnitDefects(prev => prev.filter(d => d.id !== defectId));
        fetchData(); // Refresh grid
      } else {
        const data = await res.json();
        alert(`刪除失敗: ${data.error || '未知錯誤'}`);
      }
    } catch (err) {
      console.error(err);
      alert('連線失敗，請檢查網路狀態');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearUnit = async () => {
    if (!activeUnitInfo) return;
    if (!window.confirm(`確定要清除戶別「${activeUnitInfo.key}」的所有缺失紀錄並解鎖嗎？`)) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/units/${activeUnitInfo.id}/defects`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        const { stats } = data;
        alert(`清除成功！\n- 移除 Pins: ${stats.pins}\n- 移除缺失: ${stats.defects}\n- 移除照片: ${stats.photos}\n- 移除導出紀錄: ${stats.exported}`);
        setShowDefectModal(false);
        fetchData(); // Refresh grid
      } else {
        alert(`清除失敗: ${data.error || '未知錯誤'}`);
      }
    } catch (err) {
      console.error(err);
      alert('連線失敗，請檢查網路狀態');
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchProjectDefects = async () => {
    if (!selectedProject || !token) return;
    try {
      const res = await fetch(`/api/admin/projects/${selectedProject.id}/defects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setProjectDefects(data);
      setShowProjectReportModal(true);
    } catch (err) {
      console.error('Failed to fetch project defects', err);
      alert('獲取資料失敗');
    }
  };

  const getSortedDefects = () => {
    return [...projectDefects].sort((a, b) => {
      if (sortBy === 'floor') {
        const floorA = parseInt(a.floor) || 0;
        const floorB = parseInt(b.floor) || 0;
        if (floorA !== floorB) return floorB - floorA; // 樓層高到低
        return a.unit_number.localeCompare(b.unit_number);
      }
      if (sortBy === 'unit') {
        if (a.unit_number !== b.unit_number) return a.unit_number.localeCompare(b.unit_number);
        return parseInt(b.floor) - parseInt(a.floor);
      }
      if (sortBy === 'category') {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return parseInt(b.floor) - parseInt(a.floor);
      }
      return 0;
    });
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-md">
          <Lock size={64} className="mx-auto mb-6 text-red-500" />
          <h1 className="text-3xl font-bold mb-4">存取被拒絕</h1>
          <p className="text-zinc-400 mb-8 font-medium">
            抱歉，您的帳號 ({user.username}) 沒有管理員權限。<br/>
            請聯繫系統管理員獲取權限。
          </p>
          <div className="flex flex-col gap-3">
            <a href="/Building-Inspection-System/" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-700 transition-all">
              <ArrowLeft size={18} />
              返回驗收系統
            </a>
            <button onClick={handleLogout} className="text-zinc-500 text-sm font-bold hover:text-white">
              切換帳號登入
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        
        <nav className="p-4 space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${
              activeTab === 'dashboard' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 text-slate-400'
            }`}
          >
            <Layers size={18} />
            <span className="font-bold text-sm">控制中心</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${
              activeTab === 'users' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 text-slate-400'
            }`}
          >
            <Users size={18} />
            <span className="font-bold text-sm">帳號管理</span>
          </button>
        </nav>

        {activeTab === 'dashboard' && (
          <div className="p-4 flex-1">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2 italic">專案切換</h2>
            <div className="space-y-2">
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${
                    selectedProject?.id === p.id ? 'bg-blue-600/20 text-blue-400 border border-blue-600/50' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <Layers size={18} />
                  <span className="font-bold text-sm">[{p.id}] {p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex-1" />
        
        <div className="p-4 border-t border-slate-800 space-y-2">
           <a href="/Building-Inspection-System/" className="w-full text-center block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-bold rounded-lg transition-colors">
             回驗收前台
           </a>
           <button 
             onClick={handleLogout}
             className="w-full text-center block px-4 py-2 text-slate-400 hover:text-white text-sm font-bold transition-colors"
           >
             登出系統
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {!selectedProject && activeTab === 'dashboard' ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Building2 size={64} className="mb-4 opacity-20" />
            <h2 className="text-xl font-bold">請由左側選擇專案進入管理</h2>
          </div>
        ) : activeTab === 'users' ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">帳號管理</h2>
                <p className="text-slate-500">管理系統所有巡檢員與管理員帳號權限</p>
              </div>
              <button 
                onClick={() => { setEditingUser(null); setShowUserModal(true); }}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition-all"
              >
                <UserPlus size={20} />
                <span>新增帳號</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-4 px-6 font-bold text-slate-500 text-xs uppercase tracking-wider">用戶名稱</th>
                    <th className="py-4 px-6 font-bold text-slate-500 text-xs uppercase tracking-wider">登入帳號</th>
                    <th className="py-4 px-6 font-bold text-slate-500 text-xs uppercase tracking-wider">角色權限</th>
                    <th className="py-4 px-6 font-bold text-slate-500 text-xs uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                            {u.name[0]}
                          </div>
                          <span className="font-bold text-slate-900">{u.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-600 font-mono text-sm">{u.username}</td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'admin' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}>
                          {u.role === 'admin' ? '管理員' : '巡檢員'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => { setEditingUser(u); setShowUserModal(true); }}
                            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          {u.username !== 'admin' && (
                            <button 
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
            {/* Dashboard Content */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">{selectedProject?.name || '請選擇專案'}</h2>
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
              <button
                onClick={fetchProjectDefects}
                className="flex items-center gap-2 px-6 py-3 bg-white text-slate-900 border border-slate-200 font-bold rounded-xl hover:bg-slate-50 shadow-sm transition-all"
              >
                <Printer size={18} />
                <span>列印專案總表</span>
              </button>
            </div>

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
                                      ? 'bg-red-50/50 border-red-200 shadow-sm' 
                                      : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}>
                                  <button
                                    onClick={() => fetchUnitDefects(status.unitId, key)}
                                    className="flex flex-col items-center gap-1 mb-2 hover:opacity-80 transition-opacity"
                                  >
                                    <div className="flex items-center gap-1">
                                      {status.isInspected ? (
                                        <CheckCircle2 size={16} className="text-green-600" />
                                      ) : (
                                        <AlertCircle size={16} className={status.defectCount > 0 ? "text-red-500" : "text-slate-300"} />
                                      )}
                                      <span className={`text-sm font-bold ${
                                        status.isInspected ? 'text-green-700' : status.defectCount > 0 ? 'text-red-600' : 'text-slate-600'
                                      }`}>
                                        {status.defectCount} 缺失
                                      </span>
                                    </div>
                                    {status.isInspected && (
                                      <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 rounded uppercase">已鎖定</span>
                                    )}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleLock(key, status.isInspected, status.unitId); }}
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

      {/* User Modal */}
      <AnimatePresence>
        {showUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowUserModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Shield size={20} />
                  </div>
                  <h3 className="font-bold text-xl">{editingUser ? '編輯帳號' : '新增帳號'}</h3>
                </div>
                <button onClick={() => setShowUserModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <form className="p-8 space-y-6" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveUser(Object.fromEntries(formData));
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">用戶姓名</label>
                    <input name="name" defaultValue={editingUser?.name} required className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="例如：王小明" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">登入帳號</label>
                    <div className="relative">
                      <Users size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input name="username" defaultValue={editingUser?.username} required className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="inspector_01" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">
                      {editingUser ? '變更密碼 (留空則不修改)' : '預設密碼'}
                    </label>
                    <div className="relative">
                      <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input name="password" type="password" required={!editingUser} className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="••••••••" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">權限角色</label>
                    <select name="role" defaultValue={editingUser?.role || 'user'} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none">
                      <option value="user">巡檢員 (User)</option>
                      <option value="admin">管理員 (Admin)</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 py-3 font-bold text-slate-600 hover:bg-slate-50 rounded-xl">取消</button>
                  <button type="submit" className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg">儲存帳號</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DefectDetailModal */}
      <AnimatePresence>
        {showDefectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowDefectModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">{activeUnitInfo?.key} 缺失清單</h3>
                    <p className="text-slate-400 text-xs">共 {activeUnitDefects.length} 筆缺失紀錄</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleClearUnit}
                    disabled={activeUnitDefects.length === 0 || isDeleting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600/10 text-red-500 border border-red-600/20 rounded-xl hover:bg-red-600 hover:text-white transition-all text-sm font-bold disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    一鍵清空全戶
                  </button>
                  <button onClick={() => setShowDefectModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {activeUnitDefects.length === 0 ? (
                  <div className="py-20 text-center text-slate-400">
                    <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-bold">目前無任何缺失紀錄</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {activeUnitDefects.map((defect) => (
                      <div key={defect.id} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-start gap-4">
                          <div>
                            <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded uppercase mb-1">
                              {defect.category}
                            </span>
                            <h4 className="font-bold text-slate-900">{defect.name}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">{defect.area} | {defect.status}</p>
                          </div>
                          <button 
                            onClick={() => handleDeleteDefect(defect.id)}
                            disabled={isDeleting}
                            className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="刪除此項缺失"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        
                        {defect.description && (
                          <div className="px-4 py-3 text-sm text-slate-600 border-b border-slate-100 italic bg-white/50">
                            「{defect.description}」
                          </div>
                        )}
                        
                        <div className="p-4 flex gap-2 overflow-x-auto bg-slate-100/50">
                          {defect.photos?.map((photo: string, idx: number) => (
                            <img 
                              key={idx} 
                              src={photo} 
                              alt="缺失照片" 
                              className="w-20 h-20 object-cover rounded-lg border border-white shadow-sm hover:scale-105 transition-transform cursor-pointer"
                              onClick={() => window.open(photo, '_blank')}
                            />
                          ))}
                          {(!defect.photos || defect.photos.length === 0) && (
                            <div className="w-full text-center py-4 text-xs text-slate-300 font-bold uppercase tracking-widest">
                              無現場照片
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                <button 
                  onClick={() => setShowDefectModal(false)}
                  className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg transition-all"
                >
                  關閉視窗
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Project Report Modal */}
      <AnimatePresence>
        {showProjectReportModal && (
          <div className="fixed inset-0 z-50 flex flex-col bg-white">
            <div className="h-16 border-b border-slate-200 flex items-center justify-between px-8 no-print shrink-0 bg-slate-50">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowProjectReportModal(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600"
                >
                  <ArrowLeft size={20} />
                </button>
                <h3 className="font-bold text-lg">專案缺失項目總表預覽 - {selectedProject?.name}</h3>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <SortAsc size={16} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-500 uppercase">排序方式</span>
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-sm font-bold bg-transparent outline-none border-none focus:ring-0"
                  >
                    <option value="floor">按樓層排序</option>
                    <option value="unit">按戶別排序</option>
                    <option value="category">按工項類別排序</option>
                  </select>
                </div>
                
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg transition-all"
                >
                  <Printer size={18} />
                  <span>列印報表 (A4)</span>
                </button>
                
                <button onClick={() => setShowProjectReportModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-12 print:p-0">
              <div className="max-w-[210mm] mx-auto bg-white print:max-w-none print:w-full">
                <div className="text-center mb-12">
                  <h1 className="text-3xl font-bold mb-2">建築驗收缺失總表 - {selectedProject?.name}</h1>
                  <p className="text-slate-500">報表產出時間: {new Date().toLocaleString()}</p>
                </div>

                <table className="w-full border-collapse border border-slate-200 text-sm print:text-[11px]">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border border-slate-200 p-2 text-center w-[6%]">流水號</th>
                      <th className="border border-slate-200 p-2 text-left w-[8%]">棟別</th>
                      <th className="border border-slate-200 p-2 text-left w-[12%]">戶別</th>
                      <th className="border border-slate-200 p-2 text-left w-[12%]">工項</th>
                      <th className="border border-slate-200 p-2 text-left w-[44%]">缺失說明</th>
                      <th className="border border-slate-200 p-2 text-left w-[18%]">照片</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedDefects().map((d, idx) => (
                      <tr key={idx} className="break-inside-avoid">
                        <td className="border border-slate-200 p-2 text-center text-slate-400">{idx + 1}</td>
                        <td className="border border-slate-200 p-2 text-center">{d.building}</td>
                        <td className="border border-slate-200 p-2 text-center font-bold">{d.floor}-{d.unit_number}</td>
                        <td className="border border-slate-200 p-2 text-xs text-blue-600 font-bold">{d.category}</td>
                        <td className="border border-slate-200 p-2 font-medium">
                          <div className="font-bold text-slate-900">{d.name}</div>
                          {d.description && (
                            <div className="text-xs text-slate-500 mt-1 italic leading-relaxed">
                              「{d.description}」
                            </div>
                          )}
                          {d.area && (
                            <div className="mt-1 text-[10px] text-slate-400">
                              區域：{d.area}
                            </div>
                          )}
                        </td>
                        <td className="border border-slate-200 p-2">
                          {d.photos && d.photos.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {d.photos.slice(0, 3).map((photo: string, pIdx: number) => (
                                <img 
                                  key={pIdx} 
                                  src={photo} 
                                  alt="缺失照片" 
                                  className="w-12 h-12 object-cover rounded border border-slate-100" 
                                />
                              ))}
                              {d.photos.length > 3 && <span className="text-[9px] text-slate-400 self-end">+{d.photos.length - 3}</span>}
                            </div>
                          ) : (
                            <span className="text-zinc-300 text-[9px] italic">無照片</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {projectDefects.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-20 text-center text-slate-400 font-bold italic">目前該專案無任何缺失紀錄</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                
                <div className="mt-12 text-center text-slate-400 text-[10px] border-t pt-4">
                  報告結束 • 建築驗收管理系統產出
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
