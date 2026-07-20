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

  // 注意：inst/text 是 Docker 語法本身，且被程式比對（card.text !== CARDS[pos].text），不可翻；只有 note 是說明文字
  var CARDS = [
    { inst: 'FROM', text: 'FROM node:20', note: { zh: '地基：從一張基底藍圖開始', en: 'Foundation: start from a base blueprint' } },
    { inst: 'WORKDIR', text: 'WORKDIR /app', note: { zh: '之後的操作都在這個艙房進行', en: 'Everything after this happens in this cabin' } },
    { inst: 'COPY', text: 'COPY package.json .', note: { zh: '先只搬「依賴清單」', en: 'Copy only the "dependency list" first' }, file: 'package.json' },
    { inst: 'RUN', text: 'RUN npm install', note: { zh: '安裝依賴（最花時間的一層）', en: 'Install dependencies (the slowest layer)' } },
    { inst: 'COPY', text: 'COPY . .', note: { zh: '搬入全部程式碼', en: 'Copy in all the source code' }, file: 'server.js' },
    { inst: 'EXPOSE', text: 'EXPOSE 3000', note: { zh: '標注貨櫃的艙門號', en: "Label the container's hatch number" } },
    { inst: 'CMD', text: 'CMD ["node","server.js"]', note: { zh: '容器啟動時要跑的指令', en: 'The command to run when the container starts' } }
  ];

  // rejectReason 只在互動時（tryPlace）被呼叫，回傳值直接餵給 feedback()，故在此就地 DG.t
  function rejectReason(card, pos, placed) {
    if (pos === 0 && card.text !== 'FROM node:20') {
      return root.DG.t({ zh: 'Dockerfile 第一行必須是 FROM——沒有基底藍圖，後面什麼都蓋不起來。',
        en: 'The first line of a Dockerfile must be FROM — without a base blueprint, nothing above it can be built.' });
    }
    if (card.inst === 'CMD' && pos < CARDS.length - 1) {
      return root.DG.t({ zh: 'CMD 是「容器啟動時做什麼」，不是建造步驟——而且一個 Dockerfile 只有最後一個 CMD 算數，習慣放最後一行。',
        en: 'CMD is "what to do when the container starts", not a build step — and only the last CMD in a Dockerfile counts, so it belongs on the last line.' });
    }
    if (card.text === 'RUN npm install' && !placed.some(function (c) { return c.text === 'COPY package.json .'; })) {
      return root.DG.t({ zh: 'npm install 需要 package.json 才知道要裝什麼——先把它 COPY 進來。',
        en: 'npm install needs package.json to know what to install — COPY it in first.' });
    }
    if (card.text === 'COPY . .' && !placed.some(function (c) { return c.text === 'RUN npm install'; })) {
      return root.DG.t({ zh: '先只 COPY package.json、npm install，「最後」才 COPY 全部程式碼——因為程式碼天天改、依賴不常改，' +
        '這樣改程式碼重 build 時，安裝依賴那層可以吃 cache，省下大把時間。',
        en: 'COPY package.json and run npm install first, and COPY the full source code "last" — because code changes daily while dependencies rarely do. ' +
        'That way, when you rebuild after a code change, the dependency-install layer can reuse the cache and save a lot of time.' });
    }
    if (card.inst === 'COPY' && !placed.some(function (c) { return c.inst === 'WORKDIR'; })) {
      return root.DG.t({ zh: '先用 WORKDIR 指定工作目錄，之後的 COPY／RUN 都以它為基準，路徑才不會亂。',
        en: 'Set the working directory with WORKDIR first, so the later COPY/RUN steps are all relative to it and paths stay tidy.' });
    }
    return root.DG.t({ zh: '順序不太對——想想：地基 → 工作目錄 → 依賴清單 → 裝依賴 → 程式碼 → 標注 port → 啟動指令。',
      en: 'The order is off — think: foundation → working directory → dependency list → install dependencies → source code → expose port → start command.' });
  }

  function mountBoard(ctx) {
    var board = h('div', 'df-board');
    board.innerHTML =
      '<div class="df-col"><h4>' + root.DG.t({ zh: '打亂的指令卡（點擊或拖曳到右邊）', en: 'Shuffled instruction cards (click or drag to the right)' }) + '</h4><div class="df-pool"></div></div>' +
      '<div class="df-col"><h4>' + root.DG.t({ zh: 'Dockerfile（由上而下）', en: 'Dockerfile (top to bottom)' }) + '</h4><div class="df-slots">' +
      '<div class="df-slot-hint">' + root.DG.t({ zh: '把卡片依正確順序放進來', en: 'Drop the cards here in the correct order' }) + '</div></div></div>';
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
      var noteHtml = isLayerInst(card.inst)
        ? root.DG.t({ zh: 'layer {n}（唯讀層）', en: 'layer {n} (read-only layer)' }, { n: layerNo })
        : root.DG.t({ zh: 'metadata · 不佔層', en: 'metadata · no layer' });
      var done = h('div', 'df-card' + (isLayerInst(card.inst) ? '' : ' meta-card'),
        '<span class="df-inst">' + card.inst + '</span>' +
        card.text.slice(card.inst.length) + '<div class="df-note">' + noteHtml + '</div>');
      done.style.cursor = 'default';
      slots.appendChild(done);
      root.DG.audio.play('place');
      if (placed.length === CARDS.length) { complete(); }
      else if (card.text === 'COPY package.json .') {
        feedback(root.DG.t({ zh: '好眼力！先搬依賴清單——等下 build cache 那步你就知道為什麼。',
          en: "Good eye! Copy the dependency list first — you'll see why at the build-cache step soon." }), true);
      }
    }

    function complete() {
      feedback(root.DG.t({ zh: 'Dockerfile 完成！到終端機執行 docker build -t myapp . 開始建造。',
        en: 'Dockerfile complete! Head to the terminal and run docker build -t myapp . to start building.' }), true);
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
        '<div class="df-note">' + root.DG.t(card.note) + '</div>');
      el.draggable = true;
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', root.DG.t({ zh: '指令卡 {t}（按 Enter 放進 Dockerfile）',
        en: 'Instruction card {t} (press Enter to place it into the Dockerfile)' }, { t: card.text }));
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
    if (!layerStep) { return '<span class="brick-badge meta">' + root.DG.t({ zh: 'metadata · 不佔層', en: 'metadata · no layer' }) + '</span>'; }
    if (s.cached) { return '<span class="brick-badge cached">⚡ CACHED · 0.0s</span>'; }
    var secs = BUILD_SECS[s.step.text] || 0.5;
    return '<span class="brick-badge fresh">' + root.DG.t({ zh: '建造 {s}s', en: 'build {s}s' }, { s: secs.toFixed(1) }) + '</span>';
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
        root.DG.t({ zh: '本次 build 總耗時 ≈ <b>{s}s</b>', en: 'Total build time this round ≈ <b>{s}s</b>' }, { s: totalSecs.toFixed(1) }) +
        (cachedCount ? root.DG.t({ zh: '（{n} 步 CACHED 秒過，只重蓋變動之後的層）',
          en: ' ({n} steps CACHED in an instant — only layers after the change are rebuilt)' }, { n: cachedCount }) : ''));
      stack.appendChild(total);
      var legend = h('div', 'layer-legend',
        '<span><i class="lg-dot fresh"></i>' + root.DG.t({ zh: '藍＝這次重新建造（花時間）', en: 'Blue = rebuilt this round (takes time)' }) + '</span>' +
        '<span><i class="lg-dot cached"></i>' + root.DG.t({ zh: '黃＝CACHED：內容沒變，直接重用（0 秒）', en: 'Yellow = CACHED: content unchanged, reused directly (0 s)' }) + '</span>' +
        '<span><i class="lg-dot meta"></i>' + root.DG.t({ zh: '灰薄片＝metadata：只是設定，不佔層', en: 'Gray sliver = metadata: just settings, no layer' }) + '</span>');
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
    var btn = h('button', 'btn small df-edit-btn', root.DG.t({ zh: '修改 server.js（然後重新 build 看 cache）',
      en: 'Edit server.js (then rebuild to see the cache)' }));
    btn.style.cssText = 'position:absolute;top:14px;right:16px;z-index:30;';
    btn.addEventListener('click', function () {
      ctx.flags.fileVersions['server.js'] = 2;
      ctx.cli.setBuildContext({ steps: CARDS, fileVersions: ctx.flags.fileVersions });
      ctx.flag('editedSource');
      btn.disabled = true;
      btn.textContent = root.DG.t({ zh: 'server.js 已修改 ✓ 去重新 build！', en: 'server.js edited ✓ go rebuild!' });
      ctx.stage.caption(root.DG.t({ zh: '程式碼改了一行——再 build 一次，注意前幾層的 CACHED。',
        en: 'One line of code changed — build again and watch the first few layers turn CACHED.' }));
      root.DG.audio.play('click');
    });
    ctx.overlay.appendChild(btn);
  }

  root.DG.registerLevel({
    id: 8,
    name: { zh: '藍圖設計師', en: 'The Blueprint Designer' },
    topic: 'Dockerfile · layer · cache',
    glyph: 'blueprint',
    terminal: true,
    resultDelay: 15000,   // layer 動畫資訊量大：疊磚 ~3s + 觀賞 12s 再跳結算（覆寫全域 8s）
    story: [
      { zh: '你已經會「用」別人的藍圖了，今天升級——<b>自己設計藍圖</b>。',
        en: 'You can already "use" other people\'s blueprints — today you level up: <b>design your own blueprint</b>.' },
      { zh: '藍圖的設計稿叫 <code>Dockerfile</code>：一行一個指令，其中 FROM／COPY／RUN 這類會各疊出一層 layer（樓層）。',
        en: 'A blueprint\'s draft is called a <code>Dockerfile</code>: one instruction per line, and the FROM/COPY/RUN kind each stack up a layer (a floor).' },
      { zh: '風把我桌上的指令卡吹亂了！幫我把它們排回正確順序——順序錯了，蓋出來的藍圖會又慢又壞。',
        en: 'The wind scattered the instruction cards on my desk! Help me put them back in the right order — get the order wrong and the blueprint you build will be slow and broken.' }
    ],
    teach: {
      title: { zh: 'Dockerfile 與 layer cache', en: 'Dockerfile and layer cache' },
      html: {
        zh: '<p>常用指令：<code>FROM</code> 基底藍圖、<code>WORKDIR</code> 工作目錄、<code>COPY</code> 搬檔案、' +
          '<code>RUN</code> 建造期執行、<code>EXPOSE</code> 標注 port、<code>CMD</code> 啟動指令。</p>' +
          '<p>建造指令 <code>docker build -t myapp .</code> 拆開看：<code>build</code>＝照 Dockerfile 蓋出 image；' +
          '<code>-t myapp</code>＝幫蓋好的 image 取名字（tag），之後才能 <code>docker run myapp</code>；' +
          '最後的 <code>.</code>＝<b>build context</b>——告訴 Docker「去哪個資料夾找 Dockerfile 和要 COPY 的檔案」，' +
          '<code>.</code> 就是「目前所在的資料夾」。</p>' +
          '<p>其中 <code>FROM</code>（基底）、<code>COPY</code>／<code>ADD</code>（搬檔）、<code>RUN</code>（執行）會各疊一層<b>唯讀 layer</b>；' +
          '<code>WORKDIR</code>／<code>EXPOSE</code>／<code>CMD</code> 只是設定（metadata），<b>不佔檔案系統層</b>。</p>' +
          '<p>重 build 時，沒變動的層直接用 <b>cache</b>（秒過）；<b>一層變了，它之後的所有層都要重蓋</b>。</p>' +
          '<p>所以把「不常變的」放上面、「常變的」放下面——這就是先 COPY package.json 再 npm install 的理由。</p>',
        en: '<p>Common instructions: <code>FROM</code> base blueprint, <code>WORKDIR</code> working directory, <code>COPY</code> move files in, ' +
          '<code>RUN</code> run at build time, <code>EXPOSE</code> label a port, <code>CMD</code> start command.</p>' +
          '<p>Break down the build command <code>docker build -t myapp .</code>: <code>build</code> = build an image from the Dockerfile; ' +
          '<code>-t myapp</code> = give the built image a name (tag) so you can later <code>docker run myapp</code>; ' +
          'the trailing <code>.</code> = <b>build context</b> — it tells Docker "which folder to look in for the Dockerfile and the files to COPY", ' +
          'and <code>.</code> means "the folder you are currently in".</p>' +
          '<p>Of these, <code>FROM</code> (base), <code>COPY</code>/<code>ADD</code> (move files) and <code>RUN</code> (execute) each stack a <b>read-only layer</b>; ' +
          '<code>WORKDIR</code>/<code>EXPOSE</code>/<code>CMD</code> are just settings (metadata) and <b>take no filesystem layer</b>.</p>' +
          '<p>On a rebuild, unchanged layers reuse the <b>cache</b> (instant); <b>once a layer changes, every layer after it must be rebuilt</b>.</p>' +
          '<p>So put the "rarely changing" parts on top and the "often changing" parts at the bottom — that is exactly why you COPY package.json before npm install.</p>'
      },
      map: { zh: '<b>港口比喻</b>：Dockerfile＝藍圖設計稿；layer＝一層層疊起來的發光地基；cache＝已經蓋好、可直接重用的樓層。',
        en: '<b>Harbor Analogy</b>: Dockerfile = the blueprint draft; layer = glowing foundations stacked floor by floor; cache = floors already built that can be reused directly.' }
    },
    outro: { zh: 'Dockerfile 由上而下逐層蓋；順序決定 cache 命中率——少變的在上，常變的在下。',
      en: 'A Dockerfile is built layer by layer, top to bottom; the order decides your cache hit rate — rarely changing on top, often changing at the bottom.' },
    setup: function (ctx) {
      mountBoard(ctx);
    },
    objectives: [
      { text: { zh: '把 7 張指令卡排成正確的 Dockerfile（放錯會告訴你為什麼）',
          en: 'Arrange the 7 instruction cards into a correct Dockerfile (a wrong placement tells you why)' },
        hints: [
          { zh: '第一張一定是 FROM——先有地基。', en: 'The first card is always FROM — you need the foundation first.' },
          { zh: '中段順序的靈魂：COPY package.json . → RUN npm install → COPY . .（為了 cache）。',
            en: 'The heart of the middle order: COPY package.json . → RUN npm install → COPY . . (for the cache).' },
          { zh: '完整順序：FROM → WORKDIR → COPY package.json . → RUN npm install → COPY . . → EXPOSE → CMD',
            en: 'Full order: FROM → WORKDIR → COPY package.json . → RUN npm install → COPY . . → EXPOSE → CMD' }],
        check: function (result, ctx) { return ctx.flags.dfOrdered; } },
      { text: { zh: '執行 <code>docker build -t myapp .</code>，看它逐行建置（FROM／COPY／RUN 會疊出實體層）',
          en: 'Run <code>docker build -t myapp .</code> and watch it build line by line (FROM/COPY/RUN stack up real layers)' },
        hints: [
          { zh: 'build 要給名字（-t）和建置目錄（.）。', en: 'build needs a name (-t) and a build directory (.).' },
          { zh: '骨架：docker build -t _____ .（名字用 myapp，最後的點別忘）。',
            en: "Skeleton: docker build -t _____ . (use myapp for the name, don't forget the trailing dot)." },
          { zh: '完整指令：docker build -t myapp .', en: 'Full command: docker build -t myapp .' }],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'build' && result.parsed.tag === 'myapp';
        },
        onDone: function (ctx, result) {
          animateLayers(ctx, result.buildResult);
          setTimeout(function () { showEditButton(ctx); }, 3200);
        } },
      { text: { zh: '按右上角「修改 server.js」，再 build 一次——體驗 cache 的威力',
          en: 'Click "Edit server.js" in the top-right, then build again — feel the power of the cache' },
        hints: [
          { zh: '先按舞台右上角的按鈕改程式碼，再重打同一個 build 指令。',
            en: 'First click the button in the top-right of the stage to change the code, then retype the same build command.' },
          { zh: '重打：docker build -t myapp .（注意這次前幾層變成 CACHED，只有後面重蓋）。',
            en: 'Retype: docker build -t myapp . (notice the first few layers turn CACHED this time, only the later ones rebuild).' },
          { zh: '按「修改 server.js」按鈕，然後執行：docker build -t myapp .',
            en: 'Click the "Edit server.js" button, then run: docker build -t myapp .' }],
        check: function (result, ctx) {
          return !!(ctx.flags.editedSource && result && result.ok &&
            result.parsed.cmd === 'build' && result.parsed.cachedCount >= 3);
        },
        onDone: function (ctx, result) {
          animateLayers(ctx, result.buildResult);
          ctx.stage.caption(root.DG.t({ zh: '前 {n} 層 CACHED 秒過，只重蓋改動之後的層——這就是把 COPY . . 放後面的回報。',
            en: "The first {n} layers went CACHED in an instant — only layers after the change get rebuilt. That's the payoff for putting COPY . . last." }, { n: result.parsed.cachedCount }), 6000);
        } }
    ]
  });
}(typeof globalThis !== 'undefined' ? globalThis : this));
