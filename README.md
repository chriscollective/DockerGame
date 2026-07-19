# Docker 大航海 — The Container Voyage

互動式 Docker 教學網頁遊戲。你是「鯨魚港」的貨櫃見習生，跟著鯨魚船長從 `hello-world` 一路學到 `docker compose`，最終獲授「鯨魚港港務長（Harbour Master）」。

## 怎麼玩

直接雙擊 `index.html` 用瀏覽器開啟即可，零依賴、免安裝、免 build。
建議用桌面瀏覽器（寬度 ≥1280px）遊玩，進度自動存在 localStorage。

## 內容

10 道循序漸進的關卡：

| # | 關卡 | 學到什麼 |
|---|------|----------|
| 1 | 貨櫃與大船 | Container vs VM、共用 kernel |
| 2 | 第一個貨櫃 | `docker run` 的完整流程 |
| 3 | 藍圖倉庫 | image、registry、tag、`pull` |
| 4 | 碼頭大掃除 | 生命週期：`ps` / `stop` / `start` / `rm` |
| 5 | 開通管線 | port mapping（`-p`）、`-d`、port 衝突 |
| 6 | 深入貨櫃 | `logs` / `exec` / `--name` / `-e` 除錯 |
| 7 | 不沉的保險庫 | volume 與資料持久化 |
| 8 | 藍圖設計師 | Dockerfile、layer、build cache |
| 9 | 開通內線 | network、容器名 DNS |
| 10 | 港務長 | docker compose 總整合 |

玩法：在模擬終端機打真實的 docker 指令（行為擬真，含錯誤訊息）、港口舞台即時視覺化容器狀態，穿插拖拉小遊戲、星等、XP、知識徽章圖鑑。

## 開發

- 純 HTML/CSS/JS，無任何外部依賴（含字體、CDN）。
- 模擬 Docker 引擎在 `js/engine.js`（與 DOM 解耦），測試：`node tests/engine.test.mjs`。
