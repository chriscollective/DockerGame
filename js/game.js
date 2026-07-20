/*
 * game.js — 主控制器：畫面流轉、關卡執行、目標判定、提示與星等、結算
 */
(function (root) {
  'use strict';
  var CONFIG = root.DG.CONFIG;
  var art = root.DG.art;
  var h = root.DG.h;
  var t = root.DG.t;

  var engine, cli, stage, terminal;
  var stageCore, questScroll, tipBubble;
  var current = null;   // {def, ctx, objIdx, objEls, hintLevels, hintsUsed, wrongs, completed}
  var titleCtl = null;

  // ---------- 畫面切換 ----------
  function switchScreen(id, cb) {
    var wipe = document.getElementById('wipe');
    wipe.classList.add('on');
    setTimeout(function () {
      document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('on'); });
      document.getElementById(id).classList.add('on');
      if (cb) { cb(); }
      setTimeout(function () { wipe.classList.remove('on'); }, 60);
    }, 460);
  }

  function goMap() {
    stage.hideBrowser();
    switchScreen('screen-map', function () {
      root.DG.screens.buildMap(document.getElementById('screen-map'), startLevel, goBadges);
    });
  }

  function goBadges() {
    switchScreen('screen-badges', function () {
      root.DG.screens.buildBadges(document.getElementById('screen-badges'), goMap);
    });
  }

  function goTitle() {
    titleCtl.refresh();
    switchScreen('screen-title');
  }

  // ---------- 任務面板渲染 ----------
  function capBubble(html, tipMode) {
    var d = h('div', 'dialogue' + (tipMode ? ' tip-mode' : ''));
    var name = tipMode ? t({ zh: '船長的提點', en: "Captain's Tip" }) : t({ zh: '鯨魚船長', en: 'Captain Whale' });
    d.innerHTML = '<div class="cap-avatar">' + art.whale(true) + '</div>' +
      '<div class="bubble"><div class="cap-name">' + name + '</div>' + html + '</div>';
    return d;
  }

  function renderQuest(def) {
    questScroll.innerHTML = '';
    def.story.forEach(function (line, i) {
      var b = capBubble(t(line));
      b.style.animationDelay = (i * 0.24) + 's';
      questScroll.appendChild(b);
    });
    var tc = h('div', 'teach-card');
    tc.innerHTML = '<div class="tc-head">' + t({ zh: '教學卡 · ', en: 'Teaching Card · ' }) + t(def.teach.title) + '</div>' +
      '<div class="tc-body">' + t(def.teach.html) +
      '<div class="tc-map">' + t(def.teach.map) + '</div></div>';
    questScroll.appendChild(tc);

    var wrap = h('div', 'objectives', '<div class="obj-title">' + t({ zh: '任務目標', en: 'Objectives' }) + '</div>');
    current.objEls = def.objectives.map(function (obj, i) {
      var o = h('div', 'objective' + (i === 0 ? ' active' : ''));
      o.innerHTML = '<span class="check-icon">' + art.check() + '</span>' +
        '<span class="obj-text">' + t(obj.text) + '</span>';
      wrap.appendChild(o);
      return o;
    });
    questScroll.appendChild(wrap);
    tipBubble = null;
  }

  function showTip(html) {
    if (!tipBubble) {
      tipBubble = capBubble(html, true);
      questScroll.appendChild(tipBubble);
    } else {
      tipBubble.querySelector('.bubble').innerHTML =
        '<div class="cap-name">' + t({ zh: '船長的提點', en: "Captain's Tip" }) + '</div>' + html;
      questScroll.appendChild(tipBubble);   // 移到最下方
    }
    tipBubble.classList.remove('rise');
    questScroll.scrollTop = questScroll.scrollHeight;
  }

  // ---------- 提示系統 ----------
  function updateHintBadge() {
    document.querySelector('#btn-hint .hint-count').textContent = current.hintsUsed;
  }

  function revealHint(auto) {
    if (!current || current.completed) { return; }
    var idx = current.objIdx;
    var obj = current.def.objectives[idx];
    var lv = current.hintLevels[idx];
    if (lv >= 3) {
      showTip(t({ zh: '（提示已全部給過了）', en: '(all hints already given) ' }) + t(obj.hints[2]));
      return;
    }
    current.hintLevels[idx] = lv + 1;
    current.hintsUsed++;
    updateHintBadge();
    var label = [t({ zh: '先給個方向', en: 'a nudge' }), t({ zh: '給你指令骨架', en: 'the command skeleton' }),
      t({ zh: '完整答案', en: 'the full answer' })][lv];
    var lead = auto ? t({ zh: '看你卡了一會兒——', en: "Looks like you're stuck — " }) : '';
    showTip(lead + t({ zh: '提示 {n}/3（{label}）：<br>', en: 'Hint {n}/3 ({label}):<br>' },
      { n: lv + 1, label: label }) + t(obj.hints[lv]));
    root.DG.audio.play('click');
  }

  // ---------- 目標判定 ----------
  function objectiveDone(idx, result) {
    var obj = current.def.objectives[idx];
    var el = current.objEls[idx];
    el.classList.remove('active');
    el.classList.add('done', 'pop');
    root.DG.audio.play('ok');
    stage.burst(12 + Math.random() * 20, 24, 8, ['#5cf2a5', '#a7ffd0']);
    if (obj.onDone) { obj.onDone(current.ctx, result); }
    current.objIdx++;
    current.wrongs = 0;
    if (current.objIdx < current.def.objectives.length) {
      current.objEls[current.objIdx].classList.add('active');
      checkObjective(result);   // 狀態早已達標的目標（玩家提前做了）允許連鎖完成
    } else {
      levelComplete();
    }
  }

  function checkObjective(result) {
    if (!current || current.completed) { return; }
    var obj = current.def.objectives[current.objIdx];
    var ok = false;
    try { ok = !!obj.check(result, current.ctx); }
    catch (e) {
      ok = false;   // check 內部錯誤不讓遊戲 crash，但要留痕跡以免關卡靜默卡死
      if (root.console && console.warn) {
        console.warn('[objective check error] level', current.def.id, 'obj', current.objIdx, e);
      }
    }
    if (ok) { objectiveDone(current.objIdx, result); }
  }

  function onCommand(result) {
    stage.applyEvents(result.events);
    if (result.tip) { showTip(result.tip); }
    var before = current.objIdx;
    checkObjective(result);
    if (current.completed || current.objIdx > before) { current.offTopic = 0; return; }
    // 指令沒推進目前的任務目標
    if (!result.ok) {
      current.wrongs++;
      if (current.wrongs >= CONFIG.WRONG_TRIES_BEFORE_HINT &&
          current.hintLevels[current.objIdx] === 0) {
        setTimeout(function () { revealHint(true); }, 350);
      }
    } else {
      // 指令成功但偏題：給免費的方向提醒（不扣星、不直接給答案），避免玩家卡住卻毫無回饋
      current.offTopic = (current.offTopic || 0) + 1;
      if (current.offTopic >= CONFIG.WRONG_TRIES_BEFORE_HINT &&
          current.hintLevels[current.objIdx] === 0) {
        current.offTopic = 0;
        showTip(t({ zh: '這個指令有跑成功，但還沒完成目前的「任務目標」。<br>再看一眼上方的任務目標，或按右上角 💡 要一個提示。',
          en: 'That command ran fine, but it has not completed the current objective yet.<br>Take another look at the objectives above, or tap 💡 in the top-right for a hint.' }));
      }
    }
  }

  // ---------- 過關 ----------
  function levelComplete() {
    current.completed = true;
    var def = current.def;
    questScroll.appendChild(capBubble('<b>' + t({ zh: '過關！', en: 'Cleared!' }) + '</b>' + t(def.outro)));
    questScroll.scrollTop = questScroll.scrollHeight;
    root.DG.audio.play('fanfare');
    stage.burst(50, 40, 26);
    var stars = CONFIG.starsForHints(current.hintsUsed);
    var res = root.DG.store.completeLevel(def.id, stars);
    var isLast = def.id === CONFIG.LEVEL_COUNT;
    var resultOpts = {
      levelId: def.id,
      stars: stars,
      xpGained: res.xpGained,
      badge: res.badge,
      newBadge: res.newBadge,
      isLast: isLast,
      onMap: goMap,
      onBadges: goBadges,
      onNext: (!isLast && root.DG.getLevel(def.id + 1))
        ? function () { startLevel(def.id + 1); } : null
    };
    // 不馬上跳結算：留時間讀完最後一個指令的輸出與船長收尾，
    // 玩家也可以按「查看結算」直接看，不必等滿
    var token = current;
    var btn = h('button', 'btn primary result-now-btn',
      t({ zh: '查看結算', en: 'See results' }) + '<span class="btn-orb">➜</span>');
    var shown = false;
    function showNow() {
      if (shown) { return; }
      shown = true;
      clearTimeout(timer);
      btn.remove();
      // 玩家已離開這一關（回航線圖／換關）就不再彈結算——進度早已存檔
      if (current !== token ||
          !document.getElementById('screen-level').classList.contains('on')) { return; }
      root.DG.screens.showResult(resultOpts);
    }
    var timer = setTimeout(showNow,
      def.resultDelay || (isLast ? CONFIG.RESULT_DELAY_LAST_MS : CONFIG.RESULT_DELAY_MS));
    btn.addEventListener('click', showNow);
    document.getElementById('screen-level').appendChild(btn);
  }

  // ---------- 啟動關卡 ----------
  function clearOverlays() {
    var kids = Array.prototype.slice.call(stageCore.children);
    kids.forEach(function (k) {
      if (!k.classList.contains('harbor-scene')) { k.remove(); }
    });
    stage.hideBrowser();
  }

  function startLevel(id) {
    var def = root.DG.getLevel(id);
    if (!def) { return; }
    engine.reset();
    cli.resetSession();
    cli.setLearnedLevel(id);

    current = {
      def: def,
      objIdx: 0,
      objEls: [],
      hintLevels: def.objectives.map(function () { return 0; }),
      hintsUsed: 0,
      wrongs: 0,
      offTopic: 0,
      completed: false,
      ctx: null
    };
    current.ctx = {
      engine: engine,
      cli: cli,
      stage: stage,
      terminal: terminal,
      overlay: stageCore,
      flags: {},
      flag: function (name) {
        current.ctx.flags[name] = true;
        checkObjective(null);
      }
    };

    switchScreen('screen-level', function () {
      var stale = document.querySelector('.result-now-btn');
      if (stale) { stale.remove(); }
      document.getElementById('lt-num').textContent = 'LEVEL ' + def.id + ' / ' + CONFIG.LEVEL_COUNT;
      document.getElementById('lt-title').textContent = t(def.name) + '　·　' + t(def.topic);
      // 無終端機的關卡：把終端機列收成薄鎖定條，多出的高度全給中間舞台
      document.getElementById('screen-level').classList.toggle('no-term', !def.terminal);
      updateHintBadge();
      clearOverlays();
      terminal.reset();
      if (def.setup) { def.setup(current.ctx); }
      engine.takeEvents();   // 清掉開場預置產生的事件，別漏進第一個指令的結果
      stage.sync();
      renderQuest(def);
      // 進關後把「任務目標」捲進視野，避免玩家沒發現摺線以下還有目標
      setTimeout(function () {
        var wrap = questScroll.querySelector('.objectives');
        if (wrap && wrap.scrollIntoView) { wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      }, 1100);
      if (def.terminal) {
        terminal.setLocked(false);
        terminal.print(t({ zh: '鯨魚港終端機 — 輸入 help 可查看目前學會的指令',
          en: 'Whale Harbor terminal — type help to see the commands you have learned' }), 'dim');
        terminal.focus();
      } else {
        terminal.setLocked(true);
      }
      root.DG.audio.play('horn');
    });
  }

  // ---------- 初始化 ----------
  var renderMute, renderLangBtn;
  function wireTopbar() {
    document.getElementById('btn-hint').addEventListener('click', function () { revealHint(false); });
    document.getElementById('btn-map').addEventListener('click', function () {
      var inLevel = document.getElementById('screen-level').classList.contains('on');
      if (inLevel && current && !current.completed) {
        root.DG.screens.showConfirm(t({ zh: '離開這一關？', en: 'Leave this level?' }),
          t({ zh: '目前這關的進度會重置，回港後要從頭再來一次。確定離開嗎？',
            en: "This level's progress will reset — you'll start it over next time. Leave anyway?" }), goMap);
      } else {
        goMap();
      }
    });
    document.getElementById('btn-dex').addEventListener('click', goBadges);
    var muteBtn = document.getElementById('btn-mute');
    renderMute = function () {
      muteBtn.innerHTML = root.DG.audio.isMuted() ? art.icons.muted : art.icons.sound;
      muteBtn.title = root.DG.audio.isMuted() ? t({ zh: '開啟音效', en: 'Unmute' }) : t({ zh: '靜音', en: 'Mute' });
    };
    muteBtn.addEventListener('click', function () {
      var m = !root.DG.audio.isMuted();
      root.DG.audio.setMuted(m);
      root.DG.store.setMuted(m);
      renderMute();
    });
    renderMute();

    var langBtn = document.getElementById('btn-lang');
    renderLangBtn = function () {
      var en = root.DG.getLang() === 'en';
      langBtn.textContent = en ? '中' : 'EN';
      langBtn.title = en ? '切換成中文' : 'Switch to English';
    };
    langBtn.addEventListener('click', function () {
      root.DG.setLang(root.DG.getLang() === 'zh' ? 'en' : 'zh');
      root.DG.audio.play('click');
    });
    renderLangBtn();
  }

  // 語言切換：重繪當前畫面 + topbar 動態鈕（靜態 chrome 由 i18n.setLang 內部處理）
  function onLangChange() {
    if (renderLangBtn) { renderLangBtn(); }
    if (renderMute) { renderMute(); }
    var active = document.querySelector('.screen.on');
    if (!active) { return; }
    if (active.id === 'screen-map') {
      root.DG.screens.buildMap(document.getElementById('screen-map'), startLevel, goBadges);
    } else if (active.id === 'screen-badges') {
      root.DG.screens.buildBadges(document.getElementById('screen-badges'), goMap);
    } else if (active.id === 'screen-title' && titleCtl) {
      titleCtl.refresh();
    } else if (active.id === 'screen-level' && current) {
      relevelText();
    }
  }

  // 關卡進行中切語言：重繪任務面板文字並還原已完成/進行中狀態（小遊戲 DOM 與終端機歷史維持原樣）
  function relevelText() {
    var def = current.def;
    document.getElementById('lt-title').textContent = t(def.name) + '　·　' + t(def.topic);
    renderQuest(def);
    if (stage && stage.sync) { stage.sync(); }   // 港口舞台標籤（藍圖架/保險庫）跟著切語言重繪
    current.objEls.forEach(function (el, idx) {
      el.classList.remove('active', 'done');
      if (idx < current.objIdx) { el.classList.add('done'); }
      else if (idx === current.objIdx && !current.completed) { el.classList.add('active'); }
    });
    if (current.completed) {
      questScroll.appendChild(capBubble('<b>' + t({ zh: '過關！', en: 'Cleared!' }) + '</b>' + t(def.outro)));
    }
  }

  function init() {
    root.DG.initLang();
    root.DG.onLangChange(onLangChange);
    root.DG.audio.setMuted(!!root.DG.store.data.muted);

    engine = root.DG.createEngine();
    cli = root.DG.createCLI(engine);
    stageCore = document.getElementById('stage-mount');
    stage = root.DG.createStage(stageCore, engine);
    questScroll = document.getElementById('quest-scroll');
    terminal = root.DG.createTerminal({
      bodyEl: document.getElementById('term-body'),
      inputEl: document.getElementById('term-input'),
      promptEl: document.getElementById('term-prompt'),
      veilEl: document.getElementById('term-veil'),
      cli: cli,
      onCommand: onCommand
    });

    titleCtl = root.DG.screens.buildTitle(
      document.getElementById('screen-title'),
      function () { startLevel(1); },
      goMap,
      function () {
        root.DG.screens.showConfirm(t({ zh: '重新開始？', en: 'Start over?' }),
          t({ zh: '這會清除所有進度：關卡星等、XP 與徽章圖鑑。確定要從頭啟航嗎？',
            en: 'This clears all progress: level stars, XP and the badge codex. Set sail from the start?' }),
          function () {
            root.DG.store.resetAll();
            titleCtl.refresh();
            root.DG.audio.play('splash');
          });
      });

    wireTopbar();
    document.getElementById('screen-title').classList.add('on');
  }

  document.addEventListener('DOMContentLoaded', init);
}(typeof globalThis !== 'undefined' ? globalThis : this));
