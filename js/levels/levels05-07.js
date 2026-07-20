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
    name: { zh: '開通管線', en: 'Open the Pipe' },
    topic: 'port mapping',
    glyph: 'pipe',
    terminal: true,
    story: [
      { zh: '有貨櫃在跑還不夠——外面的訪客要能「走進去」才算開張！',
        en: 'A running container is not enough — visitors outside have to be able to "walk in" before you are truly open for business!' },
      { zh: '貨櫃是封閉的，想從碼頭外連進來，得接一條<b>管線（port mapping）</b>。',
        en: 'A container is sealed off; to reach it from outside the dock you have to run a <b>pipe (port mapping)</b>.' },
      { zh: '接好之後，我帶你去看真正的網頁跑起來的樣子。這是全港最爽的瞬間。',
        en: 'Once it is connected, I will show you a real web page coming to life. It is the most satisfying moment in the whole harbor.' }
    ],
    teach: {
      title: { zh: '-p 主機port:容器port 與 -d', en: '-p host-port:container-port and -d' },
      html: {
        zh: '<p><code>-p 8080:80</code> 的意思：把<b>主機的 8080</b> 接到<b>容器的 80</b>。' +
          '冒號左邊是碼頭這側（host），右邊是貨櫃那側（container）。</p>' +
          '<p><code>-d</code>（detach）讓容器在<b>背景</b>執行，不佔住你的終端機——長駐服務都這樣跑。</p>' +
          '<p>注意：一個主機 port 同時只能綁一個容器，重複綁定會報 <code>port is already allocated</code>。</p>',
        en: '<p><code>-p 8080:80</code> means: connect <b>the host\'s 8080</b> to <b>the container\'s 80</b>. ' +
          'Left of the colon is the dock side (host), right is the container side (container).</p>' +
          '<p><code>-d</code> (detach) runs the container in the <b>background</b> so it does not tie up your terminal — long-running services all run this way.</p>' +
          '<p>Note: one host port can only bind to one container at a time; binding it twice reports <code>port is already allocated</code>.</p>'
      },
      map: {
        zh: '<b>港口比喻</b>：-p＝從岸邊接一條發光管線到貨櫃艙門；主機 port＝岸邊的接口編號，先到先得。',
        en: '<b>Harbor Analogy</b>: -p = running a glowing pipe from the shore to the container\'s hatch; the host port = the numbered socket on the shore, first come first served.'
      }
    },
    outro: {
      zh: '-p host:container，左邊是你家門牌、右邊是容器房號；門牌一個 port 只能掛一塊。',
      en: '-p host:container — left is your street number, right is the container\'s room number; each street-number port can only carry one plate.'
    },
    setup: function (ctx) {
      ctx.engine.pull('nginx');
      ctx.engine.takeEvents();
    },
    objectives: [
      { text: { zh: '用 <code>docker run -d -p 8080:80 nginx</code> 開通第一條管線',
          en: 'Use <code>docker run -d -p 8080:80 nginx</code> to open your first pipe' },
        hints: [
          { zh: '要同時用到 -d（背景）和 -p（管線），image 是 nginx。',
            en: 'You need both -d (background) and -p (the pipe), and the image is nginx.' },
          { zh: '骨架：docker run -d -p ____:__ nginx（主機 8080、容器 80）。',
            en: 'Skeleton: docker run -d -p ____:__ nginx (host 8080, container 80).' },
          { zh: '完整指令：docker run -d -p 8080:80 nginx',
            en: 'Full command: docker run -d -p 8080:80 nginx' }
        ],
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
            ctx.stage.caption(root.DG.t({ zh: '訪客從 8080 管線走進貨櫃，看到了 nginx 歡迎頁！',
              en: 'A visitor walked through the 8080 pipe into the container and saw the nginx welcome page!' }));
          }, 2100);
        } },
      { text: { zh: '好奇心時間：再跑一個 nginx，也綁 <code>8080</code> 試試（體驗 port 衝突）',
          en: 'Curiosity time: run another nginx, also bound to <code>8080</code> (feel a port conflict)' },
        hints: [
          { zh: '一模一樣的指令再打一次就好，看看會發生什麼事。',
            en: 'Just type the exact same command again and see what happens.' },
          { zh: '再執行一次：docker run -d -p 8080:80 nginx。',
            en: 'Run it once more: docker run -d -p 8080:80 nginx.' },
          { zh: '完整指令：docker run -d -p 8080:80 nginx（會看到 port is already allocated 錯誤——這就是本目標要的）',
            en: 'Full command: docker run -d -p 8080:80 nginx (you will see the port is already allocated error — that is exactly what this objective wants).' }
        ],
        check: function (result) {
          return result && !result.ok && result.parsed.cmd === 'run' &&
            result.script.some(function (l) { return l.text.indexOf('port is already allocated') >= 0; });
        } },
      { text: { zh: '換個門牌讓第二個 nginx 跑起來：綁到主機 <code>8081</code>',
          en: 'Change the street number so the second nginx runs: bind it to host <code>8081</code>' },
        hints: [
          { zh: '主機 port（冒號左邊）換成沒人用的號碼。',
            en: 'Change the host port (left of the colon) to a number nobody is using.' },
          { zh: '骨架：docker run -d -p 8081:__ nginx。',
            en: 'Skeleton: docker run -d -p 8081:__ nginx.' },
          { zh: '完整指令：docker run -d -p 8081:80 nginx',
            en: 'Full command: docker run -d -p 8081:80 nginx' }
        ],
        check: function (result) {
          var o = result && result.ok && result.parsed.cmd === 'run' && result.parsed.opts;
          return !!(o && o.detach && o.image === 'nginx' &&
            (o.ports || []).some(function (p) { return p.host === 8081 && p.cont === 80; }));
        },
        onDone: function (ctx) {
          ctx.stage.caption(root.DG.t({ zh: '兩條管線同時服務：8080 與 8081 各接一個貨櫃。',
            en: 'Two pipes serving at once: 8080 and 8081 each connect to a container.' }));
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
    name: { zh: '深入貨櫃', en: 'Deep into the Container' },
    topic: 'logs · exec · env',
    glyph: 'lantern',
    terminal: true,
    story: [
      { zh: '出事了！港務通知系統 <code>harbor-app</code> 一直沒發通知，客戶在碼頭外排長龍。',
        en: 'Something broke! The harbor notification system <code>harbor-app</code> has stopped sending notices, and customers are lining up outside the dock.' },
      { zh: '別慌。除錯三步驟：<b>先看日誌（logs）→ 鑽進貨櫃查現場（exec）→ 修好重跑</b>。',
        en: 'Do not panic. Debugging has three steps: <b>read the logs first (logs) → climb into the container to inspect the scene (exec) → fix it and rerun</b>.' },
      { zh: '提著燈籠跟我來，今天你要學會在貨櫃「裡面」辦案。',
        en: 'Grab a lantern and follow me — today you will learn to investigate "inside" the container.' }
    ],
    teach: {
      title: { zh: '容器除錯工具箱', en: 'The container debugging toolbox' },
      html: {
        zh: '<p><code>docker logs <名字></code>：看容器的輸出——出事先看這裡，九成線索都在。</p>' +
          '<p><code>docker exec -it <名字> sh</code>：在運行中的容器裡開一個 shell，' +
          '<code>-it</code> 讓你能互動輸入。進去之後用 <code>ls</code>、<code>cat</code> 查案，<code>exit</code> 離開。</p>' +
          '<p><code>-e KEY=VALUE</code>：run 的時候注入環境變數；<code>--name</code> 幫容器取名，別再靠隨機名。</p>' +
          '<p>⚠ <b>兩個超常見卡點</b>：① 環境變數<b>大小寫敏感</b>——程式讀的是 <code>MODE</code>，' +
          '寫成 <code>mode</code> 等於沒設；② <b>image 名稱一律放在指令最後面</b>——' +
          '所有旗標（<code>-d</code>、<code>-p</code>、<code>--name</code>、<code>-e</code>…）都要寫在 image 前面，' +
          'image 後面的字會被當成「容器內要執行的指令」。</p>',
        en: '<p><code>docker logs <name></code>: view the container\'s output — check here first when something breaks; nine out of ten clues are here.</p>' +
          '<p><code>docker exec -it <name> sh</code>: open a shell inside a running container; ' +
          '<code>-it</code> lets you type interactively. Once inside, use <code>ls</code> and <code>cat</code> to investigate, and <code>exit</code> to leave.</p>' +
          '<p><code>-e KEY=VALUE</code>: inject an environment variable at run time; <code>--name</code> gives the container a name so you no longer rely on random ones.</p>' +
          '<p>⚠ <b>Two very common pitfalls</b>: ① environment variables are <b>case-sensitive</b> — the program reads <code>MODE</code>, ' +
          'so writing <code>mode</code> is the same as not setting it; ② <b>the image name always goes last in the command</b> — ' +
          'all flags (<code>-d</code>, <code>-p</code>, <code>--name</code>, <code>-e</code>…) must come before the image, ' +
          'and anything after the image is treated as "a command to run inside the container".</p>'
      },
      map: {
        zh: '<b>港口比喻</b>：logs＝貨櫃的工作日誌；exec＝提燈進櫃檢查；-e＝裝櫃時放進去的一張<b>工作單</b>，櫃裡的程式開工前會先讀它。',
        en: '<b>Harbor Analogy</b>: logs = the container\'s ship\'s log; exec = boarding with a lantern to inspect; -e = a <b>work order</b> slipped in when loading, which the program inside reads before it starts.'
      }
    },
    outro: {
      zh: '除錯三連：logs 看線索 → exec 進現場 → 修正條件（-e）重新出航。',
      en: 'The debugging trio: logs to read clues → exec to enter the scene → fix the conditions (-e) and set sail again.'
    },
    setup: function (ctx) {
      var e = ctx.engine;
      e.pull('whale-app');
      e.run({ image: 'whale-app', name: 'harbor-app', detach: true });
      e.takeEvents();
    },
    objectives: [
      { text: { zh: '先看日誌：<code>docker logs harbor-app</code>',
          en: 'Read the logs first: <code>docker logs harbor-app</code>' },
        hints: [
          { zh: '看日誌的指令是 logs，後面接容器名。',
            en: 'The command to read logs is logs, followed by the container name.' },
          { zh: 'docker logs __________。', en: 'docker logs __________.' },
          { zh: '完整指令：docker logs harbor-app', en: 'Full command: docker logs harbor-app' }
        ],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'logs' && result.parsed.ref === 'harbor-app';
        } },
      { text: { zh: '日誌說 MODE 沒設定。鑽進去看現場：<code>docker exec -it harbor-app sh</code>',
          en: 'The logs say MODE is not set. Climb in to see the scene: <code>docker exec -it harbor-app sh</code>' },
        hints: [
          { zh: 'exec 加上 -it 再接容器名和 sh，就能進到容器內。',
            en: 'exec plus -it, then the container name and sh, gets you inside the container.' },
          { zh: '骨架：docker exec -it harbor-app __。', en: 'Skeleton: docker exec -it harbor-app __.' },
          { zh: '完整指令：docker exec -it harbor-app sh', en: 'Full command: docker exec -it harbor-app sh' }
        ],
        check: function (result) {
          return result && result.ok && result.shell === true;
        } },
      { text: { zh: '在貨櫃裡查看設定檔：<code>cat config.txt</code>（先用 <code>ls</code> 環顧四周也行）',
          en: 'Inside the container, look at the config file: <code>cat config.txt</code> (using <code>ls</code> to look around first is fine too)' },
        hints: [
          { zh: '你現在「在容器裡面」，用類 Linux 指令。cat 可以印出檔案內容。',
            en: 'You are now "inside the container", so use Linux-like commands. cat prints a file\'s contents.' },
          { zh: 'cat co________（tab 補不了，自己拼）。',
            en: 'cat co________ (tab will not autocomplete here, spell it yourself).' },
          { zh: '完整指令：cat config.txt', en: 'Full command: cat config.txt' }
        ],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'shell' &&
            result.parsed.argv[0] === 'cat' && result.parsed.argv[1] === 'config.txt';
        } },
      { text: { zh: '找到病因了（MODE 沒設）。輸入 <code>exit</code> 離開貨櫃',
          en: 'Found the cause (MODE was not set). Type <code>exit</code> to leave the container' },
        hints: [
          { zh: '離開容器 shell 的指令就一個單字。', en: 'The command to leave the container shell is a single word.' },
          { zh: 'e___。', en: 'e___.' },
          { zh: '完整指令：exit', en: 'Full command: exit' }
        ],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'shell-exit';
        } },
      { text: { zh: '拆掉壞的，用正確配方重跑：<code>-p 3000:3000</code> + <code>--name harbor-app</code> + <code>-e MODE=harbor</code>（image 是 whale-app）',
          en: 'Tear down the broken one and rerun with the right recipe: <code>-p 3000:3000</code> + <code>--name harbor-app</code> + <code>-e MODE=harbor</code> (the image is whale-app)' },
        hints: [
          { zh: '先 docker rm -f harbor-app 清掉舊的，再 run 新的——這次要 -p 發佈 port，瀏覽器才連得進來（第 5 關教過）。',
            en: 'First docker rm -f harbor-app to clear the old one, then run a new one — this time -p to publish the port so the browser can connect (taught in Level 5).' },
          { zh: '骨架：docker run -d -p 3000:3000 --name harbor-app -e MODE=______ whale-app。',
            en: 'Skeleton: docker run -d -p 3000:3000 --name harbor-app -e MODE=______ whale-app.' },
          { zh: '完整指令：docker rm -f harbor-app，然後 docker run -d -p 3000:3000 --name harbor-app -e MODE=harbor whale-app',
            en: 'Full command: docker rm -f harbor-app, then docker run -d -p 3000:3000 --name harbor-app -e MODE=harbor whale-app' }
        ],
        check: function (result, ctx) {
          var c = ctx.engine.findContainer('harbor-app');
          return !!(result && result.ok && c && c.status === 'running' &&
            c.imageRef.indexOf('whale-app') === 0 && c.env.MODE === 'harbor' &&
            c.ports.some(function (p) { return p.host === 3000 && p.cont === 3000; }));
        },
        onDone: function (ctx) {
          ctx.stage.showBrowser('http://localhost:3000',
            root.DG.t({ zh: '港務通知系統', en: 'Harbor Notification System' }),
            root.DG.t({
              zh: '<p><b>狀態：運行正常 ✓</b></p><p>MODE=harbor 已載入、-p 3000:3000 已發佈，通知恢復發送。碼頭外的人潮散了。</p>' +
                '<p class="mb-em">— harbor-notify service</p>',
              en: '<p><b>Status: running normally ✓</b></p><p>MODE=harbor is loaded, -p 3000:3000 is published, and notifications are flowing again. The crowd outside the dock has dispersed.</p>' +
                '<p class="mb-em">— harbor-notify service</p>'
            }));
          ctx.stage.caption(root.DG.t({ zh: '通知系統復活！logs → exec → 修復（-e 設定 + -p 發佈）的除錯節奏。',
            en: 'The notification system is back! The logs → exec → fix (-e config + -p publish) debugging rhythm.' }));
        } }
    ]
  });

  // ===== 第 7 關：volume 持久化 =====
  root.DG.registerLevel({
    id: 7,
    name: { zh: '不沉的保險庫', en: 'The Unsinkable Vault' },
    topic: { zh: 'volume 持久化', en: 'volume persistence' },
    glyph: 'vault',
    terminal: true,
    story: [
      { zh: '講個港口最痛的鬼故事：有人把黃金存在貨櫃裡，然後……把貨櫃拆了。',
        en: 'Here is the harbor\'s most painful ghost story: someone stored gold inside a container, and then… tore the container down.' },
      { zh: '容器是<b>暫時的</b>——拆掉，裡面的資料就跟著沉海。今天做個實驗讓你痛一次（安全的痛）。',
        en: 'Containers are <b>ephemeral</b> — tear one down and the data inside sinks with it. Today we run an experiment to let you feel that pain once (safely).' },
      { zh: '然後我教你<b>保險庫（volume）</b>：讓資料活得比任何貨櫃都久。',
        en: 'Then I will teach you the <b>vault (volume)</b>: making data outlive any container.' }
    ],
    teach: {
      title: { zh: '容器是暫時的，volume 是永久的', en: 'Containers are ephemeral, volumes are permanent' },
      html: {
        zh: '<p>容器的可寫層跟著容器走：<code>rm</code> 之後<b>寫在容器裡的資料就沒了</b>（但掛在 volume／bind mount 的不會——那正是這關要學的）。這是特性不是 bug——容器要能隨拆隨建。</p>' +
          '<p><b>volume</b> 是 Docker 管理的獨立儲存空間：<code>docker volume create <名字></code> 建立，' +
          'run 時用 <code>-v 名字:/容器內路徑</code> 掛進去。</p>' +
          '<p>容器拆了，volume 還在；新容器掛上同一個 volume，資料原封不動。</p>' +
          '<p>本關的 harbor-db 支援兩個小指令：<code>docker exec db store <貨物></code> 存貨、' +
          '<code>docker exec db list</code> 盤點。</p>',
        en: '<p>A container\'s writable layer travels with the container: after <code>rm</code>, <b>data written inside the container is gone</b> (but anything on a volume / bind mount is not — that is exactly what this level teaches). This is a feature, not a bug — containers must be disposable and rebuildable at will.</p>' +
          '<p>A <b>volume</b> is an independent storage space managed by Docker: create it with <code>docker volume create <name></code>, ' +
          'and mount it at run time with <code>-v name:/path-in-container</code>.</p>' +
          '<p>Tear the container down and the volume remains; mount the same volume on a new container and the data is untouched.</p>' +
          '<p>This level\'s harbor-db supports two small commands: <code>docker exec db store <item></code> to store cargo, ' +
          'and <code>docker exec db list</code> to take inventory.</p>'
      },
      map: {
        zh: '<b>港口比喻</b>：volume＝獨立存放在岸上的防水保險庫——貨櫃被銷毀（rm）也動不到它，等下一個貨櫃來掛載。',
        en: '<b>Harbor Analogy</b>: volume = a waterproof vault stored independently on the shore — destroying the container (rm) cannot touch it; it waits for the next container to mount it.'
      }
    },
    outro: {
      zh: '容器可拋棄、資料不可拋棄——重要的東西一律放 volume。',
      en: 'Containers are disposable, data is not — always put anything important on a volume.'
    },
    setup: function (ctx) {
      ctx.engine.pull('harbor-db');
      ctx.engine.takeEvents();
    },
    objectives: [
      { text: { zh: '跑一個資料庫貨櫃：<code>docker run -d --name db harbor-db</code>',
          en: 'Run a database container: <code>docker run -d --name db harbor-db</code>' },
        hints: [
          { zh: '用 --name 取名 db，image 是 harbor-db，記得 -d。',
            en: 'Name it db with --name, the image is harbor-db, and remember -d.' },
          { zh: '骨架：docker run -d --name db ________。', en: 'Skeleton: docker run -d --name db ________.' },
          { zh: '完整指令：docker run -d --name db harbor-db', en: 'Full command: docker run -d --name db harbor-db' }
        ],
        check: function (result, ctx) {
          var c = ctx.engine.findContainer('db');
          return result && result.ok && c && c.status === 'running';
        } },
      { text: { zh: '存一批黃金進去：<code>docker exec db store gold</code>',
          en: 'Store a batch of gold: <code>docker exec db store gold</code>' },
        hints: [
          { zh: 'harbor-db 的存貨指令是 store，用 exec 對 db 執行。',
            en: 'harbor-db\'s store command is store; run it against db with exec.' },
          { zh: '骨架：docker exec db store ____。', en: 'Skeleton: docker exec db store ____.' },
          { zh: '完整指令：docker exec db store gold', en: 'Full command: docker exec db store gold' }
        ],
        check: function (result) {
          return result && result.ok && result.parsed.cmd === 'exec' &&
            result.parsed.argv && result.parsed.argv[0] === 'store';
        } },
      { text: { zh: '現在，拆掉它：<code>docker rm -f db</code>（是的，就是要你拆）',
          en: 'Now, tear it down: <code>docker rm -f db</code> (yes, you are meant to tear it down)' },
        hints: [
          { zh: '它在運轉中，所以要用強制旗標。', en: 'It is running, so you need the force flag.' },
          { zh: 'docker rm -_ db。', en: 'docker rm -_ db.' },
          { zh: '完整指令：docker rm -f db', en: 'Full command: docker rm -f db' }
        ],
        check: function (result, ctx) {
          return result && result.ok && !ctx.engine.findContainer('db');
        },
        onDone: function (ctx) {
          ctx.stage.caption(root.DG.t({ zh: '貨櫃沉了……黃金呢？',
            en: 'The container sank… where is the gold?' }), 4200);
        } },
      { text: { zh: '重跑一個 db，用 <code>docker exec db list</code> 盤點——黃金還在嗎？',
          en: 'Rerun a db and take inventory with <code>docker exec db list</code> — is the gold still there?' },
        hints: [
          { zh: '先 docker run -d --name db harbor-db，再 exec list。',
            en: 'First docker run -d --name db harbor-db, then exec list.' },
          { zh: '重跑後執行：docker exec db list。', en: 'After rerunning, run: docker exec db list.' },
          { zh: '依序：docker run -d --name db harbor-db，然後 docker exec db list（會看到空的——這正是重點）',
            en: 'In order: docker run -d --name db harbor-db, then docker exec db list (you will see it empty — that is precisely the point).' }
        ],
        check: function (result) {
          return result && result.ok && result.execResult && result.execResult.empty === true;
        },
        onDone: function (ctx) {
          ctx.stage.caption(root.DG.t({ zh: '空的！資料跟著舊貨櫃沉進海裡了。這就是「容器是暫時的」。',
            en: 'Empty! The data sank into the sea with the old container. This is what "containers are ephemeral" means.' }), 5000);
          root.DG.audio.play('error');
        } },
      { text: { zh: '建立保險庫：<code>docker volume create treasure</code>',
          en: 'Create a vault: <code>docker volume create treasure</code>' },
        hints: [
          { zh: 'volume 有自己的子指令 create。', en: 'volume has its own subcommand, create.' },
          { zh: 'docker volume ______ treasure。', en: 'docker volume ______ treasure.' },
          { zh: '完整指令：docker volume create treasure', en: 'Full command: docker volume create treasure' }
        ],
        check: function (result, ctx) {
          return result && result.ok && !!ctx.engine.findVolume('treasure');
        } },
      { text: { zh: '拆掉現在的 db，重跑一個<b>掛著保險庫</b>的：<code>-v treasure:/data</code>',
          en: 'Tear down the current db and rerun one <b>with the vault mounted</b>: <code>-v treasure:/data</code>' },
        hints: [
          { zh: '先 docker rm -f db，再 run 時加 -v treasure:/data。',
            en: 'First docker rm -f db, then add -v treasure:/data when you run.' },
          { zh: '骨架：docker run -d --name db -v treasure:/data ________。',
            en: 'Skeleton: docker run -d --name db -v treasure:/data ________.' },
          { zh: '完整指令：docker rm -f db，然後 docker run -d --name db -v treasure:/data harbor-db',
            en: 'Full command: docker rm -f db, then docker run -d --name db -v treasure:/data harbor-db' }
        ],
        check: function (result, ctx) {
          var c = ctx.engine.findContainer('db');
          return !!(result && result.ok && c && c.status === 'running' &&
            c.imageRef.indexOf('harbor-db') === 0 &&
            c.mounts.some(function (m) { return m.volume === 'treasure' && m.dest === '/data'; }));
        } },
      { text: { zh: '再存一次黃金（store gold），這次它會進保險庫',
          en: 'Store gold once more (store gold); this time it goes into the vault' },
        hints: [
          { zh: '跟剛才一樣的 exec store。', en: 'The same exec store as before.' },
          { zh: 'docker exec db store gold。', en: 'docker exec db store gold.' },
          { zh: '完整指令：docker exec db store gold', en: 'Full command: docker exec db store gold' }
        ],
        check: function (result, ctx) {
          if (hasEvent(result, 'cargo:store', function (d) { return d.persistent; })) {
            ctx.flags.persistStored = true;
            return true;
          }
          return false;
        } },
      { text: { zh: '終極考驗：<code>rm -f db</code> → 重跑（帶 -v）→ <code>list</code>——見證保險庫浮起',
          en: 'The ultimate test: <code>rm -f db</code> → rerun (with -v) → <code>list</code> — watch the vault float back up' },
        hints: [
          { zh: '三連：docker rm -f db → docker run -d --name db -v treasure:/data harbor-db → docker exec db list。',
            en: 'The trio: docker rm -f db → docker run -d --name db -v treasure:/data harbor-db → docker exec db list.' },
          { zh: '拆掉重跑時「一定要再掛 -v treasure:/data」，不然接不回保險庫。',
            en: 'When tearing down and rerunning you "must mount -v treasure:/data again", or you will not reconnect to the vault.' },
          { zh: '依序執行：docker rm -f db、docker run -d --name db -v treasure:/data harbor-db、docker exec db list',
            en: 'Run in order: docker rm -f db, docker run -d --name db -v treasure:/data harbor-db, docker exec db list' }
        ],
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
          ctx.stage.caption(root.DG.t({ zh: '黃金完好無缺！貨櫃拆了，保險庫還完好留在岸上——這就是 volume。',
            en: 'The gold is intact! The container is gone, but the vault stays safe on the shore — this is volume.' }), 5200);
          ctx.stage.burst(88, 70, 22, ['#5cf2a5', '#ffd166', '#a7ffd0']);
          root.DG.audio.play('badge');
        } }
    ]
  });
}(typeof globalThis !== 'undefined' ? globalThis : this));
