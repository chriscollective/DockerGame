// tests/engine.test.mjs — 模擬 Docker 引擎核心行為驗證（node 內建 assert，零依賴）
// 執行：node tests/engine.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createEngine } = require('../js/engine.js');
const { createCLI } = require('../js/cli.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('  ok - ' + name);
}

// ---------- pull / run 基本流程 ----------
test('pull：已知 image 成功、未知 image 擬真報錯', () => {
  const e = createEngine();
  const r = e.pull('nginx');
  assert.equal(r.ok, true);
  assert.equal(e.state.images.length, 1);
  assert.equal(e.state.images[0].tag, 'latest');
  const bad = e.pull('no-such-image');
  assert.equal(bad.ok, false);
  assert.match(bad.error, /repository does not exist/);
});

test('run：沒 pull 過會自動 pull；容器 id 為 64 hex、預設隨機名 adjective_noun', () => {
  const e = createEngine();
  const r = e.run({ image: 'nginx', detach: true });
  assert.equal(r.ok, true);
  assert.ok(r.pulled, 'local miss 應觸發自動 pull');
  assert.match(r.container.id, /^[0-9a-f]{64}$/);
  assert.match(r.container.name, /^[a-z]+_[a-z]+$/);
  assert.equal(r.container.status, 'running');
});

test('run：oneshot image（hello-world）跑完即 exited', () => {
  const e = createEngine();
  const r = e.run({ image: 'hello-world' });
  assert.equal(r.container.status, 'exited');
  assert.equal(r.container.exitCode, 0);
});

// ---------- stop / start / rm / -f ----------
test('生命週期：stop → exited、start → running、rm 運行中要報錯、-f 可強拆', () => {
  const e = createEngine();
  const { container: c } = e.run({ image: 'nginx', name: 'web', detach: true });
  assert.equal(e.stop('web').ok, true);
  assert.equal(c.status, 'exited');
  assert.equal(e.start('web').ok, true);
  assert.equal(c.status, 'running');

  const rmFail = e.rm('web', false);
  assert.equal(rmFail.ok, false);
  assert.match(rmFail.error, /container is running: stop the container before removing or force remove/);
  assert.equal(e.state.containers.length, 1, '失敗的 rm 不應移除容器');

  const rmForce = e.rm('web', true);
  assert.equal(rmForce.ok, true);
  assert.equal(e.state.containers.length, 0);
});

test('rm：不存在的容器報 No such container', () => {
  const e = createEngine();
  const r = e.rm('ghost', false);
  assert.equal(r.ok, false);
  assert.match(r.error, /No such container: ghost/);
});

test('可用 id 前綴操作容器', () => {
  const e = createEngine();
  const { container: c } = e.run({ image: 'redis', detach: true });
  const r = e.stop(c.id.slice(0, 12));
  assert.equal(r.ok, true);
  assert.equal(c.status, 'exited');
});

