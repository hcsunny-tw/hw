# 作業繳交系統（Firebase + Google 登入）

## 快速開始
1. `git clone` 本專案或直接下載 zip。
2. 在 Firebase Console 建立專案，啟用 **Authentication → Sign-in method → Google**。
3. 啟用 **Firestore**（資料庫模式可先用測試規則）。
4. 於瀏覽器開啟 `index.html`：
   - 首次點「首次設定」，貼上 Firebase 專案的 Web App 設定（包含 apiKey、authDomain、projectId 等）。
   - 按「使用 Google 帳號登入」。
5. 登入後，主畫面會出現，名單與作業會同步到 Firestore：
   - `users/{uid}/data/roster`
   - `users/{uid}/assignments/*`

> 若登入後沒有畫面：請按 F12 查看 Console 是否有錯誤；本修正版已針對不存在的元素做防呆，正常不會因事件綁定中斷。
