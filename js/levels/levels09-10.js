/*
 * levels09-10.js — 第 9 關「開通內線」(network)、第 10 關「港務長」(compose 終局戰)
 */
(function (root) {
  'use strict';
  var h = root.DG.h;
  var hasEvent = root.DG.hasEvent;
  var t = root.DG.t;

  // ===== 第 9 關：network =====
  root.DG.registerLevel({
    id: 9,
    name: { zh: '開通內線', en: 'Open the Private Line' },
    topic: { zh: 'network · 容器名 DNS', en: 'network · container-name DNS' },
    glyph: 'compass',
    terminal: true,
    story: [
      { zh: '緊急狀況！航運追蹤網頁 <code>web</code> 說它找不到資料庫 <code>db</code>——但 db 明明就在隔壁泊位。',
        en: 'Emergency! The shipping-tracker page <code>web</code> says it cannot find the database <code>db</code> — yet db is right there in the next berth.' },
      { zh: '你先去驗證看看：讓 web 去 ping db 一下。',
        en: 'Verify it for yourself first: have web ping db.' },
      { zh: '（小聲說：它們現在都接在<b>預設 bridge</b> 公共線路上……總機沒登記名字，互相叫不出來。）',
        en: '(Whisper: right now they are both on the <b>default bridge</b> public line… the switchboard has no names on file, so they cannot call each other.)' }
    ],
    teach: {
      title: { zh: '自訂 network 與容器名 DNS', en: 'Custom networks and container-name DNS' },
      html: {
        zh: '<p>不指定 network 時，容器都掛在<b>預設 bridge</b>：能上網，但<b>沒有容器名 DNS</b>——' +
          '用名字互找會失敗（<code>bad address</code>）。</p>' +
          '<p><code>docker network create <名字></code> 拉一條專屬內線；run 時用 ' +
          '<code>--network <名字></code> 把貨櫃接上去。</p>' +
          '<p>同一條自訂 network 上，Docker 內建 DNS 讓你<b>直接用容器名當主機名</b>：' +
          'web 連 <code>db:5432</code> 就通，IP 換了也不怕。</p>',
        en: '<p>Without a specified network, containers all hang on the <b>default bridge</b>: they can reach the internet, but there is <b>no container-name DNS</b> — ' +
          'looking each other up by name fails (<code>bad address</code>).</p>' +
          '<p><code>docker network create <name></code> lays a dedicated private line; at run time use ' +
          '<code>--network <name></code> to plug the container in.</p>' +
          '<p>On the same custom network, Docker\'s built-in DNS lets you <b>use the container name directly as the hostname</b>: ' +
          'web reaches <code>db:5432</code> and it just works, even if the IP changes.</p>'
      },
      map: {
        zh: '<b>港口比喻</b>：自訂 network＝在港區拉一條<b>專屬內線電話</b>——同一條內線上，撥「名字」總機就幫你轉接（內建 DNS＝總機的通訊錄）；預設 bridge＝公共線路：打得出去，但總機沒登記你的名字。',
        en: '<b>Harbor Analogy</b>: a custom network = laying a <b>private phone line</b> across the harbor — on the same line, dial a "name" and the switchboard connects you (built-in DNS = the switchboard directory); the default bridge = the public line: you can dial out, but the switchboard has no name on file for you.'
      }
    },
    outro: {
      zh: '要讓容器互相叫得出名字：拉一條自訂 network、大家 --network 接上——名字就是地址。',
      en: 'To let containers call each other by name: lay a custom network and have everyone plug in with --network — the name is the address.'
    },
    setup: function (ctx) {
      var e = ctx.engine;
      e.pull('harbor-db');
      e.pull('webapp');
      e.run({ image: 'harbor-db', name: 'db', detach: true });
      e.run({ image: 'webapp', name: 'web', detach: true });
      e.takeEvents();
    },
    objectives: [
      { text: { zh: '驗證問題：<code>docker exec web ping db</code>（預期會失敗——失敗也是證據）',
          en: 'Verify the problem: <code>docker exec web ping db</code> (it is expected to fail — the failure is the evidence)' },
        hints: [
          { zh: '用 exec 讓 web 容器執行 ping db。',
            en: 'Use exec to run ping db inside the web container.' },
          { zh: '骨架：docker exec web ping __。',
            en: 'Skeleton: docker exec web ping __.' },
          { zh: '完整指令：docker exec web ping db（看到 bad address 就對了，這正是本目標）',
            en: 'Full command: docker exec web ping db (seeing bad address is correct — that is the point of this objective)' }],
        check: function (result) {
          return !!(result && result.parsed.cmd === 'exec' &&
            result.parsed.argv && result.parsed.argv[0] === 'ping' &&
            hasEvent(result, 'ping', function (d) { return !d.ok; }));
        },
        onDone: function (ctx) {
          ctx.stage.caption(t({ zh: '證實了：預設 bridge 上，容器名字互相解析不了。',
            en: 'Confirmed: on the default bridge, container names cannot resolve each other.' }), 4600);
        } },
      { text: { zh: '拉一條專屬內線：<code>docker network create harbor-net</code>',
          en: 'Lay a dedicated private line: <code>docker network create harbor-net</code>' },
        hints: [
          { zh: 'network 的子指令 create，內線名用 harbor-net。',
            en: 'The network subcommand is create; name the line harbor-net.' },
          { zh: 'docker network ______ harbor-net。',
            en: 'docker network ______ harbor-net.' },
          { zh: '完整指令：docker network create harbor-net',
            en: 'Full command: docker network create harbor-net' }],
        check: function (result, ctx) {
          return result && result.ok && !!ctx.engine.findNetwork('harbor-net');
        } },
      { text: { zh: '把 <code>db</code> 和 <code>web</code> 都搬進 harbor-net（先拆舊的，再帶 <code>--network</code> 重跑）',
          en: 'Move both <code>db</code> and <code>web</code> into harbor-net (tear down the old ones first, then re-run with <code>--network</code>)' },
        hints: [
          { zh: '舊貨櫃不會自己換內線：docker rm -f db web，然後各自重跑。',
            en: 'Old containers will not switch lines on their own: docker rm -f db web, then re-run each.' },
          { zh: '骨架：docker run -d --name db --network harbor-net harbor-db（web 同理，image 是 webapp）。',
            en: 'Skeleton: docker run -d --name db --network harbor-net harbor-db (web is the same, its image is webapp).' },
          { zh: '依序：docker rm -f db web → docker run -d --name db --network harbor-net harbor-db → docker run -d --name web --network harbor-net webapp',
            en: 'In order: docker rm -f db web → docker run -d --name db --network harbor-net harbor-db → docker run -d --name web --network harbor-net webapp' }],
        check: function (result, ctx) {
          var db = ctx.engine.findContainer('db');
          var web = ctx.engine.findContainer('web');
          return !!(result && result.ok && db && web &&
            db.status === 'running' && web.status === 'running' &&
            db.network === 'harbor-net' && web.network === 'harbor-net');
        } },
      { text: { zh: '再試一次：<code>docker exec web ping db</code>——這次名字應該喊得應',
          en: 'Try again: <code>docker exec web ping db</code> — this time the name should answer' },
        hints: [
          { zh: '跟第一步一模一樣的指令。',
            en: 'The exact same command as the first step.' },
          { zh: 'docker exec web ping db。',
            en: 'docker exec web ping db.' },
          { zh: '完整指令：docker exec web ping db（這次會看到 0% packet loss）',
            en: 'Full command: docker exec web ping db (this time you will see 0% packet loss)' }],
        check: function (result) {
          return !!(result && result.ok &&
            hasEvent(result, 'ping', function (d) { return d.ok; }));
        },
        onDone: function (ctx) {
          ctx.stage.caption(t({ zh: '通了！同一條內線上，撥容器名總機就轉接——這就是 Docker 的內建 DNS。',
            en: 'Connected! On the same line, dial a container name and the switchboard connects you — that is Docker\'s built-in DNS.' }), 5200);
          root.DG.audio.play('badge');
        } }
    ]
  });

  // ===== 第 10 關：compose 終局戰 =====
  var BLANKS = {
    webImage:  { expect: 'webapp',    why: { zh: 'web 服務是我們的網頁程式——藍圖叫 webapp。nginx 是別人的伺服器，不是這艘。',
      en: 'The web service is our web app — its blueprint is called webapp. nginx is someone else\'s server, not this ship.' } },
    webPorts:  { expect: '8080:3000', why: { zh: '格式跟 -p 一樣「主機:容器」。webapp 在容器內聽 3000、我們要從主機 8080 進來——8080:3000。',
      en: 'The format is the same as -p, "host:container". webapp listens on 3000 inside the container and we come in from host 8080 — 8080:3000.' } },
    webDep:    { expect: 'db',        why: { zh: 'depends_on 填「要等誰先啟動」——web 要等資料庫 db。',
      en: 'depends_on takes "who must start first" — web waits for the database db.' } },
    webNet:    { expect: 'fleet-net', why: { zh: '第 9 關的教訓：web 和 db 要接同一條內線，容器名 DNS 才通——fleet-net。',
      en: 'The lesson from Level 9: web and db must be on the same private line for container-name DNS to work — fleet-net.' } },
    dbImage:   { expect: 'harbor-db', why: { zh: '資料庫服務用我們的 harbor-db 藍圖。',
      en: 'The database service uses our harbor-db blueprint.' } },
    dbVol:     { expect: 'db-data',   why: { zh: '第 7 關的教訓：資料庫的資料要進保險庫（volume）——這裡宣告的是 db-data。',
      en: 'The lesson from Level 7: database data must go into a vault (volume) — here we declare db-data.' } }
  };
  var CHIPS = ['webapp', 'harbor-db', 'nginx', '8080:3000', '3000:8080', 'db', 'web', 'db-data', 'treasure', 'fleet-net'];

  function ymlHTML() {
    function blank(id) { return '<span class="yml-blank" data-b="' + id + '">？</span>'; }
    return '<span class="yc"># docker-compose.yml — ' +
      t({ zh: '鯨魚港總調度令', en: 'Whale Harbor master manifest' }) + '</span>\n' +
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
      '<h4>' + t({ zh: '零件盤（先點黃色空格，再點零件）',
        en: 'Parts tray (tap a yellow blank first, then a part)' }) + '</h4><div class="chip-pool"></div>' +
      '<div class="compose-note">' + t({
        zh: '每個空格都是前面九關教過的概念：image（第 3 關）、ports（第 5 關）、' +
          'volumes（第 7 關）、networks（第 9 關）、depends_on（啟動順序）。',
        en: 'Every blank is a concept from the previous nine levels: image (Level 3), ports (Level 5), ' +
          'volumes (Level 7), networks (Level 9), depends_on (startup order).' }) + '</div>');
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
        if (!selected) { feedback(t({ zh: '先點一個黃色空格，再選零件。',
          en: 'Tap a yellow blank first, then pick a part.' }), false); return; }
        var spec = BLANKS[selected.dataset.b];
        if (chip !== spec.expect) {
          feedback(t({ zh: '不是這個——', en: 'Not this one — ' }) + t(spec.why), false);
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
      feedback(t({ zh: '總調度令完成！到終端機下達 docker compose up -d ——全港貨櫃一鍵上工！',
        en: 'Master manifest complete! Head to the terminal and issue docker compose up -d — every container in the harbor reports for duty in one command!' }), true);
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
    name: { zh: '港務長', en: 'Harbour Master' },
    topic: 'docker compose',
    glyph: 'flag',
    terminal: true,
    story: [
      { zh: '見習生——不，<b>準港務長</b>。今天是你的結業之戰。',
        en: 'Apprentice — no, <b>Harbour Master to be</b>. Today is your graduation battle.' },
      { zh: '一組服務要 web、要 db、要管線、保險庫、內線……每次都手打一長串指令？整個港區不是這樣管的。',
        en: 'A stack needs web, needs db, needs pipes, vaults, private lines… hand-typing a long string of commands every time? That is not how the whole harbor is run.' },
      { zh: '<b>compose</b> 讓你把整組服務寫成一紙「總調度令」（YAML），一個指令、全港貨櫃各就各位。把它組出來吧——每一格都是你學過的東西。',
        en: '<b>compose</b> lets you write the whole stack as a single "master manifest" (YAML): one command, and every container in the harbor takes its place. Assemble it — every blank is something you have already learned.' }
    ],
    teach: {
      title: { zh: 'docker compose：一紙總調度令', en: 'docker compose: a single master manifest' },
      html: {
        zh: '<p><code>docker-compose.yml</code> 用<b>宣告</b>的方式描述整組服務：' +
          '每個 <code>service</code> 一個容器，image／ports／volumes／networks 全寫在檔案裡。</p>' +
          '<p><code>depends_on</code> 只控制<b>啟動順序</b>（先起 db 再起 web）——但它<b>不等 db 真正就緒</b>；要確保連得上，得靠 healthcheck 或應用層重試。volume 與 network 也在檔案裡宣告，compose 會自動建立。</p>' +
          '<p>之後只要 <code>docker compose up -d</code> 一鍵啟動、<code>docker compose down</code> 一鍵收隊。</p>',
        en: '<p><code>docker-compose.yml</code> describes the whole stack <b>declaratively</b>: ' +
          'one container per <code>service</code>, with image / ports / volumes / networks all written in the file.</p>' +
          '<p><code>depends_on</code> only controls <b>startup order</b> (start db before web) — but it does <b>not wait for db to be truly ready</b>; to be sure the connection works, rely on a healthcheck or app-level retries. Volumes and networks are declared in the file too, and compose creates them automatically.</p>' +
          '<p>After that, <code>docker compose up -d</code> starts everything in one command and <code>docker compose down</code> stands the crew down in one.</p>'
      },
      map: {
        zh: '<b>港口比喻</b>：compose＝港務長的<b>總調度令</b>——你不再一個個貨櫃下令，而是把整份配置寫在紙上，號角一響，全港照令上工。',
        en: '<b>Harbor Analogy</b>: compose = the Harbour Master\'s <b>master manifest</b> — instead of ordering each container one by one, you write the whole configuration on paper, and at one blast of the horn the whole harbor reports for duty by the order.'
      }
    },
    outro: {
      zh: '從此你不再指揮單一貨櫃，而是簽發一紙總調度令——這就是 compose，也是港務長的日常。',
      en: 'From now on you no longer command a single container — you sign off a single master manifest. That is compose, and the Harbour Master\'s daily work.'
    },
    setup: function (ctx) {
      ctx.engine.pull('webapp');
      ctx.engine.pull('harbor-db');
      ctx.engine.takeEvents();
      mountComposeDesk(ctx);
    },
    objectives: [
      { text: { zh: '組出完整的 docker-compose.yml（6 個空格，全是舊識）',
          en: 'Assemble a complete docker-compose.yml (6 blanks, all old friends)' },
        hints: [
          { zh: '先點黃色空格、再點右邊零件；填錯船長會告訴你為什麼。',
            en: 'Tap a yellow blank first, then a part on the right; if you fill it wrong the captain tells you why.' },
          { zh: 'web 的 image 是 webapp、db 的 image 是 harbor-db；ports 是 8080:3000。',
            en: 'web\'s image is webapp, db\'s image is harbor-db; ports is 8080:3000.' },
          { zh: '六格答案：webapp、8080:3000、db、fleet-net、harbor-db、db-data。',
            en: 'The six answers: webapp, 8080:3000, db, fleet-net, harbor-db, db-data.' }],
        check: function (result, ctx) { return ctx.flags.composed; } },
      { text: { zh: '簽發總調度令：<code>docker compose up -d</code>',
          en: 'Sign off the master manifest: <code>docker compose up -d</code>' },
        hints: [
          { zh: 'compose 的啟動子指令是 up，別忘了背景旗標。',
            en: 'compose\'s start subcommand is up; do not forget the background flag.' },
          { zh: 'docker compose __ -d。',
            en: 'docker compose __ -d.' },
          { zh: '完整指令：docker compose up -d',
            en: 'Full command: docker compose up -d' }],
        check: function (result) {
          return !!(result && result.ok && result.parsed.cmd === 'compose-up' && result.parsed.detach === true);
        },
        onDone: function (ctx) {
          ctx.stage.caption(t({ zh: '全港上工！network、volume、web、db——一道指令，各就各位。',
            en: 'The whole harbor is at work! network, volume, web, db — one command, all in place.' }), 6000);
          setTimeout(function () {
            ctx.stage.finale(
              t({ zh: '結業典禮 · 授階', en: 'Graduation Ceremony · Investiture' }),
              t({ zh: '鯨魚船長授予你最終頭銜：鯨魚港港務長（Harbour Master）',
                en: 'Captain Whale confers your final title: Harbour Master of Whale Harbor' }));
          }, 700);
        } }
    ]
  });
}(typeof globalThis !== 'undefined' ? globalThis : this));
