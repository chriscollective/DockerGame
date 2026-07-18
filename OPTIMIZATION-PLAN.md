# 《Docker 大航海》最佳化計畫

> 審查日期：2026-07-18
> 方法：Codex CLI（獨立審查，reasoning=high）＋ 深讀 subagent（逐檔審計，20/20 測試通過）＋ 主線親自驗證關鍵 [P1]。
> 現況判定：**教學骨架與航海隱喻是強項，但有數處會「教錯 Docker 觀念」的正確性 bug，且多個通關條件太鬆、可用錯指令過關。** 這些是最該優先修的。

---

## ✅ 實作狀態（2026-07-18 於分支 `optimize/review-fixes` 完成）

- **已實作**：Group A 全部（A1–A10）、Group B 全部（B1–B5）、Group C 全部（C1–C4）、D1、Group E 的 E1–E6、F1。
- **測試**：`tests/engine.test.mjs` 20→**25** 個、新增 `tests/levels.test.mjs` **6** 個（DOM-free 載入關卡驗通關條件）；共 **31 個全過**。TDD：通關條件收緊都先寫「錯指令不該過」的失敗測試再改。
- **瀏覽器實測**：本機 HTTP server 全程零 console error；實跑第 6、10 關驗證 A1/A4/A6/A7/B2/C3/E1/E2/E4/E6。
- **刻意延後（低優先／結構性風險，見各群組說明）**：D2（第 7 關拆段）、D3（第 6 關加獨立 --name/-e 練習）、E7（矮螢幕版面）、E8（行動裝置 RWD，屬 ocean）、F2/F3（build size 硬編碼、pull 無 Already exists——純擬真度，不影響教學正確性）。

---

## 0. 一句話總結

遊戲好玩、隱喻貼切、20 個引擎測試都過；但目前會讓學習者建立**至少 5 個錯誤心智模型**（layer、port 可達性、前景服務、環境變數來源、bridge 網路），加上通關條件寬鬆讓「打錯也能過」。修掉教學正確性 + 收緊通關條件後，這會是一款可以放心分享的 Docker 教材。

---

## 1. 分組修正清單（依「教學傷害」排序）

### Group A — Docker 教學正確性（最高優先：會教錯觀念）

| ID | 問題 | 位置 | 事實 / 修法 |
|----|------|------|-------------|
| **A1** | 第 6 關修好容器**沒有 `-p`**，onDone 卻直接彈出 `http://localhost:3000` 可達 | `js/levels/levels05-07.js:141-146` | 真實 Docker 未 publish port，host 連不到容器 3000。這正好教了第 5 關剛警告的錯。**修法**：obj5 改用 `docker run -d -p 3000:3000 --name harbor-app -e MODE=harbor whale-app`，check 加驗 `-p 3000:3000`；否則就別顯示 `localhost:3000`（改成「容器內服務已恢復」不談外部可達）。 |
| **A2** | 「Dockerfile 每行 = 一個 layer」錯誤 | `js/levels/level08.js:76,168,175`、`js/config.js:116`(徽章 b8) | 只有 `RUN`/`COPY`/`ADD` 產生**檔案系統層**；`FROM` 是基底層，`WORKDIR`/`EXPOSE`/`CMD`/`ENV`/`LABEL` 是零體積 metadata。**修法**：卡片視覺區分「檔案系統層（發光磚）vs metadata 指令（薄片/標籤）」；build 輸出的 `[i/7]` 改成只對產生層的步驟計層；徽章文案改「部分指令會疊出唯讀層，並可快取重用」。 |
| **A3** | 前景服務容器立即返回控制權 | `js/cli.js:159-162` | 真實 `docker run nginx`（無 `-d`）會 attach 並卡住終端機直到停止。目前 sim 直接印 log 就返回，且第 5 關不要求 `-d`（見 W1），強化錯誤直覺。**修法**：非 `-d` 的長駐服務，sim 印完啟動 log 後顯示「（服務在前景執行中，Ctrl-C 結束…）」的 attach 狀態，或在教學層強制 `-d`；一次性容器（hello-world）維持返回。 |
| **A4** | 環境變數被建模成 image 內的檔案 | `js/config.js:87`(whale-app `config.txt`)、`js/levels/levels05-07.js:99,124,137` | 第 6 關要玩家 `cat config.txt` 看到 `MODE=<未設定>`，再用 `-e MODE=harbor` 修好——把「烤進 image 的預設設定檔」和「runtime 環境變數」混為一談。**修法**：教學卡明講「`config.txt` 是 image 內建的**預設**，`-e MODE=harbor` 是**啟動時覆蓋**，兩者不同來源」；或把病因改成 log 直接說「環境變數 MODE 未設定」，不要用 cat 檔案暗示 env 來自檔案。 |
| **A5** | `http://db:5432` 協定錯置 | `js/engine.js:257` | 5432 是 PostgreSQL 的 TCP port，不是 HTTP。**修法**：改成 `waiting for db at db:5432 (tcp)` 或 `tcp://db:5432`。 |
| **A6** | `compose up` 無 `-d` 卻當「背景艦隊出航」 | `js/cli.js:402,421`、`js/levels/levels09-10.js:235` | 真實 `docker compose up`（無 `-d`）會 attach logs、前景卡住。**修法**：第 10 關指令改 `docker compose up -d`，check 驗 `-d`；敘述維持「背景出航」。 |
| **A7** | `depends_on` 被框成「web 等 db 就緒」 | `js/levels/levels09-10.js:90,218`、`js/engine.js:257` | Compose 的 `depends_on` 只控**啟動順序**、不等服務 ready。**修法**：教學卡補一句「只保證 db 先啟動，不保證 db 已可連線；要等就緒需 healthcheck / 應用層重試」。 |
| **A8** | `latest` = 「最新」誤導 | `js/levels/levels02-04.js:67`、`js/config.js:106` | `latest` 只是**預設 tag 名**，不保證最新版本。**修法**：教學卡改「`latest` 是沒指定 tag 時的預設名字，不等於『最新版』」。 |
| **A9** | 預設 bridge「完全不通」過度絕對 | `js/config.js:118`、`js/levels/levels09-10.js:23`、`js/engine.js:342,346` | 預設 bridge 上容器**可用 IP 互通**，缺的是「自動容器名 DNS」。**修法**：文案改「預設 bridge 不能用**容器名**互相解析（需 IP）；自訂 network 才有內建 DNS」，模擬可讓 ping IP 成功、ping 名稱失敗。 |
| **A10** | 「`rm` 之後資料全部消失」需限定 | `js/levels/levels05-07.js:168` | 消失的是**容器可寫層**的資料；named volume / bind mount 不受影響。**修法**：加半句「（掛在 volume 或 bind mount 的資料不會，這正是下一步要學的）」。 |

