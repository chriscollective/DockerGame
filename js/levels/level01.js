/*
 * level01.js — 第 1 關「貨櫃與大船」：VM vs Container 互動比較 + 小測驗（無終端機）
 */
(function (root) {
  'use strict';
  var h = root.DG.h;

  // 貨物名（{zh,en}）——在 loadVM/loadCT 渲染時才 DG.t()，不可在此求值
  var CARGO = [
    { zh: '郵件服務', en: 'Mail service' },
    { zh: '網頁商店', en: 'Web store' },
    { zh: '報表系統', en: 'Reporting system' }
  ];
  // 測驗題（{zh,en}）——q/opts/why 在 buildQuiz 的 renderQ/answer 渲染時才 DG.t()；ans 是索引不翻
  var QUIZ = [
    { q: { zh: '為什麼貨櫃（container）啟動比大船（VM）快這麼多？',
           en: 'Why does a container start up so much faster than a ship (VM)?' },
      opts: [
        { zh: '因為它不用搬一整套客用作業系統，直接共用主機的 kernel',
          en: 'Because it does not haul a whole guest OS — it shares the host kernel directly' },
        { zh: '因為貨櫃裡的程式碼寫得比較好',
          en: 'Because the code inside the container is written better' },
        { zh: '因為貨櫃一定跑在比較快的機器上',
          en: 'Because a container always runs on a faster machine' }],
      ans: 0,
      why: { zh: 'VM 每艘都要載一套完整的 Guest OS（開機就要幾十秒）；容器只打包應用程式和依賴，' +
               '核心（kernel）直接借用主機的，所以啟動是秒級的。',
             en: 'Every VM must load a full Guest OS (booting alone takes tens of seconds); a container ' +
               'only packages the app and its dependencies and borrows the host kernel directly, so startup is a matter of seconds.' } },
    { q: { zh: '同一台主機上的多個容器，「共用」的是什麼？',
           en: 'What do multiple containers on the same host "share"?' },
      opts: [
        { zh: '彼此的應用程式資料', en: 'Each other\'s application data' },
        { zh: '主機的作業系統核心（kernel）', en: 'The host\'s operating system kernel' },
        { zh: '什麼都不共用，完全隔離', en: 'Nothing — they are completely isolated' }],
      ans: 1,
      why: { zh: '容器之間的檔案系統、程序、網路是隔離的，但它們都跑在同一個主機 kernel 上——' +
               '這正是輕量的來源，也是它和 VM 最大的差別。',
             en: 'Containers have isolated file systems, processes, and networks, but they all run on the same ' +
               'host kernel — that is exactly where their lightness comes from, and the biggest difference from a VM.' } },
    { q: { zh: '那什麼時候反而該選 VM？',
           en: 'So when should you pick a VM instead?' },
      opts: [
        { zh: '想要省記憶體的時候', en: 'When you want to save memory' },
        { zh: '想要啟動快的時候', en: 'When you want fast startup' },
        { zh: '需要跑完全不同的作業系統核心、或要更強的隔離時',
          en: 'When you need a completely different OS kernel, or stronger isolation' }],
      ans: 2,
      why: { zh: '容器共用主機 kernel，所以 Linux 主機跑不了 Windows 容器核心；' +
               '需要核心級隔離（例如多租戶安全邊界）時，VM 仍是對的工具。',
             en: 'Containers share the host kernel, so a Linux host can\'t run a Windows container kernel; ' +
               'when you need kernel-level isolation (e.g. a multi-tenant security boundary), a VM is still the right tool.' } }
  ];

  function buildLane(kind) {
    var isVM = kind === 'vm';
    var lane = h('div', 'lane' + (isVM ? ' active-lane' : ' ct-lane'));
    var title = isVM
      ? root.DG.t({ zh: '傳統大船（虛擬機 VM）', en: 'Old-style ship (VM)' })
      : root.DG.t({ zh: '貨櫃船（Container）', en: 'Container ship' });
    var tag = isVM
      ? root.DG.t({ zh: '每件貨 = 造一艘船', en: 'Each cargo = one whole ship' })
      : root.DG.t({ zh: '共用船底 = 共用 kernel', en: 'Shared hull = shared kernel' });
    var meterLabel = root.DG.t({ zh: '碼頭資源佔用', en: 'Dock resource usage' });
    var loadLabel = isVM
      ? root.DG.t({ zh: '造船載貨（{n}/3）', en: 'Build & load ({n}/3)' }, { n: 0 })
      : root.DG.t({ zh: '裝櫃出貨（{n}/3）', en: 'Pack & ship ({n}/3)' }, { n: 0 });
    lane.innerHTML =
      '<h4>' + title +
      '<span class="lane-tag">' + tag + '</span></h4>' +
      '<div class="fleet"></div>' +
      '<div class="lane-meter">' + meterLabel + ' <span class="meter-num">0%</span>' +
      '<div class="meter-bar"><div class="meter-fill"></div></div></div>' +
      '<button class="btn small primary load-btn">' + loadLabel + '</button>';
    if (!isVM) {
      lane.querySelector('.fleet').appendChild(h('div', 'ct-base', HULL_SVG +
        '<span class="ct-base-label">' +
        root.DG.t({ zh: '共用船底：主機 kernel（所有貨櫃共用這一艘）',
          en: 'Shared hull: host kernel (every container shares this one)' }) + '</span>'));
      lane.querySelector('.load-btn').disabled = true;
    }
    return lane;
  }

  // 共用船底：一艘貨櫃船側影（斜艏在右、圓艉在左、水線 + 舷窗 + 船橋）
  var HULL_SVG =
    '<svg class="hull-svg" viewBox="0 0 340 52" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><linearGradient id="hullg" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#1d5a86"/><stop offset="1" stop-color="#081d30"/></linearGradient></defs>' +
    '<rect x="20" y="2" width="30" height="12" rx="2" fill="#123a5c" stroke="rgba(89,200,255,0.55)" stroke-width="1.2"/>' + // 船橋
    '<path d="M22 6 H30 M34 6 H42 M22 10 H30 M34 10 H42" stroke="rgba(150,220,255,0.6)" stroke-width="1.4"/>' +          // 船橋窗
    '<path d="M6 14 H316 L332 14 L314 44 L30 44 Q10 42 6 30 Z" fill="url(#hullg)" stroke="rgba(89,200,255,0.55)" stroke-width="1.6"/>' + // 船身
    '<path d="M9 15 H314" stroke="rgba(150,220,255,0.5)" stroke-width="1.4"/>' +   // 甲板高光
    '<path d="M16 35 H302" stroke="rgba(120,180,240,0.32)" stroke-width="1.4"/>' + // 水線
    '<g fill="#081d30" stroke="rgba(150,220,255,0.6)" stroke-width="0.9">' +        // 舷窗
    '<circle cx="120" cy="26" r="2.6"/><circle cx="150" cy="26" r="2.6"/><circle cx="180" cy="26" r="2.6"/>' +
    '<circle cx="210" cy="26" r="2.6"/><circle cx="240" cy="26" r="2.6"/><circle cx="270" cy="26" r="2.6"/></g>' +
    '</svg>';

  // 小圖：一艘吃水很深的傳統大船（船身含一整套 Guest OS）
  var SHIP_SVG =
    '<svg class="ship-ico" viewBox="0 0 96 44" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M6 26 H90 L80 40 H16 Z" fill="#6b5cae"/>' +            // 船身
    '<path d="M6 26 H90 L88 30 H8 Z" fill="#8a79d6"/>' +             // 甲板亮面
    '<rect x="40" y="12" width="30" height="14" rx="2" fill="#9a8ae0"/>' + // 駕駛艙
    '<rect x="46" y="4" width="8" height="9" rx="1.5" fill="#5a4c94"/>' +  // 煙囪
    '<rect x="12" y="18" width="22" height="8" rx="1.5" fill="#4f4285"/>' +// 貨艙
    '<path d="M4 40 Q14 44 24 40 T44 40 T64 40 T84 40 T96 40" fill="none" stroke="#3a6ea8" stroke-width="2" opacity="0.6"/>' +
    '</svg>';

  function loadVM(lane, idx, done) {
    var btn = lane.querySelector('.load-btn');
    btn.disabled = true;
    btn.textContent = root.DG.t({ zh: '正在建造整艘船（載入 Guest OS）…', en: 'Building the whole ship (loading Guest OS)…' });
    var ship = h('div', 'vm-ship',
      SHIP_SVG +
      '<div class="vs-row"><span>' + root.DG.t({ zh: '大船 #{n}', en: 'Ship #{n}' }, { n: idx + 1 }) + '</span><span>2.4GB</span></div>' +
      '<div class="vs-os">' + root.DG.t({ zh: 'Guest OS 開機中…', en: 'Guest OS booting…' }) + '</div>' +
      '<div class="vs-cargo">' + root.DG.t(CARGO[idx]) + '</div>');
    lane.querySelector('.fleet').appendChild(ship);
    root.DG.audio.play('splash');
    setTimeout(function () {
      ship.querySelector('.vs-os').textContent = root.DG.t({ zh: 'Guest OS ✓（佔 2GB）', en: 'Guest OS ✓ (uses 2GB)' });
      setMeter(lane, (idx + 1) * 28);
      btn.disabled = false;
      btn.textContent = root.DG.t({ zh: '造船載貨（{n}/3）', en: 'Build & load ({n}/3)' }, { n: idx + 1 });
      done();
    }, 1700);
  }

  function loadCT(lane, idx, done) {
    var crate = h('div', 'ct-crate',
      '<span class="ct-name">' + root.DG.t(CARGO[idx]) + '</span>' +
      '<span class="ct-mark">CTR-' + (idx + 1) + '</span>');
    crate.style.setProperty('--h', [205, 155, 25][idx]);
    lane.querySelector('.fleet').appendChild(crate);
    root.DG.audio.play('place');
    setMeter(lane, (idx + 1) * 7);
    lane.querySelector('.load-btn').textContent = root.DG.t({ zh: '裝櫃出貨（{n}/3）', en: 'Pack & ship ({n}/3)' }, { n: idx + 1 });
    setTimeout(done, 320);
  }

  function setMeter(lane, pct) {
    lane.querySelector('.meter-fill').style.width = pct + '%';
    lane.querySelector('.meter-num').textContent = pct + '%';
  }

  function buildQuiz(deck, ctx) {
    var box = h('div', 'quiz-box');
    deck.appendChild(box);
    var qi = 0;
    function renderQ() {
      var item = QUIZ[qi];
      box.innerHTML = '<div class="quiz-q">' +
        root.DG.t({ zh: 'Q{n}／{total}　{q}', en: 'Q{n} / {total}  {q}' },
          { n: qi + 1, total: QUIZ.length, q: root.DG.t(item.q) }) + '</div>';
      item.opts.forEach(function (opt, oi) {
        var b = h('button', 'quiz-opt', root.DG.t(opt));
        b.addEventListener('click', function () { answer(item, oi, b); });
        box.appendChild(b);
      });
    }
    function answer(item, oi, btn) {
      if (box.querySelector('.quiz-explain')) { return; }
      if (oi === item.ans) {
        btn.classList.add('right');
        root.DG.audio.play('ok');
        var ex = h('div', 'quiz-explain', root.DG.t({ zh: '答對了！', en: 'Correct! ' }) + root.DG.t(item.why));
        box.appendChild(ex);
        setTimeout(function () {
          qi++;
          if (qi < QUIZ.length) { renderQ(); }
          else { ctx.flag('quizDone'); box.innerHTML = '<div class="quiz-q">' +
            root.DG.t({ zh: '測驗完成——你已經懂容器為什麼輕了！',
              en: 'Quiz complete — now you know why containers are so light!' }) + '</div>'; }
        }, 2600);
      } else {
        btn.classList.add('wrong');
        root.DG.audio.play('error');
        var ex2 = h('div', 'quiz-explain', root.DG.t({ zh: '再想想：', en: 'Think again: ' }) + root.DG.t(item.why));
        box.appendChild(ex2);
        setTimeout(function () { renderQ(); }, 3200);
      }
    }
    renderQ();
  }

  root.DG.registerLevel({
    id: 1,
    name: { zh: '貨櫃與大船', en: 'Containers & Ships' },
    topic: 'VM vs Container',
    glyph: 'ship',
    terminal: false,
    story: [
      { zh: '嗨，新來的見習生！我是鯨魚船長，歡迎來到鯨魚港。',
        en: 'Hi there, new apprentice! I\'m Captain Whale — welcome to Whale Harbor.' },
      { zh: '在你摸終端機之前，先看懂一件事：為什麼全世界的碼頭都改用「貨櫃」了？',
        en: 'Before you touch a terminal, get one thing straight: why did every harbor in the world switch to "containers"?' },
      { zh: '左邊是老派做法——每送一件貨就造一艘大船。右邊是貨櫃船。你親手各載一次就懂了。',
        en: 'On the left is the old way — build a whole ship for every cargo. On the right is a container ship. Load each once yourself and you\'ll get it.' }
    ],
    teach: {
      title: { zh: '容器 vs 虛擬機', en: 'Container vs Virtual Machine' },
      html: { zh: '<p><b>虛擬機（VM）</b>：每台都要搬一整套客用作業系統（Guest OS），肥、慢、佔資源，但隔離最徹底。</p>' +
          '<p><b>容器（Container）</b>:只打包「應用程式＋依賴」，作業系統核心直接<b>共用主機的 kernel</b>——輕、快、密度高。</p>',
        en: '<p><b>Virtual Machine (VM)</b>: each one hauls a full guest operating system (Guest OS) — heavy, slow, resource-hungry, but the most thoroughly isolated.</p>' +
          '<p><b>Container</b>: packages only "app + dependencies"; its OS core <b>shares the host kernel</b> directly — light, fast, high density.</p>' },
      map: { zh: '<b>港口比喻</b>：大船＝VM（整艘含引擎）；貨櫃＝Container（只裝貨，共用同一艘船底＝主機 kernel）。',
        en: '<b>Harbor Analogy</b>: the ship = VM (the whole vessel, engine included); the container = Container (cargo only, sharing the same hull = host kernel).' }
    },
    outro: { zh: '記住這句就夠了：VM 搬整棟房子，容器只搬家當——因為地基（kernel）是共用的。',
      en: 'Just remember this: a VM moves the whole house, a container moves only your belongings — because the foundation (kernel) is shared.' },
    setup: function (ctx) {
      var deck = h('div', 'compare-deck');
      deck.innerHTML = '<h3>' + root.DG.t({ zh: '碼頭載貨實驗', en: 'Dockside loading experiment' }) + '</h3>' +
        '<div class="cd-sub">' + root.DG.t({ zh: '同樣 3 件貨，兩種載法。先用左邊的傳統大船。',
          en: 'Same 3 cargos, two ways to load them. Start with the old-style ship on the left.' }) + '</div>';
      var lanes = h('div', 'lanes');
      var vmLane = buildLane('vm');
      var ctLane = buildLane('ct');
      lanes.appendChild(vmLane);
      lanes.appendChild(ctLane);
      deck.appendChild(lanes);
      ctx.overlay.appendChild(deck);

      var vmCount = 0;
      var ctCount = 0;
      vmLane.querySelector('.load-btn').addEventListener('click', function () {
        if (vmCount >= 3) { return; }
        loadVM(vmLane, vmCount, function () {
          vmCount++;
          if (vmCount === 3) {
            vmLane.querySelector('.load-btn').disabled = true;
            vmLane.classList.remove('active-lane');
            ctLane.classList.add('active-lane');
            ctLane.querySelector('.load-btn').disabled = false;
            ctx.flag('vmDone');
          }
        });
      });
      ctLane.querySelector('.load-btn').addEventListener('click', function () {
        if (ctCount >= 3) { return; }
        loadCT(ctLane, ctCount, function () {
          ctCount++;
          if (ctCount === 3) {
            ctLane.querySelector('.load-btn').disabled = true;
            ctx.flag('ctDone');
            setTimeout(function () {
              lanes.style.display = 'none';
              deck.querySelector('.cd-sub').textContent = root.DG.t({ zh: '感受到差距了吧。船長要考你三題！',
                en: 'Feel the difference? Now the Captain has three questions for you!' });
              buildQuiz(deck, ctx);
            }, 900);
          }
        });
      });
    },
    objectives: [
      { text: { zh: '用<b>傳統大船</b>把 3 件貨都載出去（感受每艘都要載 Guest OS 有多重）',
          en: 'Use the <b>old-style ship</b> to load all 3 cargos (feel how heavy loading a Guest OS on each one is)' },
        hints: [
          { zh: '點左邊車道的「造船載貨」按鈕，連點三次、看看資源表。',
            en: 'Click the "Build & load" button in the left lane three times and watch the resource meter.' },
          { zh: '每造一艘船都要等 Guest OS 開機——這就是 VM 的日常。',
            en: 'Every ship you build waits for the Guest OS to boot — that\'s daily life with a VM.' },
          { zh: '按「造船載貨」三次即可完成。',
            en: 'Press "Build & load" three times to finish.' }],
        check: function (result, ctx) { return ctx.flags.vmDone; } },
      { text: { zh: '改用<b>貨櫃</b>載同樣 3 件貨（注意速度與資源差多少）',
          en: 'Switch to <b>containers</b> to load the same 3 cargos (notice how much the speed and resources differ)' },
        hints: [
          { zh: '右邊車道解鎖了，點「裝櫃出貨」。',
            en: 'The right lane is unlocked — click "Pack & ship".' },
          { zh: '貨櫃不用開機——它們直接坐在共用船底（主機 kernel）上。',
            en: 'Containers don\'t boot — they sit directly on the shared hull (host kernel).' },
          { zh: '按「裝櫃出貨」三次即可完成。',
            en: 'Press "Pack & ship" three times to finish.' }],
        check: function (result, ctx) { return ctx.flags.ctDone; } },
      { text: { zh: '通過船長的 3 題小測驗', en: 'Pass the Captain\'s 3-question quiz' },
        hints: [
          { zh: '答案都藏在剛剛的實驗和左邊的教學卡裡。',
            en: 'The answers are hidden in the experiment you just did and the teaching card on the left.' },
          { zh: '關鍵字：共用 kernel、只打包應用與依賴、核心級隔離選 VM。',
            en: 'Keywords: shared kernel, packages only app and dependencies, choose a VM for kernel-level isolation.' },
          { zh: '三題答案依序是：第 1 個、第 2 個、第 3 個選項。',
            en: 'The three answers in order are: option 1, option 2, option 3.' }],
        check: function (result, ctx) { return ctx.flags.quizDone; } }
    ]
  });
}(typeof globalThis !== 'undefined' ? globalThis : this));
