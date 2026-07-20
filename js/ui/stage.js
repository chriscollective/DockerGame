/*
 * stage.js — 港口舞台：把引擎狀態畫成貨櫃/藍圖架/保險庫/內線，並播放事件動畫。
 * 用法：sync() 全量重繪（無動畫）；applyEvents(events) 在指令跑完後播放對應演出。
 */
(function (root) {
  'use strict';
  var art = root.DG.art;
  var t = root.DG.t;

  var CRATE_HUES = [205, 155, 25, 280, 340, 95, 240, 55];

  function hueFor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) { h = (h * 31 + name.charCodeAt(i)) & 0xffff; }
    return CRATE_HUES[h % CRATE_HUES.length];
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (html !== undefined) { e.innerHTML = html; }
    return e;
  }

  function createStage(mount, engine) {
    var scene = el('div', 'harbor-scene');
    mount.appendChild(scene);
    var crateEls = {};   // container.id -> element
    var refs = buildScene(scene);

    // ---------- 場景基礎 ----------
    function buildScene(sc) {
      for (var i = 0; i < 26; i++) {
        var s = el('div', 'sky-star');
        s.style.left = (Math.random() * 100) + '%';
        s.style.top = (Math.random() * 52) + '%';
        s.style.animationDelay = (Math.random() * 3) + 's';
        s.style.opacity = 0.25 + Math.random() * 0.7;
        sc.appendChild(s);
      }
      sc.appendChild(el('div', 'moon'));
      ['w1', 'w2', 'w3'].forEach(function (w, idx) {
        var wv = el('div', 'wave ' + w, art.wave(['#12325e', '#0d2648', '#091c36'][idx]));
        sc.appendChild(wv);
      });
      sc.appendChild(el('div', 'sea'));
      var dock = el('div', 'dock');
      sc.appendChild(dock);
      [12, 88].forEach(function (pct) {
        var lamp = el('div', 'dock-lamp');
        lamp.style.left = pct + '%';
        sc.appendChild(lamp);
      });
      var crane = el('div', 'crane',
        '<div class="jib"></div><div class="mast"></div><div class="cab"></div>' +
        '<div class="trolley"></div><div class="cable"></div><div class="hook"></div>');
      sc.appendChild(crane);
      var whale = el('div', 'whale-swim', art.whale(false) + '<div class="spout"></div>');
      sc.appendChild(whale);
      var shelf = el('div', 'shelf', '<div class="shelf-title">' + t({ zh: '藍圖架 · images', en: 'Blueprint shelf · images' }) + '</div>');
      sc.appendChild(shelf);
      var crates = el('div', 'crate-row');
      var wires = el('div', 'net-wires');
      crates.appendChild(wires);
      sc.appendChild(crates);
      var vaults = el('div', 'vaults');
      sc.appendChild(vaults);
      var caption = el('div', 'stage-caption');
      sc.appendChild(caption);
      return { crane: crane, shelf: shelf, crates: crates, wires: wires, vaults: vaults, caption: caption, scene: sc };
    }

    // ---------- 貨櫃 ----------
    function statusTag(c) {
      return c.status === 'running' ? '▶ RUN' : '⏸ STOP';
    }

    function crateHTML(c) {
      var ports = c.ports.map(function (p) {
        return '<div class="pipe"></div><div class="pipe-tag">:' + p.host + ' → :' + p.cont + '</div>';
      }).join('');
      return '<div class="crate-doors"></div><div class="crate-lamp"></div>' + ports +
        '<div class="crate-status">' + statusTag(c) + '</div>' +
        '<div class="crate-label">' + c.name + '</div>';
    }

    function addCrate(c, animated) {
      var d = el('div', 'crate' + (c.status === 'running' ? '' : ' exited'), crateHTML(c));
      d.style.setProperty('--h', hueFor(c.name));
      if (c.network && c.network !== 'bridge') { d.classList.add('netted'); }
      if (animated) { d.classList.add('dropping'); root.DG.audio.play('place'); }
      refs.crates.appendChild(d);
      crateEls[c.id] = d;
      scheduleWires();
      return d;
    }

    function updateCrate(c) {
      var d = crateEls[c.id];
      if (!d) { return; }
      d.classList.toggle('exited', c.status !== 'running');
      d.classList.toggle('netted', !!(c.network && c.network !== 'bridge'));
      var stEl = d.querySelector('.crate-status');
      if (stEl) { stEl.textContent = statusTag(c); }
      scheduleWires();
    }

    function removeCrate(c, animated) {
      var d = crateEls[c.id];
      if (!d) { return; }
      delete crateEls[c.id];
      if (!animated) { d.remove(); scheduleWires(); return; }
      d.classList.remove('dropping');
      d.classList.add('removing');
      setTimeout(function () { d.remove(); drawWires(); }, 850);
      scheduleWires();
    }

    // ---------- 內線電話線（同一條自訂 network 的貨櫃間拉實體線纜） ----------
    var wireTimer = null;
    function drawWires() {
      var groups = {};
      engine.state.containers.forEach(function (c) {
        var d = crateEls[c.id];
        if (!d || !c.network || c.network === 'bridge') { return; }
        (groups[c.network] = groups[c.network] || []).push(d);
      });
      var svg = '';
      Object.keys(groups).forEach(function (net) {
        var members = groups[net].sort(function (a, b) { return a.offsetLeft - b.offsetLeft; });
        for (var i = 0; i + 1 < members.length; i++) {
          var a = members[i], b = members[i + 1];
          var x1 = a.offsetLeft + a.offsetWidth / 2, y1 = a.offsetTop + 4;
          var x2 = b.offsetLeft + b.offsetWidth / 2, y2 = b.offsetTop + 4;
          // 架空拉線：從櫃頂向上拱過兩櫃之間，才不會被貨櫃本體遮住
          var liftY = Math.min(y1, y2) - Math.min(46, 26 + (x2 - x1) * 0.05);
          var cx1 = x1 + (x2 - x1) / 3, cx2 = x2 - (x2 - x1) / 3;
          svg += '<path class="net-wire" d="M' + x1 + ' ' + y1 +
            ' C' + cx1 + ' ' + liftY + ', ' + cx2 + ' ' + liftY + ', ' + x2 + ' ' + y2 + '"/>' +
            '<circle class="net-plug" cx="' + x1 + '" cy="' + y1 + '" r="3.2"/>' +
            '<circle class="net-plug" cx="' + x2 + '" cy="' + y2 + '" r="3.2"/>';
        }
      });
      refs.wires.innerHTML = svg ? '<svg width="100%" height="100%">' + svg + '</svg>' : '';
    }
    function scheduleWires() {
      requestAnimationFrame(drawWires);
      clearTimeout(wireTimer);
      wireTimer = setTimeout(drawWires, 950);   // 吊放/移除動畫落定後再校正一次錨點
    }
    root.addEventListener('resize', scheduleWires);

    // ---------- 藍圖架 / 保險庫 ----------
    function renderShelf() {
      refs.shelf.innerHTML = '<div class="shelf-title">' + t({ zh: '藍圖架 · images', en: 'Blueprint shelf · images' }) + '</div>';
      engine.state.images.forEach(function (im) {
        var b = el('div', 'blueprint',
          art.icons.bpSmall + '<span>' + im.repo + '</span><span class="bp-tag">:' + im.tag + '</span>');
        refs.shelf.appendChild(b);
      });
    }

    function renderVaults(animatedName) {
      refs.vaults.innerHTML = '';
      engine.state.volumes.forEach(function (v) {
        var d = el('div', 'vault', '<div class="vault-label">' + v.name + '</div>');
        if (v.name === animatedName) { d.classList.add('surfacing'); }
        refs.vaults.appendChild(d);
      });
    }

    // ---------- 全量同步（無動畫，關卡開場用） ----------
    function sync() {
      Object.keys(crateEls).forEach(function (id) { crateEls[id].remove(); });
      crateEls = {};
      engine.state.containers.forEach(function (c) { addCrate(c, false); });
      renderShelf();
      renderVaults();
    }

    // ---------- 粒子煙火 ----------
    function burst(xPct, yPct, count, palette) {
      var colors = palette || ['#5cf2a5', '#ffd166', '#59c8ff', '#ff7a90', '#a78bfa'];
      for (var i = 0; i < (count || 22); i++) {
        (function () {
          var p = el('div', 'spark');
          p.style.left = xPct + '%';
          p.style.top = yPct + '%';
          p.style.background = colors[i % colors.length];
          p.style.boxShadow = '0 0 8px 2px ' + colors[i % colors.length];
          refs.scene.appendChild(p);
          var ang = Math.random() * Math.PI * 2;
          var dist = 40 + Math.random() * 130;
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              p.style.transform = 'translate(' + Math.cos(ang) * dist + 'px,' +
                (Math.sin(ang) * dist - 30) + 'px) scale(0.2)';
              p.style.opacity = '0';
            });
          });
          setTimeout(function () { p.remove(); }, 1250);
        }());
      }
    }

    function fireworks() {
      root.DG.audio.play('fanfare');
      [[25, 30], [55, 22], [78, 36], [42, 44], [65, 50]].forEach(function (pos, i) {
        setTimeout(function () { burst(pos[0], pos[1], 26); }, i * 260);
      });
    }

    // 結業典禮：授階儀式（接上 level.css 既有的 .finale-veil / .fleet-sail）
    function finale(title, sub) {
      var veil = el('div', 'finale-veil');
      var ships = '';
      for (var i = 0; i < 5; i++) {
        ships += '<div class="sail-ship" style="animation-delay:' + (i * 0.16) + 's">' + art.whale(true) + '</div>';
      }
      veil.innerHTML = '<h2>' + (title || t({ zh: '結業典禮', en: 'Graduation Ceremony' })) + '</h2>' +
        '<div class="fin-sub">' + (sub || '') + '</div>' +
        '<div class="fleet-sail">' + ships + '</div>';
      mount.appendChild(veil);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { veil.classList.add('on'); });
      });
      fireworks();
      setTimeout(function () {
        veil.classList.remove('on');
        setTimeout(function () { if (veil.parentNode) { veil.remove(); } }, 900);
      }, 6500);
      return veil;
    }

    // ---------- 說明字幕 ----------
    var capTimer = null;
    function caption(text, ms) {
      refs.caption.textContent = text;
      refs.caption.classList.add('on');
      clearTimeout(capTimer);
      capTimer = setTimeout(function () { refs.caption.classList.remove('on'); }, ms || 3400);
    }

    // ---------- 訪客走進管線（port 演出） ----------
    function visitorWalk(crateElTarget) {
      if (!crateElTarget) { return; }
      var v = el('div', 'visitor', '<div class="v-head"></div><div class="v-body"></div>');
      v.style.left = '-24px';
      refs.scene.appendChild(v);
      var rect = crateElTarget.getBoundingClientRect();
      var sceneRect = refs.scene.getBoundingClientRect();
      var target = rect.left - sceneRect.left + rect.width / 2;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { v.style.left = target + 'px'; });
      });
      setTimeout(function () {
        burst(target / sceneRect.width * 100, 66, 10, ['#59c8ff', '#bfe9ff']);
        v.remove();
      }, 2300);
    }

    // ---------- ping 光束 ----------
    function pingBeam(fromName, toName, ok) {
      var from = null;
      var to = null;
      engine.state.containers.forEach(function (c) {
        if (c.name === fromName) { from = crateEls[c.id]; }
        if (c.name === toName) { to = crateEls[c.id]; }
      });
      if (!from) { return; }
      var sceneRect = refs.scene.getBoundingClientRect();
      var f = from.getBoundingClientRect();
      var fx = (f.left - sceneRect.left + f.width / 2) / sceneRect.width * 100;
      if (!to || !ok) {
        burst(fx, 62, 8, ['#ff7a90', '#ffb0be']);
        if (from.classList) { from.classList.add('shake'); setTimeout(function () { from.classList.remove('shake'); }, 600); }
        return;
      }
      var t = to.getBoundingClientRect();
      var tx = (t.left - sceneRect.left + t.width / 2) / sceneRect.width * 100;
      [0, 1, 2, 3, 4].forEach(function (i) {
        setTimeout(function () {
          burst(fx + (tx - fx) * (i / 4), 62, 4, ['#5cf2a5', '#a7ffd0']);
        }, i * 110);
      });
    }

    // ---------- 事件 → 演出 ----------
    var HANDLERS = {
      'pull:done': function () { renderShelf(); root.DG.audio.play('splash'); },
      'container:create': function (d) { addCrate(d.container, true); },
      'container:start': function (d) {
        if (!crateEls[d.container.id]) { addCrate(d.container, true); }
        updateCrate(d.container);
      },
      'container:stop': function (d) { updateCrate(d.container); },
      'container:die': function (d) { updateCrate(d.container); },
      'container:remove': function (d) { removeCrate(d.container, true); },
      'volume:create': function (d) { renderVaults(d.volume.name); root.DG.audio.play('splash'); },
      'network:create': function (d) { caption(t({ zh: '內線開通：{name}', en: 'Private line opened: {name}' }, { name: d.network.name })); },
      'ping': function (d) { pingBeam(d.from, d.to, d.ok); },
      'cargo:store': function (d) {
        caption(d.persistent
          ? t({ zh: '貨物「{item}」已存入保險庫 {volume}', en: 'Cargo "{item}" stored in vault {volume}' }, { item: d.item, volume: d.volume })
          : t({ zh: '貨物「{item}」存在貨櫃裡（暫時的！）', en: 'Cargo "{item}" kept inside the container (temporary!)' }, { item: d.item }));
        burst(d.persistent ? 88 : 50, d.persistent ? 74 : 70, 10, ['#5cf2a5', '#ffd166']);
      },
      'compose:up': function () { fireworks(); root.DG.audio.play('horn'); }
    };

    function applyEvents(events) {
      (events || []).forEach(function (evt) {
        var h = HANDLERS[evt.type];
        if (h) { h(evt.data); }
      });
    }

    // ---------- 迷你瀏覽器 ----------
    var browser = null;
    function showBrowser(url, title, bodyHTML) {
      hideBrowser();
      browser = el('div', 'mini-browser',
        '<div class="mb-bar">' +
        '<span class="mb-dot" style="background:#ff5f57"></span>' +
        '<span class="mb-dot" style="background:#febc2e"></span>' +
        '<span class="mb-dot" style="background:#28c840"></span>' +
        '<span class="mb-url">' + url + '</span></div>' +
        '<div class="mb-page"><h2>' + title + '</h2>' + bodyHTML + '</div>' +
        '<button class="mb-close" title="' + t({ zh: '關閉', en: 'Close' }) + '">✕</button>');
      browser.querySelector('.mb-close').addEventListener('click', hideBrowser);
      refs.scene.appendChild(browser);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { browser.classList.add('on'); });
      });
    }

    function hideBrowser() {
      if (browser) { browser.remove(); browser = null; }
    }

    return {
      scene: scene,
      sync: sync,
      applyEvents: applyEvents,
      caption: caption,
      burst: burst,
      fireworks: fireworks,
      finale: finale,
      visitorWalk: visitorWalk,
      crateElOf: function (name) {
        var c = engine.findContainer(name);
        return c ? crateEls[c.id] : null;
      },
      showBrowser: showBrowser,
      hideBrowser: hideBrowser,
      renderShelf: renderShelf,
      renderVaults: renderVaults
    };
  }

  root.DG.createStage = createStage;
}(typeof globalThis !== 'undefined' ? globalThis : this));
