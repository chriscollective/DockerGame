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
    { xp: 0,    title: { zh: '見習水手', en: 'Apprentice Sailor' } },
    { xp: 300,  title: { zh: '貨櫃學徒', en: 'Container Apprentice' } },
    { xp: 700,  title: { zh: '碼頭操作員', en: 'Dock Operator' } },
    { xp: 1200, title: { zh: '航線領航員', en: 'Route Pilot' } },
    { xp: 1800, title: { zh: '港務長', en: 'Harbour Master' } }
  ];

  // 提示 → 星等：0 hint = 3 星、1-2 = 2 星、3+ = 1 星
  function starsForHints(hints) {
    if (hints <= 0) { return 3; }
    if (hints <= 2) { return 2; }
    return 1;
  }

  // 同一目標連錯 N 次自動遞出提示
  var WRONG_TRIES_BEFORE_HINT = 2;

  // 過關 → 結算彈窗的延遲：留時間讀完最後一個指令的輸出與船長收尾金句
  // （等待期間畫面會出現「查看結算」鈕，等不及可直接按）
  var RESULT_DELAY_MS = 8000;
  var RESULT_DELAY_LAST_MS = 9500;   // 最終關的結業授階演出較長

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
        'config.txt': 'app=harbor-notify\n# MODE comes from an ENVIRONMENT VARIABLE (docker run -e MODE=...), not hard-coded in this file\n# This container has no MODE set -> the service is down; correct fix: -e MODE=harbor',
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
    { id: 'b1',  level: 1,  title: { zh: '輕量之證', en: 'Mark of Lightness' }, glyph: 'ship', hue: 205,
      summary: { zh: '容器共用主機 kernel，只打包應用與依賴，所以比 VM 輕、快、省。',
        en: 'Containers share the host kernel and package only the app and its dependencies, so they are lighter, faster and leaner than VMs.' } },
    { id: 'b2',  level: 2,  title: { zh: '初航之證', en: 'Mark of the First Voyage' }, glyph: 'box', hue: 155,
      summary: { zh: 'docker run = 本地找 image → 沒有就 pull → create 容器 → start。',
        en: 'docker run = look for the image locally → pull it if missing → create the container → start it.' } },
    { id: 'b3',  level: 3,  title: { zh: '藍圖之證', en: 'Mark of the Blueprint' }, glyph: 'scroll', hue: 45,
      summary: { zh: 'image 是唯讀藍圖，存在 registry；image:tag 指定版本，不寫 tag 就是 latest。',
        en: 'An image is a read-only blueprint kept in a registry; image:tag picks a version, and no tag means latest.' } },
    { id: 'b4',  level: 4,  title: { zh: '清港之證', en: 'Mark of Harbor Cleanup' }, glyph: 'broom', hue: 280,
      summary: { zh: '容器生命週期：created → running → exited；rm 運行中容器要先 stop 或 -f。',
        en: 'Container lifecycle: created → running → exited; to rm a running container, stop it first or use -f.' } },
    { id: 'b5',  level: 5,  title: { zh: '通管之證', en: 'Mark of Open Pipes' }, glyph: 'pipe', hue: 190,
      summary: { zh: '-p 主機port:容器port 把外部流量接進容器；同一主機 port 只能綁一次。',
        en: '-p hostPort:containerPort pipes outside traffic into a container; each host port can only be bound once.' } },
    { id: 'b6',  level: 6,  title: { zh: '探艙之證', en: 'Mark of the Hold' }, glyph: 'lantern', hue: 25,
      summary: { zh: 'docker logs 看輸出、docker exec -it 進容器除錯、-e 注入環境變數。',
        en: 'docker logs shows output, docker exec -it steps inside to debug, and -e injects environment variables.' } },
    { id: 'b7',  level: 7,  title: { zh: '保險庫之證', en: 'Mark of the Vault' }, glyph: 'vault', hue: 130,
      summary: { zh: '容器是暫時的，刪了資料就沒；volume 掛載讓資料活得比容器久。',
        en: 'Containers are ephemeral—delete one and its data is gone; mounting a volume lets data outlive the container.' } },
    { id: 'b8',  level: 8,  title: { zh: '設計師之證', en: 'Mark of the Designer' }, glyph: 'blueprint', hue: 215,
      summary: { zh: 'RUN/COPY/ADD 會疊出唯讀 layer、FROM 是基底層；WORKDIR/EXPOSE/CMD 等是 metadata 不佔層。順序影響 cache——少變的放前面。',
        en: 'RUN/COPY/ADD stack read-only layers and FROM is the base layer; WORKDIR/EXPOSE/CMD are metadata and add no layer. Order affects cache—put rarely-changing steps first.' } },
    { id: 'b9',  level: 9,  title: { zh: '內線之證', en: 'Mark of the Private Line' }, glyph: 'compass', hue: 175,
      summary: { zh: '自訂 network 讓容器用「容器名」互相解析（內建 DNS）；預設 bridge 沒有容器名 DNS（仍可用 IP 互通）。',
        en: 'A custom network lets containers resolve each other by name (built-in DNS); the default bridge has no name DNS (they can still reach each other by IP).' } },
    { id: 'b10', level: 10, title: { zh: '港務長之證', en: 'Mark of the Harbour Master' }, glyph: 'flag', hue: 350,
      summary: { zh: 'docker compose 用一份 YAML 宣告整組服務：services、ports、volumes、networks。',
        en: 'docker compose declares a whole stack in one YAML file: services, ports, volumes, networks.' } }
  ];

  // ---- help 指令表：隨進度解鎖（level = 學會它的關卡）----
  var COMMAND_DEX = [
    { level: 2,  cmd: 'docker run <image>',
      desc: { zh: '從藍圖建立並啟動貨櫃', en: 'Create and start a container from a blueprint' } },
    { level: 2,  cmd: 'docker ps [-a]',
      desc: { zh: '列出運行中（-a 含停止）貨櫃', en: 'List running containers (-a includes stopped)' } },
    { level: 3,  cmd: 'docker pull <image>[:tag]',
      desc: { zh: '從藍圖倉庫下載藍圖', en: 'Download a blueprint from the registry' } },
    { level: 3,  cmd: 'docker images',
      desc: { zh: '列出本地藍圖', en: 'List local blueprints' } },
    { level: 4,  cmd: { zh: 'docker stop <名字|id>', en: 'docker stop <name|id>' },
      desc: { zh: '停止貨櫃', en: 'Stop a container' } },
    { level: 4,  cmd: { zh: 'docker start <名字|id>', en: 'docker start <name|id>' },
      desc: { zh: '啟動已停止的貨櫃', en: 'Start a stopped container' } },
    { level: 4,  cmd: { zh: 'docker rm [-f] <名字|id>', en: 'docker rm [-f] <name|id>' },
      desc: { zh: '移除貨櫃（-f 強制）', en: 'Remove a container (-f forces it)' } },
    { level: 5,  cmd: { zh: 'docker run -d -p 主機:容器 <image>', en: 'docker run -d -p host:container <image>' },
      desc: { zh: '背景執行並開通管線', en: 'Run in the background and open a pipe' } },
    { level: 6,  cmd: { zh: 'docker logs <名字>', en: 'docker logs <name>' },
      desc: { zh: '查看貨櫃輸出日誌', en: "View a container's output log" } },
    { level: 6,  cmd: { zh: 'docker exec -it <名字> sh', en: 'docker exec -it <name> sh' },
      desc: { zh: '進入運行中的貨櫃', en: 'Step inside a running container' } },
    { level: 6,  cmd: 'docker run --name X -e K=V …',
      desc: { zh: '命名貨櫃並注入環境變數', en: 'Name a container and inject env vars' } },
    { level: 7,  cmd: { zh: 'docker volume create <名字>', en: 'docker volume create <name>' },
      desc: { zh: '建立保險庫（volume）', en: 'Create a vault (volume)' } },
    { level: 7,  cmd: { zh: 'docker run -v 保險庫:/路徑 …', en: 'docker run -v vault:/path …' },
      desc: { zh: '把保險庫掛進貨櫃', en: 'Mount a vault into a container' } },
    { level: 8,  cmd: { zh: 'docker build -t <名字> .', en: 'docker build -t <name> .' },
      desc: { zh: '依 Dockerfile 建造藍圖', en: 'Build a blueprint from a Dockerfile' } },
    { level: 9,  cmd: { zh: 'docker network create <名字>', en: 'docker network create <name>' },
      desc: { zh: '拉一條專屬內線（network）', en: 'Lay a private line (network)' } },
    { level: 9,  cmd: { zh: 'docker run --network <內線> …', en: 'docker run --network <line> …' },
      desc: { zh: '把貨櫃接上內線', en: 'Connect a container to a private line' } },
    { level: 10, cmd: 'docker compose up -d',
      desc: { zh: '照總調度令啟動整組服務', en: 'Bring up the whole stack per the master manifest' } }
  ];

  return {
    STORAGE_KEY: STORAGE_KEY,
    LEVEL_COUNT: LEVEL_COUNT,
    XP_BASE: XP_BASE,
    XP_PER_STAR: XP_PER_STAR,
    RANKS: RANKS,
    starsForHints: starsForHints,
    WRONG_TRIES_BEFORE_HINT: WRONG_TRIES_BEFORE_HINT,
    RESULT_DELAY_MS: RESULT_DELAY_MS,
    RESULT_DELAY_LAST_MS: RESULT_DELAY_LAST_MS,
    TERMINAL: TERMINAL,
    NAME_ADJ: NAME_ADJ,
    NAME_SUR: NAME_SUR,
    REGISTRY: REGISTRY,
    BADGES: BADGES,
    COMMAND_DEX: COMMAND_DEX
  };
}));
