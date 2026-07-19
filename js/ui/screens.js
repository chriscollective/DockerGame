/*
 * screens.js — 標題畫面、關卡地圖、徽章圖鑑、結算/確認彈窗
 */
(function (root) {
  'use strict';
  var CONFIG = root.DG.CONFIG;
  var art = root.DG.art;
  var h = root.DG.h;

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
      '<div class="logo-sub">互動式 DOCKER 教學遊戲</div>' +
      '<h1>Docker 大航海</h1>' +
      '<div class="logo-en">THE CONTAINER VOYAGE · 鯨魚港</div></div>' +
      '<div class="title-whale">' + art.whale(true) + '</div>' +
      '<div class="title-actions"></div>' +
      '<div class="title-progress"></div>';
    mount.appendChild(overlay);

    var actions = overlay.querySelector('.title-actions');
    function refresh() {
      actions.innerHTML = '';
      var prog = overlay.querySelector('.title-progress');
      if (root.DG.store.hasAnyProgress()) {
        var cont = h('button', 'btn primary', '<span>繼續航行</span><span class="btn-orb">➜</span>');
        cont.addEventListener('click', onContinue);
        actions.appendChild(cont);
        var restart = h('button', 'btn ghost', '重新開始');
        restart.addEventListener('click', onReset);
        actions.appendChild(restart);
        var done = Object.keys(root.DG.store.data.levels).length;
        prog.textContent = '目前進度：' + done + ' / ' + CONFIG.LEVEL_COUNT + ' 關 · ' +
          root.DG.store.data.xp + ' XP · ' + root.DG.store.rank().title;
      } else {
        var start = h('button', 'btn primary', '<span>啟航</span><span class="btn-orb">➜</span>');
        start.addEventListener('click', onStart);
        actions.appendChild(start);
        prog.textContent = '一場從 hello-world 到 docker compose 的航程';
      }
    }
    refresh();
    return { refresh: refresh };
  }

  // ---------- 關卡地圖 ----------
  function buildMap(mount, onPick, onBadges) {
    mount.innerHTML = '';
    var head = h('div', 'map-head');
    head.innerHTML = '<div class="head-left"><h2>鯨魚港 · 航線圖</h2>' +
      '<span class="eyebrow">選擇泊位</span></div>' +
      '<div class="map-stats"><span class="xp-chip"></span><span class="rank-chip"></span>' +
      '<button class="btn small ghost btn-badges">知識徽章圖鑑</button></div>';
    mount.appendChild(head);
    head.querySelector('.btn-badges').addEventListener('click', onBadges);

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
        '<div class="isle-name">' + lv.name + '</div>' +
        '<div class="isle-topic">' + lv.topic + '</div>' +
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
    head.querySelector('.rank-chip').textContent = '軍階：' + root.DG.store.rank().title;
  }

  // ---------- 徽章圖鑑 ----------
  function buildBadges(mount, onBack) {
    mount.innerHTML = '';
    var wrap = h('div', 'badges-wrap');
    wrap.innerHTML = '<div class="badges-head"><h2>知識徽章圖鑑 <span class="eyebrow">Docker 概念小抄</span></h2>' +
      '<button class="btn small ghost btn-back">回航線圖</button></div>';
    mount.appendChild(wrap);
    wrap.querySelector('.btn-back').addEventListener('click', onBack);

    var grid = h('div', 'badge-grid');
    wrap.appendChild(grid);
    var owned = root.DG.store.data.badges;
    CONFIG.BADGES.forEach(function (b) {
      var has = owned.indexOf(b.id) >= 0;
      var cell = h('div', 'shell badge-cell' + (has ? '' : ' locked'));
      cell.innerHTML = art.badgeMedal(b, !has) +
        '<div><div class="bc-level">LEVEL ' + b.level + '</div>' +
        '<div class="bc-name">' + (has ? b.title : '？？？') + '</div>' +
        '<div class="bc-sum">' + (has ? b.summary : '通過第 ' + b.level + ' 關解鎖這枚徽章的知識。') + '</div></div>';
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
      '<span class="eyebrow">' + (opts.isLast ? '結業之戰 · 通過' : 'LEVEL ' + opts.levelId + ' · 通過') + '</span>' +
      '<h3>' + lv.name + '</h3>' +
      '<div class="result-sub">' + (opts.isLast ? '鯨魚船長授銜：鯨魚港港務長（Harbour Master）' : lv.topic) + '</div>' +
      '<div class="result-stars">' + starsHTML + '</div>' +
      '<div class="result-xp">' + (opts.xpGained > 0 ? '+' + opts.xpGained + ' XP' : '（重玩 · 無新增 XP）') +
      ' · 總計 ' + root.DG.store.data.xp + ' XP · ' + root.DG.store.rank().title + '</div>' +
      (opts.badge && opts.newBadge
        ? '<div class="badge-award">' + art.badgeMedal(opts.badge, false) +
          '<div><div class="ba-title">獲得知識徽章「' + opts.badge.title + '」</div>' +
          '<div class="ba-sum">' + opts.badge.summary + '</div></div></div>'
        : '') +
      '<div class="result-actions"></div></div>';
    veil.appendChild(card);
    var actions = card.querySelector('.result-actions');

    var mapBtn = h('button', 'btn ghost', '回航線圖');
    mapBtn.addEventListener('click', function () { hideModal(veil); opts.onMap(); });
    actions.appendChild(mapBtn);
    if (opts.isLast) {
      var bBtn = h('button', 'btn primary', '<span>檢視全部徽章</span><span class="btn-orb">➜</span>');
      bBtn.addEventListener('click', function () { hideModal(veil); opts.onBadges(); });
      actions.appendChild(bBtn);
    } else if (opts.onNext) {
      var nextBtn = h('button', 'btn primary', '<span>下一關</span><span class="btn-orb">➜</span>');
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
    var no = h('button', 'btn ghost', '取消');
    no.addEventListener('click', function () { hideModal(veil); });
    var yes = h('button', 'btn primary', '確定');
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
