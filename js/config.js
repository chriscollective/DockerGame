/*
 * config.js — 全域常數與資料表（UMD：瀏覽器掛 window.DG.CONFIG，Node 走 module.exports）
 * 所有魔法值集中於此。
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = mod; }
  root.DG = root.DG || {};
  root.DG.CONFIG = mod;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STORAGE_KEY = 'docker-voyage-save-v1';

  // ---- 進度與獎勵 ----
  var LEVEL_COUNT = 10;
  var XP_BASE = 100;          // 過關基礎 XP
  var XP_PER_STAR = 50;       // 每顆星加成
  var RANKS = [
    { xp: 0,    title: '見習水手' },
    { xp: 300,  title: '貨櫃學徒' },
    { xp: 700,  title: '碼頭操作員' },
    { xp: 1200, title: '航線領航員' },
    { xp: 1800, title: '艦隊指揮官' }
  ];

  // 提示 → 星等：0 hint = 3 星、1-2 = 2 星、3+ = 1 星
  function starsForHints(hints) {
    if (hints <= 0) { return 3; }
    if (hints <= 2) { return 2; }
    return 1;
  }

  // 同一目標連錯 N 次自動遞出提示
  var WRONG_TRIES_BEFORE_HINT = 2;

  // ---- 終端機 ----
  var TERMINAL = {
    lineDelay: 34,        // 逐行輸出間隔 ms
    fastLineDelay: 12,    // 長輸出（logs 等）加速
    layerTick: 90,        // pull 進度條每格 ms
    historyMax: 60,
    promptHost: 'harbor',
    promptUser: 'sailor'
  };

  // ---- 容器隨機命名（真 Docker 風格 adjective_scientist）----
  var NAME_ADJ = ['admiring', 'brave', 'clever', 'dreamy', 'eager', 'festive',
    'gallant', 'happy', 'jolly', 'keen', 'lucid', 'mystic', 'nifty', 'quirky',
    'serene', 'vibrant', 'wizardly', 'zen'];
  var NAME_SUR = ['albattani', 'curie', 'darwin', 'einstein', 'fermi', 'galileo',
    'hopper', 'hypatia', 'kepler', 'lovelace', 'mendel', 'newton', 'noether',
    'pasteur', 'raman', 'tesla', 'turing', 'wu'];

  // ---- 模擬 Registry：可 pull 的藍圖目錄 ----
  // kind: 'oneshot' 跑完即退出 / 'service' 常駐
  var REGISTRY = {
    'hello-world': {
      tags: ['latest'], size: '13.3kB', sizeNum: 13300, kind: 'oneshot',
      layerSizes: ['719B'], desc: '最小的測試藍圖',
      command: '/hello'
    },
    'nginx': {
      tags: ['latest', '1.27', '1.25-alpine'], size: '187MB', sizeNum: 187000000,
      kind: 'service', web: true, defaultPort: 80,
      layerSizes: ['29.2MB', '41.8MB', '628B', '955B', '371B', '1.21kB', '1.4kB'],
      desc: '輕量網頁伺服器', command: "nginx -g 'daemon off;'"
    },
    'redis': {
      tags: ['latest', '7.2', '7-alpine'], size: '117MB', sizeNum: 117000000,
      kind: 'service', defaultPort: 6379,
      layerSizes: ['29.2MB', '1.1kB', '1.4MB', '14.1MB', '99B', '32.4MB'],
      desc: '記憶體資料庫', command: 'redis-server'
    },
    'harbor-db': {
      tags: ['latest'], size: '89.4MB', sizeNum: 89400000,
      kind: 'service', defaultPort: 5432, cargo: true,
      layerSizes: ['29.2MB', '8.7MB', '51.5MB'],
      desc: '鯨魚港特製貨物資料庫', command: 'harbor-db --data /data'
    },
    'whale-app': {
      tags: ['latest'], size: '142MB', sizeNum: 142000000,
      kind: 'service', defaultPort: 3000, web: true,
      layerSizes: ['29.2MB', '48.3MB', '64.5MB'],
      desc: '港務通知系統（會讀 MODE 環境變數）', command: 'node server.js',
      files: {
        'config.txt': 'app=harbor-notify\n# MODE 由「環境變數」提供（docker run -e MODE=...），不是寫死在這個檔\n# 目前容器未設定 MODE → 服務停擺；正解：-e MODE=harbor',
        'server.js': "require('./notify')(process.env.MODE)"
      }
    },
    'webapp': {
      tags: ['latest'], size: '96.1MB', sizeNum: 96100000,
      kind: 'service', defaultPort: 3000, web: true,
      layerSizes: ['29.2MB', '18.6MB', '48.3MB'],
      desc: '航運追蹤網頁（需要連到 db）', command: 'node index.js'
    }
  };

  // ---- 知識徽章（每關一枚，圖鑑 = Docker 概念小抄）----
  var BADGES = [
    { id: 'b1',  level: 1,  title: '輕量之證', glyph: 'ship', hue: 205,
      summary: '容器共用主機 kernel，只打包應用與依賴，所以比 VM 輕、快、省。' },
    { id: 'b2',  level: 2,  title: '初航之證', glyph: 'box', hue: 155,
      summary: 'docker run = 本地找 image → 沒有就 pull → create 容器 → start。' },
    { id: 'b3',  level: 3,  title: '藍圖之證', glyph: 'scroll', hue: 45,
      summary: 'image 是唯讀藍圖，存在 registry；image:tag 指定版本，不寫 tag 就是 latest。' },
    { id: 'b4',  level: 4,  title: '清港之證', glyph: 'broom', hue: 280,
      summary: '容器生命週期：created → running → exited；rm 運行中容器要先 stop 或 -f。' },
    { id: 'b5',  level: 5,  title: '通管之證', glyph: 'pipe', hue: 190,
      summary: '-p 主機port:容器port 把外部流量接進容器；同一主機 port 只能綁一次。' },
    { id: 'b6',  level: 6,  title: '探艙之證', glyph: 'lantern', hue: 25,
      summary: 'docker logs 看輸出、docker exec -it 進容器除錯、-e 注入環境變數。' },
    { id: 'b7',  level: 7,  title: '保險庫之證', glyph: 'vault', hue: 130,
      summary: '容器是暫時的，刪了資料就沒；volume 掛載讓資料活得比容器久。' },
    { id: 'b8',  level: 8,  title: '設計師之證', glyph: 'blueprint', hue: 215,
      summary: 'RUN/COPY/ADD 會疊出唯讀 layer、FROM 是基底層；WORKDIR/EXPOSE/CMD 等是 metadata 不佔層。順序影響 cache——少變的放前面。' },
    { id: 'b9',  level: 9,  title: '航道之證', glyph: 'compass', hue: 175,
      summary: '自訂 network 讓容器用「容器名」互相解析（內建 DNS）；預設 bridge 沒有容器名 DNS（仍可用 IP 互通）。' },
    { id: 'b10', level: 10, title: '指揮官之證', glyph: 'flag', hue: 350,
      summary: 'docker compose 用一份 YAML 宣告整支艦隊：services、ports、volumes、networks。' }
  ];

  // ---- help 指令表：隨進度解鎖（level = 學會它的關卡）----
  var COMMAND_DEX = [
    { level: 2,  cmd: 'docker run <image>',            zh: '從藍圖建立並啟動貨櫃' },
    { level: 2,  cmd: 'docker ps [-a]',                zh: '列出運行中（-a 含停止）貨櫃' },
    { level: 3,  cmd: 'docker pull <image>[:tag]',     zh: '從藍圖倉庫下載藍圖' },
    { level: 3,  cmd: 'docker images',                 zh: '列出本地藍圖' },
    { level: 4,  cmd: 'docker stop <名字|id>',          zh: '停止貨櫃' },
    { level: 4,  cmd: 'docker start <名字|id>',         zh: '啟動已停止的貨櫃' },
    { level: 4,  cmd: 'docker rm [-f] <名字|id>',       zh: '移除貨櫃（-f 強制）' },
    { level: 5,  cmd: 'docker run -d -p 主機:容器 <image>', zh: '背景執行並開通管線' },
    { level: 6,  cmd: 'docker logs <名字>',             zh: '查看貨櫃輸出日誌' },
    { level: 6,  cmd: 'docker exec -it <名字> sh',      zh: '進入運行中的貨櫃' },
    { level: 6,  cmd: 'docker run --name X -e K=V …',  zh: '命名貨櫃並注入環境變數' },
    { level: 7,  cmd: 'docker volume create <名字>',    zh: '建立保險庫（volume）' },
    { level: 7,  cmd: 'docker run -v 保險庫:/路徑 …',    zh: '把保險庫掛進貨櫃' },
    { level: 8,  cmd: 'docker build -t <名字> .',       zh: '依 Dockerfile 建造藍圖' },
    { level: 9,  cmd: 'docker network create <名字>',   zh: '開闢自訂航道（network）' },
    { level: 9,  cmd: 'docker run --network <航道> …',  zh: '讓貨櫃加入航道' },
    { level: 10, cmd: 'docker compose up -d',          zh: '照艦隊調度令啟動整組服務' }
  ];

  return {
    STORAGE_KEY: STORAGE_KEY,
    LEVEL_COUNT: LEVEL_COUNT,
    XP_BASE: XP_BASE,
    XP_PER_STAR: XP_PER_STAR,
    RANKS: RANKS,
    starsForHints: starsForHints,
    WRONG_TRIES_BEFORE_HINT: WRONG_TRIES_BEFORE_HINT,
    TERMINAL: TERMINAL,
    NAME_ADJ: NAME_ADJ,
    NAME_SUR: NAME_SUR,
    REGISTRY: REGISTRY,
    BADGES: BADGES,
    COMMAND_DEX: COMMAND_DEX
  };
}));
