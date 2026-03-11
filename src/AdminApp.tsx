import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import { Building2, Layers, Unlock, Lock, AlertCircle, CheckCircle2, LogOut, ArrowLeft, Users, UserPlus, Edit2, Trash2, X, Shield, Key, Printer, SortAsc } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Project {
  id: string;
  name: string;
  has_buildings: boolean;
  buildings: {
    name: string;
    layout: {
      floor: string;
      items: string[];
    }[];
  }[];
}

export default function AdminApp() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('inspect_token'));
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('inspect_user') || 'null'));

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('A棟');
  const [defectCounts, setDefectCounts] = useState<Record<string, { defectCount: number, isInspected: boolean, unitId: string }>>({});
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'projects'>('dashboard');
  const [users, setUsers] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  const [showProjectModal, setShowProjectModal] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingBuildings, setEditingBuildings] = useState<{name: string, layout: {floor: string, items: string[]}[]}[]>([]);
  const [editingActiveBuilding, setEditingActiveBuilding] = useState<string>('');
  const [buildingsInputText, setBuildingsInputText] = useState<string>('A棟, B棟');
  const [batchItemsInput, setBatchItemsInput] = useState<string>('');
  
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [activeUnitDefects, setActiveUnitDefects] = useState<any[]>([]);
  const [activeUnitInfo, setActiveUnitInfo] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [showProjectReportModal, setShowProjectReportModal] = useState(false);
  const [projectDefects, setProjectDefects] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'floor' | 'unit' | 'category'>('floor');

  const getActiveBuildings = () => {
    if (!selectedProject) return [];
    if (!selectedProject.has_buildings) return ['無分棟'];
    return selectedProject.buildings?.map(b => b.name) || [];
  };
  const getActiveColumns = () => {
    return []; // deprecated for table rendering, kept for backward compatibility if missed
  };

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

  const fetchProjects = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'admin' || !token) return;
    fetchProjects();
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

  // Adjust selected building if project changes
  useEffect(() => {
    if (selectedProject) {
      const buildings = getActiveBuildings();
      if (!buildings.includes(selectedBuilding) && buildings.length > 0) {
        setSelectedBuilding(buildings[0]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  // Load layout into editing state when opening modal
  useEffect(() => {
    if (showProjectModal) {
      if (editingProject) {
        setEditingBuildings(JSON.parse(JSON.stringify(editingProject.buildings || [])));
        setBuildingsInputText(editingProject.buildings?.map(b => b.name).join(', ') || '');
        if (editingProject.buildings?.length > 0) {
          setEditingActiveBuilding(editingProject.buildings[0].name);
        } else {
          setEditingActiveBuilding('');
        }
      } else {
        setEditingBuildings([]);
        setEditingActiveBuilding('');
        setBuildingsInputText('A棟, B棟');
      }
      setBatchItemsInput('');
    }
  }, [showProjectModal, editingProject]);

  const syncBuildingsInput = () => {
    const names = buildingsInputText.split(',').map(s => s.trim()).filter(Boolean);
    const newBuildings = names.map(n => {
      const existing = editingBuildings.find(b => b.name === n);
      return existing ? existing : { name: n, layout: [] };
    });
    setEditingBuildings(newBuildings);
    if (!names.includes(editingActiveBuilding) && newBuildings.length > 0) {
      setEditingActiveBuilding(newBuildings[0].name);
    }
  };

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

  const handleSaveProject = async (projectData: any) => {
    try {
      const url = editingProject ? `/api/admin/projects/${editingProject.id}` : '/api/admin/projects';
      const method = editingProject ? 'PUT' : 'POST';
      
      const payload = {
        id: projectData.id,
        name: projectData.name,
        has_buildings: projectData.has_buildings === 'true',
        buildings: editingBuildings,
      };

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.status === 401 || res.status === 403) {
        const data = await res.json();
        if (data.error?.includes('token') || data.error?.includes('Admin access')) {
          alert('驗證過期或無效，請重新登入');
          handleLogout();
          return;
        }
      }

      if (res.ok) {
        setShowProjectModal(false);
        setEditingProject(null);
        fetchProjects();
        if (selectedProject?.id === projectData.id) {
          // Refresh selected project details
          const updated = await fetch('/api/projects', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json());
          setSelectedProject(updated.find((p: Project) => p.id === projectData.id) || null);
        }
      } else {
        const data = await res.json();
        alert(`儲存失敗: ${data.error || '未知錯誤'}`);
      }
    } catch (err) {
      console.error('Save error:', err);
      alert(`系統錯誤: ${err instanceof Error ? err.message : '連線失敗'}`);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!window.confirm(`警告：這將會刪除專案「${name}」的所有資料（包含戶別、缺失、照片等），確定要刪除嗎？`)) return;
    
    try {
      const res = await fetch(`/api/admin/projects/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchProjects();
        if (selectedProject?.id === id) setSelectedProject(null);
      } else {
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
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col no-print shrink-0 md:h-screen md:sticky md:top-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">系統管理員</h1>
            <span className="text-xs text-slate-400">巡檢進度中控台</span>
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
          <button
            onClick={() => setActiveTab('projects')}
            className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${
              activeTab === 'projects' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 text-slate-400'
            }`}
          >
            <Layers size={18} />
            <span className="font-bold text-sm">專案管理</span>
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
              {/* Desktop View: Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-4 px-6 font-bold text-slate-500 text-xs uppercase tracking-wider">用戶名稱</th>
                      <th className="py-4 px-6 font-bold text-slate-500 text-xs uppercase tracking-wider">登入帳號</th>
                      <th className="py-4 px-6 font-bold text-slate-500 text-xs uppercase tracking-wider">角色權限</th>
                      <th className="py-4 px-6 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold shrink-0">
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
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
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

              {/* Mobile View: Cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {users.map(u => (
                  <div key={u.id} className="p-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold shrink-0">
                          {u.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-xs text-slate-500 font-mono">{u.username}</div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}>
                        {u.role === 'admin' ? '管理員' : '巡檢員'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => { setEditingUser(u); setShowUserModal(true); }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-50 text-slate-600 font-bold text-sm rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-200"
                      >
                        <Edit2 size={16} />
                        修改
                      </button>
                      {u.username !== 'admin' && (
                        <button 
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-500 font-bold text-sm rounded-xl hover:bg-red-100 transition-all border border-red-100"
                        >
                          <Trash2 size={16} />
                          刪除
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'projects' ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">專案管理</h2>
                <p className="text-slate-500">設定各專案的樓層、戶別與公共空間</p>
              </div>
              <button 
                onClick={() => { setEditingProject(null); setShowProjectModal(true); }}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition-all"
              >
                <Building2 size={20} />
                <span>新增專案</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.map(p => (
                <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1">[{p.id}] {p.name}</h3>
                      <p className="text-sm text-slate-500">{p.has_buildings ? '有分棟' : '無分棟'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setEditingProject(p); setShowProjectModal(true); }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteProject(p.id, p.name)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3 flex-1">
                    {p.has_buildings && (
                      <div>
                        <span className="text-xs font-bold text-slate-400 block mb-1">棟別</span>
                        <div className="flex flex-wrap gap-1">
                          {p.buildings?.map(b => (
                            <span key={b.name} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">{b.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-bold text-slate-400 block mb-1">樓層 (共 {p.buildings?.reduce((acc, b) => acc + (b.layout?.length || 0), 0) || 0} 層)</span>
                      <div className="text-sm text-slate-700 max-h-12 overflow-hidden text-ellipsis line-clamp-2">
                        {p.buildings?.flatMap(b => b.layout?.map(l => l.floor)).join(', ') || '尚未設定'}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-400 block mb-1">戶別 / 區域 (共 {p.buildings?.reduce((acc, b) => acc + (b.layout?.reduce((acc2, l) => acc2 + (l.items?.length || 0), 0) || 0), 0) || 0} 區)</span>
                      <div className="flex flex-wrap gap-1">
                        {/* Display a unique list of items across all floors as a preview */}
                        {Array.from(new Set(p.buildings?.flatMap(b => b.layout?.flatMap(l => l.items) || []) || [])).slice(0, 10).map(u => (
                          <span key={u as string} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs">{u as string}</span>
                        ))}
                        {(Array.from(new Set(p.buildings?.flatMap(b => b.layout?.flatMap(l => l.items) || []) || [])).length > 10) && (
                          <span className="text-xs text-slate-400 mt-0.5">...</span>
                        )}
                        {(!p.buildings?.length || p.buildings.every(b => !b.layout?.length)) && <span className="text-xs text-slate-400 italic">尚未設定</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                <div className="col-span-1 md:col-span-2 text-center py-20 text-slate-400">
                  <Building2 size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-bold">目前無任何專案，請新增專案</p>
                </div>
              )}
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
              <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto max-w-full">
                {getActiveBuildings().map(b => (
                  <button
                    key={b}
                    onClick={() => setSelectedBuilding(b)}
                    className={`px-6 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
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

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overscroll-contain">
              <div className="space-y-6">
                {(selectedProject?.has_buildings 
                  ? [...(selectedProject?.buildings?.find(b => b.name === selectedBuilding)?.layout || [])]
                  : [...(selectedProject?.buildings?.[0]?.layout || [])]
                ).reverse().map((floorData, idx) => (
                  <div key={idx} className="flex flex-col xl:flex-row gap-4">
                    <div className="xl:w-32 shrink-0 py-2">
                      <div className="bg-slate-100/80 px-4 py-3 rounded-xl font-bold text-slate-800 text-lg text-center shadow-sm border border-slate-200">
                        {floorData.floor}
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-wrap gap-3">
                      {floorData.items.map((item: string, itemIdx: number) => {
                        const key = `${floorData.floor}-${item}`;
                        const status = defectCounts[key];
                        
                        return (
                          <div key={itemIdx} className="w-full sm:w-[calc(50%-0.375rem)] md:w-[calc(33.333%-0.5rem)] lg:w-[calc(25%-0.5625rem)] xl:w-48 shrink-0">
                            <div className={`h-full flex flex-col justify-between p-3 rounded-xl border transition-all ${
                              !status?.unitId 
                                ? 'bg-slate-50 border-slate-200 border-dashed opacity-70' 
                                : status.isInspected 
                                  ? 'bg-green-50/50 border-green-200 shadow-sm' 
                                  : status.defectCount > 0 
                                    ? 'bg-red-50/50 border-red-200 shadow-sm' 
                                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                            }`}>
                              
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-slate-800">{item}</span>
                                {status?.isInspected && (
                                  <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded uppercase">已鎖定</span>
                                )}
                              </div>
                              
                              {!status?.unitId ? (
                                <div className="text-xs text-slate-400 font-bold py-3 text-center">未建立巡檢資料</div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => fetchUnitDefects(status.unitId, key)}
                                    className="flex items-center gap-1.5 group mb-3 hover:opacity-80 transition-opacity"
                                  >
                                    {status.isInspected ? (
                                      <CheckCircle2 size={16} className="text-green-600" />
                                    ) : (
                                      <AlertCircle size={16} className={status.defectCount > 0 ? "text-red-500" : "text-slate-300 group-hover:text-blue-500"} />
                                    )}
                                    <span className={`text-sm font-bold ${
                                      status.isInspected ? 'text-green-700' : status.defectCount > 0 ? 'text-red-600' : 'text-slate-600 group-hover:text-blue-600'
                                    }`}>
                                      {status.defectCount} 項缺失
                                    </span>
                                  </button>
                                  
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleLock(key, status.isInspected, status.unitId); }}
                                    className={`flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-bold transition-all ${
                                      status.isInspected 
                                        ? 'bg-white border border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200' 
                                        : 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm'
                                    }`}
                                  >
                                    {status.isInspected ? (
                                      <><Unlock size={14} /> 強制解鎖</>
                                    ) : (
                                      <><Lock size={14} /> 強制鎖定</>
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      
                      {(!floorData.items || floorData.items.length === 0) && (
                        <div className="w-full flex items-center justify-center py-6 text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          該樓層無設定戶別/公設
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {(!selectedProject?.buildings || selectedProject.buildings.every(b => !b.layout || b.layout.length === 0)) && (
                  <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500">
                    <Building2 size={40} className="mx-auto mb-3 opacity-20" />
                    請至「專案管理」設定各棟別/樓層的戶別配置
                  </div>
                )}
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
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
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

      {/* Project Modal */}
      <AnimatePresence>
        {showProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowProjectModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Building2 size={20} />
                  </div>
                  <h3 className="font-bold text-xl">{editingProject ? '編輯專案設定' : '新增專案'}</h3>
                </div>
                <button onClick={() => setShowProjectModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <form className="flex-1 overflow-y-auto" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveProject(Object.fromEntries(formData));
              }}>
                <div className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">專案編號 (ID)</label>
                      <input name="id" defaultValue={editingProject?.id} readOnly={!!editingProject} required className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none read-only:bg-slate-100 read-only:text-slate-400" placeholder="例如：KY85" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">專案名稱</label>
                      <input name="name" defaultValue={editingProject?.name} required className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="例如：國揚數位案" />
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-6">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">網格基礎參數</label>
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-4 mb-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="has_buildings" value="true" defaultChecked={editingProject ? editingProject.has_buildings : true} className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-bold text-slate-700">有分棟</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="has_buildings" value="false" defaultChecked={editingProject ? !editingProject.has_buildings : false} className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-bold text-slate-700">無分棟 (單棟)</span>
                          </label>
                        </div>
                        <div className="flex gap-2 items-center mt-2">
                          <input 
                            name="buildings" 
                            value={buildingsInputText}
                            onChange={(e) => setBuildingsInputText(e.target.value)}
                            onBlur={syncBuildingsInput}
                            className="flex-1 px-4 py-2 bg-white rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-600" 
                            placeholder="A棟, B棟, C棟... (以半形逗號分隔)" 
                          />
                          <button type="button" onClick={syncBuildingsInput} className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-sm rounded-lg hover:bg-slate-300 transition-colors">
                            套用新棟別
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">若選擇「無分棟」，仍可留空，系統將自動以單棟處理。每次修改棟別名稱後，請點擊套用以更新下方頁籤。</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-6">
                    {editingBuildings.length > 0 && (
                      <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto mb-4">
                        {editingBuildings.map(b => (
                          <button
                            key={b.name}
                            type="button"
                            onClick={() => setEditingActiveBuilding(b.name)}
                            className={`px-4 py-1.5 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
                              editingActiveBuilding === b.name ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                          >
                            {b.name}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-500 uppercase">
                      <label>目前編輯：{editingActiveBuilding || '未選擇棟別'} (Layout Builder)</label>
                      <button 
                        type="button"
                        onClick={() => {
                          const activeIdx = editingBuildings.findIndex(b => b.name === editingActiveBuilding);
                          if (activeIdx === -1) return;
                          const newB = [...editingBuildings];
                          const num = newB[activeIdx].layout.length + 1;
                          newB[activeIdx].layout.unshift({ floor: `${num}F`, items: [] });
                          setEditingBuildings(newB);
                        }}
                        className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        + 新增樓層
                      </button>
                    </div>

                    <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200 mb-4">
                      <span className="text-xs font-bold text-yellow-800 mb-2 block">⚡ 從此處能快速填入 {editingActiveBuilding || ''} 全棟單層配置</span>
                      <div className="flex gap-2">
                        <input 
                          value={batchItemsInput}
                          onChange={(e) => setBatchItemsInput(e.target.value)}
                          placeholder="例如: 1戶, 2戶, 3戶, 大廳" 
                          className="flex-1 px-3 py-2 text-sm bg-white border border-yellow-300 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            if (!batchItemsInput.trim() || !editingActiveBuilding) return;
                            const items = batchItemsInput.split(',').map(s => s.trim()).filter(Boolean);
                            const activeIdx = editingBuildings.findIndex(b => b.name === editingActiveBuilding);
                            if (activeIdx === -1) return;
                            
                            const newB = [...editingBuildings];
                            newB[activeIdx].layout = newB[activeIdx].layout.map(l => ({ ...l, items: [...items] }));
                            setEditingBuildings(newB);
                          }}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                        >
                          一鍵套用
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {editingBuildings.find(b => b.name === editingActiveBuilding)?.layout.map((floorData, floorIndex) => (
                        <div key={floorIndex} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row gap-3 items-start md:items-center">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => {
                              const activeIdx = editingBuildings.findIndex(b => b.name === editingActiveBuilding);
                              const newB = [...editingBuildings];
                              newB[activeIdx].layout.splice(floorIndex, 1);
                              setEditingBuildings(newB);
                            }} className="text-slate-400 hover:text-red-500 p-1">
                              <X size={14} />
                            </button>
                            <input 
                              value={floorData.floor}
                              onChange={(e) => {
                                const activeIdx = editingBuildings.findIndex(b => b.name === editingActiveBuilding);
                                const newB = [...editingBuildings];
                                newB[activeIdx].layout[floorIndex].floor = e.target.value;
                                setEditingBuildings(newB);
                              }}
                              className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-center outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="flex-1 flex flex-wrap gap-2 items-center w-full">
                            {floorData.items.map((item, itemIndex) => (
                              <div key={itemIndex} className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden group">
                                <input 
                                  value={item}
                                  onChange={(e) => {
                                    const activeIdx = editingBuildings.findIndex(b => b.name === editingActiveBuilding);
                                    const newB = [...editingBuildings];
                                    newB[activeIdx].layout[floorIndex].items[itemIndex] = e.target.value;
                                    setEditingBuildings(newB);
                                  }}
                                  className="w-16 md:w-20 px-2 py-1.5 text-xs text-center outline-none bg-transparent"
                                />
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const activeIdx = editingBuildings.findIndex(b => b.name === editingActiveBuilding);
                                    const newB = [...editingBuildings];
                                    newB[activeIdx].layout[floorIndex].items.splice(itemIndex, 1);
                                    setEditingBuildings(newB);
                                  }}
                                  className="bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 px-1.5 py-1.5 h-full border-l border-slate-100 transition-colors"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                            <button 
                              type="button"
                              onClick={() => {
                                const activeIdx = editingBuildings.findIndex(b => b.name === editingActiveBuilding);
                                const newB = [...editingBuildings];
                                newB[activeIdx].layout[floorIndex].items.push(`新戶別`);
                                setEditingBuildings(newB);
                              }}
                              className="w-8 h-7 flex items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                      {(!editingBuildings.find(b => b.name === editingActiveBuilding)?.layout || editingBuildings.find(b => b.name === editingActiveBuilding)?.layout.length === 0) && (
                        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                          請先點擊上方「+ 新增樓層」來建立網格
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-200 flex gap-3 shrink-0">
                  <button type="button" onClick={() => setShowProjectModal(false)} className="flex-1 py-3 font-bold text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl transition-all">取消</button>
                  <button type="submit" className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg">儲存設定</button>
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
