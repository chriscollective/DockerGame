/*
 * levels05-07.js — 第 5 關「開通管線」(port)、第 6 關「深入貨櫃」(除錯)、第 7 關「不沉的保險庫」(volume)
 */
(function (root) {
  'use strict';
  var hasEvent = root.DG.hasEvent;

  var NGINX_PAGE = '<p>If you see this page, the nginx web server is successfully installed and working. ' +
    'Further configuration is required.</p>' +
    '<p class="mb-em">Thank you for using nginx.</p>';

  // ===== 第 5 關：port mapping =====
  root.DG.registerLevel({
    id: 5,
    name: '開通管線',
    topic: 'port mapping',
    glyph: 'pipe',
    terminal: true,
    story: [
      '有貨櫃在跑還不夠——外面的訪客要能「走進去」才算開張！',
      '貨櫃是封閉的，想從碼頭外連進來，得接一條<b>管線（port mapping）</b>。',
      '接好之後，我帶你去看真正的網頁跑起來的樣子。這是全港最爽的瞬間。'
    ],
    teach: {
      title: '-p 主機port:容器port 與 -d',
      html: '<p><code>-p 8080:80</code> 的意思：把<b>主機的 8080</b> 接到<b>容器的 80</b>。' +
        '冒號左邊是碼頭這側（host），右邊是貨櫃那側（container）。</p>' +
        '<p><code>-d</code>（detach）讓容器在<b>背景</b>執行，不佔住你的終端機——長駐服務都這樣跑。</p>' +
        '<p>注意：一個主機 port 同時只能綁一個容器，重複綁定會報 <code>port is already allocated</code>。</p>',
      map: '<b>港口比喻</b>：-p＝從岸邊接一條發光管線到貨櫃艙門；主機 port＝岸邊的接口編號，先到先得。'
    },
    outro: '-p host:container，左邊是你家門牌、右邊是容器房號；門牌一個 port 只能掛一塊。',
    setup: function (ctx) {
      ctx.engine.pull('nginx');
      ctx.engine.takeEvents();
    },
    objectives: [
      { text: '用 <code>docker run -d -p 8080:80 nginx</code> 開通第一條管線',
        hints: ['要同時用到 -d（背景）和 -p（管線），image 是 nginx。',
          '骨架：docker run -d -p ____:__ nginx（主機 8080、容器 80）。',
          '完整指令：docker run -d -p 8080:80 nginx'],
        check: function (result) {
          var o = result && result.ok && result.parsed.cmd === 'run' && result.parsed.opts;
          return !!(o && o.detach && o.image === 'nginx' &&
            (o.ports || []).some(function (p) { return p.host === 8080 && p.cont === 80; }));
        },
        onDone: function (ctx) {
          ctx.stage.visitorWalk(ctx.stage.crateElOf(latestNginx(ctx)));
          setTimeout(function () {
            ctx.stage.showBrowser('http://localhost:8080', 'Welcome to nginx!', NGINX_PAGE);
            root.DG.audio.play('badge');
            ctx.stage.caption('訪客從 8080 管線走進貨櫃，看到了 nginx 歡迎頁！');
          }, 2100);
        } },
      { text: '好奇心時間：再跑一個 nginx，也綁 <code>8080</code> 試試（體驗 port 衝突）',
        hints: ['一模一樣的指令再打一次就好，看看會發生什麼事。',
          '再執行一次：docker run -d -p 8080:80 nginx。',
          '完整指令：docker run -d -p 8080:80 nginx（會看到 port is already allocated 錯誤——這就是本目標要的）'],
        check: function (result) {
          return result && !result.ok && result.parsed.cmd === 'run' &&
            result.script.some(function (l) { return l.text.indexOf('port is already allocated') >= 0; });
        } },
      { text: '換個門牌讓第二個 nginx 跑起來：綁到主機 <code>8081</code>',
        hints: ['主機 port（冒號左邊）換成沒人用的號碼。',
          '骨架：docker run -d -p 8081:__ nginx。',
          '完整指令：docker run -d -p 8081:80 nginx'],
        check: function (result) {
          var o = result && result.ok && result.parsed.cmd === 'run' && result.parsed.opts;
          return !!(o && o.detach && o.image === 'nginx' &&
            (o.ports || []).some(function (p) { return p.host === 8081 && p.cont === 80; }));
        },
        onDone: function (ctx) {
          ctx.stage.caption('兩條管線同時服務：8080 與 8081 各接一個貨櫃。');
          ctx.stage.burst(70, 50, 16);
        } }
    ]
  });

  function latestNginx(ctx) {
    var list = ctx.engine.state.containers.filter(function (c) { return c.imageRef.indexOf('nginx') === 0; });
    return list.length ? list[list.length - 1].name : null;
  }

  // ===== 第 6 關：logs / exec 除錯 =====
  root.DG.registerLevel({
    id: 6,
    name: '深入貨櫃',
    topic: 'logs · exec · env',
    glyph: 'lantern',
    terminal: true,
    story: [
      '出事了！港務通知系統 <code>harbor-app</code> 一直沒發通知，客戶在碼頭外排長龍。',
      '別慌。除錯三步驟：<b>先看日誌（logs）→ 鑽進貨櫃查現場（exec）→ 修好重跑</b>。',
      '提著燈籠跟我來，今天你要學會在貨櫃「裡面」辦案。'
    ],
    teach: {
      title: '容器除錯工具箱',
      html: '<p><code>docker logs <名字></code>：看容器的輸出——出事先看這裡，九成線索都在。</p>' +
        '<p><code>docker exec -it <名字> sh</code>：在運行中的容器裡開一個 shell，' +
        '<code>-it</code> 讓你能互動輸入。進去之後用 <code>ls</code>、<code>cat</code> 查案，<code>exit</code> 離開。</p>' +
        '<p><code>-e KEY=VALUE</code>：run 的時候注入環境變數；<code>--name</code> 幫容器取名，別再靠隨機名。</p>',
      map: '<b>港口比喻</b>：logs＝貨櫃的航海日誌；exec＝提燈進櫃檢查；-e＝出航前塞給船員的指令條。'
    },
    outro: '除錯三連：logs 看線索 → exec 進現場 → 修正條件（-e）重新出航。',
    setup: function (ctx) {
      var e = ctx.engine;
      e.pull('whale-app');
      e.run({ image: 'whale-app', name: 'harbor-app', detach: true });
      e.takeEvents();
    },
    objectives: [
      { text: '先看日誌：<code>docker logs harbor-app</code>',
        hints: ['看日誌的指令是 logs，後面接容器名。',
          'docker logs __________。',
          '完整指令：docker logs harbor-app'],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'logs' && result.parsed.ref === 'harbor-app';
        } },
      { text: '日誌說 MODE 沒設定。鑽進去看現場：<code>docker exec -it harbor-app sh</code>',
        hints: ['exec 加上 -it 再接容器名和 sh，就能進到容器內。',
          '骨架：docker exec -it harbor-app __。',
          '完整指令：docker exec -it harbor-app sh'],
        check: function (result) {
          return result && result.ok && result.shell === true;
        } },
      { text: '在貨櫃裡查看設定檔：<code>cat config.txt</code>（先用 <code>ls</code> 環顧四周也行）',
        hints: ['你現在「在容器裡面」，用類 Linux 指令。cat 可以印出檔案內容。',
          'cat co________（tab 補不了，自己拼）。',
          '完整指令：cat config.txt'],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'shell' &&
            result.parsed.argv[0] === 'cat' && result.parsed.argv[1] === 'config.txt';
        } },
      { text: '找到病因了（MODE 沒設）。輸入 <code>exit</code> 離開貨櫃',
        hints: ['離開容器 shell 的指令就一個單字。', 'e___。', '完整指令：exit'],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'shell-exit';
        } },
      { text: '拆掉壞的，用正確配方重跑：<code>-p 3000:3000</code> + <code>--name harbor-app</code> + <code>-e MODE=harbor</code>（image 是 whale-app）',
        hints: ['先 docker rm -f harbor-app 清掉舊的，再 run 新的——這次要 -p 發佈 port，瀏覽器才連得進來（第 5 關教過）。',
          '骨架：docker run -d -p 3000:3000 --name harbor-app -e MODE=______ whale-app。',
          '完整指令：docker rm -f harbor-app，然後 docker run -d -p 3000:3000 --name harbor-app -e MODE=harbor whale-app'],
        check: function (result, ctx) {
          var c = ctx.engine.findContainer('harbor-app');
          return !!(result && result.ok && c && c.status === 'running' &&
            c.imageRef.indexOf('whale-app') === 0 && c.env.MODE === 'harbor' &&
            c.ports.some(function (p) { return p.host === 3000 && p.cont === 3000; }));
        },
        onDone: function (ctx) {
          ctx.stage.showBrowser('http://localhost:3000', '港務通知系統',
            '<p><b>狀態：運行正常 ✓</b></p><p>MODE=harbor 已載入、-p 3000:3000 已發佈，通知恢復發送。碼頭外的人潮散了。</p>' +
            '<p class="mb-em">— harbor-notify service</p>');
          ctx.stage.caption('通知系統復活！logs → exec → 修復（-e 設定 + -p 發佈）的除錯節奏。');
        } }
    ]
  });

  // ===== 第 7 關：volume 持久化 =====
  root.DG.registerLevel({
    id: 7,
    name: '不沉的保險庫',
    topic: 'volume 持久化',
    glyph: 'vault',
    terminal: true,
    story: [
      '講個港口最痛的鬼故事：有人把黃金存在貨櫃裡，然後……把貨櫃拆了。',
      '容器是<b>暫時的</b>——拆掉，裡面的資料就跟著沉海。今天做個實驗讓你痛一次（安全的痛）。',
      '然後我教你<b>保險庫（volume）</b>：讓資料活得比任何貨櫃都久。'
    ],
    teach: {
      title: '容器是暫時的，volume 是永久的',
      html: '<p>容器的可寫層跟著容器走：<code>rm</code> 之後<b>寫在容器裡的資料就沒了</b>（但掛在 volume／bind mount 的不會——那正是這關要學的）。這是特性不是 bug——容器要能隨拆隨建。</p>' +
        '<p><b>volume</b> 是 Docker 管理的獨立儲存空間：<code>docker volume create <名字></code> 建立，' +
        'run 時用 <code>-v 名字:/容器內路徑</code> 掛進去。</p>' +
        '<p>容器拆了，volume 還在；新容器掛上同一個 volume，資料原封不動。</p>' +
        '<p>本關的 harbor-db 支援兩個小指令：<code>docker exec db store <貨物></code> 存貨、' +
        '<code>docker exec db list</code> 盤點。</p>',
      map: '<b>港口比喻</b>：volume＝獨立於貨櫃的防水保險庫，沉船了它也會自己浮起來，等下一艘掛載。'
    },
    outro: '容器可拋棄、資料不可拋棄——重要的東西一律放 volume。',
    setup: function (ctx) {
      ctx.engine.pull('harbor-db');
      ctx.engine.takeEvents();
    },
    objectives: [
      { text: '跑一個資料庫貨櫃：<code>docker run -d --name db harbor-db</code>',
        hints: ['用 --name 取名 db，image 是 harbor-db，記得 -d。',
          '骨架：docker run -d --name db ________。',
          '完整指令：docker run -d --name db harbor-db'],
        check: function (result, ctx) {
          var c = ctx.engine.findContainer('db');
          return result && result.ok && c && c.status === 'running';
        } },
      { text: '存一批黃金進去：<code>docker exec db store gold</code>',
        hints: ['harbor-db 的存貨指令是 store，用 exec 對 db 執行。',
          '骨架：docker exec db store ____。',
          '完整指令：docker exec db store gold'],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'exec' &&
            result.parsed.argv && result.parsed.argv[0] === 'store';
        } },
      { text: '現在，拆掉它：<code>docker rm -f db</code>（是的，就是要你拆）',
        hints: ['它在運轉中，所以要用強制旗標。',
          'docker rm -_ db。',
          '完整指令：docker rm -f db'],
        check: function (result, ctx) {
          return result && result.ok && !ctx.engine.findContainer('db');
        },
        onDone: function (ctx) {
          ctx.stage.caption('貨櫃沉了……黃金呢？', 4200);
        } },
      { text: '重跑一個 db，用 <code>docker exec db list</code> 盤點——黃金還在嗎？',
        hints: ['先 docker run -d --name db harbor-db，再 exec list。',
          '重跑後執行：docker exec db list。',
          '依序：docker run -d --name db harbor-db，然後 docker exec db list（會看到空的——這正是重點）'],
        check: function (result) {
          return result && result.ok && result.execResult && result.execResult.empty === true;
        },
        onDone: function (ctx) {
          ctx.stage.caption('空的！資料跟著舊貨櫃沉進海裡了。這就是「容器是暫時的」。', 5000);
          root.DG.audio.play('error');
        } },
      { text: '建立保險庫：<code>docker volume create treasure</code>',
        hints: ['volume 有自己的子指令 create。',
          'docker volume ______ treasure。',
          '完整指令：docker volume create treasure'],
        check: function (result, ctx) {
          return result && result.ok && !!ctx.engine.findVolume('treasure');
        } },
      { text: '拆掉現在的 db，重跑一個<b>掛著保險庫</b>的：<code>-v treasure:/data</code>',
        hints: ['先 docker rm -f db，再 run 時加 -v treasure:/data。',
          '骨架：docker run -d --name db -v treasure:/data ________。',
          '完整指令：docker rm -f db，然後 docker run -d --name db -v treasure:/data harbor-db'],
        check: function (result, ctx) {
          var c = ctx.engine.findContainer('db');
          return !!(result && result.ok && c && c.status === 'running' &&
            c.imageRef.indexOf('harbor-db') === 0 &&
            c.mounts.some(function (m) { return m.volume === 'treasure' && m.dest === '/data'; }));
        } },
      { text: '再存一次黃金（store gold），這次它會進保險庫',
        hints: ['跟剛才一樣的 exec store。',
          'docker exec db store gold。',
          '完整指令：docker exec db store gold'],
        check: function (result, ctx) {
          if (hasEvent(result, 'cargo:store', function (d) { return d.persistent; })) {
            ctx.flags.persistStored = true;
            return true;
          }
          return false;
        } },
      { text: '終極考驗：<code>rm -f db</code> → 重跑（帶 -v）→ <code>list</code>——見證保險庫浮起',
        hints: ['三連：docker rm -f db → docker run -d --name db -v treasure:/data harbor-db → docker exec db list。',
          '拆掉重跑時「一定要再掛 -v treasure:/data」，不然接不回保險庫。',
          '依序執行：docker rm -f db、docker run -d --name db -v treasure:/data harbor-db、docker exec db list'],
        check: function (result, ctx) {
          if (hasEvent(result, 'container:remove') && ctx.flags.persistStored) {
            ctx.flags.rmAfterPersist = true;
          }
          return !!(result && result.ok && ctx.flags.rmAfterPersist &&
            result.execResult && result.execResult.items && result.execResult.items.length > 0 &&
            hasEvent(result, 'cargo:list', function (d) { return d.persistent; }));
        },
        onDone: function (ctx) {
          ctx.stage.renderVaults('treasure');
          ctx.stage.caption('黃金完好無缺！保險庫從沉船中浮起——這就是 volume。', 5200);
          ctx.stage.burst(88, 70, 22, ['#5cf2a5', '#ffd166', '#a7ffd0']);
          root.DG.audio.play('badge');
        } }
    ]
  });
}(typeof globalThis !== 'undefined' ? globalThis : this));