// ---------- port 衝突 ----------
test('port 衝突：同 host port 第二次 bind 報 port is already allocated', () => {
  const e = createEngine();
  assert.equal(e.run({ image: 'nginx', name: 'a', detach: true, ports: [{ host: 8080, cont: 80 }] }).ok, true);
  const r = e.run({ image: 'nginx', name: 'b', detach: true, ports: [{ host: 8080, cont: 80 }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /Bind for 0\.0\.0\.0:8080 failed: port is already allocated/);
  assert.equal(e.state.containers.length, 1, '衝突時不應建立容器');
});

test('port 釋放：stop 佔用者後同 port 可再 bind；start 回來時若被佔則失敗', () => {
  const e = createEngine();
  e.run({ image: 'nginx', name: 'a', detach: true, ports: [{ host: 8080, cont: 80 }] });
  e.stop('a');
  const r = e.run({ image: 'nginx', name: 'b', detach: true, ports: [{ host: 8080, cont: 80 }] });
  assert.equal(r.ok, true, 'stop 之後 port 應被釋放');
  const back = e.start('a');
  assert.equal(back.ok, false);
  assert.match(back.error, /port is already allocated/);
});

// ---------- name 衝突 ----------
test('name 衝突：重複 --name 報 Conflict（含舊容器 id 與教學句式）', () => {
  const e = createEngine();
  const first = e.run({ image: 'nginx', name: 'web', detach: true });
  const r = e.run({ image: 'redis', name: 'web', detach: true });
  assert.equal(r.ok, false);
  assert.match(r.error, /Conflict\. The container name "\/web" is already in use by container/);
  assert.ok(r.error.includes(first.container.id));
  const afterRm = (e.rm('web', true), e.run({ image: 'redis', name: 'web', detach: true }));
  assert.equal(afterRm.ok, true, 'rm 後名字應可重用');
});

// ---------- volume 持久語意 ----------
test('volume 語意：無 volume 資料隨容器消失；有 volume 資料活過 rm -f', () => {
  const e = createEngine();
  // 沒掛 volume：資料是暫時的
  e.run({ image: 'harbor-db', name: 'db', detach: true });
  assert.equal(e.execCmd('db', ['store', 'gold']).ok, true);
  assert.equal(e.execCmd('db', ['list']).items.length, 1);
  e.rm('db', true);
  e.run({ image: 'harbor-db', name: 'db', detach: true });
  assert.equal(e.execCmd('db', ['list']).empty, true, '無 volume 重建後資料應消失');

  // 掛 volume：資料持久
  e.rm('db', true);
  e.volumeCreate('treasure');
  e.run({ image: 'harbor-db', name: 'db', detach: true, mounts: [{ volume: 'treasure', dest: '/data' }] });
  e.execCmd('db', ['store', 'gold']);
  e.execCmd('db', ['store', 'silk']);
  e.rm('db', true);
  e.run({ image: 'harbor-db', name: 'db', detach: true, mounts: [{ volume: 'treasure', dest: '/data' }] });
  const listed = e.execCmd('db', ['list']);
  assert.deepEqual(listed.items, ['gold', 'silk'], '掛 volume 重建後資料應還在');
});

test('run -v：具名 volume 不存在時自動建立（真實 Docker 行為）', () => {
  const e = createEngine();
  e.run({ image: 'harbor-db', name: 'db', detach: true, mounts: [{ volume: 'auto-vol', dest: '/data' }] });
  assert.ok(e.findVolume('auto-vol'));
});

// ---------- network 連通 ----------
test('network：預設 bridge 無容器名 DNS；自訂 network 可用名字互通', () => {
  const e = createEngine();
  e.run({ image: 'harbor-db', name: 'db', detach: true });          // bridge
  e.run({ image: 'webapp', name: 'web', detach: true });            // bridge
  const fail = e.execCmd('web', ['ping', 'db']);
  assert.equal(fail.ok, false);
  assert.match(fail.error, /bad address 'db'/);

  e.networkCreate('harbor-net');
  e.rm('web', true); e.rm('db', true);
  e.run({ image: 'harbor-db', name: 'db', detach: true, network: 'harbor-net' });
  e.run({ image: 'webapp', name: 'web', detach: true, network: 'harbor-net' });
  const okPing = e.execCmd('web', ['ping', 'db']);
  assert.equal(okPing.ok, true);
  assert.match(okPing.output[0], /^PING db/);
});

test('network：重複建立報 already exists；run 指定不存在的 network 報 not found', () => {
  const e = createEngine();
  assert.equal(e.networkCreate('n1').ok, true);
  const dup = e.networkCreate('n1');
  assert.equal(dup.ok, false);
  assert.match(dup.error, /network with name n1 already exists/);
  const r = e.run({ image: 'nginx', detach: true, network: 'ghost-net' });
  assert.equal(r.ok, false);
  assert.match(r.error, /network ghost-net not found/);
});

// ---------- exec ----------
test('exec：停止中的容器不可 exec；容器內可 ls / cat', () => {
  const e = createEngine();
  const { container: c } = e.run({ image: 'whale-app', name: 'app', detach: true });
  e.stop('app');
  const dead = e.execCmd('app', ['ls']);
  assert.equal(dead.ok, false);
  assert.match(dead.error, /is not running/);
  e.start('app');
  assert.ok(e.execCmd('app', ['ls']).output.includes('config.txt'));
  assert.match(e.execCmd('app', ['cat', 'config.txt']).output.join('\n'), /MODE/);
  assert.match(e.execCmd('app', ['cat', 'nope.txt']).error, /No such file/);
  assert.ok(c);
});

// ---------- build cache ----------
test('build：第一次全建、第二次全 CACHED、改檔後該層起失效', () => {
  const e = createEngine();
  const steps = [
    { inst: 'FROM', text: 'FROM node:20' },
    { inst: 'COPY', text: 'COPY package.json .', file: 'package.json' },
    { inst: 'RUN', text: 'RUN npm install' },
    { inst: 'COPY', text: 'COPY . .', file: 'server.js' },
    { inst: 'CMD', text: 'CMD ["node","server.js"]' }
  ];
  const v1 = { 'package.json': 1, 'server.js': 1 };
  const b1 = e.build('myapp', steps, v1);
  assert.equal(b1.steps.filter(s => s.cached).length, 0);
  const b2 = e.build('myapp', steps, v1);
  assert.equal(b2.steps.filter(s => s.cached).length, 5, '未改動重 build 應全 CACHED');
  const b3 = e.build('myapp', steps, { 'package.json': 1, 'server.js': 2 });
  assert.deepEqual(b3.steps.map(s => s.cached), [true, true, true, false, false],
    '改 server.js 後：COPY . . 起的層失效，前面仍 CACHED');
});

// ---------- compose ----------
test('compose up：建立 network/volume/容器並依 depends_on 排序', () => {
  const e = createEngine();
  const r = e.composeUp({
    name: 'harbor',
    networks: ['fleet-net'],
    volumes: ['db-data'],
    services: [
      { name: 'web', image: 'webapp', ports: [{ host: 8080, cont: 3000 }], network: 'fleet-net', dependsOn: ['db'] },
      { name: 'db', image: 'harbor-db', volume: { name: 'db-data', dest: '/data' }, network: 'fleet-net' }
    ]
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.created.containers.map(c => c.name), ['harbor-db-1', 'harbor-web-1'],
    'db 應先於 web 啟動（depends_on）');
  assert.ok(e.findNetwork('harbor_fleet-net'));
  assert.ok(e.findVolume('harbor_db-data'));
  assert.equal(e.execCmd('harbor-web-1', ['ping', 'harbor-db-1']).ok, true, '同內線應可互 ping');
});

// ---------- CLI 層：擬真錯誤與解析 ----------
test('CLI：打錯子指令 → is not a docker command＋猜測提示', () => {
  const cli = createCLI(createEngine());
  const r = cli.exec('docker rnu nginx');
  assert.equal(r.ok, false);
  assert.match(r.script[0].text, /'rnu' is not a docker command/);
  assert.match(r.tip, /docker run/);
});

test('CLI：非 docker 指令 → command not found；docker ps 表頭擬真', () => {
  const cli = createCLI(createEngine());
  const nf = cli.exec('dokcer ps');
  assert.match(nf.script[0].text, /command not found/);
  const ps = cli.exec('docker ps');
  assert.match(ps.script[0].text, /^CONTAINER ID\s+IMAGE\s+COMMAND\s+CREATED\s+STATUS\s+PORTS\s+NAMES$/);
});

test('CLI：run -p 格式錯誤／rm 運行中／port 衝突都給 tip', () => {
  const e = createEngine();
  const cli = createCLI(e);
  const bad = cli.exec('docker run -p 8080 nginx');
  assert.match(bad.script[0].text, /invalid publish opts format/);
  assert.ok(bad.tip);
  cli.exec('docker run -d --name web -p 8080:80 nginx');
  const rmr = cli.exec('docker rm web');
  assert.equal(rmr.ok, false);
  assert.ok(rmr.tip.indexOf('stop') >= 0);
  const clash = cli.exec('docker run -d -p 8080:80 nginx');
  assert.equal(clash.ok, false);
  assert.match(clash.script[0].text, /port is already allocated/);
});

test('CLI：旗標放在 image 後面 → 擬真 exec 錯誤＋教學 tip，不靜默建出錯誤容器', () => {
  const e = createEngine();
  const cli = createCLI(e);
  const r = cli.exec('docker run whale-app -e MODE=harbor');
  assert.equal(r.ok, false);
  assert.match(r.script[0].text, /executable file not found/);
  assert.ok(r.tip && r.tip.indexOf('最後面') >= 0);
  assert.equal(e.state.containers.length, 0);
});

test('CLI：exec -it 進 shell、shell 內 cat、exit 離開', () => {
  const e = createEngine();
  const cli = createCLI(e);
  cli.exec('docker run -d --name app whale-app');
  const enter = cli.exec('docker exec -it app sh');
  assert.equal(enter.shell, true);
  assert.match(cli.getPrompt().text, /^root@[0-9a-f]{12}:\/app# $/);
  const cat = cli.exec('cat config.txt');
  assert.match(cat.script.map(l => l.text).join('\n'), /MODE/);
  cli.exec('exit');
  assert.equal(cli.inShell(), false);
});

// ---------- 教學正確性修正（review 後新增）----------
test('A5 webapp 啟動日誌用 tcp 描述 db:5432，不再標成 http://', () => {
  const e = createEngine();
  const { container: c } = e.run({ image: 'webapp', name: 'web', detach: true });
  const log = c.logs.join('\n');
  assert.match(log, /db:5432/);
  assert.doesNotMatch(log, /http:\/\/db:5432/, 'db:5432 是 TCP，不該標成 http');
});

test('A3 run 服務不加 -d：終端機提示前景 attach、需 -d 才背景；加 -d 就不提示', () => {
  const cli = createCLI(createEngine());
  const fg = cli.exec('docker run nginx');
  const fgText = fg.script.map(function (l) { return l.text; }).join('\n');
  assert.match(fgText, /前景|-d/, '前景服務應提示需要 -d');
  const bg = cli.exec('docker run -d nginx');
  const bgText = bg.script.map(function (l) { return l.text; }).join('\n');
  assert.doesNotMatch(bgText, /前景/, '加了 -d 不該再提示前景');
});

test('A6 compose up 不加 -d：不啟動服務並提示 -d；up -d 才真正啟動', () => {
  const e = createEngine();
  const cli = createCLI(e);
  cli.setComposeProject({
    name: 'harbor', networks: ['fleet-net'], volumes: ['db-data'],
    services: [
      { name: 'web', image: 'webapp', ports: [{ host: 8080, cont: 3000 }], network: 'fleet-net', dependsOn: ['db'] },
      { name: 'db', image: 'harbor-db', volume: { name: 'db-data', dest: '/data' }, network: 'fleet-net' }
    ]
  });
  const noD = cli.exec('docker compose up');
  assert.equal(noD.parsed.detach, false);
  assert.equal(e.state.containers.length, 0, '沒 -d 不應建立容器');
  const withD = cli.exec('docker compose up -d');
  assert.equal(withD.parsed.detach, true);
  assert.equal(e.state.containers.length, 2, 'up -d 應啟動 web + db');
});

test('C3 CLI 串接：a && b 兩個都跑、事件合併；&& 遇錯短路；; 不短路', () => {
  const e = createEngine();
  const cli = createCLI(e);
  const chain = cli.exec('docker run -d --name a nginx && docker run -d --name b nginx');
  assert.equal(chain.ok, true);
  assert.ok(e.findContainer('a') && e.findContainer('b'), '兩個容器都該建立');

  const e2 = createEngine();
  const cli2 = createCLI(e2);
  const sc = cli2.exec('docker rm ghost && docker run -d --name z nginx');
  assert.equal(sc.ok, false, '第一個失敗整串應失敗');
  assert.equal(e2.findContainer('z'), null, '&& 短路：第二個不該執行');

  const e3 = createEngine();
  const cli3 = createCLI(e3);
  cli3.exec('docker rm ghost ; docker run -d --name y nginx');
  assert.ok(e3.findContainer('y'), '; 不短路：第二個仍應執行');
});

test('F1 network create 印出的 ID 與 ls 短 ID 一致（前 12 碼）', () => {
  const e = createEngine();
  const cli = createCLI(e);
  const cr = cli.exec('docker network create harbor-net');
  const printedId = cr.script[0].text.trim();
  const net = e.findNetwork('harbor-net');
  assert.ok(net.id, 'network 應有 id');
  assert.equal(printedId.slice(0, 12), net.id.slice(0, 12), 'create 印出 ID 前 12 碼應等於短 ID');
  const ls = cli.exec('docker network ls');
  const row = ls.script.map(function (l) { return l.text; }).filter(function (t) { return t.indexOf('harbor-net') >= 0; })[0];
  assert.ok(row && row.indexOf(net.id.slice(0, 12)) >= 0, 'ls 應顯示短 ID');
});

console.log('\n全部通過：' + passed + ' 個測試');
