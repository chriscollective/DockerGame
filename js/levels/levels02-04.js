/*
 * levels02-04.js — 第 2 關「第一個貨櫃」、第 3 關「藍圖倉庫」、第 4 關「碼頭大掃除」
 */
(function (root) {
  'use strict';
  var hasEvent = root.DG.hasEvent;

  // ===== 第 2 關：docker run hello-world =====
  root.DG.registerLevel({
    id: 2,
    name: { zh: '第一個貨櫃', en: 'Your First Container' },
    topic: 'docker run',
    glyph: 'box',
    terminal: true,
    story: [
      { zh: '恭喜，終端機解鎖了！這是港口的核心工具，以後都靠它指揮起重機。',
        en: 'Congratulations, the terminal is unlocked! It\'s the harbor\'s core tool — from now on you\'ll command the cranes with it.' },
      { zh: '第一單生意很簡單：跑起你人生第一個貨櫃。藍圖叫 <code>hello-world</code>。',
        en: 'Your first job is simple: run the very first container of your life. The blueprint is called <code>hello-world</code>.' },
      { zh: '仔細看終端機和碼頭——run 這個指令背後其實做了四件事。',
        en: 'Watch the terminal and the dock closely — behind the scenes the run command actually does four things.' }
    ],
    teach: {
      title: { zh: 'docker run 的完整流程', en: 'The full docker run flow' },
      html: {
        zh: '<p><code>docker run hello-world</code> 會依序做四件事：</p>' +
          '<p>1. 在<b>本地藍圖架</b>找 image → 2. 找不到就去 <b>registry</b> 下載（pull）→ ' +
          '3. 依藍圖<b>建立（create）</b>容器 → 4. <b>啟動（start）</b>它。</p>' +
          '<p>hello-world 是「一次性」容器：說完話就退出（exited），但它不會消失——用 <code>docker ps -a</code> 能找到屍體。</p>',
        en: '<p><code>docker run hello-world</code> does four things in order:</p>' +
          '<p>1. Look for the image on the <b>local blueprint shelf</b> → 2. If it\'s not there, download it from the <b>registry</b> (pull) → ' +
          '3. <b>Create</b> the container from the blueprint → 4. <b>Start</b> it.</p>' +
          '<p>hello-world is a "one-shot" container: it says its piece and exits, but it doesn\'t disappear — you can still find the body with <code>docker ps -a</code>.</p>'
      },
      map: {
        zh: '<b>港口比喻</b>：本地沒藍圖 → 派快船去藍圖倉庫（registry）取 → 起重機照圖組櫃 → 貨櫃亮燈。',
        en: '<b>Harbor Analogy</b>: no blueprint locally → send a fast boat to the blueprint warehouse (registry) to fetch one → the crane assembles the container from the blueprint → the container lights up.'
      }
    },
    outro: {
      zh: 'run = 找藍圖 → 沒有就 pull → create → start。這條流水線你之後每天都會用。',
      en: 'run = find the blueprint → if it\'s missing, pull → create → start. You\'ll use this pipeline every day from now on.'
    },
    setup: function () { /* 乾淨的港口 */ },
    objectives: [
      { text: { zh: '執行 <code>docker run hello-world</code>，看完整個流程',
          en: 'Run <code>docker run hello-world</code> and watch the whole flow.' },
        hints: [
          { zh: '指令格式是 docker run <藍圖名>，這次的藍圖叫 hello-world。',
            en: 'The command format is docker run <blueprint-name>, and this time the blueprint is called hello-world.' },
          { zh: '照這個骨架打：docker run ______（填 hello-world）。',
            en: 'Type it following this skeleton: docker run ______ (fill in hello-world).' },
          { zh: '完整指令：docker run hello-world',
            en: 'Full command: docker run hello-world' }],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'run' &&
            result.parsed.image === 'hello-world';
        } },
      { text: { zh: '它說完話就退場了。用 <code>docker ps -a</code> 找到這個已退出（Exited）的貨櫃',
          en: 'It says its piece and leaves. Use <code>docker ps -a</code> to find this exited container.' },
        hints: [
          { zh: 'docker ps 只列「運行中」的；要看全部得加一個旗標。',
            en: 'docker ps lists only the "running" ones; to see them all you need to add a flag.' },
          { zh: '旗標是 -a（all）：docker ps __。',
            en: 'The flag is -a (all): docker ps __.' },
          { zh: '完整指令：docker ps -a',
            en: 'Full command: docker ps -a' }],
        check: function (result, ctx) {
          return !!(result && result.ok && result.parsed.cmd === 'ps' && result.parsed.all &&
            ctx.engine.state.containers.some(function (c) { return c.status === 'exited'; }));
        } }
    ]
  });

  // ===== 第 3 關：docker pull / images / tag =====
  root.DG.registerLevel({
    id: 3,
    name: { zh: '藍圖倉庫', en: 'The Blueprint Warehouse' },
    topic: 'image · registry · tag',
    glyph: 'scroll',
    terminal: true,
    story: [
      { zh: '今天帶你認識<b>藍圖倉庫（registry）</b>——全世界的藍圖都存在那裡。',
        en: 'Today I\'ll introduce you to the <b>blueprint warehouse (registry)</b> — every blueprint in the world is stored there.' },
      { zh: '藍圖（image）是唯讀的：起重機照著它可以蓋出一百個一模一樣的貨櫃。',
        en: 'A blueprint (image) is read-only: the crane can build a hundred identical containers from it.' },
      { zh: '先把港口最常用的 <code>nginx</code> 藍圖拉回來備著。注意看，它是一「層」一層下載的！',
        en: 'Let\'s first pull the harbor\'s most-used <code>nginx</code> blueprint to keep on hand. Watch closely — it downloads one "layer" at a time!' }
    ],
    teach: {
      title: { zh: 'image、registry 與 tag', en: 'image, registry, and tag' },
      html: {
        zh: '<p><b>image</b> 是唯讀藍圖；<b>registry</b>（如 Docker Hub）是放藍圖的倉庫。' +
          '<code>docker pull</code> 只下載、不啟動。</p>' +
          '<p>藍圖名字的完整格式是 <code>名字:tag</code>——tag 是版本標籤。' +
          '不寫 tag 時 Docker 幫你補 <code>:latest</code>——注意 <code>latest</code> 只是「預設標籤名」，' +
          '不保證是最新版本，正式環境要釘死版本！</p>' +
          '<p>下載時的多條進度條 = image 的多個 <b>layer</b>（分層），之後蓋藍圖時會再深談。</p>',
        en: '<p>An <b>image</b> is a read-only blueprint; a <b>registry</b> (like Docker Hub) is the warehouse that stores blueprints. ' +
          '<code>docker pull</code> only downloads — it doesn\'t start anything.</p>' +
          '<p>The full form of a blueprint name is <code>name:tag</code> — the tag is the version tag. ' +
          'When you omit the tag, Docker fills in <code>:latest</code> for you — but note that <code>latest</code> is only the "default tag name", ' +
          'not a guarantee of the newest version; in production, always pin the version!</p>' +
          '<p>The multiple progress bars during download = the image\'s multiple <b>layers</b>; we\'ll dig into these later when we build blueprints.</p>'
      },
      map: {
        zh: '<b>港口比喻</b>：registry＝遠方的藍圖總倉；pull＝派快船抄一份回本地藍圖架；tag＝藍圖的版本編號。',
        en: '<b>Harbor Analogy</b>: registry = the distant central blueprint depot; pull = send a fast boat to copy one back to the local blueprint shelf; tag = the blueprint\'s version number.'
      }
    },
    outro: {
      zh: 'image 是唯讀藍圖、registry 是藍圖倉庫、tag 釘版本——:latest 只是預設值，不是承諾。',
      en: 'image = read-only blueprint, registry = blueprint warehouse, tag pins the version — :latest is just a default, not a promise.'
    },
    setup: function () { /* 空藍圖架 */ },
    objectives: [
      { text: { zh: '執行 <code>docker pull nginx</code> 把藍圖拉回本地',
          en: 'Run <code>docker pull nginx</code> to pull the blueprint down to your local shelf.' },
        hints: [
          { zh: 'pull 的格式：docker pull <藍圖名>。',
            en: 'The pull format: docker pull <blueprint-name>.' },
          { zh: '骨架：docker pull _____（這次要 nginx）。',
            en: 'Skeleton: docker pull _____ (this time it\'s nginx).' },
          { zh: '完整指令：docker pull nginx',
            en: 'Full command: docker pull nginx' }],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'pull' &&
            result.parsed.image.indexOf('nginx') === 0;
        } },
      { text: { zh: '用 <code>docker images</code> 檢查本地藍圖架（注意 TAG 欄位）',
          en: 'Use <code>docker images</code> to check your local blueprint shelf (note the TAG column).' },
        hints: [
          { zh: '列出本地藍圖的指令只有兩個單字。',
            en: 'The command to list local blueprints is just two words.' },
          { zh: 'docker ______（複數）。',
            en: 'docker ______ (plural).' },
          { zh: '完整指令：docker images',
            en: 'Full command: docker images' }],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'images' && result.parsed.count >= 1;
        } },
      { text: { zh: '指定版本拉一份 <code>redis:7.2</code>（體驗 tag 的寫法）',
          en: 'Pull a specific version, <code>redis:7.2</code> (to experience how tags are written).' },
        hints: [
          { zh: 'tag 寫在藍圖名後面，用冒號接起來。',
            en: 'The tag goes after the blueprint name, joined with a colon.' },
          { zh: '骨架：docker pull redis:___。',
            en: 'Skeleton: docker pull redis:___.' },
          { zh: '完整指令：docker pull redis:7.2',
            en: 'Full command: docker pull redis:7.2' }],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'pull' &&
            result.parsed.image === 'redis:7.2';
        } }
    ]
  });

  // ===== 第 4 關：生命週期大掃除 =====
  root.DG.registerLevel({
    id: 4,
    name: { zh: '碼頭大掃除', en: 'Dockside Cleanup' },
    topic: { zh: '容器生命週期', en: 'Container Lifecycle' },
    glyph: 'broom',
    terminal: true,
    story: [
      { zh: '糟糕，昨晚值班的學長又亂丟貨櫃就下班了……整個碼頭一團亂！',
        en: 'Uh oh — the senior on last night\'s shift dumped containers everywhere and clocked out again... the whole dock is a mess!' },
      { zh: '有的還在運轉、有的熄了火佔位子。今天你來當清潔隊長。',
        en: 'Some are still running, others have gone cold and are hogging berths. Today you\'re the cleanup captain.' },
      { zh: '記住口訣：<b>ps 點名、stop 熄火、start 重啟、rm 拆櫃</b>。運轉中的櫃子不能直接拆！',
        en: 'Remember the mantra: <b>ps to roll call, stop to shut down, start to restart, rm to scrap</b>. You can\'t scrap a running container directly!' }
    ],
    teach: {
      title: { zh: '容器生命週期', en: 'The Container Lifecycle' },
      html: {
        zh: '<p>容器是一台<b>狀態機</b>：<code>created</code> → <code>running</code> → <code>exited</code>，' +
          '可以 <code>start</code> 回去、最後 <code>rm</code> 移除。</p>' +
          '<p><code>docker ps</code> 只顯示 running；<code>docker ps -a</code> 顯示全部。</p>' +
          '<p>運行中的容器<b>不能直接 rm</b>——Docker 會報錯。先 <code>stop</code> 再 <code>rm</code>，' +
          '或用 <code>rm -f</code> 強制拆除（會直接送 SIGKILL，粗暴但有效）。</p>',
        en: '<p>A container is a <b>state machine</b>: <code>created</code> → <code>running</code> → <code>exited</code>, ' +
          'you can <code>start</code> it back up, and finally <code>rm</code> to remove it.</p>' +
          '<p><code>docker ps</code> shows only running ones; <code>docker ps -a</code> shows them all.</p>' +
          '<p>A running container <b>can\'t be removed with rm directly</b> — Docker throws an error. Either <code>stop</code> then <code>rm</code>, ' +
          'or use <code>rm -f</code> to force removal (it sends SIGKILL straight away — brutal but effective).</p>'
      },
      map: {
        zh: '<b>港口比喻</b>：running＝貨櫃亮綠燈運轉中；exited＝熄燈佔泊位；rm＝吊走拆解。運轉中硬拆會出事！',
        en: '<b>Harbor Analogy</b>: running = the container glows green and is operating; exited = lights off but still occupying a berth; rm = hoist it away and scrap it. Forcing a scrap while it\'s running causes trouble!'
      }
    },
    outro: {
      zh: '生命週期：run → running → stop → exited → start 或 rm。刪運轉中的？先 stop，或想清楚再 -f。',
      en: 'Lifecycle: run → running → stop → exited → start or rm. Deleting a running one? Stop it first, or think twice before -f.'
    },
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
      { text: { zh: '先點名：<code>docker ps</code> 看看哪些貨櫃在運轉',
          en: 'Roll call first: <code>docker ps</code> to see which containers are running.' },
        hints: [
          { zh: '最基本的點名指令，兩個單字。', en: 'The most basic roll-call command, two words.' },
          { zh: 'docker __（很短）。', en: 'docker __ (very short).' },
          { zh: '完整指令：docker ps', en: 'Full command: docker ps' }],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'ps' && !result.parsed.all;
        } },
      { text: { zh: '再用 <code>docker ps -a</code> 揪出熄火佔位的傢伙',
          en: 'Then use <code>docker ps -a</code> to flush out the cold ones hogging berths.' },
        hints: [
          { zh: '加上「全部」的旗標。', en: 'Add the "all" flag.' },
          { zh: 'docker ps -_。', en: 'docker ps -_.' },
          { zh: '完整指令：docker ps -a', en: 'Full command: docker ps -a' }],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'ps' && result.parsed.all;
        } },
      { text: { zh: '<code>cargo-log</code> 其實還有用，把它重新啟動',
          en: '<code>cargo-log</code> is actually still useful — restart it.' },
        hints: [
          { zh: '讓 exited 容器復活的指令是 start。', en: 'The command to revive an exited container is start.' },
          { zh: 'docker start ______（接名字）。', en: 'docker start ______ (add the name).' },
          { zh: '完整指令：docker start cargo-log', en: 'Full command: docker start cargo-log' }],
        check: function (result, ctx) {
          var c = ctx.engine.findContainer('cargo-log');
          return result && result.ok && c && c.status === 'running';
        } },
      { text: { zh: '<code>old-web</code> 早就沒人用了，先讓它熄火（stop）',
          en: 'Nobody has used <code>old-web</code> in ages — shut it down first (stop).' },
        hints: [
          { zh: 'stop 接容器名字。', en: 'stop takes the container name.' },
          { zh: 'docker stop ______。', en: 'docker stop ______.' },
          { zh: '完整指令：docker stop old-web', en: 'Full command: docker stop old-web' }],
        check: function (result, ctx) {
          var c = ctx.engine.findContainer('old-web');
          return result && result.ok && c && c.status === 'exited';
        } },
      { text: { zh: '把熄火的 <code>old-web</code> 拆掉（rm）',
          en: 'Scrap the now-stopped <code>old-web</code> (rm).' },
        hints: [
          { zh: '已停止的容器可以直接 rm。', en: 'A stopped container can be removed with rm directly.' },
          { zh: 'docker rm ______。', en: 'docker rm ______.' },
          { zh: '完整指令：docker rm old-web', en: 'Full command: docker rm old-web' }],
        check: function (result, ctx) {
          return result && result.ok && !ctx.engine.findContainer('old-web');
        } },
      { text: { zh: '最後拆掉還在運轉的 <code>mystery</code>——直接 rm 會被拒絕，想想怎麼辦',
          en: 'Finally, scrap the still-running <code>mystery</code> — a plain rm will be refused, so think about what to do.' },
        hints: [
          { zh: '先試試 docker rm mystery，看看 Docker 怎麼抗議。',
            en: 'Try docker rm mystery first and see how Docker protests.' },
          { zh: '兩條路：先 stop 再 rm，或一步到位的強制旗標 -f。',
            en: 'Two routes: stop then rm, or the one-step force flag -f.' },
          { zh: '完整指令：docker rm -f mystery（或先 docker stop mystery 再 docker rm mystery）',
            en: 'Full command: docker rm -f mystery (or docker stop mystery first, then docker rm mystery)' }],
        check: function (result, ctx) {
          return result && result.ok && !ctx.engine.findContainer('mystery');
        },
        onDone: function (ctx) {
          ctx.stage.caption(root.DG.t({ zh: '碼頭煥然一新！學長欠你一杯咖啡。',
            en: 'The dock looks brand new! The senior owes you a coffee.' }));
          ctx.stage.burst(50, 55, 18);
        } }
    ]
  });

  void hasEvent;
}(typeof globalThis !== 'undefined' ? globalThis : this));