### Group B — 通關條件太鬆（打錯指令也能過）

| ID | 問題 | 位置 | 修法 |
|----|------|------|------|
| **B1** | 第 5 關 obj1 只驗有 `8080:80` port，**不驗 image=nginx、不驗 `-d`**；obj3 只驗 host port=8081 | `js/levels/levels05-07.js:42-45,66-69` | obj1 check 加 `result.parsed.opts.image` 起頭為 `nginx` 且 `opts.detach===true`；obj3 加 `p.cont===80` 與 image/`-d`。（已親自驗證：`docker run -p 8080:80 redis` 現在會過。） |
| **B2** | 第 6 關 obj5 接受任何 truthy `MODE`、任何 image、任何 port 狀態 | `js/levels/levels05-07.js:141-144` | check 改 `c.imageRef` 起頭為 `whale-app` 且 `c.env.MODE==='harbor'`；若採 A1 的 `-p`，一併驗 published port。 |
| **B3** | 第 7 關掛載 db 只驗「容器名 db 有 volume treasure」，不驗 image / 掛載點 `/data` | `js/levels/levels05-07.js:230` | check 加驗 image=`harbor-db`、mount destination=`/data`。 |
| **B4** | 第 10 關 obj2 只驗 `cmd==='compose-up'`（靠 obj1 的 `flags.composed` 兜底） | `js/levels/levels09-10.js:239` | 低風險但可補：obj2 直接驗 compose 後 web/db 兩容器都 running 且同網路。 |
| **B5** | 第 2 關 obj2 `count>=1` 不驗容器是 exited | `js/levels/levels02-04.js:44` | 低風險（此關必然只有一個 exited）。可補驗「存在 status==='exited' 的容器」。 |

### Group C — 引擎 / 回饋邏輯

