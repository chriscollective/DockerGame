/*
 * levels/index.js — 關卡註冊表與共用小工具
 * 每個關卡檔呼叫 DG.registerLevel(def) 自行註冊。
 * def: {id, name, topic, glyph, story[], teach{title,html,map}, outro,
 *       terminal(bool), setup(ctx), mount(ctx)?, objectives[], cleanup(ctx)?,
 *       resultDelay(ms)?——覆寫該關過關→結算彈窗的延遲（預設走 CONFIG.RESULT_DELAY_MS）}
 * objective: {text(html), hints[3], check(result, ctx), onDone(ctx)?}
 * ctx: {engine, cli, stage, terminal, flags, flag(), overlay, game}
 */
(function (root) {
  'use strict';
  var registry = {};

  root.DG = root.DG || {};
  root.DG.registerLevel = function (def) { registry[def.id] = def; };
  root.DG.getLevel = function (id) { return registry[id]; };
  root.DG.levelList = function () {
    return Object.keys(registry).map(Number).sort(function (a, b) { return a - b; })
      .map(function (id) { return registry[id]; });
  };

  // 共用：把「事件列表裡是否出現某型別事件」包成 check（DOM 工具 h 定義於 ui/art.js）
  root.DG.hasEvent = function (result, type, pred) {
    if (!result || !result.events) { return false; }
    return result.events.some(function (e) {
      return e.type === type && (!pred || pred(e.data));
    });
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
