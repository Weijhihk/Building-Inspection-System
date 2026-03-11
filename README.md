# Building Inspection System | 建築物驗收系統

A robust building inspection system designed for enterprise-scale quality control and progress tracking.
一套專為企業級工程品質控管與進度追蹤設計的建築物驗收系統。

---

## 🇹🇼 繁體中文操作說明 (Traditional Chinese)

### 1. 系統環境準備
* **Node.js**: 建議使用 v20 或更新版本。
* **資料庫**: 系統使用 **PostgreSQL (Docker)**，請確保本機已安裝 Docker 並執行 `docker-compose up -d`。

### 2. 快速啟動
1. 安裝套件：`npm install`
2. 啟動資料庫：`docker-compose up -d`
3. 建立並設定 `.env` 檔案。
4. 啟動開發伺服器：`npm run dev`
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

---

## 🇺🇸 English Instructions

### 1. Prerequisites
* **Node.js**: v20+ recommended.
* **Database**: Uses **PostgreSQL (Docker)**. Run `docker-compose up -d` to start.

### 2. Installation & Setup
1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
   * The system runs concurrently (Vite on port 3000, Express on 3001).

### 3. Demo Accounts
* **Admin**: `admin` / `admin123`
* **Inspector**: `user` / `user123`

### 4. Key Features
* **Inspection Flow**: Floor plan marking, photo uploads (Base64), and unit locking.
* **Admin Controls**: Master lock/unlock toggle, project-wide monitoring, and user CRUD management.

---

## Deployment
This project is configured to automatically deploy to GitHub Pages via GitHub Actions whenever changes are pushed to the `main` branch. 

**Base Path**: `/Building-Inspection-System/`
**CI/CD**: `.github/workflows/deploy.yml`