| ID | 問題 | 位置 | 修法 |
|----|------|------|------|
| **C1** | 「成功但偏題」的指令**不觸發任何提示**（自動 hint 只在指令失敗時累加） | `js/game.js:145` | 對「以狀態達標」的目標（4 關 obj3-6、6 關 obj5、7 關 obj4/8），若指令 `ok` 但目標仍未推進，累加一個「軟計數」並在 N 次後給「離題引導」。避免玩家卡住卻毫無回饋。 |
| **C2** | `check()` 例外被靜默吞掉 → 若某 check 恆拋例外，該關會無錯誤地永遠無法完成 | `js/game.js:136` | catch 內在 dev 模式 `console.warn` 印出 level/obj 與錯誤，方便回歸測試抓到。 |
| **C3** | 多指令目標，但 parser 不支援 `;` / `&&`（貼一整行 hint 會失敗） | `js/cli.js:18`、`js/levels/levels05-07.js:246`、`js/levels/levels09-10.js:60` | 二選一：(a) parser 支援 `;` / `&&` 逐條執行；(b) 把 hint 的多指令拆成一步一步、不呈現成單行可貼序列。 |
| **C4** | 地圖鈕中途離開無確認，重進 `startLevel` 重置引擎 → 靜默丟失關內進度 | `js/game.js:193,243` | 離開前 `showConfirm`「進度會重置，確定回港？」；或把關內進度快照存 store，重進時還原。 |

### Group D — 課程順序 / 難度節奏

| ID | 問題 | 位置 | 修法 |
|----|------|------|------|
| **D1** | `docker ps -a` 第 2 關就要用，卻在 `COMMAND_DEX` 註冊為 level 4、徽章 b4 也第 4 關才解鎖；第 2/3 關打 `help` 看不到 `ps` | `js/levels/levels02-04.js:39`、`js/config.js:128`、`js/cli.js:426` | 把 `docker ps [-a]` 在 COMMAND_DEX 的 learnedLevel 提前到 2；或第 2 關改只用 `docker ps -a` 並在該關教學卡正式介紹 `ps`。 |
| **D2** | 關卡長度落差大：第 7 關 9 個 objective、第 6 關 5 個、第 8 關排 7 卡＋build 兩次 | 第 7 關 `objectives`（9 項） | 第 7 關拆成兩段（「痛一次：資料沉海」→「保險庫：volume 持久」），中間給存檔點；避免中途疲勞。 |
| **D3** | 第 6 關收尾 obj5 一次塞 `rm -f`＋`run -d`＋`--name`＋`-e`，而 `--name`/`-e` 此關首次登場、沒單獨練 | `js/levels/levels05-07.js:137` | 先加一個只練 `--name` 或 `-e` 的中間 objective，再組合。 |
| **D4** | 「故意製造錯誤」的目標（5 關 obj2、9 關 obj1）與「成功才打勾」心智相反，初次困惑 | `js/levels/levels05-07.js:54`、`js/levels/levels09-10.js:45` | 文案明標「本目標**要你故意觸發錯誤**，看到紅字才算成功」，並在 UI 上用不同顏色標示「預期會失敗」的目標。 |

### Group E — UI / 可及性 / 版面

| ID | 問題 | 位置 | 修法 |
|----|------|------|------|
| **E1** | 通關全 10 關的「結業典禮」CSS 是**死碼**，從未接線 | `css/level.css:543-558`（`.finale-veil`/`.fleet-sail`）| 第 10 關結尾接上艦隊出航儀式，讓通關體驗對得上原設計意圖（目前只有 fireworks + modal）。 |
| **E2** | 任務目標清單在「摺線以下」，初次不 auto-scroll，玩家要手動往下捲才看到目標 | `js/game.js:53-76,88` | 進關後把左欄捲到「任務目標」區塊；或重排版讓目標在船長對話之上/並列。 |
| **E3** | 第 8 關指令卡是 `<div>` 綁 click/drag，**不能 Tab 聚焦、不能鍵盤操作**（與第 1/10 關用 `<button>` 不一致） | `js/levels/level08.js:99` | 卡片改 `<button>` 或加 `tabindex="0"` + `keydown`（Enter/方向鍵排序），與其它關一致。 |
| **E4** | 狀態僅以顏色區分（running 綠燈 / exited 灰階），色盲風險 | `css/harbor.css:213`、`.crate-lamp` | running/exited 加文字或圖形標籤（如 ▶ / ⏸ 或「RUN/STOP」小字）。 |
| **E5** | 終端表格用 `word-break: break-all`，`docker ps`/`images` 的欄位會從字中斷行、破版 | `css/level.css:196` | 表格型輸出改 `overflow-wrap: normal` + 容器 `overflow-x: auto` 橫向捲動。 |
| **E6** | Modal 無 Esc / 點遮罩關閉、無 focus trap | `js/ui/screens.js:154,194` | 加 Esc 關閉與遮罩點擊關閉（破壞性確認框可只留按鈕）；補基本 focus trap。 |
| **E7** | 固定高度佈局（topbar 58 + 舞台 1fr + 終端 302）在 ~1024×640 小筆電會擠壓、貨櫃列與 mini-browser 重疊 | `css/level.css:9,245`、`css/harbor.css:161` | 終端高度改 `min-height` + 可收合；或整體加 `min-height` 與捲動，避免重疊。 |
| **E8**（選配）| `<1024px` 全封鎖、無行動裝置支援 | `css/base.css:169` | 明確定位為桌面體驗即可保留；若要擴及平板，需重排 grid（超出本次核心範圍，列為 ocean）。 |

