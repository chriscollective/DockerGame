/*
 * store.js — 進度存檔（localStorage）
 * 結構：{ levels: {1:{stars,done}}, badges: ['b1'], xp, muted, startedAt }
 */
(function (root) {
  'use strict';
  var CONFIG = root.DG.CONFIG;

  function blank() {
    return { levels: {}, badges: [], xp: 0, muted: false, lang: null, startedAt: Date.now(), v: 1 };
  }

  function load() {
    try {
      var raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) { return blank(); }
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || !data.levels) { return blank(); }
      return data;
    } catch (e) {
      // 存檔壞掉就重來，不讓遊戲 crash
      return blank();
    }
  }

  var save = load();

  function persist() {
    try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(save)); }
    catch (e) { /* 隱私模式下寫入失敗：遊戲照玩，只是不存檔 */ }
  }

  function completeLevel(level, stars) {
    var prev = save.levels[level];
    var firstTime = !prev;
    var improved = prev && stars > prev.stars;
    if (firstTime || improved) {
      save.levels[level] = { stars: stars, done: true };
    }
    var badge = CONFIG.BADGES.filter(function (b) { return b.level === level; })[0];
    var newBadge = false;
    if (badge && save.badges.indexOf(badge.id) < 0) {
      save.badges.push(badge.id);
      newBadge = true;
    }
    var gained = 0;
    if (firstTime) { gained = CONFIG.XP_BASE + stars * CONFIG.XP_PER_STAR; }
    else if (improved) { gained = (stars - prev.stars) * CONFIG.XP_PER_STAR; }
    save.xp += gained;
    persist();
    return { xpGained: gained, newBadge: newBadge, badge: badge, firstTime: firstTime };
  }

  function isUnlocked(level) {
    if (level === 1) { return true; }
    var prev = save.levels[level - 1];
    return !!(prev && prev.done);
  }

  function starsOf(level) {
    var s = save.levels[level];
    return s ? s.stars : 0;
  }

  function hasAnyProgress() {
    return Object.keys(save.levels).length > 0;
  }

  function rank() {
    var r = CONFIG.RANKS[0];
    CONFIG.RANKS.forEach(function (x) { if (save.xp >= x.xp) { r = x; } });
    return r;
  }

  function resetAll() {
    save = blank();
    persist();
  }

  function setMuted(m) {
    save.muted = !!m;
    persist();
  }

  // 語言偏好：null = 尚未選過（交給 i18n 依瀏覽器語言自動偵測）
  function getLang() { return save.lang || null; }
  function setLang(l) { save.lang = l; persist(); }

  root.DG.store = {
    get data() { return save; },
    completeLevel: completeLevel,
    isUnlocked: isUnlocked,
    starsOf: starsOf,
    hasAnyProgress: hasAnyProgress,
    rank: rank,
    resetAll: resetAll,
    setMuted: setMuted,
    getLang: getLang,
    setLang: setLang
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
