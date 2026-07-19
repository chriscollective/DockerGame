/*
 * art.js — 共用 SVG 美術：鯨魚船長、徽章、關卡圖示、海浪、小圖示
 * 全部 inline SVG 字串，零外部資源。
 */
(function (root) {
  'use strict';

  // ---- 鯨魚船長（原創吉祥物：圓潤深藍鯨 + 船長帽） ----
  // 每次呼叫產生唯一漸層 id，避免多隻鯨魚共用同一個 id 導致 url(#wg)
  // 解析到隱藏畫面裡的定義而讓身體變透明。
  var whaleSeq = 0;
  function whale(withHat) {
    var gid = 'wg' + (++whaleSeq);
    var hat = withHat === false ? '' :
      '<g transform="translate(30,2)">' +
      '<path d="M8 14 Q20 -2 34 12 L33 16 Q20 10 9 17 Z" fill="#16213e" stroke="#3d5a99" stroke-width="1.2"/>' +
      '<rect x="6" y="14" width="30" height="5" rx="2.5" fill="#1d2b52" stroke="#3d5a99" stroke-width="1"/>' +
      '<circle cx="21" cy="10" r="2.6" fill="#ffd166"/>' +
      '</g>';
    return '<svg viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#4a7fd6"/><stop offset="1" stop-color="#28497f"/></linearGradient></defs>' +
      // 尾巴
      '<path d="M95 42 Q112 30 116 18 Q114 34 106 44 Q114 52 118 64 Q108 56 94 52 Z" fill="#31589a"/>' +
      // 身體
      '<path d="M12 50 Q14 22 52 20 Q92 18 100 44 Q102 58 84 64 Q46 74 22 62 Q12 58 12 50 Z" fill="url(#' + gid + ')"/>' +
      // 肚皮紋
      '<path d="M20 58 Q48 70 82 62 Q64 70 40 69 Q26 67 20 58 Z" fill="#bcd6f7" opacity="0.85"/>' +
      '<path d="M24 60 L80 60 M28 64 L74 65" stroke="#8fb4e8" stroke-width="1.4" opacity="0.5" fill="none"/>' +
      // 鰭
      '<path d="M50 58 Q58 66 52 74 Q42 70 44 60 Z" fill="#31589a"/>' +
      // 眼睛 + 腮紅 + 微笑
      '<circle cx="38" cy="40" r="4.2" fill="#0c1329"/>' +
      '<circle cx="39.6" cy="38.4" r="1.4" fill="#fff"/>' +
      '<ellipse cx="30" cy="48" rx="4.5" ry="2.6" fill="#e88ba0" opacity="0.55"/>' +
      '<path d="M44 50 Q50 55 58 51" stroke="#0c1329" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      hat + '</svg>';
  }

  // ---- 海浪層 ----
  function wave(color) {
    var d = 'M0 24 Q 60 4 120 24 T 240 24 T 360 24 T 480 24 T 600 24 T 720 24 T 840 24 T 960 24 V46 H0 Z';
    return '<svg viewBox="0 0 960 46" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="' + d + '" fill="' + color + '"/></svg>';
  }

  // ---- 星星 / 勾勾 ----
  function star(lit) {
    return '<svg class="star' + (lit ? ' lit' : '') + '" viewBox="0 0 24 24">' +
      '<path d="M12 2.5 L14.9 8.6 L21.5 9.5 L16.7 14.1 L17.9 20.7 L12 17.5 L6.1 20.7 L7.3 14.1 L2.5 9.5 L9.1 8.6 Z"/></svg>';
  }
  function check() {
    return '<svg viewBox="0 0 14 14"><path d="M2 7.5 L5.5 11 L12 3.5" fill="none" stroke="#04240f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function lock() {
    return '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="2" fill="none" stroke="#98a2c4" stroke-width="1.4"/><path d="M5 7 V5 a3 3 0 0 1 6 0 V7" fill="none" stroke="#98a2c4" stroke-width="1.4"/></svg>';
  }

  // ---- 徽章圖形字典（線條圖示） ----
  var GLYPHS = {
    ship: '<path d="M8 20 L24 20 L21 25 H11 Z" fill="none" stroke-width="1.8"/><path d="M16 8 V19 M16 10 L23 16 H16" fill="none" stroke-width="1.8"/>',
    box: '<rect x="9" y="11" width="14" height="11" rx="1.5" fill="none" stroke-width="1.8"/><path d="M9 15 H23 M13 11 V15 M19 11 V15" stroke-width="1.4"/>',
    scroll: '<path d="M10 8 H22 V22 Q22 25 19 25 H10 Q12 24 12 21 V8" fill="none" stroke-width="1.8"/><path d="M14 13 H19 M14 17 H19" stroke-width="1.4"/>',
    broom: '<path d="M20 7 L14 15" stroke-width="1.8"/><path d="M11 15 L17 15 L18 24 Q13 26 9 22 Z" fill="none" stroke-width="1.8"/>',
    pipe: '<path d="M8 22 V14 Q8 10 12 10 H24" fill="none" stroke-width="2"/><circle cx="24" cy="10" r="2.4" fill="none" stroke-width="1.6"/><path d="M6 22 H10" stroke-width="2"/>',
    lantern: '<rect x="12" y="10" width="8" height="12" rx="3" fill="none" stroke-width="1.8"/><path d="M16 7 V10 M16 22 V25 M12 16 H20" stroke-width="1.6"/>',
    vault: '<rect x="9" y="9" width="14" height="14" rx="2" fill="none" stroke-width="1.8"/><circle cx="16" cy="16" r="3.4" fill="none" stroke-width="1.6"/><path d="M16 12.6 V10.8 M16 21.2 V19.4 M12.6 16 H10.8 M21.2 16 H19.4" stroke-width="1.4"/>',
    blueprint: '<rect x="8" y="9" width="16" height="14" rx="1.5" fill="none" stroke-width="1.8"/><path d="M11 13 H17 M11 16 H21 M11 19 H15" stroke-width="1.4"/>',
    compass: '<circle cx="16" cy="16" r="8" fill="none" stroke-width="1.8"/><path d="M19.5 12.5 L17.2 17.2 L12.5 19.5 L14.8 14.8 Z" fill="none" stroke-width="1.5"/>',
    flag: '<path d="M11 7 V25" stroke-width="2"/><path d="M11 8 H23 L20 12 L23 16 H11" fill="none" stroke-width="1.8"/>'
  };

  // ---- 徽章勳章 ----
  function badgeMedal(badge, locked) {
    var hue = badge.hue;
    var stroke = locked ? '#5d6688' : ('hsl(' + hue + ', 80%, 72%)');
    var g1 = 'hsl(' + hue + ', 55%, 34%)';
    var g2 = 'hsl(' + hue + ', 60%, 16%)';
    var id = 'bm' + badge.id;
    return '<svg class="badge-medal" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><radialGradient id="' + id + '" cx="0.35" cy="0.3" r="1">' +
      '<stop offset="0" stop-color="' + g1 + '"/><stop offset="1" stop-color="' + g2 + '"/></radialGradient></defs>' +
      '<circle cx="16" cy="16" r="14.4" fill="url(#' + id + ')" stroke="' + stroke + '" stroke-width="1.4"/>' +
      '<circle cx="16" cy="16" r="11.6" fill="none" stroke="' + stroke + '" stroke-width="0.6" stroke-dasharray="2 3" opacity="0.8"/>' +
      '<g stroke="' + stroke + '" stroke-linecap="round" stroke-linejoin="round" fill="none">' +
      (GLYPHS[badge.glyph] || GLYPHS.box) + '</g></svg>';
  }

  // 地圖島嶼圖示：直接用徽章 glyph
  function isleIcon(glyph, color) {
    return '<svg viewBox="0 0 32 32"><g stroke="' + (color || '#9ec2ff') +
      '" stroke-linecap="round" stroke-linejoin="round" fill="none">' +
      (GLYPHS[glyph] || GLYPHS.box) + '</g></svg>';
  }

  // ---- 小圖示 ----
  var icons = {
    sound: '<svg viewBox="0 0 20 20"><path d="M4 8 H7 L11 4.5 V15.5 L7 12 H4 Z" fill="currentColor"/><path d="M13.5 7 Q15.5 10 13.5 13 M15.5 5 Q18.6 10 15.5 15" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
    muted: '<svg viewBox="0 0 20 20"><path d="M4 8 H7 L11 4.5 V15.5 L7 12 H4 Z" fill="currentColor"/><path d="M13.5 8 L17.5 12 M17.5 8 L13.5 12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
    map: '<svg viewBox="0 0 20 20"><path d="M3 5 L8 3.5 L12 5.5 L17 4 V15 L12 16.5 L8 14.5 L3 16 Z M8 3.5 V14.5 M12 5.5 V16.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    bulb: '<svg viewBox="0 0 20 20"><path d="M10 2.8 a5.2 5.2 0 0 1 3 9.4 L12.6 14 H7.4 L7 12.2 A5.2 5.2 0 0 1 10 2.8 Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 16.5 H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    replay: '<svg viewBox="0 0 20 20"><path d="M4.5 8 A6 6 0 1 1 4 12.5 M4.5 4 V8 H8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    badge: '<svg viewBox="0 0 20 20"><circle cx="10" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 12 L6 17.5 L10 15.5 L14 17.5 L13 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    bpSmall: '<svg class="bp-icon" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="#9ec2ff" stroke-width="1.3"/><path d="M4.5 6 H10 M4.5 8.5 H11.5" stroke="#9ec2ff" stroke-width="1.1"/></svg>',
    terminal: '<svg viewBox="0 0 20 20"><rect x="2" y="3.5" width="16" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 8 L8.5 10.5 L5.5 13 M10 13.5 H14" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  root.DG = root.DG || {};

  // 共用 DOM 小工具（最早載入的 UI 檔，供 screens/levels/game 使用）
  root.DG.h = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (html !== undefined) { e.innerHTML = html; }
    return e;
  };

  root.DG.art = {
    whale: whale,
    wave: wave,
    star: star,
    check: check,
    lock: lock,
    badgeMedal: badgeMedal,
    isleIcon: isleIcon,
    icons: icons
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