### Group F — 擬真度細節（低優先、不影響觀念）

- **F1** `docker network create` 印的 ID（`js/cli.js:360`，臨時亂數 64 hex）與 `network ls` 顯示的短 ID（`js/engine.js:399` 存的 12 hex）無關聯；真實 Docker 兩者前 12 碼一致。
- **F2** `build` 產物大小硬編碼 `156MB`（`js/engine.js:420`），不論 base image 皆同。
- **F3** `pull` 不顯示共享層的 `Already exists`（`js/cli.js:123`），每層都重跑 Downloading。

---

## 2. 實作路線圖（分階段，含 TDD）

> 現有測試：`node tests/engine.test.mjs`（20 個，全過）。每個「通關條件 / 引擎行為」修正都**先寫會失敗的測試**再改（例：先加一個「`docker run -p 8080:80 redis` 不該過第 5 關 obj1」的測試）。純文案/CSS 修正免測試先行，但改完仍跑全套確認沒弄壞。

**Phase 0 — 教學正確性止血（最高優先）**
A1、A2、A3、A4、A5、A7 ＋ 通關收緊 B1、B2
→ 這批直接決定「玩家會不會學到錯的 Docker」。A1 + B1 + B2 建議一起改（同屬 port 可達性主題）。
新增測試：第 5 關拒收 `redis`/缺 `-d`；第 6 關要求 `whale-app` + `MODE=harbor`（+ 若採 `-p` 驗 published port）。

**Phase 1 — 通關嚴謹 + 引擎回饋**
B3、B4、C1、C3、C4
→ 讓「打錯過關」與「卡住無回饋」消失。C1（偏題無提示）對新手體驗影響最大。

**Phase 2 — 觀念細修 + 課程順序**
A6、A8、A9、A10、D1、D3、D4、C2
→ 文案為主 + `ps` 課程順序修正 + 難度節奏。

**Phase 3 — 完成體驗 + 核心 UI**
E1（結業典禮接線）、E2（目標可見性）、E3（第 8 關鍵盤）、E4（色盲）、E5（表格破版）、E6（modal Esc）
→ 讓「破關」有應得的儀式感，並補齊可及性硬傷。

**Phase 4 — 選配 / 擬真度（可延後）**
D2（第 7 關拆段）、E7、E8（RWD）、F1、F2、F3

---

## 3. 驗收條件（每階段完成前逐條對驗）

- [ ] `node tests/engine.test.mjs` 全過，且**新增**涵蓋每個收緊後通關條件的測試（wrong-command 應失敗、right-command 應通過）。
- [ ] 手動走查第 5、6、7、10 關：用「錯誤但相近」的指令確認**過不了**；用正解確認**過得了**。
- [ ] 第 6 關若保留 `localhost:3000`，必須有對應的 `-p 3000:3000`（A1 與 B2 一致）。
- [ ] 第 8 關可純鍵盤完成（Tab + Enter/方向鍵）。
- [ ] 通關第 10 關會觸發結業典禮動畫（E1），不再是死碼。
- [ ] 全站文案不再出現：「每行=一層」「latest=最新」「bridge 完全不通」「rm 資料全部消失」等未限定敘述。

---

## 4. 非目標（本次不做 / ocean）

- 全面 RWD 手機版重排（E8 只做「明確定位桌面」或平板微調，不做手機重寫）。
- 真正跑 Docker daemon 的整合（維持 mock 引擎）。
- 新增關卡 / 新 Docker 主題（本次聚焦既有 10 關的正確性與體驗）。

---

## 附錄：審查來源對照

- **兩模型都抓到**：A2（layer）、A7（depends_on）、A9（bridge）。
- **Codex 獨有**：A1（第 6 關 port 可達）、A3（前景服務）、A5（db:5432）、A6（compose -d）、A8（latest）、B1（第 5 關通關）、C3（多指令）、C4（地圖丟進度）、E5（表格破版）。
- **subagent 獨有**：A4（env-var 當檔案）、D1（ps 課程順序）、E1（結業典禮死碼）、E2/E3/E4/E6（可及性）、E7/E8（版面/RWD）、F1（network id）。
- **主線親自驗證屬實**：B1（第 5 關 `levels05-07.js:42-45,66-69`）、A1（`:141-146`）、A3（`cli.js:159-162`）、A5（`engine.js:257`）。
