/*
 * levels09-10.js — 第 9 關「開通內線」(network)、第 10 關「港務長」(compose 終局戰)
 */
(function (root) {
  'use strict';
  var h = root.DG.h;
  var hasEvent = root.DG.hasEvent;

  // ===== 第 9 關：network =====
  root.DG.registerLevel({
    id: 9,
    name: '開通內線',
    topic: 'network · 容器名 DNS',
    glyph: 'compass',
    terminal: true,
    story: [
      '緊急狀況！航運追蹤網頁 <code>web</code> 說它找不到資料庫 <code>db</code>——但 db 明明就在隔壁泊位。',
      '你先去驗證看看：讓 web 去 ping db 一下。',
      '（小聲說：它們現在都接在<b>預設 bridge</b> 公共線路上……總機沒登記名字，互相叫不出來。）'
    ],
    teach: {
      title: '自訂 network 與容器名 DNS',
      html: '<p>不指定 network 時，容器都掛在<b>預設 bridge</b>：能上網，但<b>沒有容器名 DNS</b>——' +
        '用名字互找會失敗（<code>bad address</code>）。</p>' +
        '<p><code>docker network create <名字></code> 拉一條專屬內線；run 時用 ' +
        '<code>--network <名字></code> 把貨櫃接上去。</p>' +
        '<p>同一條自訂 network 上，Docker 內建 DNS 讓你<b>直接用容器名當主機名</b>：' +
        'web 連 <code>db:5432</code> 就通，IP 換了也不怕。</p>',
      map: '<b>港口比喻</b>：自訂 network＝在港區拉一條<b>專屬內線電話</b>——同一條內線上，撥「名字」總機就幫你轉接（內建 DNS＝總機的通訊錄）；預設 bridge＝公共線路：打得出去，但總機沒登記你的名字。'
    },
    outro: '要讓容器互相叫得出名字：拉一條自訂 network、大家 --network 接上——名字就是地址。',
    setup: function (ctx) {
      var e = ctx.engine;
      e.pull('harbor-db');
      e.pull('webapp');
      e.run({ image: 'harbor-db', name: 'db', detach: true });
      e.run({ image: 'webapp', name: 'web', detach: true });
      e.takeEvents();
    },
    objectives: [
      { text: '驗證問題：<code>docker exec web ping db</code>（預期會失敗——失敗也是證據）',
        hints: ['用 exec 讓 web 容器執行 ping db。',
          '骨架：docker exec web ping __。',
          '完整指令：docker exec web ping db（看到 bad address 就對了，這正是本目標）'],
        check: function (result) {
          return !!(result && result.parsed.cmd === 'exec' &&
            result.parsed.argv && result.parsed.argv[0] === 'ping' &&
            hasEvent(result, 'ping', function (d) { return !d.ok; }));
        },
        onDone: function (ctx) {
          ctx.stage.caption('證實了：預設 bridge 上，容器名字互相解析不了。', 4600);
        } },
      { text: '拉一條專屬內線：<code>docker network create harbor-net</code>',
        hints: ['network 的子指令 create，內線名用 harbor-net。',
          'docker network ______ harbor-net。',
          '完整指令：docker network create harbor-net'],
        check: function (result, ctx) {
          return result && result.ok && !!ctx.engine.findNetwork('harbor-net');
        } },
      { text: '把 <code>db</code> 和 <code>web</code> 都搬進 harbor-net（先拆舊的，再帶 <code>--network</code> 重跑）',
        hints: ['舊貨櫃不會自己換內線：docker rm -f db web，然後各自重跑。',
          '骨架：docker run -d --name db --network harbor-net harbor-db（web 同理，image 是 webapp）。',
          '依序：docker rm -f db web → docker run -d --name db --network harbor-net harbor-db → docker run -d --name web --network harbor-net webapp'],
        check: function (result, ctx) {
          var db = ctx.engine.findContainer('db');
          var web = ctx.engine.findContainer('web');
          return !!(result && result.ok && db && web &&
            db.status === 'running' && web.status === 'running' &&
            db.network === 'harbor-net' && web.network === 'harbor-net');
        } },
      { text: '再試一次：<code>docker exec web ping db</code>——這次名字應該喊得應',
        hints: ['跟第一步一模一樣的指令。',
          'docker exec web ping db。',
          '完整指令：docker exec web ping db（這次會看到 0% packet loss）'],
        check: function (result) {
          return !!(result && result.ok &&
            hasEvent(result, 'ping', function (d) { return d.ok; }));
        },
        onDone: function (ctx) {
          ctx.stage.caption('通了！同一條內線上，撥容器名總機就轉接——這就是 Docker 的內建 DNS。', 5200);
          root.DG.audio.play('badge');
        } }
    ]
  });

  // ===== 第 10 關：compose 終局戰 =====
  var BLANKS = {
    webImage:  { expect: 'webapp',    why: 'web 服務是我們的網頁程式——藍圖叫 webapp。nginx 是別人的伺服器，不是這艘。' },
    webPorts:  { expect: '8080:3000', why: '格式跟 -p 一樣「主機:容器」。webapp 在容器內聽 3000、我們要從主機 8080 進來——8080:3000。' },
    webDep:    { expect: 'db',        why: 'depends_on 填「要等誰先啟動」——web 要等資料庫 db。' },
    webNet:    { expect: 'fleet-net', why: '第 9 關的教訓：web 和 db 要接同一條內線，容器名 DNS 才通——fleet-net。' },
    dbImage:   { expect: 'harbor-db', why: '資料庫服務用我們的 harbor-db 藍圖。' },
    dbVol:     { expect: 'db-data',   why: '第 7 關的教訓：資料庫的資料要進保險庫（volume）——這裡宣告的是 db-data。' }
  };
  var CHIPS = ['webapp', 'harbor-db', 'nginx', '8080:3000', '3000:8080', 'db', 'web', 'db-data', 'treasure', 'fleet-net'];

  function ymlHTML() {
    function blank(id) { return '<span class="yml-blank" data-b="' + id + '">？</span>'; }
    return '<span class="yc"># docker-compose.yml — 鯨魚港總調度令</span>\n' +
      '<span class="yk">services:</span>\n' +
      '  <span class="yk">web:</span>\n' +
      '    <span class="yk">image:</span> ' + blank('webImage') + '\n' +
      '    <span class="yk">ports:</span>\n' +
      '      - "' + blank('webPorts') + '"\n' +
      '    <span class="yk">depends_on:</span>\n' +
      '      - ' + blank('webDep') + '\n' +
      '    <span class="yk">networks:</span> [' + blank('webNet') + ']\n' +
      '  <span class="yk">db:</span>\n' +
      '    <span class="yk">image:</span> ' + blank('dbImage') + '\n' +
      '    <span class="yk">volumes:</span>\n' +
      '      - ' + blank('dbVol') + ':/data\n' +
      '    <span class="yk">networks:</span> [fleet-net]\n' +
      '<span class="yk">volumes:</span>\n' +
      '  db-data:\n' +
      '<span class="yk">networks:</span>\n' +
      '  fleet-net:';
  }

  function mountComposeDesk(ctx) {
    var desk = h('div', 'compose-desk');
    var yml = h('div', 'compose-yml', ymlHTML());
    var tray = h('div', 'compose-tray',
      '<h4>零件盤（先點黃色空格，再點零件）</h4><div class="chip-pool"></div>' +
      '<div class="compose-note">每個空格都是前面九關教過的概念：image（第 3 關）、ports（第 5 關）、' +
      'volumes（第 7 關）、networks（第 9 關）、depends_on（啟動順序）。</div>');
    desk.appendChild(yml);
    desk.appendChild(tray);
    ctx.overlay.appendChild(desk);
    var fb = h('div', 'df-feedback');
    ctx.overlay.appendChild(fb);
    var selected = null;
    var filled = 0;

    function feedback(msg, good) {
      fb.textContent = msg;
      fb.className = 'df-feedback on' + (good ? ' good' : '');
      root.DG.audio.play(good ? 'ok' : 'error');
      clearTimeout(fb._t);
      fb._t = setTimeout(function () { fb.classList.remove('on'); }, good ? 2400 : 5600);
    }

    function select(el) {
      yml.querySelectorAll('.yml-blank').forEach(function (b) { b.classList.remove('picked'); });
      selected = el;
      if (el) { el.classList.add('picked'); }
    }

    yml.querySelectorAll('.yml-blank').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.classList.contains('filled')) { return; }
        select(b);
        root.DG.audio.play('click');
      });
    });
    select(yml.querySelector('.yml-blank'));

    CHIPS.forEach(function (chip) {
      var c = h('button', 'yml-chip', chip);
      c.addEventListener('click', function () {
        if (!selected) { feedback('先點一個黃色空格，再選零件。', false); return; }
        var spec = BLANKS[selected.dataset.b];
        if (chip !== spec.expect) {
          feedback('不是這個——' + spec.why, false);
          return;
        }
        selected.textContent = chip;
        selected.classList.add('filled');
        selected.classList.remove('picked');
        filled++;
        root.DG.audio.play('place');
        var next = null;
        yml.querySelectorAll('.yml-blank').forEach(function (b) {
          if (!b.classList.contains('filled') && !next) { next = b; }
        });
        select(next);
        if (filled === Object.keys(BLANKS).length) { complete(); }
      });
      tray.querySelector('.chip-pool').appendChild(c);
    });

    function complete() {
      feedback('總調度令完成！到終端機下達 docker compose up -d ——全港貨櫃一鍵上工！', true);
      ctx.cli.setComposeProject({
        name: 'harbor',
        networks: ['fleet-net'],
        volumes: ['db-data'],
        services: [
          { name: 'web', image: 'webapp', ports: [{ host: 8080, cont: 3000 }],
            network: 'fleet-net', dependsOn: ['db'] },
          { name: 'db', image: 'harbor-db', volume: { name: 'db-data', dest: '/data' },
            network: 'fleet-net' }
        ]
      });
      ctx.flag('composed');
      setTimeout(function () {
        desk.style.transition = 'opacity 0.6s';
        desk.style.opacity = '0';
        setTimeout(function () { desk.remove(); }, 650);
      }, 1800);
    }
  }

  root.DG.registerLevel({
    id: 10,
    name: '港務長',
    topic: 'docker compose',
    glyph: 'flag',
    terminal: true,
    story: [
      '見習生——不，<b>準港務長</b>。今天是你的結業之戰。',
      '一組服務要 web、要 db、要管線、保險庫、內線……每次都手打一長串指令？整個港區不是這樣管的。',
      '<b>compose</b> 讓你把整組服務寫成一紙「總調度令」（YAML），一個指令、全港貨櫃各就各位。把它組出來吧——每一格都是你學過的東西。'
    ],
    teach: {
      title: 'docker compose：一紙總調度令',
      html: '<p><code>docker-compose.yml</code> 用<b>宣告</b>的方式描述整組服務：' +
        '每個 <code>service</code> 一個容器，image／ports／volumes／networks 全寫在檔案裡。</p>' +
        '<p><code>depends_on</code> 只控制<b>啟動順序</b>（先起 db 再起 web）——但它<b>不等 db 真正就緒</b>；要確保連得上，得靠 healthcheck 或應用層重試。volume 與 network 也在檔案裡宣告，compose 會自動建立。</p>' +
        '<p>之後只要 <code>docker compose up -d</code> 一鍵啟動、<code>docker compose down</code> 一鍵收隊。</p>',
      map: '<b>港口比喻</b>：compose＝港務長的<b>總調度令</b>——你不再一個個貨櫃下令，而是把整份配置寫在紙上，號角一響，全港照令上工。'
    },
    outro: '從此你不再指揮單一貨櫃，而是簽發一紙總調度令——這就是 compose，也是港務長的日常。',
    setup: function (ctx) {
      ctx.engine.pull('webapp');
      ctx.engine.pull('harbor-db');
      ctx.engine.takeEvents();
      mountComposeDesk(ctx);
    },
    objectives: [
      { text: '組出完整的 docker-compose.yml（6 個空格，全是舊識）',
        hints: ['先點黃色空格、再點右邊零件；填錯船長會告訴你為什麼。',
          'web 的 image 是 webapp、db 的 image 是 harbor-db；ports 是 8080:3000。',
          '六格答案：webapp、8080:3000、db、fleet-net、harbor-db、db-data。'],
        check: function (result, ctx) { return ctx.flags.composed; } },
      { text: '簽發總調度令：<code>docker compose up -d</code>',
        hints: ['compose 的啟動子指令是 up，別忘了背景旗標。',
          'docker compose __ -d。',
          '完整指令：docker compose up -d'],
        check: function (result) {
          return !!(result && result.ok && result.parsed.cmd === 'compose-up' && result.parsed.detach === true);
        },
        onDone: function (ctx) {
          ctx.stage.caption('全港上工！network、volume、web、db——一道指令，各就各位。', 6000);
          setTimeout(function () {
            ctx.stage.finale('結業典禮 · 授階', '鯨魚船長授予你最終頭銜：鯨魚港港務長（Harbour Master）');
          }, 700);
        } }
    ]
  });
}(typeof globalThis !== 'undefined' ? globalThis : this));
