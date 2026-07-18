// tests/levels.test.mjs — 關卡「通關條件」整合測試（DOM-free 載入關卡檔）
// 執行：node tests/levels.test.mjs
// 作法：用最小的 DG 環境（stub h/audio）載入所有關卡檔，取出每關 objective 的
//       check(result, ctx)，用真實 engine + cli 造出 result 後逐條驗證。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// 建立無 DOM 的 DG 環境（關卡 check 不碰 DOM；onDone 才用 stage，本測試不觸發）
globalThis.DG = { h: function () { return {}; }, audio: { play: function () {} } };
globalThis.DG.CONFIG = require('../js/config.js');
const { createEngine } = require('../js/engine.js');
const { createCLI } = require('../js/cli.js');
globalThis.DG.createEngine = createEngine;
globalThis.DG.createCLI = createCLI;
require('../js/levels/index.js');        // 提供 registerLevel/getLevel/hasEvent
require('../js/levels/level01.js');
require('../js/levels/levels02-04.js');
require('../js/levels/levels05-07.js');
require('../js/levels/level08.js');
require('../js/levels/levels09-10.js');

const L = function (id) { return globalThis.DG.getLevel(id); };
function ctx(engine, flags) { return { engine: engine, flags: flags || {} }; }

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ok - ' + name); }

// ---------- B5：第 2 關 obj2 需真的有 exited 容器 ----------
test('L2-obj2：docker ps -a 且存在 exited 容器才過（不再只看 count>=1）', () => {
  const e = createEngine();
  const cli = createCLI(e);
  e.run({ image: 'nginx', name: 'up1', detach: true });          // 只有 running
  let r = cli.exec('docker ps -a');
  assert.equal(!!L(2).objectives[1].check(r, ctx(e)), false, '沒有 exited 容器不該過');

  const e2 = createEngine();
  const cli2 = createCLI(e2);
  e2.run({ image: 'hello-world', name: 'hw' });                  // oneshot → exited
  r = cli2.exec('docker ps -a');
  assert.equal(!!L(2).objectives[1].check(r, ctx(e2)), true, '有 exited 容器應過');
});

// ---------- B1：第 5 關通關條件收緊 ----------
test('L5-obj1：必須 nginx + -d + 8080:80；redis 或缺 -d 都不過', () => {
  let e, cli, r;
  e = createEngine(); cli = createCLI(e);
  r = cli.exec('docker run -d -p 8080:80 redis');
  assert.equal(!!L(5).objectives[0].check(r, ctx(e)), false, 'redis 不該過 L5-obj1');
  e = createEngine(); cli = createCLI(e);
  r = cli.exec('docker run -p 8080:80 nginx');
  assert.equal(!!L(5).objectives[0].check(r, ctx(e)), false, '缺 -d 不該過');
  e = createEngine(); cli = createCLI(e);
  r = cli.exec('docker run -d -p 8080:80 nginx');
  assert.equal(!!L(5).objectives[0].check(r, ctx(e)), true, '正解應過');
});

test('L5-obj3：必須 nginx + -d + host 8081 → 容器 80', () => {
  let e, cli, r;
  e = createEngine(); cli = createCLI(e);
  r = cli.exec('docker run -d -p 8081:80 nginx');
  assert.equal(!!L(5).objectives[2].check(r, ctx(e)), true, '正解應過');
  e = createEngine(); cli = createCLI(e);
  r = cli.exec('docker run -p 8081:80 nginx');
  assert.equal(!!L(5).objectives[2].check(r, ctx(e)), false, '缺 -d 不該過');
});

// ---------- B2 + A1：第 6 關 obj5 需 whale-app + MODE=harbor + -p 3000:3000 ----------
test('L6-obj5：需 whale-app + MODE=harbor + 發佈 3000:3000', () => {
  let e = createEngine(); let cli = createCLI(e);
  e.run({ image: 'whale-app', name: 'harbor-app', detach: true });   // setup 的壞容器
  cli.exec('docker rm -f harbor-app');
  let r = cli.exec('docker run -d -p 3000:3000 --name harbor-app -e MODE=harbor whale-app');
  assert.equal(!!L(6).objectives[4].check(r, ctx(e)), true, '正解應過');

  e = createEngine(); cli = createCLI(e);
  r = cli.exec('docker run -d --name harbor-app -e MODE=harbor whale-app');
  assert.equal(!!L(6).objectives[4].check(r, ctx(e)), false,
    '缺 -p 3000:3000 不該過（否則 localhost:3000 連不到卻宣稱可達）');

  e = createEngine(); cli = createCLI(e);
  r = cli.exec('docker run -d -p 3000:3000 --name harbor-app whale-app');
  assert.equal(!!L(6).objectives[4].check(r, ctx(e)), false, '缺 MODE 不該過');
});

// ---------- B3：第 7 關掛載步驟需 harbor-db + treasure:/data ----------
test('L7 掛載步驟：需 harbor-db + treasure:/data；掛錯路徑不過', () => {
  let e = createEngine(); let cli = createCLI(e);
  e.volumeCreate('treasure');
  let r = cli.exec('docker run -d --name db -v treasure:/data harbor-db');
  assert.equal(!!L(7).objectives[5].check(r, ctx(e)), true, '正解應過');

  e = createEngine(); cli = createCLI(e);
  e.volumeCreate('treasure');
  r = cli.exec('docker run -d --name db -v treasure:/wrong harbor-db');
  assert.equal(!!L(7).objectives[5].check(r, ctx(e)), false, '掛錯路徑不該過');
});

// ---------- A6/B4：第 10 關 obj2 需要 up -d ----------
test('L10-obj2：docker compose up 需帶 -d 才過', () => {
  const e = createEngine();
  const cli = createCLI(e);
  cli.setComposeProject({
    name: 'harbor', networks: ['fleet-net'], volumes: ['db-data'],
    services: [
      { name: 'web', image: 'webapp', ports: [{ host: 8080, cont: 3000 }], network: 'fleet-net', dependsOn: ['db'] },
      { name: 'db', image: 'harbor-db', volume: { name: 'db-data', dest: '/data' }, network: 'fleet-net' }
    ]
  });
  let r = cli.exec('docker compose up');
  assert.equal(!!L(10).objectives[1].check(r, ctx(e)), false, '缺 -d 不該過');
  r = cli.exec('docker compose up -d');
  assert.equal(!!L(10).objectives[1].check(r, ctx(e)), true, 'up -d 應過');
});

console.log('\n全部通過：' + passed + ' 個測試');
