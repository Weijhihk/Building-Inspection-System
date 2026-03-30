# Building Inspection System | 建築物驗收系統

A robust building inspection system designed for enterprise-scale quality control and progress tracking.
一套專為企業級工程品質控管與進度追蹤設計的建築物驗收系統。

---

## 🇹🇼 繁體中文操作說明 (Traditional Chinese)

### 1. 系統環境準備
* **Node.js**: 建議使用 v20 或更新版本。
* **資料庫**: 系統目前預設使用 **SQLite** (`database.sqlite`)，本地開發無需安裝或啟動 Docker。
  * 若需切換回 PostgreSQL，請參考 `server.js` 內的 `Pool` 設定並恢復 `docker-compose.yml` 運行。

### 2. 快速啟動
1. 安裝套件：`npm install`
2. 檢查並設定 `.env` 檔案（參考 `.env.example`）。
3. 啟動開發伺服器：`npm run dev`
   * **前端主介面**: `http://localhost:3000/Building-Inspection-System/`
   * **後台管理系統**: `http://localhost:3000/Building-Inspection-System/admin`
   * **後端 API 伺服器**: `http://localhost:3001` (由並行指令自動啟動)

### 3. 登入測試帳號
* **系統管理員 (Admin)**
  * 帳號：`admin`
  * 密碼：`admin123`
  * 權限：完整存取，可進入後台管理專案鎖定與帳號。
* **現場巡檢員 (User)**
  * 帳號：`user`
  * 密碼：`user123`
  * 權限：僅能進行平面圖標記與缺失上傳。

### 4. 主要功能模組
* **驗收系統 (Front-end)**:
  * 選擇專案與樓層。
  * 在平面圖上點擊位置標記缺失。
  * 上傳缺失照片與詳細描述。
  * 「驗收完成」按鈕可鎖定該戶別，禁止進一步修改。
* **管理系統 (Admin Dashboard)**:
  * **控制中心**: 強制鎖定或解鎖特定戶別，即時監控全案驗收比例。
  * **帳號管理**: 新增、刪除或修改系統使用者權限。

### 5. 檔案格式規範
* **平面圖照片**: 請依照 `public/floorplans/README.txt` 規範進行命名（例如：`KY85_A_2F_0A.jpg`）。

---

## 🇺🇸 English Instructions

### 1. Prerequisites
* **Node.js**: v20+ recommended.
* **Database**: Uses **SQLite (database.sqlite)** by default. No Docker registration required for local development.

### 2. Installation & Setup
1. Install dependencies: `npm install`
2. Configure your `.env` file based on `.env.example`.
3. Start development server: `npm run dev`
   * The system runs concurrently (Vite on port 3000, Express on 3001).

### 3. Demo Accounts
* **Admin**: `admin` / `admin123`
* **Inspector**: `user` / `user123`

### 4. Key Features
* **Inspection Flow**: Floor plan marking, photo uploads, and unit locking.
* **Admin Controls**: Master lock/unlock toggle, project-wide monitoring, and user management.

---

## Deployment
This project is configured to automatically deploy to GitHub Pages via GitHub Actions whenever changes are pushed to the `main` branch. 

**Base Path**: `/Building-Inspection-System/`
**CI/CD**: `.github/workflows/deploy.yml`
