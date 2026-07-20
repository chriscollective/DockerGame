/*
 * i18n.js — 語言狀態與翻譯工具（掛 window.DG；同時 module.exports 供 Node 測試）
 *
 * 設計原則（務必遵守，否則會弄壞測試）：
 *   1. DG.t / DG.lang 在任何環境都可用（純函式，不碰瀏覽器 API）。
 *   2. 所有瀏覽器 API（localStorage / navigator / document）只在 setLang()/initLang()
 *      等「執行期」函式內存取，且以 typeof 防護；模組載入期一律不碰。
 *   3. 翻譯內容一律存成資料（純字串或 {zh,en} 物件），DG.t 只在 render/互動時呼叫。
 *      關卡檔的可翻欄位改成 {zh,en}，模組載入期不得呼叫 DG.t（Node 測試只跑 check()）。
 *
 * 用法：
 *   DG.t('固定字')                              → 原樣回傳（語言中性）
 *   DG.t({ zh: '啟航', en: 'Set Sail' })         → 依當前語言挑，fallback zh
 *   DG.t({ zh:'裝櫃（{n}/3）', en:'Ship ({n}/3)' }, { n: 2 })  → 內插 {name} placeholder
 */
(function (root) {
  'use strict';
  root.DG = root.DG || {};
  var DG = root.DG;

  var lang = 'zh';           // 預設；瀏覽器端由 initLang() 依 store / navigator 覆寫
  var listeners = [];        // 語言切換時要重繪的 callback

  // ---- 核心：依當前語言取值並內插變數 ----
  function t(val, vars) {
    var s;
    if (val == null) { s = ''; }
    else if (typeof val === 'string') { s = val; }
    else if (typeof val === 'object') {
      s = (val[lang] != null) ? val[lang] : val.zh;
      if (s == null) { s = ''; }
    } else { s = String(val); }
    if (vars) {
      s = String(s).replace(/\{(\w+)\}/g, function (m, k) {
        return (vars[k] != null) ? vars[k] : m;
      });
    }
    return s;
  }

  function getLang() { return lang; }
  function isEn() { return lang === 'en'; }

  function onLangChange(cb) { if (typeof cb === 'function') { listeners.push(cb); } }

  // 由瀏覽器語言猜預設：zh 開頭 → 中文，其餘 → 英文
  function detectLang() {
    if (typeof navigator !== 'undefined' && navigator.language &&
        /^zh/i.test(navigator.language)) { return 'zh'; }
    if (typeof navigator !== 'undefined' && navigator.language) { return 'en'; }
    return 'zh';
  }

  // 切換語言：更新狀態 → 瀏覽器副作用（防護）→ 持久化 → 通知重繪
  function setLang(l, opts) {
    if (l !== 'zh' && l !== 'en') { return; }
    lang = l;
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('lang', l === 'zh' ? 'zh-Hant' : 'en');
      applyStaticI18n();
    }
    if (DG.store && DG.store.setLang) { DG.store.setLang(l); }
    if (!(opts && opts.silent)) {
      listeners.forEach(function (cb) { try { cb(l); } catch (e) { /* 單一重繪失敗不連坐 */ } });
    }
  }

  // 瀏覽器啟動時決定初始語言（存檔優先，其次偵測），套用靜態文字但不觸發重繪
  function initLang() {
    var saved = (DG.store && DG.store.getLang) ? DG.store.getLang() : null;
    lang = (saved === 'zh' || saved === 'en') ? saved : detectLang();
    setLang(lang, { silent: true });
    return lang;
  }

  // ---- index.html 靜態文字（載入時與切換時填入）----
  var STATIC = {
    title: { zh: 'Docker 大航海 — 鯨魚港的貨櫃見習生',
             en: 'Docker Voyage — Cargo Apprentice of Whale Harbor' },
    hintBtn: { zh: '要提示（會影響星等）', en: 'Ask for a hint (costs stars)' },
    dexBtn: { zh: '知識徽章圖鑑', en: 'Badge Codex' },
    mapBtn: { zh: '回航線圖', en: 'Back to the chart' },
    termInput: { zh: '終端機輸入', en: 'Terminal input' },
    termVeil: { zh: '本關不需要終端機——完成上方的互動任務（第 2 關解鎖終端機）',
                en: 'No terminal this level — finish the interactive task above (the terminal unlocks at Level 2)' },
    tooSmallH: { zh: '請用電腦遊玩', en: 'Please play on a computer' },
    tooSmallP: { zh: '鯨魚港的碼頭作業需要寬敞的甲板——請用寬度 1024px 以上的螢幕（建議 1280px+）開啟本遊戲。',
                 en: 'Dock work at Whale Harbor needs a roomy deck — open this game on a screen at least 1024px wide (1280px+ recommended).' }
  };

  function setText(sel, val) {
    if (typeof document === 'undefined') { return; }
    var el = document.querySelector(sel);
    if (el) { el.textContent = t(val); }
  }
  function setAttr(sel, attr, val) {
    if (typeof document === 'undefined') { return; }
    var el = document.querySelector(sel);
    if (el) { el.setAttribute(attr, t(val)); }
  }

  function applyStaticI18n() {
    if (typeof document === 'undefined') { return; }
    document.title = t(STATIC.title);
    setAttr('#btn-hint', 'title', STATIC.hintBtn);
    setAttr('#btn-dex', 'title', STATIC.dexBtn);
    setAttr('#btn-map', 'title', STATIC.mapBtn);
    setAttr('#term-input', 'aria-label', STATIC.termInput);
    setText('#term-veil-text', STATIC.termVeil);
    setText('#too-small h2', STATIC.tooSmallH);
    setText('#too-small p', STATIC.tooSmallP);
  }

  DG.t = t;
  DG.getLang = getLang;
  DG.isEn = isEn;
  DG.setLang = setLang;
  DG.initLang = initLang;
  DG.detectLang = detectLang;
  DG.onLangChange = onLangChange;
  DG.applyStaticI18n = applyStaticI18n;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { t: t, getLang: getLang, setLang: setLang, initLang: initLang,
      detectLang: detectLang, onLangChange: onLangChange, applyStaticI18n: applyStaticI18n };
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
