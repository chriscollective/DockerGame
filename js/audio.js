/*
 * audio.js — WebAudio 合成音效（零音檔）
 * 打字、完成、錯誤、過關號角、氣泡、汽笛等，皆以 oscillator + envelope 合成。
 */
(function (root) {
  'use strict';
  var ctx = null;
  var muted = false;

  function ac() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) { return null; }
      ctx = new AC();
    }
    if (ctx.state === 'suspended') { ctx.resume(); }
    return ctx;
  }

  // 基本音符：type 波形、freq 起始頻率、dur 秒、vol 音量、glide 目標頻率
  function tone(opts) {
    var a = ac();
    if (!a || muted) { return; }
    var t0 = a.currentTime + (opts.at || 0);
    var osc = a.createOscillator();
    var gain = a.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.glide) { osc.frequency.exponentialRampToValueAtTime(opts.glide, t0 + opts.dur); }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(opts.vol || 0.12, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.05);
  }

  function noise(dur, vol, at) {
    var a = ac();
    if (!a || muted) { return; }
    var t0 = a.currentTime + (at || 0);
    var len = Math.floor(a.sampleRate * dur);
    var buf = a.createBuffer(1, len, a.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) { d[i] = (Math.random() * 2 - 1) * (1 - i / len); }
    var src = a.createBufferSource();
    src.buffer = buf;
    var g = a.createGain();
    g.gain.value = vol || 0.05;
    var f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    src.connect(f).connect(g).connect(a.destination);
    src.start(t0);
  }

  var sfx = {
    key: function () { tone({ type: 'square', freq: 620 + Math.random() * 160, dur: 0.03, vol: 0.022 }); },
    enter: function () { tone({ type: 'square', freq: 340, dur: 0.06, vol: 0.04 }); },
    ok: function () {  // 目標打勾
      tone({ type: 'sine', freq: 660, dur: 0.09, vol: 0.09 });
      tone({ type: 'sine', freq: 880, dur: 0.14, vol: 0.09, at: 0.09 });
    },
    error: function () {
      tone({ type: 'sawtooth', freq: 180, dur: 0.16, vol: 0.05, glide: 120 });
    },
    splash: function () { noise(0.25, 0.06); },
    pull: function () { tone({ type: 'triangle', freq: 240, dur: 0.2, vol: 0.05, glide: 480 }); },
    place: function () {  // 貨櫃放下
      tone({ type: 'triangle', freq: 140, dur: 0.12, vol: 0.1, glide: 90 });
      noise(0.08, 0.04);
    },
    fanfare: function () {  // 過關號角
      var seq = [392, 523, 659, 784];
      seq.forEach(function (f, i) {
        tone({ type: 'triangle', freq: f, dur: 0.22, vol: 0.1, at: i * 0.13 });
        tone({ type: 'sine', freq: f * 2, dur: 0.22, vol: 0.04, at: i * 0.13 });
      });
      tone({ type: 'triangle', freq: 1047, dur: 0.5, vol: 0.11, at: 0.55 });
    },
    horn: function () {  // 鯨魚港汽笛
      tone({ type: 'sawtooth', freq: 98, dur: 0.7, vol: 0.06 });
      tone({ type: 'sawtooth', freq: 147, dur: 0.7, vol: 0.04 });
    },
    badge: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone({ type: 'sine', freq: f, dur: 0.3, vol: 0.07, at: i * 0.07 });
      });
    },
    whale: function () {  // 鯨魚噴水
      tone({ type: 'sine', freq: 300, dur: 0.4, vol: 0.04, glide: 700 });
      noise(0.3, 0.03, 0.1);
    },
    click: function () { tone({ type: 'sine', freq: 500, dur: 0.05, vol: 0.05 }); }
  };

  root.DG = root.DG || {};
  root.DG.audio = {
    play: function (name) { if (sfx[name]) { sfx[name](); } },
    setMuted: function (m) { muted = !!m; },
    isMuted: function () { return muted; }
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
