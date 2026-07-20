/*
 * screens.js — 標題畫面、關卡地圖、徽章圖鑑、結算/確認彈窗
 */
(function (root) {
  'use strict';
  var CONFIG = root.DG.CONFIG;
  var art = root.DG.art;
  var h = root.DG.h;
  var t = root.DG.t;

  // 共用語言切換鈕（各畫面標頭都放一顆；畫面重繪時會帶新語言重建）
  function langToggleBtn() {
    var en = root.DG.getLang() === 'en';
    var b = h('button', 'btn small ghost lang-toggle', en ? '中文' : 'EN');
    b.title = en ? '切換成中文' : 'Switch to English';
    b.addEventListener('click', function () {
      root.DG.setLang(root.DG.getLang() === 'zh' ? 'en' : 'zh');
      root.DG.audio.play('click');
    });
    return b;
  }

  // 地圖上 10 個泊位的座標（百分比）
  var ISLE_POS = [
    [9, 76], [22, 57], [34, 74], [46, 52], [58, 71],
    [69, 46], [80, 65], [88, 38], [71, 18], [51, 22]
  ];

  function starsRow(n, size) {
    var out = '<span class="stars">';
    for (var i = 0; i < 3; i++) { out += art.star(i < n); }
    return out + '</span>';
  }

  // ---------- 標題畫面 ----------
  function buildTitle(mount, onStart, onContinue, onReset) {
    var eng = root.DG.createEngine();
    var stage = root.DG.createStage(mount, eng);
    eng.pull('nginx');
    eng.pull('redis');
    eng.run({ image: 'nginx', name: 'harbor-web', detach: true, ports: [{ host: 80, cont: 80 }] });
    eng.run({ image: 'redis', name: 'night-cache', detach: true });
    eng.takeEvents();
    stage.sync();

    var overlay = h('div', 'title-overlay');
    overlay.innerHTML =
      '<div class="game-logo rise">' +
      '<div class="logo-sub" id="logo-sub"></div>' +
      '<h1 id="logo-title"></h1>' +
      '<div class="logo-en" id="logo-en"></div></div>' +
      '<div class="title-whale">' + art.whale(true) + '</div>' +
      '<div class="title-actions"></div>' +
      '<div class="title-progress"></div>';
    mount.appendChild(overlay);

    var actions = overlay.querySelector('.title-actions');
    function refresh() {
      stage.sync();   // 標題舞台的藍圖架標籤跟著切語言重繪
      overlay.querySelector('#logo-sub').textContent = t({ zh: '互動式 DOCKER 教學遊戲', en: 'AN INTERACTIVE DOCKER GAME' });
      overlay.querySelector('#logo-title').textContent = t({ zh: 'Docker 大航海', en: 'Docker Voyage' });
      overlay.querySelector('#logo-en').textContent = t({ zh: 'THE CONTAINER VOYAGE · 鯨魚港', en: 'THE CONTAINER VOYAGE · WHALE HARBOR' });
      actions.innerHTML = '';
      var prog = overlay.querySelector('.title-progress');
      if (root.DG.store.hasAnyProgress()) {
        var cont = h('button', 'btn primary', '<span>' + t({ zh: '繼續航行', en: 'Continue Voyage' }) + '</span><span class="btn-orb">➜</span>');
        cont.addEventListener('click', onContinue);
        actions.appendChild(cont);
        var restart = h('button', 'btn ghost', t({ zh: '重新開始', en: 'Start Over' }));
        restart.addEventListener('click', onReset);
        actions.appendChild(restart);
        var done = Object.keys(root.DG.store.data.levels).length;
        prog.textContent = t({ zh: '目前進度：{done} / {total} 關 · {xp} XP · {rank}',
          en: 'Progress: {done} / {total} levels · {xp} XP · {rank}' },
          { done: done, total: CONFIG.LEVEL_COUNT, xp: root.DG.store.data.xp, rank: t(root.DG.store.rank().title) });
      } else {
        var start = h('button', 'btn primary', '<span>' + t({ zh: '啟航', en: 'Set Sail' }) + '</span><span class="btn-orb">➜</span>');
        start.addEventListener('click', onStart);
        actions.appendChild(start);
        prog.textContent = t({ zh: '一場從 hello-world 到 docker compose 的航程',
          en: 'A voyage from hello-world to docker compose' });
      }
      actions.appendChild(langToggleBtn());
    }
    refresh();
    return { refresh: refresh };
  }

  // ---------- 關卡地圖 ----------
  function buildMap(mount, onPick, onBadges) {
    mount.innerHTML = '';
    var head = h('div', 'map-head');
    head.innerHTML = '<div class="head-left"><h2>' + t({ zh: '鯨魚港 · 航線圖', en: 'Whale Harbor · Sea Chart' }) + '</h2>' +
      '<span class="eyebrow">' + t({ zh: '選擇泊位', en: 'Choose a berth' }) + '</span></div>' +
      '<div class="map-stats"><span class="xp-chip"></span><span class="rank-chip"></span>' +
      '<button class="btn small ghost btn-badges">' + t({ zh: '知識徽章圖鑑', en: 'Badge Codex' }) + '</button></div>';
    mount.appendChild(head);
    head.querySelector('.btn-badges').addEventListener('click', onBadges);
    head.querySelector('.map-stats').appendChild(langToggleBtn());

    var sea = h('div', 'map-sea');
    mount.appendChild(sea);

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'map-route');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    sea.appendChild(svg);

    var levels = root.DG.levelList();
    for (var i = 0; i < levels.length - 1; i++) {
      var a = ISLE_POS[i];
      var b = ISLE_POS[i + 1];
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      var mx = (a[0] + b[0]) / 2 + (i % 2 ? 5 : -5);
      var my = (a[1] + b[1]) / 2 + (i % 2 ? -6 : 6);
      path.setAttribute('d', 'M' + a[0] + ' ' + a[1] + ' Q' + mx + ' ' + my + ' ' + b[0] + ' ' + b[1]);
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      if (root.DG.store.isUnlocked(levels[i + 1].id)) { path.setAttribute('class', 'route-lit'); }
      svg.appendChild(path);
    }

    levels.forEach(function (lv, idx) {
      var unlocked = root.DG.store.isUnlocked(lv.id);
      var stars = root.DG.store.starsOf(lv.id);
      var done = !!root.DG.store.data.levels[lv.id];
      var current = unlocked && !done;
      var isle = h('div', 'isle' + (unlocked ? '' : ' locked') + (done ? ' done' : '') + (current ? ' current' : ''));
      isle.style.left = ISLE_POS[idx][0] + '%';
      isle.style.top = ISLE_POS[idx][1] + '%';
      isle.innerHTML =
        '<div class="isle-disc">' + art.isleIcon(lv.glyph, done ? '#7ef2b0' : (unlocked ? '#ffd166' : '#5d6688')) +
        '<div class="isle-num">' + lv.id + '</div>' +
        (unlocked ? '' : '<div class="lock-glyph">' + art.lock() + '</div>') + '</div>' +
        '<div class="isle-name">' + t(lv.name) + '</div>' +
        '<div class="isle-topic">' + t(lv.topic) + '</div>' +
        (done ? starsRow(stars) : '');
      if (unlocked) {
        isle.querySelector('.isle-disc').addEventListener('click', function () {
          root.DG.audio.play('click');
          onPick(lv.id);
        });
      }
      sea.appendChild(isle);
    });

    head.querySelector('.xp-chip').textContent = root.DG.store.data.xp + ' XP';
    head.querySelector('.rank-chip').textContent = t({ zh: '軍階：', en: 'Rank: ' }) + t(root.DG.store.rank().title);
  }

  // ---------- 徽章圖鑑 ----------
  function buildBadges(mount, onBack) {
    mount.innerHTML = '';
    var wrap = h('div', 'badges-wrap');
    wrap.innerHTML = '<div class="badges-head"><h2>' + t({ zh: '知識徽章圖鑑', en: 'Badge Codex' }) +
      ' <span class="eyebrow">' + t({ zh: 'Docker 概念小抄', en: 'Docker concept cheat-sheet' }) + '</span></h2>' +
      '<button class="btn small ghost btn-back">' + t({ zh: '回航線圖', en: 'Back to the chart' }) + '</button></div>';
    mount.appendChild(wrap);
    wrap.querySelector('.btn-back').addEventListener('click', onBack);
    wrap.querySelector('.badges-head').appendChild(langToggleBtn());

    var grid = h('div', 'badge-grid');
    wrap.appendChild(grid);
    var owned = root.DG.store.data.badges;
    CONFIG.BADGES.forEach(function (b) {
      var has = owned.indexOf(b.id) >= 0;
      var cell = h('div', 'shell badge-cell' + (has ? '' : ' locked'));
      cell.innerHTML = art.badgeMedal(b, !has) +
        '<div><div class="bc-level">LEVEL ' + b.level + '</div>' +
        '<div class="bc-name">' + (has ? t(b.title) : '？？？') + '</div>' +
        '<div class="bc-sum">' + (has ? t(b.summary) : t({ zh: '通過第 {level} 關解鎖這枚徽章的知識。',
          en: 'Clear Level {level} to unlock this badge.' }, { level: b.level })) + '</div></div>';
      grid.appendChild(cell);
    });
  }

  // ---------- 過關結算 ----------
  function showResult(opts) {
    // opts: {levelId, stars, xpGained, badge, newBadge, isLast, onMap, onNext, onBadges}
    var veil = document.getElementById('modal-result');
    var lv = root.DG.getLevel(opts.levelId);
    veil.innerHTML = '';
    var card = h('div', 'shell result-card');
    var starsHTML = '';
    for (var i = 0; i < 3; i++) { starsHTML += art.star(i < opts.stars); }
    card.innerHTML = '<div class="core">' +
      '<span class="eyebrow">' + (opts.isLast ? t({ zh: '結業之戰 · 通過', en: 'Final Challenge · Cleared' })
        : t({ zh: 'LEVEL {n} · 通過', en: 'LEVEL {n} · Cleared' }, { n: opts.levelId })) + '</span>' +
      '<h3>' + t(lv.name) + '</h3>' +
      '<div class="result-sub">' + (opts.isLast
        ? t({ zh: '鯨魚船長授銜：鯨魚港港務長（Harbour Master）', en: 'Captain Whale bestows your title: Harbour Master of Whale Harbor' })
        : t(lv.topic)) + '</div>' +
      '<div class="result-stars">' + starsHTML + '</div>' +
      '<div class="result-xp">' + (opts.xpGained > 0 ? '+' + opts.xpGained + ' XP'
        : t({ zh: '（重玩 · 無新增 XP）', en: '(replay · no new XP)' })) +
      t({ zh: ' · 總計 {xp} XP · {rank}', en: ' · {xp} XP total · {rank}' },
        { xp: root.DG.store.data.xp, rank: t(root.DG.store.rank().title) }) + '</div>' +
      (opts.badge && opts.newBadge
        ? '<div class="badge-award">' + art.badgeMedal(opts.badge, false) +
          '<div><div class="ba-title">' + t({ zh: '獲得知識徽章「{title}」', en: 'Badge earned: "{title}"' },
            { title: t(opts.badge.title) }) + '</div>' +
          '<div class="ba-sum">' + t(opts.badge.summary) + '</div></div></div>'
        : '') +
      '<div class="result-actions"></div></div>';
    veil.appendChild(card);
    var actions = card.querySelector('.result-actions');

    var mapBtn = h('button', 'btn ghost', t({ zh: '回航線圖', en: 'Back to the chart' }));
    mapBtn.addEventListener('click', function () { hideModal(veil); opts.onMap(); });
    actions.appendChild(mapBtn);
    if (opts.isLast) {
      var bBtn = h('button', 'btn primary', '<span>' + t({ zh: '檢視全部徽章', en: 'View all badges' }) + '</span><span class="btn-orb">➜</span>');
      bBtn.addEventListener('click', function () { hideModal(veil); opts.onBadges(); });
      actions.appendChild(bBtn);
    } else if (opts.onNext) {
      var nextBtn = h('button', 'btn primary', '<span>' + t({ zh: '下一關', en: 'Next Level' }) + '</span><span class="btn-orb">➜</span>');
      nextBtn.addEventListener('click', function () { hideModal(veil); opts.onNext(); });
      actions.appendChild(nextBtn);
    }
    veil.classList.add('on');
    (actions.querySelector('.btn.primary') || mapBtn).focus();
    bindModalDismiss(veil, function () { hideModal(veil); opts.onMap(); });
    if (opts.newBadge) { setTimeout(function () { root.DG.audio.play('badge'); }, 900); }
  }

  function showConfirm(title, msg, onYes) {
    var veil = document.getElementById('modal-confirm');
    veil.innerHTML = '';
    var card = h('div', 'shell confirm-card');
    card.innerHTML = '<div class="core"><h3>' + title + '</h3><p>' + msg + '</p>' +
      '<div class="result-actions"></div></div>';
    var actions = card.querySelector('.result-actions');
    var no = h('button', 'btn ghost', t({ zh: '取消', en: 'Cancel' }));
    no.addEventListener('click', function () { hideModal(veil); });
    var yes = h('button', 'btn primary', t({ zh: '確定', en: 'Confirm' }));
    yes.addEventListener('click', function () { hideModal(veil); onYes(); });
    actions.appendChild(no);
    actions.appendChild(yes);
    veil.appendChild(card);
    veil.classList.add('on');
    yes.focus();
    bindModalDismiss(veil, function () { hideModal(veil); });   // Esc／點遮罩 = 取消
  }

  function hideModal(veil) {
    veil.classList.remove('on');
    if (veil._cleanupDismiss) { veil._cleanupDismiss(); veil._cleanupDismiss = null; }
  }

  // Esc 或點遮罩背景關閉 modal（並清掉監聽器，避免累積）
  function bindModalDismiss(veil, onDismiss) {
    function onKey(e) { if (e.key === 'Escape') { onDismiss(); } }
    function onClick(e) { if (e.target === veil) { onDismiss(); } }
    veil._cleanupDismiss = function () {
      document.removeEventListener('keydown', onKey);
      veil.removeEventListener('click', onClick);
    };
    document.addEventListener('keydown', onKey);
    veil.addEventListener('click', onClick);
  }

  root.DG.screens = {
    buildTitle: buildTitle,
    buildMap: buildMap,
    buildBadges: buildBadges,
    showResult: showResult,
    showConfirm: showConfirm
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
