/*
 * level01.js — 第 1 關「貨櫃與大船」：VM vs Container 互動比較 + 小測驗（無終端機）
 */
(function (root) {
  'use strict';
  var h = root.DG.h;

  var CARGO = ['郵件服務', '網頁商店', '報表系統'];
  var QUIZ = [
    { q: '為什麼貨櫃（container）啟動比大船（VM）快這麼多？',
      opts: ['因為它不用搬一整套客用作業系統，直接共用主機的 kernel',
        '因為貨櫃裡的程式碼寫得比較好',
        '因為貨櫃一定跑在比較快的機器上'],
      ans: 0,
      why: 'VM 每艘都要載一套完整的 Guest OS（開機就要幾十秒）；容器只打包應用程式和依賴，' +
        '核心（kernel）直接借用主機的，所以啟動是秒級的。' },
    { q: '同一台主機上的多個容器，「共用」的是什麼？',
      opts: ['彼此的應用程式資料', '主機的作業系統核心（kernel）', '什麼都不共用，完全隔離'],
      ans: 1,
      why: '容器之間的檔案系統、程序、網路是隔離的，但它們都跑在同一個主機 kernel 上——' +
        '這正是輕量的來源，也是它和 VM 最大的差別。' },
    { q: '那什麼時候反而該選 VM？',
      opts: ['想要省記憶體的時候', '想要啟動快的時候',
        '需要跑完全不同的作業系統核心、或要更強的隔離時'],
      ans: 2,
      why: '容器共用主機 kernel，所以 Linux 主機跑不了 Windows 容器核心；' +
        '需要核心級隔離（例如多租戶安全邊界）時，VM 仍是對的工具。' }
  ];

  function buildLane(kind) {
    var isVM = kind === 'vm';
    var lane = h('div', 'lane' + (isVM ? ' active-lane' : ''));
    lane.innerHTML =
      '<h4>' + (isVM ? '傳統大船（虛擬機 VM）' : '貨櫃船（Container）') +
      '<span class="lane-tag">' + (isVM ? '每件貨 = 造一艘船' : '共用船底 = 共用 kernel') + '</span></h4>' +
      '<div class="fleet"></div>' +
      '<div class="lane-meter">碼頭資源佔用 <span class="meter-num">0%</span>' +
      '<div class="meter-bar"><div class="meter-fill"></div></div></div>' +
      '<button class="btn small primary load-btn">' + (isVM ? '造船載貨' : '裝櫃出貨') + '（0/3）</button>';
    if (!isVM) {
      lane.querySelector('.fleet').appendChild(
        h('div', 'ct-base', '共用船底：主機 kernel（所有貨櫃共用這一艘）'));
      lane.querySelector('.load-btn').disabled = true;
    }
    return lane;
  }

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
    btn.textContent = '正在建造整艘船（載入 Guest OS）…';
    var ship = h('div', 'vm-ship',
      SHIP_SVG +
      '<div class="vs-row"><span>大船 #' + (idx + 1) + '</span><span>2.4GB</span></div>' +
      '<div class="vs-os">Guest OS 開機中…</div>' +
      '<div class="vs-cargo">' + CARGO[idx] + '</div>');
    lane.querySelector('.fleet').appendChild(ship);
    root.DG.audio.play('splash');
    setTimeout(function () {
      ship.querySelector('.vs-os').textContent = 'Guest OS ✓（佔 2GB）';
      setMeter(lane, (idx + 1) * 28);
      btn.disabled = false;
      btn.textContent = '造船載貨（' + (idx + 1) + '/3）';
      done();
    }, 1700);
  }

  function loadCT(lane, idx, done) {
    var crate = h('div', 'ct-crate',
      '<span class="ct-name">' + CARGO[idx] + '</span>' +
      '<span class="ct-mark">CTR-' + (idx + 1) + '</span>');
    crate.style.setProperty('--h', [205, 155, 25][idx]);
    lane.querySelector('.fleet').appendChild(crate);
    root.DG.audio.play('place');
    setMeter(lane, (idx + 1) * 7);
    lane.querySelector('.load-btn').textContent = '裝櫃出貨（' + (idx + 1) + '/3）';
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
      box.innerHTML = '<div class="quiz-q">Q' + (qi + 1) + '／' + QUIZ.length + '　' + item.q + '</div>';
      item.opts.forEach(function (opt, oi) {
        var b = h('button', 'quiz-opt', opt);
        b.addEventListener('click', function () { answer(item, oi, b); });
        box.appendChild(b);
      });
    }
    function answer(item, oi, btn) {
      if (box.querySelector('.quiz-explain')) { return; }
      if (oi === item.ans) {
        btn.classList.add('right');
        root.DG.audio.play('ok');
        var ex = h('div', 'quiz-explain', '答對了！' + item.why);
        box.appendChild(ex);
        setTimeout(function () {
          qi++;
          if (qi < QUIZ.length) { renderQ(); }
          else { ctx.flag('quizDone'); box.innerHTML = '<div class="quiz-q">測驗完成——你已經懂容器為什麼輕了！</div>'; }
        }, 2600);
      } else {
        btn.classList.add('wrong');
        root.DG.audio.play('error');
        var ex2 = h('div', 'quiz-explain', '再想想：' + item.why);
        box.appendChild(ex2);
        setTimeout(function () { renderQ(); }, 3200);
      }
    }
    renderQ();
  }

  root.DG.registerLevel({
    id: 1,
    name: '貨櫃與大船',
    topic: 'VM vs Container',
    glyph: 'ship',
    terminal: false,
    story: [
      '嗨，新來的見習生！我是鯨魚船長，歡迎來到鯨魚港。',
      '在你摸終端機之前，先看懂一件事：為什麼全世界的碼頭都改用「貨櫃」了？',
      '左邊是老派做法——每送一件貨就造一艘大船。右邊是貨櫃船。你親手各載一次就懂了。'
    ],
    teach: {
      title: '容器 vs 虛擬機',
      html: '<p><b>虛擬機（VM）</b>：每台都要搬一整套客用作業系統（Guest OS），肥、慢、佔資源，但隔離最徹底。</p>' +
        '<p><b>容器（Container）</b>:只打包「應用程式＋依賴」，作業系統核心直接<b>共用主機的 kernel</b>——輕、快、密度高。</p>',
      map: '<b>港口比喻</b>：大船＝VM（整艘含引擎）；貨櫃＝Container（只裝貨，共用同一艘船底＝主機 kernel）。'
    },
    outro: '記住這句就夠了：VM 搬整棟房子，容器只搬家當——因為地基（kernel）是共用的。',
    setup: function (ctx) {
      var deck = h('div', 'compare-deck');
      deck.innerHTML = '<h3>碼頭載貨實驗</h3>' +
        '<div class="cd-sub">同樣 3 件貨，兩種載法。先用左邊的傳統大船。</div>';
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
              deck.querySelector('.cd-sub').textContent = '感受到差距了吧。船長要考你三題！';
              buildQuiz(deck, ctx);
            }, 900);
          }
        });
      });
    },
    objectives: [
      { text: '用<b>傳統大船</b>把 3 件貨都載出去（感受每艘都要載 Guest OS 有多重）',
        hints: ['點左邊車道的「造船載貨」按鈕，連點三次、看看資源表。',
          '每造一艘船都要等 Guest OS 開機——這就是 VM 的日常。',
          '按「造船載貨」三次即可完成。'],
        check: function (result, ctx) { return ctx.flags.vmDone; } },
      { text: '改用<b>貨櫃</b>載同樣 3 件貨（注意速度與資源差多少）',
        hints: ['右邊車道解鎖了，點「裝櫃出貨」。',
          '貨櫃不用開機——它們直接坐在共用船底（主機 kernel）上。',
          '按「裝櫃出貨」三次即可完成。'],
        check: function (result, ctx) { return ctx.flags.ctDone; } },
      { text: '通過船長的 3 題小測驗',
        hints: ['答案都藏在剛剛的實驗和左邊的教學卡裡。',
          '關鍵字：共用 kernel、只打包應用與依賴、核心級隔離選 VM。',
          '三題答案依序是：第 1 個、第 2 個、第 3 個選項。'],
        check: function (result, ctx) { return ctx.flags.quizDone; } }
    ]
  });
}(typeof globalThis !== 'undefined' ? globalThis : this));
