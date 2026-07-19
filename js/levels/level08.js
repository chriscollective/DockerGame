/*
 * level08.js — 第 8 關「藍圖設計師」：Dockerfile 指令卡排序 + build layer/cache 體驗
 */
(function (root) {
  'use strict';
  var h = root.DG.h;

  // 只有 FROM/COPY/ADD/RUN 會疊出檔案系統層；WORKDIR/EXPOSE/CMD/ENV 等是 metadata、不佔層
  var LAYER_INSTS = { FROM: 1, COPY: 1, ADD: 1, RUN: 1 };
  function isLayerInst(inst) { return !!LAYER_INSTS[inst]; }

  // 每一步「重新建造」時的模擬耗時（秒）——用時間對比讓 cache 的威力一眼有感
  var BUILD_SECS = {
    'FROM node:20': 3.2,
    'WORKDIR /app': 0,
    'COPY package.json .': 0.4,
    'RUN npm install': 24.6,
    'COPY . .': 0.6,
    'EXPOSE 3000': 0,
    'CMD ["node","server.js"]': 0
  };

  var CARDS = [
    { inst: 'FROM', text: 'FROM node:20', note: '地基：從一張基底藍圖開始' },
    { inst: 'WORKDIR', text: 'WORKDIR /app', note: '之後的操作都在這個艙房進行' },
    { inst: 'COPY', text: 'COPY package.json .', note: '先只搬「依賴清單」', file: 'package.json' },
    { inst: 'RUN', text: 'RUN npm install', note: '安裝依賴（最花時間的一層）' },
    { inst: 'COPY', text: 'COPY . .', note: '搬入全部程式碼', file: 'server.js' },
    { inst: 'EXPOSE', text: 'EXPOSE 3000', note: '標注貨櫃的艙門號' },
    { inst: 'CMD', text: 'CMD ["node","server.js"]', note: '容器啟動時要跑的指令' }
  ];

  function rejectReason(card, pos, placed) {
    if (pos === 0 && card.text !== 'FROM node:20') {
      return 'Dockerfile 第一行必須是 FROM——沒有基底藍圖，後面什麼都蓋不起來。';
    }
    if (card.inst === 'CMD' && pos < CARDS.length - 1) {
      return 'CMD 是「容器啟動時做什麼」，不是建造步驟——而且一個 Dockerfile 只有最後一個 CMD 算數，習慣放最後一行。';
    }
    if (card.text === 'RUN npm install' && !placed.some(function (c) { return c.text === 'COPY package.json .'; })) {
      return 'npm install 需要 package.json 才知道要裝什麼——先把它 COPY 進來。';
    }
    if (card.text === 'COPY . .' && !placed.some(function (c) { return c.text === 'RUN npm install'; })) {
      return '先只 COPY package.json、npm install，「最後」才 COPY 全部程式碼——因為程式碼天天改、依賴不常改，' +
        '這樣改程式碼重 build 時，安裝依賴那層可以吃 cache，省下大把時間。';
    }
    if (card.inst === 'COPY' && !placed.some(function (c) { return c.inst === 'WORKDIR'; })) {
      return '先用 WORKDIR 指定工作目錄，之後的 COPY／RUN 都以它為基準，路徑才不會亂。';
    }
    return '順序不太對——想想：地基 → 工作目錄 → 依賴清單 → 裝依賴 → 程式碼 → 標注 port → 啟動指令。';
  }

  function mountBoard(ctx) {
    var board = h('div', 'df-board');
    board.innerHTML =
      '<div class="df-col"><h4>打亂的指令卡（點擊或拖曳到右邊）</h4><div class="df-pool"></div></div>' +
      '<div class="df-col"><h4>Dockerfile（由上而下）</h4><div class="df-slots">' +
      '<div class="df-slot-hint">把卡片依正確順序放進來</div></div></div>';
    var fb = h('div', 'df-feedback');
    ctx.overlay.appendChild(board);
    ctx.overlay.appendChild(fb);
    var pool = board.querySelector('.df-pool');
    var slots = board.querySelector('.df-slots');
    var placed = [];

    var shuffled = CARDS.slice().sort(function () { return Math.random() - 0.5; });
    if (shuffled[0].text === 'FROM node:20') { shuffled.push(shuffled.shift()); }

    function feedback(msg, good) {
      fb.textContent = msg;
      fb.className = 'df-feedback on' + (good ? ' good' : '');
      root.DG.audio.play(good ? 'ok' : 'error');
      clearTimeout(fb._t);
      fb._t = setTimeout(function () { fb.classList.remove('on'); }, good ? 2600 : 5200);
    }

    function tryPlace(card, el) {
      var pos = placed.length;
      if (card.text !== CARDS[pos].text) {
        el.classList.add('shake');
        setTimeout(function () { el.classList.remove('shake'); }, 500);
        feedback(rejectReason(card, pos, placed), false);
        return;
      }
      placed.push(card);
      el.remove();
      var hint = slots.querySelector('.df-slot-hint');
      if (hint) { hint.remove(); }
      var layerNo = placed.filter(function (c) { return isLayerInst(c.inst); }).length;
      var noteHtml = isLayerInst(card.inst) ? ('layer ' + layerNo + '（唯讀層）') : 'metadata · 不佔層';
      var done = h('div', 'df-card' + (isLayerInst(card.inst) ? '' : ' meta-card'),
        '<span class="df-inst">' + card.inst + '</span>' +
        card.text.slice(card.inst.length) + '<div class="df-note">' + noteHtml + '</div>');
      done.style.cursor = 'default';
      slots.appendChild(done);
      root.DG.audio.play('place');
      if (placed.length === CARDS.length) { complete(); }
      else if (card.text === 'COPY package.json .') {
        feedback('好眼力！先搬依賴清單——等下 build cache 那步你就知道為什麼。', true);
      }
    }

    function complete() {
      feedback('Dockerfile 完成！到終端機執行 docker build -t myapp . 開始建造。', true);
      ctx.flags.fileVersions = { 'package.json': 1, 'server.js': 1 };
      ctx.cli.setBuildContext({ steps: CARDS, fileVersions: ctx.flags.fileVersions });
      ctx.flag('dfOrdered');
      setTimeout(function () {
        board.style.transition = 'opacity 0.6s';
        board.style.opacity = '0';
        setTimeout(function () { board.remove(); }, 650);
      }, 1600);
    }

    shuffled.forEach(function (card) {
      var el = h('div', 'df-card',
        '<span class="df-inst">' + card.inst + '</span>' + card.text.slice(card.inst.length) +
        '<div class="df-note">' + card.note + '</div>');
      el.draggable = true;
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', '指令卡 ' + card.text + '（按 Enter 放進 Dockerfile）');
      el.addEventListener('click', function () { tryPlace(card, el); });
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); tryPlace(card, el); }
      });
      el.addEventListener('dragstart', function (ev) {
        el.classList.add('dragging');
        ev.dataTransfer.setData('text/plain', card.text);
      });
      el.addEventListener('dragend', function () { el.classList.remove('dragging'); });
      pool.appendChild(el);
    });
    slots.addEventListener('dragover', function (ev) { ev.preventDefault(); });
    slots.addEventListener('drop', function (ev) {
      ev.preventDefault();
      var text = ev.dataTransfer.getData('text/plain');
      var card = CARDS.filter(function (c) { return c.text === text; })[0];
      var el = null;
      pool.querySelectorAll('.df-card').forEach(function (d) {
        if (d.textContent.indexOf(text.slice(0, 8)) >= 0 && !el) { el = d; }
      });
      if (card && el) { tryPlace(card, el); }
    });
  }

  function brickBadge(s, layerStep) {
    if (!layerStep) { return '<span class="brick-badge meta">metadata · 不佔層</span>'; }
    if (s.cached) { return '<span class="brick-badge cached">⚡ CACHED · 0.0s</span>'; }
    var secs = BUILD_SECS[s.step.text] || 0.5;
    return '<span class="brick-badge fresh">建造 ' + secs.toFixed(1) + 's</span>';
  }

  function animateLayers(ctx, buildResult) {
    var old = ctx.overlay.querySelector('.layer-stack');
    if (old) { old.remove(); }
    var stack = h('div', 'layer-stack');
    ctx.overlay.appendChild(stack);
    var totalSecs = 0;
    buildResult.steps.forEach(function (s, i) {
      if (isLayerInst(s.step.inst) && !s.cached) { totalSecs += BUILD_SECS[s.step.text] || 0.5; }
      setTimeout(function () {
        var layerStep = isLayerInst(s.step.inst);
        var brick = h('div', 'layer-brick' + (s.cached ? ' cached-brick' : '') + (layerStep ? '' : ' meta-brick'),
          '<span class="brick-text">' + s.step.text + '</span>' + brickBadge(s, layerStep));
        stack.appendChild(brick);
        root.DG.audio.play(s.cached ? 'click' : 'place');
      }, i * (s.cached ? 110 : 380));
    });
    var buildMs = buildResult.steps.length * 400;
    setTimeout(function () {
      // 疊完後：頂部放總耗時＋圖例，第二次 build 的秒數對比就是 cache 教學的爆點
      var cachedCount = buildResult.steps.filter(function (s) { return s.cached; }).length;
      var total = h('div', 'layer-total',
        '本次 build 總耗時 ≈ <b>' + totalSecs.toFixed(1) + 's</b>' +
        (cachedCount ? '（' + cachedCount + ' 步 CACHED 秒過，只重蓋變動之後的層）' : ''));
      stack.appendChild(total);
      var legend = h('div', 'layer-legend',
        '<span><i class="lg-dot fresh"></i>藍＝這次重新建造（花時間）</span>' +
        '<span><i class="lg-dot cached"></i>黃＝CACHED：內容沒變，直接重用（0 秒）</span>' +
        '<span><i class="lg-dot meta"></i>灰薄片＝metadata：只是設定，不佔層</span>');
      stack.appendChild(legend);
    }, buildMs + 250);
    setTimeout(function () {
      stack.style.transition = 'opacity 1s';
      stack.style.opacity = '0';
      setTimeout(function () { stack.remove(); }, 1100);
    }, buildMs + 12600);   // 與 resultDelay 對齊：結算蓋上來之前都保持可讀
  }

  function showEditButton(ctx) {
    if (ctx.overlay.querySelector('.df-edit-btn')) { return; }
    var btn = h('button', 'btn small df-edit-btn', '修改 server.js（然後重新 build 看 cache）');
    btn.style.cssText = 'position:absolute;top:14px;right:16px;z-index:30;';
    btn.addEventListener('click', function () {
      ctx.flags.fileVersions['server.js'] = 2;
      ctx.cli.setBuildContext({ steps: CARDS, fileVersions: ctx.flags.fileVersions });
      ctx.flag('editedSource');
      btn.disabled = true;
      btn.textContent = 'server.js 已修改 ✓ 去重新 build！';
      ctx.stage.caption('程式碼改了一行——再 build 一次，注意前幾層的 CACHED。');
      root.DG.audio.play('click');
    });
    ctx.overlay.appendChild(btn);
  }

  root.DG.registerLevel({
    id: 8,
    name: '藍圖設計師',
    topic: 'Dockerfile · layer · cache',
    glyph: 'blueprint',
    terminal: true,
    resultDelay: 15000,   // layer 動畫資訊量大：疊磚 ~3s + 觀賞 12s 再跳結算（覆寫全域 8s）
    story: [
      '你已經會「用」別人的藍圖了，今天升級——<b>自己設計藍圖</b>。',
      '藍圖的設計稿叫 <code>Dockerfile</code>：一行一個指令，其中 FROM／COPY／RUN 這類會各疊出一層 layer（樓層）。',
      '風把我桌上的指令卡吹亂了！幫我把它們排回正確順序——順序錯了，蓋出來的藍圖會又慢又壞。'
    ],
    teach: {
      title: 'Dockerfile 與 layer cache',
      html: '<p>常用指令：<code>FROM</code> 基底藍圖、<code>WORKDIR</code> 工作目錄、<code>COPY</code> 搬檔案、' +
        '<code>RUN</code> 建造期執行、<code>EXPOSE</code> 標注 port、<code>CMD</code> 啟動指令。</p>' +
        '<p>建造指令 <code>docker build -t myapp .</code> 拆開看：<code>build</code>＝照 Dockerfile 蓋出 image；' +
        '<code>-t myapp</code>＝幫蓋好的 image 取名字（tag），之後才能 <code>docker run myapp</code>；' +
        '最後的 <code>.</code>＝<b>build context</b>——告訴 Docker「去哪個資料夾找 Dockerfile 和要 COPY 的檔案」，' +
        '<code>.</code> 就是「目前所在的資料夾」。</p>' +
        '<p>其中 <code>FROM</code>（基底）、<code>COPY</code>／<code>ADD</code>（搬檔）、<code>RUN</code>（執行）會各疊一層<b>唯讀 layer</b>；' +
        '<code>WORKDIR</code>／<code>EXPOSE</code>／<code>CMD</code> 只是設定（metadata），<b>不佔檔案系統層</b>。</p>' +
        '<p>重 build 時，沒變動的層直接用 <b>cache</b>（秒過）；<b>一層變了，它之後的所有層都要重蓋</b>。</p>' +
        '<p>所以把「不常變的」放上面、「常變的」放下面——這就是先 COPY package.json 再 npm install 的理由。</p>',
      map: '<b>港口比喻</b>：Dockerfile＝藍圖設計稿；layer＝一層層疊起來的發光地基；cache＝已經蓋好、可直接重用的樓層。'
    },
    outro: 'Dockerfile 由上而下逐層蓋；順序決定 cache 命中率——少變的在上，常變的在下。',
    setup: function (ctx) {
      mountBoard(ctx);
    },
    objectives: [
      { text: '把 7 張指令卡排成正確的 Dockerfile（放錯會告訴你為什麼）',
        hints: ['第一張一定是 FROM——先有地基。',
          '中段順序的靈魂：COPY package.json . → RUN npm install → COPY . .（為了 cache）。',
          '完整順序：FROM → WORKDIR → COPY package.json . → RUN npm install → COPY . . → EXPOSE → CMD'],
        check: function (result, ctx) { return ctx.flags.dfOrdered; } },
      { text: '執行 <code>docker build -t myapp .</code>，看它逐行建置（FROM／COPY／RUN 會疊出實體層）',
        hints: ['build 要給名字（-t）和建置目錄（.）。',
          '骨架：docker build -t _____ .（名字用 myapp，最後的點別忘）。',
          '完整指令：docker build -t myapp .'],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'build' && result.parsed.tag === 'myapp';
        },
        onDone: function (ctx, result) {
          animateLayers(ctx, result.buildResult);
          setTimeout(function () { showEditButton(ctx); }, 3200);
        } },
      { text: '按右上角「修改 server.js」，再 build 一次——體驗 cache 的威力',
        hints: ['先按舞台右上角的按鈕改程式碼，再重打同一個 build 指令。',
          '重打：docker build -t myapp .（注意這次前幾層變成 CACHED，只有後面重蓋）。',
          '按「修改 server.js」按鈕，然後執行：docker build -t myapp .'],
        check: function (result, ctx) {
          return !!(ctx.flags.editedSource && result && result.ok &&
            result.parsed.cmd === 'build' && result.parsed.cachedCount >= 3);
        },
        onDone: function (ctx, result) {
          animateLayers(ctx, result.buildResult);
          ctx.stage.caption('前 ' + result.parsed.cachedCount + ' 層 CACHED 秒過，只重蓋改動之後的層——這就是把 COPY . . 放後面的回報。', 6000);
        } }
    ]
  });
}(typeof globalThis !== 'undefined' ? globalThis : this));
