# 專案開發與環境設置標準作業程序 (Project Setup SOP)

本文件旨在規範新專案的環境搭建、資安機制、互動模式及部署流程，確保系統的一致性與安全性。

---

## 一、 環境與基礎建設 (Infrastructure)

### 1. 資料庫配置 (Docker + PostgreSQL)
- **容器化**：新專案必須使用 `docker-compose.yml` 管理 PostgreSQL。
- **持久化**：務必設定 `volumes` 以確保資料不會因容器刪除而遺失。
- **初始化**：在 `server.js` 啟動時加入 `initDB` 邏輯，自動建立必要的細節 Table 與 Index。

### 2. 環境變數 (.env)
- 必須包含：`DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `JWT_SECRET`。
- **禁止提交**：`.env` 嚴禁進入 Git 倉庫，必須透過 `.gitignore` 排除。
- **範例檔**：提供 `.env.example` 並隱藏真實數值。

---

## 二、 資安防範與認證 (Security & Auth)

### 1. Token 安全機制
- **簽章模式**：使用 `crypto.createHmac('sha256', SECRET)` 實作帶有簽名的 Token。
- **欄位規範**：Payload 必須包含 `userId`, `username`, `role`。
- **中間件**：後端管理 API 必須套用 `adminOnly` 中間件進行兩段式驗證。

### 2. 角色校驗強化
- 比對角色字串時，應先執行 `.trim().toLowerCase()` 以防止資料庫與代碼間的大小寫衝突。
- 前端應偵測 `401/403` 錯誤，若 Token 失效應執行自動登出 (Session Recovery)。

---

## 三、 行動端互動規範 (Mobile Interaction)

### 1. 平面圖操作 (Naviation)
- **手勢限制**：全面取消單指拖拽地圖，避免與圖面元件衝突。
- **雙指操作**：移動地圖與縮放 (Zoom) 必須強制兩指操作，以確保與 Konva 渲染引擎的最佳相容性。
- **CSS**：Stage 元件必須設定 `touch-action: none`。

### 2. 圖釘與標記 (Pins)
- **建立方式**：取消「點擊建立」，改為「工具箱拖拽建立」，防止使用者在縮放或平移時誤觸產生髒數據。

---

## 四、 介面與回應式設計 (RWD Standards)

### 1. 列表管理
- **桌面版**：使用水平 Table 展示。
- **行動版**：轉化為 Card-based 佈局，並優化間距。
- **側邊欄**：在小螢幕時應自動調整為隱藏或浮動式，防止遮擋主體內容。

---

## 五、 版本控制與部署 (Git & Workflow)

### 1. 提交規範
- 每次異動後必須執行 `git status` 檢查是否有不慎加入的 `.env` 或 `dist` 資料夾。
- 使用 `git push origin main` 觸發 GitHub Actions。

### 2. 自動化部署
- 透過 `.github/workflows/deploy.yml` 進行靜態網頁編譯與 Pages 發布。
- 機密資訊（如 API 網址）應存在 GitHub Repository Secrets。

---

**更新日期：2026-03-11**
**適用範圍：建築巡檢管理系統及其衍生專案**
