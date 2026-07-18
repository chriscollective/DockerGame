/*
 * levels02-04.js — 第 2 關「第一個貨櫃」、第 3 關「藍圖倉庫」、第 4 關「碼頭大掃除」
 */
(function (root) {
  'use strict';
  var hasEvent = root.DG.hasEvent;

  // ===== 第 2 關：docker run hello-world =====
  root.DG.registerLevel({
    id: 2,
    name: '第一個貨櫃',
    topic: 'docker run',
    glyph: 'box',
    terminal: true,
    story: [
      '恭喜，終端機解鎖了！這是港口的核心工具，以後都靠它指揮起重機。',
      '第一單生意很簡單：跑起你人生第一個貨櫃。藍圖叫 <code>hello-world</code>。',
      '仔細看終端機和碼頭——run 這個指令背後其實做了四件事。'
    ],
    teach: {
      title: 'docker run 的完整流程',
      html: '<p><code>docker run hello-world</code> 會依序做四件事：</p>' +
        '<p>1. 在<b>本地藍圖架</b>找 image → 2. 找不到就去 <b>registry</b> 下載（pull）→ ' +
        '3. 依藍圖<b>建立（create）</b>容器 → 4. <b>啟動（start）</b>它。</p>' +
        '<p>hello-world 是「一次性」容器：說完話就退出（exited），但它不會消失——用 <code>docker ps -a</code> 能找到屍體。</p>',
      map: '<b>港口比喻</b>：本地沒藍圖 → 派快船去藍圖倉庫（registry）取 → 起重機照圖組櫃 → 貨櫃亮燈。'
    },
    outro: 'run = 找藍圖 → 沒有就 pull → create → start。這條流水線你之後每天都會用。',
    setup: function () { /* 乾淨的港口 */ },
    objectives: [
      { text: '執行 <code>docker run hello-world</code>，看完整個流程',
        hints: ['指令格式是 docker run <藍圖名>，這次的藍圖叫 hello-world。',
          '照這個骨架打：docker run ______（填 hello-world）。',
          '完整指令：docker run hello-world'],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'run' &&
            result.parsed.image === 'hello-world';
        } },
      { text: '它說完話就退場了。用 <code>docker ps -a</code> 找到這個已退出（Exited）的貨櫃',
        hints: ['docker ps 只列「運行中」的；要看全部得加一個旗標。',
          '旗標是 -a（all）：docker ps __。',
          '完整指令：docker ps -a'],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'ps' &&
            result.parsed.all && result.parsed.count >= 1;
        } }
    ]
  });

  // ===== 第 3 關：docker pull / images / tag =====
  root.DG.registerLevel({
    id: 3,
    name: '藍圖倉庫',
    topic: 'image · registry · tag',
    glyph: 'scroll',
    terminal: true,
    story: [
      '今天帶你認識<b>藍圖倉庫（registry）</b>——全世界的藍圖都存在那裡。',
      '藍圖（image）是唯讀的：起重機照著它可以蓋出一百個一模一樣的貨櫃。',
      '先把港口最常用的 <code>nginx</code> 藍圖拉回來備著。注意看，它是一「層」一層下載的！'
    ],
    teach: {
      title: 'image、registry 與 tag',
      html: '<p><b>image</b> 是唯讀藍圖；<b>registry</b>（如 Docker Hub）是放藍圖的倉庫。' +
        '<code>docker pull</code> 只下載、不啟動。</p>' +
        '<p>藍圖名字的完整格式是 <code>名字:tag</code>——tag 是版本標籤。' +
        '不寫 tag 時 Docker 幫你補 <code>:latest</code>（「最新」，但正式環境要釘死版本！）</p>' +
        '<p>下載時的多條進度條 = image 的多個 <b>layer</b>（分層），之後蓋藍圖時會再深談。</p>',
      map: '<b>港口比喻</b>：registry＝遠方的藍圖總倉；pull＝派快船抄一份回本地藍圖架；tag＝藍圖的版本編號。'
    },
    outro: 'image 是唯讀藍圖、registry 是藍圖倉庫、tag 釘版本——:latest 只是預設值，不是承諾。',
    setup: function () { /* 空藍圖架 */ },
    objectives: [
      { text: '執行 <code>docker pull nginx</code> 把藍圖拉回本地',
        hints: ['pull 的格式：docker pull <藍圖名>。',
          '骨架：docker pull _____（這次要 nginx）。',
          '完整指令：docker pull nginx'],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'pull' &&
            result.parsed.image.indexOf('nginx') === 0;
        } },
      { text: '用 <code>docker images</code> 檢查本地藍圖架（注意 TAG 欄位）',
        hints: ['列出本地藍圖的指令只有兩個單字。',
          'docker ______（複數）。',
          '完整指令：docker images'],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'images' && result.parsed.count >= 1;
        } },
      { text: '指定版本拉一份 <code>redis:7.2</code>（體驗 tag 的寫法）',
        hints: ['tag 寫在藍圖名後面，用冒號接起來。',
          '骨架：docker pull redis:___。',
          '完整指令：docker pull redis:7.2'],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'pull' &&
            result.parsed.image === 'redis:7.2';
        } }
    ]
  });

  // ===== 第 4 關：生命週期大掃除 =====
  root.DG.registerLevel({
    id: 4,
    name: '碼頭大掃除',
    topic: '容器生命週期',
    glyph: 'broom',
    terminal: true,
    story: [
      '糟糕，昨晚值班的學長又亂丟貨櫃就下班了……整個碼頭一團亂！',
      '有的還在運轉、有的熄了火佔位子。今天你來當清潔隊長。',
      '記住口訣：<b>ps 點名、stop 熄火、start 重啟、rm 拆櫃</b>。運轉中的櫃子不能直接拆！'
    ],
    teach: {
      title: '容器生命週期',
      html: '<p>容器是一台<b>狀態機</b>：<code>created</code> → <code>running</code> → <code>exited</code>，' +
        '可以 <code>start</code> 回去、最後 <code>rm</code> 移除。</p>' +
        '<p><code>docker ps</code> 只顯示 running；<code>docker ps -a</code> 顯示全部。</p>' +
        '<p>運行中的容器<b>不能直接 rm</b>——Docker 會報錯。先 <code>stop</code> 再 <code>rm</code>，' +
        '或用 <code>rm -f</code> 強制拆除（會直接送 SIGKILL，粗暴但有效）。</p>',
      map: '<b>港口比喻</b>：running＝貨櫃亮綠燈運轉中；exited＝熄燈佔泊位；rm＝吊走拆解。運轉中硬拆會出事！'
    },
    outro: '生命週期：run → running → stop → exited → start 或 rm。刪運轉中的？先 stop，或想清楚再 -f。',
    setup: function (ctx) {
      var e = ctx.engine;
      e.pull('nginx');
      e.pull('redis');
      e.run({ image: 'nginx', name: 'old-web', detach: true });
      e.run({ image: 'redis', name: 'cargo-log', detach: true });
      e.stop('cargo-log');
      e.run({ image: 'redis', name: 'mystery', detach: true });
      e.takeEvents();
    },
    objectives: [
      { text: '先點名：<code>docker ps</code> 看看哪些貨櫃在運轉',
        hints: ['最基本的點名指令，兩個單字。', 'docker __（很短）。', '完整指令：docker ps'],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'ps' && !result.parsed.all;
        } },
      { text: '再用 <code>docker ps -a</code> 揪出熄火佔位的傢伙',
        hints: ['加上「全部」的旗標。', 'docker ps -_。', '完整指令：docker ps -a'],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'ps' && result.parsed.all;
        } },
      { text: '<code>cargo-log</code> 其實還有用，把它重新啟動',
        hints: ['讓 exited 容器復活的指令是 start。',
          'docker start ______（接名字）。',
          '完整指令：docker start cargo-log'],
        check: function (result, ctx) {
          var c = ctx.engine.findContainer('cargo-log');
          return result && result.ok && c && c.status === 'running';
        } },
      { text: '<code>old-web</code> 早就沒人用了，先讓它熄火（stop）',
        hints: ['stop 接容器名字。', 'docker stop ______。', '完整指令：docker stop old-web'],
        check: function (result, ctx) {
          var c = ctx.engine.findContainer('old-web');
          return result && result.ok && c && c.status === 'exited';
        } },
      { text: '把熄火的 <code>old-web</code> 拆掉（rm）',
        hints: ['已停止的容器可以直接 rm。', 'docker rm ______。', '完整指令：docker rm old-web'],
        check: function (result, ctx) {
          return result && result.ok && !ctx.engine.findContainer('old-web');
        } },
      { text: '最後拆掉還在運轉的 <code>mystery</code>——直接 rm 會被拒絕，想想怎麼辦',
        hints: ['先試試 docker rm mystery，看看 Docker 怎麼抗議。',
          '兩條路：先 stop 再 rm，或一步到位的強制旗標 -f。',
          '完整指令：docker rm -f mystery（或先 docker stop mystery 再 docker rm mystery）'],
        check: function (result, ctx) {
          return result && result.ok && !ctx.engine.findContainer('mystery');
        },
        onDone: function (ctx) {
          ctx.stage.caption('碼頭煥然一新！學長欠你一杯咖啡。');
          ctx.stage.burst(50, 55, 18);
        } }
    ]
  });

  void hasEvent;
}(typeof globalThis !== 'undefined' ? globalThis : this));
