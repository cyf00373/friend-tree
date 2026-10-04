# 朋友關係樹 v1：放上 GitHub Pages 教學

這一版的資料**只存在你自己的手機裡**，不會上傳到任何地方。GitHub 只是用來放 App 的網頁檔案，別人打開同一個網址，看到的是一個空的 App，看不到你的資料。

全程用瀏覽器操作，不用安裝任何軟體，大約 10 分鐘。

---

## 步驟 1：註冊 GitHub（已經有帳號就跳過）

1. 打開 https://github.com/signup
2. 輸入 Email、密碼、使用者名稱。
   - **使用者名稱會出現在網址裡**，例如使用者名稱是 `ianchen`，網址就是 `ianchen.github.io`。
3. 完成 Email 驗證。

---

## 步驟 2：建立 repository（放檔案的地方）

1. 登入後，按右上角「**+**」→「**New repository**」。
2. Repository name 輸入：`friend-tree`
3. 選 **Public**（免費帳號要選 Public 才能用 GitHub Pages）。
   > Public 只代表 App 的程式碼公開，你的朋友資料存在手機裡，不會被看到。
4. 其他選項不用動，按「**Create repository**」。

---

## 步驟 3：上傳檔案

1. 在電腦上把 `friend-tree-github.zip` **解壓縮**。
2. 回到剛建立的 repository 頁面，點「**uploading an existing file**」這個連結。
3. 打開解壓縮後的 `friend-tree-github` 資料夾，**選取裡面所有的東西**（包含 `icons` 資料夾），整批拖進 GitHub 的網頁。
   - 要拖「資料夾裡面的東西」，不是拖整個 `friend-tree-github` 資料夾。
   - 上傳清單裡要看得到 `index.html`、`app.js`、`app.css`、`sw.js`、`manifest.webmanifest`，以及 `icons/` 底下的幾張圖。
4. 拉到頁面最下方，按綠色的「**Commit changes**」。

---

## 步驟 4：開啟 GitHub Pages

1. 在 repository 上方點「**Settings**」。
2. 左側選單點「**Pages**」。
3. 「Build and deployment」→ Source 選「**Deploy from a branch**」。
4. Branch 選「**main**」，資料夾選「**/ (root)**」，按「**Save**」。
5. 等 1～2 分鐘後重新整理頁面，上方會出現：

```
Your site is live at https://你的使用者名稱.github.io/friend-tree/
```

這就是你的 App 網址。

---

## 步驟 5：安裝到手機

### iPhone
1. 一定要用 **Safari** 打開 App 網址。
2. 按下方「分享」→「**加入主畫面**」→「新增」。
3. **之後都從主畫面的圖示打開**，不要再從 Safari 開。

> ⚠️ iPhone 的主畫面 App 和 Safari 的資料是**分開的**。資料存在哪邊就只在哪邊，所以請固定從主畫面圖示使用。
> 如果只用 Safari 開、沒有加入主畫面，iPhone 可能在 7 天沒打開後自動清掉資料。

### Android
1. 用 **Chrome** 打開 App 網址。
2. 右上角「⋮」→「**安裝應用程式**」（或「加到主畫面」）。
3. 從桌面圖示打開使用。

---

## 一定要做：定期備份

資料只存在手機裡，以下情況**資料會不見**：

- 刪掉主畫面上的 App 圖示
- 清除瀏覽器資料或快取
- 手機壞掉、遺失，或換新手機

**備份方法：**
1. 按 App 右上角的「**備份**」→「**匯出備份檔**」。
2. 存到 Google 雲端硬碟、iCloud 雲碟，或用 Email 寄給自己。

App 裡有 3 位以上朋友、而且超過 30 天沒備份時，「朋友卡片」頁上方會出現提醒。

**換手機／還原：**
1. 在新手機照步驟 5 安裝 App。
2. 按「備份」→「**從備份檔匯入**」，選擇之前存的 `.json` 檔。
3. 如果新手機上已經有資料，會問你要「合併」還是「全部取代」。

---

## 分享給團隊

把網址 `https://你的使用者名稱.github.io/friend-tree/` 傳給團隊。每個人照步驟 5 安裝，**各自的資料存在各自的手機裡**，彼此看不到。

---

## 更新 App

我給你新版檔案後：
1. 到 GitHub 的 `friend-tree` repository →「**Add file**」→「**Upload files**」。
2. 把新檔案拖進去（同名檔案會自動覆蓋）→「**Commit changes**」。
3. 等 1～2 分鐘，手機上把 App 完全關掉再打開兩次，就會是新版。

**更新 App 不會影響手機裡的資料。**

---

## 常見問題

**Q：打開網址顯示 404？**
剛開啟 Pages 需要等幾分鐘。也請確認 `index.html` 是放在 repository 的最外層，不是在某個資料夾裡面。

**Q：沒有網路可以用嗎？**
可以。打開過一次之後，沒網路也能開啟、新增和修改。

**Q：之後想改成雲端同步、Google 登入？**
之前做好的 Firebase 版本可以直接接手。先在這一版「匯出備份檔」，之後在新版「匯入」，資料就能搬過去。
