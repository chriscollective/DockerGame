/*
 * terminal.js — 模擬終端機 UI：打字輸入、歷史、腳本播放（含 pull 多層進度條動畫）
 */
(function (root) {
  'use strict';
  var CONFIG = root.DG.CONFIG;

  function createTerminal(opts) {
    // opts: {bodyEl, inputEl, promptEl, veilEl, cli, onCommand}
    var cli = opts.cli;
    var history = [];
    var histIdx = -1;
    var busy = false;
    var locked = false;

    function scrollBottom() {
      opts.bodyEl.scrollTop = opts.bodyEl.scrollHeight;
    }

    function print(text, cls) {
      var el = document.createElement('div');
      el.className = 'term-line ' + (cls || 'out');
      el.textContent = text;
      opts.bodyEl.appendChild(el);
      scrollBottom();
      return el;
    }

    function printCmd(input) {
      var el = document.createElement('div');
      el.className = 'term-line cmd';
      var p = document.createElement('span');
      p.className = 'prompt-part';
      p.textContent = cli.getPrompt().text;
      el.appendChild(p);
      el.appendChild(document.createTextNode(input));
      opts.bodyEl.appendChild(el);
      scrollBottom();
    }

    function clearScreen() {
      opts.bodyEl.innerHTML = '';
    }

    // ---- pull 進度動畫：多層並行進度條 ----
    function playPull(op, done) {
      root.DG.audio.play('pull');
      var pending = op.layers.length;
      op.layers.forEach(function (layer, i) {
        var el = print('', 'pull-line');
        var total = 8 + Math.floor(Math.random() * 6);       // bar 格數
        var ticks = 0;
        var speed = CONFIG.TERMINAL.layerTick + Math.random() * 70;
        var timer = setInterval(function () {
          ticks++;
          if (ticks >= total) {
            clearInterval(timer);
            el.textContent = layer.id + ': Pull complete';
            el.className = 'term-line pull-line done-l ok';
            pending--;
            if (pending === 0) { setTimeout(done, 120); }
          } else {
            var bar = '';
            for (var b = 0; b < total; b++) { bar += b < ticks ? '=' : (b === ticks ? '>' : ' '); }
            el.textContent = layer.id + ': Downloading [' + bar + ']  ' + layer.size;
          }
          scrollBottom();
        }, speed + i * 26);
      });
      if (!op.layers.length) { done(); }
    }

    // ---- 腳本播放：逐行 + 特效 op ----
    function playScript(script, cb) {
      busy = true;
      opts.inputEl.disabled = true;
      var i = 0;
      function step() {
        if (i >= script.length) {
          busy = false;
          if (!locked) { opts.inputEl.disabled = false; focus(); }
          refreshPrompt();
          if (cb) { cb(); }
          return;
        }
        var op = script[i++];
        if (op.t === 'pull') { playPull(op, step); return; }
        print(op.text, op.cls);
        var delay = script.length > 14 ? CONFIG.TERMINAL.fastLineDelay : CONFIG.TERMINAL.lineDelay;
        setTimeout(step, op.delay !== undefined ? op.delay : delay);
      }
      step();
    }

    // ---- 輸入處理 ----
    function submit() {
      var input = opts.inputEl.value;
      if (busy) { return; }
      printCmd(input);
      opts.inputEl.value = '';
      root.DG.audio.play('enter');
      if (input.trim()) {
        history.push(input);
        if (history.length > CONFIG.TERMINAL.historyMax) { history.shift(); }
      }
      histIdx = history.length;
      var result = cli.exec(input);
      if (result.clear) {
        clearScreen();
        refreshPrompt();
        if (opts.onCommand) { opts.onCommand(result); }
        return;
      }
      if (!result.ok) { root.DG.audio.play('error'); }
      playScript(result.script, function () {
        if (opts.onCommand) { opts.onCommand(result); }
      });
    }

    function onKey(e) {
      if (e.key === 'Enter') { submit(); return; }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (histIdx > 0) { histIdx--; opts.inputEl.value = history[histIdx] || ''; }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (histIdx < history.length) { histIdx++; opts.inputEl.value = history[histIdx] || ''; }
        return;
      }
      if (e.key.length === 1) { root.DG.audio.play('key'); }
    }

    function refreshPrompt() {
      var p = cli.getPrompt();
      opts.promptEl.textContent = p.text;
      opts.promptEl.className = 'prompt' + (p.shell ? ' shell-mode' : '');
    }

    function focus() {
      if (!locked && !busy) { opts.inputEl.focus(); }
    }

    function setLocked(v) {
      locked = v;
      opts.inputEl.disabled = v || busy;
      if (opts.veilEl) { opts.veilEl.style.display = v ? 'flex' : 'none'; }
      if (!v) { focus(); }
    }

    function reset() {
      clearScreen();
      history = [];
      histIdx = -1;
      busy = false;
      refreshPrompt();
    }

    opts.inputEl.addEventListener('keydown', onKey);
    opts.bodyEl.addEventListener('click', focus);
    refreshPrompt();

    return {
      print: print,
      playScript: playScript,
      clearScreen: clearScreen,
      setLocked: setLocked,
      refreshPrompt: refreshPrompt,
      focus: focus,
      reset: reset,
      isBusy: function () { return busy; }
    };
  }

  root.DG.createTerminal = createTerminal;
}(typeof globalThis !== 'undefined' ? globalThis : this));
