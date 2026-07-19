/*
 * cli.js — 指令列解析與擬真輸出（UMD，不碰 DOM）
 * 把輸入字串 → 引擎呼叫 → 終端機播放腳本（script ops）＋ 船長教學提示（tip）。
 * script op: {t:'line',text,cls} | {t:'pull',ref,layers,cached} | {t:'gap'}
 */
(function (root, factory) {
  var deps;
  if (typeof module !== 'undefined' && module.exports) {
    deps = { CONFIG: require('./config.js') };
    module.exports = factory(deps.CONFIG);
  } else {
    root.DG = root.DG || {};
    root.DG.createCLI = factory(root.DG.CONFIG).createCLI;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (CONFIG) {
  'use strict';

  function tokenize(input) {
    var out = [];
    var re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    var m;
    while ((m = re.exec(input))) { out.push(m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : m[3])); }
    return out;
  }

  function pad(s, w) {
    s = String(s);
    while (s.length < w) { s += ' '; }
    return s;
  }

  function ago(ts) {
    var s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) { return s + (s === 1 ? ' second ago' : ' seconds ago'); }
    var mnt = Math.round(s / 60);
    if (mnt < 60) { return mnt + (mnt === 1 ? ' minute ago' : ' minutes ago'); }
    return Math.round(mnt / 60) + ' hours ago';
  }

  function upFor(ts) {
    var s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) { return s + ' seconds'; }
    var mnt = Math.round(s / 60);
    return mnt + (mnt === 1 ? ' minute' : ' minutes');
  }

  var HELLO_TEXT = [
    '',
    'Hello from Docker!',
    'This message shows that your installation appears to be working correctly.',
    '',
    'To generate this message, Docker took the following steps:',
    ' 1. The Docker client contacted the Docker daemon.',
    ' 2. The Docker daemon pulled the "hello-world" image from the registry.',
    ' 3. The Docker daemon created a new container from that image which runs the',
    '    executable that produces the output you are currently reading.',
    ' 4. The Docker daemon streamed that output to the terminal.',
    ''
  ];

  var RUN_USAGE = '\nUsage:  docker run [OPTIONS] IMAGE [COMMAND] [ARG...]\n\nRun a command in a new container';

  function createCLI(engine) {
    var st = { shell: null, buildCtx: null, composeProject: null, learnedLevel: 1 };

    function lines(arr, cls) {
      return arr.map(function (t) { return { t: 'line', text: t, cls: cls || 'out' }; });
    }
    function errRes(parsed, msg, tip) {
      return { ok: false, parsed: parsed, script: lines(msg.split('\n'), 'err'), tip: tip || null,
        events: engine.takeEvents() };
    }
    function okRes(parsed, script, extra) {
      var r = { ok: true, parsed: parsed, script: script, tip: null, events: engine.takeEvents() };
      if (extra) { Object.keys(extra).forEach(function (k) { r[k] = extra[k]; }); }
      return r;
    }

    // ---------- flag 解析（docker run / exec 共用邏輯） ----------
    function parseRunFlags(args) {
      var o = { image: null, name: null, detach: false, ports: [], env: {}, mounts: [],
        network: 'bridge', it: false, rest: [] };
      var i = 0;
      while (i < args.length) {
        var a = args[i];
        if (o.image) { o.rest.push(a); i++; continue; }
        if (a === '-d' || a === '--detach') { o.detach = true; }
        else if (a === '-it' || a === '-ti' || a === '-i' || a === '-t') { o.it = true; }
        else if (a === '--name') { o.name = args[++i]; }
        else if (a === '-p' || a === '--publish') {
          var pp = String(args[++i] || '').split(':');
          if (pp.length !== 2 || !/^\d+$/.test(pp[0]) || !/^\d+$/.test(pp[1])) {
            return { err: 'docker: invalid publish opts format: "' + (args[i] || '') + '"' };
          }
          o.ports.push({ host: +pp[0], cont: +pp[1] });
        }
        else if (a === '-e' || a === '--env') {
          var kv = String(args[++i] || '').split('=');
          if (!kv[0]) { return { err: 'docker: invalid environment variable' }; }
          o.env[kv[0]] = kv.slice(1).join('=') || '1';
        }
        else if (a === '-v' || a === '--volume') {
          var vv = String(args[++i] || '').split(':');
          if (vv.length < 2) { return { err: 'docker: invalid volume specification: "' + (args[i] || '') + '"' }; }
          o.mounts.push({ volume: vv[0], dest: vv[1] });
        }
        else if (a === '--network' || a === '--net') { o.network = args[++i]; }
        else if (a[0] === '-') { return { err: flagError(a, 'run') }; }
        else { o.image = a; }
        i++;
      }
      return o;
    }

    function flagError(flag, sub) {
      var body = flag.slice(0, 2) === '--'
        ? 'unknown flag: ' + flag
        : 'unknown shorthand flag: \'' + flag[1] + '\' in ' + flag;
      return 'docker: ' + body + '\nSee \'docker ' + sub + ' --help\'.';
    }

    // ---------- pull 腳本 ----------
    function pullScript(ref, layers, noTagGiven) {
      var r = engine.parseRef(ref);
      var s = [];
      if (noTagGiven) { s.push({ t: 'line', text: 'Using default tag: latest', cls: 'dim' }); }
      s.push({ t: 'line', text: r.tag + ': Pulling from library/' + r.repo, cls: 'out' });
      s.push({ t: 'pull', ref: ref, layers: layers });
      s.push({ t: 'line', text: 'Digest: sha256:' + hex(64), cls: 'dim' });
      s.push({ t: 'line', text: 'Status: Downloaded newer image for ' + r.repo + ':' + r.tag, cls: 'out' });
      return s;
    }

    function hex(n) {
      var s = '';
      for (var i = 0; i < n; i++) { s += '0123456789abcdef'[Math.floor(Math.random() * 16)]; }
      return s;
    }

    // ---------- docker run ----------
    function cmdRun(args) {
      if (!args.length) {
        return errRes({ cmd: 'run' },
          '"docker run" requires at least 1 argument.' + RUN_USAGE,
          '「docker run」後面要接一個藍圖（image）名字，起重機才知道要組哪種貨櫃。');
      }
      var o = parseRunFlags(args);
      if (o.err) { return errRes({ cmd: 'run' }, o.err, tipForFlagError(o.err)); }
      if (!o.image) { return errRes({ cmd: 'run' }, '"docker run" requires at least 1 argument.' + RUN_USAGE); }
      if (o.rest.length && o.rest[0].charAt(0) === '-') {
        // 旗標寫在 image 後面：真 Docker 會把它當「容器內要執行的指令」去 exec 而炸掉。
        // 忠實重現這個錯誤並給提示，不讓它靜默變成設定不完整的容器（實測玩家會卡死在這裡）。
        return errRes({ cmd: 'run', image: o.image },
          'docker: Error response from daemon: failed to create task for container: ' +
          'exec: "' + o.rest[0] + '": executable file not found in $PATH.',
          '旗標放錯位置了！docker run 的格式是 <code>docker run [旗標…] image</code>——' +
          'image 一律放在<b>最後面</b>。image 後面的字會被當成「容器裡要執行的指令」，' +
          '所以 <code>' + o.rest[0] + '</code> 被當成程式名拿去執行了。把旗標全部移到 image 前面再試一次。');
      }
      var res = engine.run(o);
      var parsed = { cmd: 'run', image: o.image, opts: o };
      if (!res.ok) { return runErrorRes(parsed, res); }
      var script = [];
      if (res.pulled) {
        var r = engine.parseRef(o.image);
        script.push({ t: 'line', text: 'Unable to find image \'' + r.repo + ':' + r.tag + '\' locally', cls: 'dim' });
        script = script.concat(pullScript(o.image, res.pulled.layers, o.image.indexOf(':') < 0));
      }
      var c = res.container;
      if (o.detach) { script.push({ t: 'line', text: c.id, cls: 'out' }); }
      else if (res.oneshot) { script = script.concat(lines(HELLO_TEXT, 'out')); }
      else {
        script = script.concat(lines(c.logs, 'out'));
        script.push({ t: 'line',
          text: '（沒加 -d：容器在前景執行，會佔住終端機直到 Ctrl-C——長駐服務通常加 -d 讓它在背景跑）',
          cls: 'dim' });
      }
      return okRes(parsed, script, { container: c, engineResult: res });
    }

    function runErrorRes(parsed, res) {
      var tip = null;
      if (res.conflict && res.error.indexOf('port is already allocated') >= 0) {
        tip = '這條管線（主機 port）已經被別的貨櫃接走了！一個主機 port 同時只能綁一個容器——' +
          '換一個主機 port（冒號左邊那個數字），或先 stop 佔用的貨櫃。';
      } else if (res.conflict && res.error.indexOf('Conflict. The container name') >= 0) {
        tip = '這個名字已經有貨櫃在用了。名字是唯一的——先 docker rm 舊的，或換個 --name。';
      } else if (res.conflict && res.error.indexOf('network') >= 0) {
        tip = '這條內線還沒拉。先 docker network create 建立它。';
      } else if (res.imageMissing) {
        tip = '藍圖倉庫裡沒有這個名字的藍圖。檢查拼字，或用 help 看看本港認得哪些藍圖。';
      }
      return errRes(parsed, res.error, tip);
    }

    function tipForFlagError(err) {
      if (err.indexOf('publish') >= 0) { return '-p 的格式是「主機port:容器port」，例如 -p 8080:80。'; }
      if (err.indexOf('volume specification') >= 0) { return '-v 的格式是「保險庫名:容器內路徑」，例如 -v treasure:/data。'; }
      return '這個旗標本港的起重機不認得。用 help 查目前學過的指令。';
    }

    // ---------- docker ps / images ----------
    function cmdPs(args) {
      var all = args.indexOf('-a') >= 0 || args.indexOf('--all') >= 0;
      var rows = engine.state.containers.filter(function (c) { return all || c.status === 'running'; });
      var head = pad('CONTAINER ID', 15) + pad('IMAGE', 13) + pad('COMMAND', 20) +
        pad('CREATED', 16) + pad('STATUS', 25) + pad('PORTS', 22) + 'NAMES';
      var body = rows.map(function (c) {
        var cmd = '"' + (c.command.length > 16 ? c.command.slice(0, 15) + '…' : c.command) + '"';
        var status = c.status === 'running' ? 'Up ' + upFor(c.created)
          : 'Exited (' + (c.exitCode === null ? 0 : c.exitCode) + ') ' + ago(c.created);
        var ports = c.ports.map(function (p) { return '0.0.0.0:' + p.host + '->' + p.cont + '/tcp'; }).join(', ');
        return pad(c.id.slice(0, 12), 15) + pad(c.image, 13) + pad(cmd, 20) +
          pad(ago(c.created), 16) + pad(status, 25) + pad(ports, 22) + c.name;
      });
      return okRes({ cmd: 'ps', all: all, count: rows.length }, lines([head].concat(body), 'table'));
    }

    function cmdImages() {
      var head = pad('REPOSITORY', 15) + pad('TAG', 14) + pad('IMAGE ID', 15) + pad('CREATED', 18) + 'SIZE';
      var body = engine.state.images.map(function (im) {
        return pad(im.repo, 15) + pad(im.tag, 14) + pad(im.id, 15) + pad(ago(im.created), 18) + im.size;
      });
      return okRes({ cmd: 'images', count: engine.state.images.length }, lines([head].concat(body), 'table'));
    }

    // ---------- pull / stop / start / rm / logs ----------
    function cmdPull(args) {
      if (!args[0]) { return errRes({ cmd: 'pull' }, '"docker pull" requires exactly 1 argument.'); }
      var res = engine.pull(args[0]);
      var parsed = { cmd: 'pull', image: args[0] };
      if (!res.ok) {
        return errRes(parsed, res.error, '藍圖倉庫查無此藍圖——檢查名字拼對了嗎？tag 存在嗎？');
      }
      if (res.alreadyExists) {
        var r0 = engine.parseRef(args[0]);
        return okRes(parsed, lines([
          r0.tag + ': Pulling from library/' + r0.repo,
          'Status: Image is up to date for ' + r0.repo + ':' + r0.tag], 'out'), { cached: true });
      }
      return okRes(parsed, pullScript(args[0], res.layers, args[0].indexOf(':') < 0), { image: res.image });
    }

    function cmdLifecycle(sub, args) {
      var force = args.indexOf('-f') >= 0 || args.indexOf('--force') >= 0;
      var refs = args.filter(function (a) { return a[0] !== '-'; });
      if (!refs.length) { return errRes({ cmd: sub }, '"docker ' + sub + '" requires at least 1 argument.'); }
      var script = [];
      var results = [];
      for (var i = 0; i < refs.length; i++) {
        var res = sub === 'stop' ? engine.stop(refs[i])
          : sub === 'start' ? engine.start(refs[i])
          : engine.rm(refs[i], force);
        results.push(res);
        if (!res.ok) {
          return errRes({ cmd: sub, ref: refs[i], force: force, results: results },
            res.error, lifecycleTip(sub, res));
        }
        script.push({ t: 'line', text: refs[i], cls: 'out' });
      }
      return okRes({ cmd: sub, refs: refs, force: force, results: results }, script);
    }

    function lifecycleTip(sub, res) {
      if (res.running) {
        return '這個貨櫃還在運轉中，直接拆會出事！先 docker stop 讓它停下，或確定要強拆就用 docker rm -f。';
      }
      if (res.error.indexOf('No such container') >= 0) {
        return '港區找不到這個名字的貨櫃。用 docker ps -a 看看所有貨櫃的正確名字。';
      }
      if (res.error.indexOf('port is already allocated') >= 0) {
        return '它綁的管線（port）現在被別的貨櫃佔走了，先處理佔用的那個。';
      }
      return null;
    }

    function cmdLogs(args) {
      var refs = args.filter(function (a) { return a[0] !== '-'; });
      if (!refs[0]) { return errRes({ cmd: 'logs' }, '"docker logs" requires exactly 1 argument.'); }
      var c = engine.findContainer(refs[0]);
      if (!c) {
        return errRes({ cmd: 'logs', ref: refs[0] },
          'Error response from daemon: No such container: ' + refs[0],
          '找不到這個貨櫃。docker ps -a 查一下名字。');
      }
      engine.emit('logs', { container: c });
      return okRes({ cmd: 'logs', ref: c.name }, lines(c.logs, 'out'), { container: c });
    }

    // ---------- exec / shell ----------
    function cmdExec(args) {
      var it = false;
      var rest = args.filter(function (a) {
        if (a === '-it' || a === '-ti' || a === '-i' || a === '-t') { it = true; return false; }
        return true;
      });
      var ref = rest[0];
      var argv = rest.slice(1);
      if (!ref || !argv.length) {
        return errRes({ cmd: 'exec' }, '"docker exec" requires at least 2 arguments.',
          '格式：docker exec [-it] <貨櫃名> <指令>。');
      }
      if ((argv[0] === 'sh' || argv[0] === 'bash') && it) {
        var c = engine.findContainer(ref);
        if (!c) { return errRes({ cmd: 'exec', ref: ref }, 'Error response from daemon: No such container: ' + ref); }
        if (c.status !== 'running') {
          return errRes({ cmd: 'exec', ref: ref },
            'Error response from daemon: container ' + c.id.slice(0, 12) + ' is not running',
            'exec 只能進入「運行中」的貨櫃——它現在是停止狀態，先 docker start 它。');
        }
        st.shell = c.name;
        engine.emit('shell:enter', { container: c });
        return okRes({ cmd: 'exec', ref: c.name, shell: true },
          lines(['(進入貨櫃內部 shell — 輸入 exit 可離開)'], 'dim'), { shell: true });
      }
      var res = engine.execCmd(ref, argv);
      var parsed = { cmd: 'exec', ref: ref, argv: argv, result: res };
      if (!res.ok) { return errRes(parsed, res.error, execTip(res)); }
      return okRes(parsed, lines(res.output || [], 'out'), { execResult: res });
    }

    function execTip(res) {
      if (res.notRunning) { return 'exec 需要貨櫃在運行中。先 docker start 它，或 docker ps -a 確認狀態。'; }
      if (res.pingFail) {
        return 'ping 不到！這兩個貨櫃不在同一條自訂內線上——預設 bridge 的總機沒有通訊錄（DNS），' +
          '撥名字沒人幫你轉接。拉一條自訂 network 把它們都接上吧。';
      }
      return null;
    }

    function shellExec(input) {
      var argv = tokenize(input);
      var parsed = { cmd: 'shell', argv: argv, container: st.shell };
      if (!argv.length) { return okRes(parsed, []); }
      if (argv[0] === 'exit') {
        var name = st.shell;
        st.shell = null;
        engine.emit('shell:exit', { name: name });
        return okRes({ cmd: 'shell-exit', container: name }, lines(['(已離開貨櫃，回到港口終端機)'], 'dim'));
      }
      if (argv[0] === 'pwd') { return okRes(parsed, lines(['/app'], 'out')); }
      if (argv[0] === 'help') {
        return okRes(parsed, lines(['容器內可用：ls、cat <檔名>、pwd、exit'], 'dim'));
      }
      var res = engine.execCmd(st.shell, argv);
      parsed.result = res;
      if (!res.ok) {
        return errRes(parsed, res.error,
          res.error.indexOf('not found in $PATH') >= 0
            ? '這個貨櫃裡是精簡系統，只有最基本的工具：ls、cat、pwd、exit。' : null);
      }
      return okRes(parsed, lines(res.output || [], 'out'), { execResult: res });
    }

    // ---------- volume / network ----------
    function cmdVolume(args) {
      if (args[0] === 'create' && args[1]) {
        var res = engine.volumeCreate(args[1]);
        return okRes({ cmd: 'volume-create', name: args[1] }, lines([args[1]], 'out'), { volume: res });
      }
      if (args[0] === 'ls') {
        var head = pad('DRIVER', 10) + 'VOLUME NAME';
        var body = engine.state.volumes.map(function (v) { return pad(v.driver, 10) + v.name; });
        return okRes({ cmd: 'volume-ls' }, lines([head].concat(body), 'table'));
      }
      return errRes({ cmd: 'volume' },
        'Usage:  docker volume COMMAND\n\nCommands:\n  create      Create a volume\n  ls          List volumes',
        'volume 底下要接子指令：docker volume create <名字> 或 docker volume ls。');
    }

    function cmdNetwork(args) {
      if (args[0] === 'create' && args[1]) {
        var res = engine.networkCreate(args[1]);
        if (!res.ok) { return errRes({ cmd: 'network-create', name: args[1] }, res.error, '這條內線已經存在了，直接用它就行。'); }
        // 印出剛建立的 network 完整 ID（ls 會顯示它的前 12 碼，兩者一致）
        return okRes({ cmd: 'network-create', name: args[1] }, lines([res.network.id], 'out'), { network: res.network });
      }
      if (args[0] === 'ls') {
        var head = pad('NETWORK ID', 15) + pad('NAME', 16) + pad('DRIVER', 10) + 'SCOPE';
        var body = engine.state.networks.map(function (n) {
          return pad(n.id ? n.id.slice(0, 12) : hex(12), 15) + pad(n.name, 16) + pad(n.driver, 10) + 'local';
        });
        return okRes({ cmd: 'network-ls' }, lines([head].concat(body), 'table'));
      }
      return errRes({ cmd: 'network' },
        'Usage:  docker network COMMAND\n\nCommands:\n  create      Create a network\n  ls          List networks',
        'network 底下要接子指令：docker network create <名字> 或 docker network ls。');
    }

    // ---------- build / compose（由關卡注入 context） ----------
    function cmdBuild(args) {
      var ti = Math.max(args.indexOf('-t'), args.indexOf('--tag'));
      var tag = ti >= 0 ? args[ti + 1] : null;
      var hasDot = args.indexOf('.') >= 0;
      if (!st.buildCtx) {
        return errRes({ cmd: 'build' },
          'ERROR: unable to prepare context: path "." not found',
          '這裡還沒有 Dockerfile 可以建造——先在藍圖設計台把指令卡排好。');
      }
      if (!tag || !hasDot) {
        return errRes({ cmd: 'build' },
          'ERROR: docker buildx build requires exactly 1 argument (the build context)\nUsage:  docker build -t NAME .',
          '建造指令的完整格式：docker build -t <藍圖名> .（最後那個點是建置目錄，別漏了）。');
      }
      var res = engine.build(tag, st.buildCtx.steps, st.buildCtx.fileVersions);
      var n = res.steps.length;
      var script = [{ t: 'line', text: '[+] Building (' + n + '/' + n + ') FINISHED', cls: 'out' }];
      res.steps.forEach(function (s, i) {
        var label = ' => ' + (s.cached ? 'CACHED ' : '') + '[' + (i + 1) + '/' + n + '] ' + s.step.text;
        script.push({ t: 'line', text: label, cls: s.cached ? 'cache' : 'build' });
      });
      script.push({ t: 'line', text: ' => exporting to image', cls: 'build' });
      script.push({ t: 'line', text: ' => => naming to docker.io/library/' + tag, cls: 'build' });
      return okRes({ cmd: 'build', tag: tag, cachedCount: res.steps.filter(function (s) { return s.cached; }).length },
        script, { buildResult: res });
    }

    function cmdCompose(args) {
      var isUp = args[0] === 'up';
      if (!st.composeProject) {
        return errRes({ cmd: 'compose' },
          'no configuration file provided: not found',
          '還沒有總調度令（docker-compose.yml）——先在調度台把它組出來。');
      }
      if (!isUp) {
        return errRes({ cmd: 'compose' }, 'unknown docker command: "compose ' + (args[0] || '') + '"',
          '這一戰用 docker compose up -d 出航。');
      }
      if (args.indexOf('-d') < 0) {
        // 真實 compose up 不加 -d 會 attach 全部服務日誌並卡住終端機——教學上要求用 -d
        return okRes({ cmd: 'compose-up', detach: false }, lines([
          '沒加 -d：docker compose up 會 attach 到所有服務、把日誌灌進終端機並卡住（要 Ctrl-C 才停）。',
          '要讓整組服務在背景長駐，改用：docker compose up -d'
        ], 'dim'));
      }
      var res = engine.composeUp(st.composeProject);
      if (!res.ok) { return errRes({ cmd: 'compose-up' }, res.error); }
      var cr = res.created;
      var total = cr.networks.length + cr.volumes.length + cr.containers.length;
      var script = [{ t: 'line', text: '[+] Running ' + total + '/' + total, cls: 'out' }];
      cr.networks.forEach(function (nm) { script.push({ t: 'line', text: ' ✔ Network ' + pad(nm, 22) + ' Created', cls: 'ok' }); });
      cr.volumes.forEach(function (v) { script.push({ t: 'line', text: ' ✔ Volume ' + pad('"' + v + '"', 23) + ' Created', cls: 'ok' }); });
      cr.containers.forEach(function (c) { script.push({ t: 'line', text: ' ✔ Container ' + pad(c.name, 19) + ' Started', cls: 'ok' }); });
      return okRes({ cmd: 'compose-up', detach: true }, script, { composeResult: res });
    }

    // ---------- help / 未知指令 ----------
    function cmdHelp() {
      var learned = CONFIG.COMMAND_DEX.filter(function (e) { return e.level <= st.learnedLevel; });
      var script = [{ t: 'line', text: '── 目前學會的指令 ──', cls: 'dim' }];
      learned.forEach(function (e) {
        script.push({ t: 'line', text: '  ' + pad(e.cmd, 38) + e.zh, cls: 'help' });
      });
      script.push({ t: 'line', text: '  ' + pad('clear', 38) + '清空終端機', cls: 'help' });
      return okRes({ cmd: 'help' }, script);
    }

    var DOCKER_SUBS = { run: cmdRun, ps: cmdPs, images: cmdImages, pull: cmdPull, logs: cmdLogs,
      exec: cmdExec, volume: cmdVolume, network: cmdNetwork, build: cmdBuild, compose: cmdCompose };

    function dockerDispatch(sub, rest) {
      if (sub === 'stop' || sub === 'start' || sub === 'rm') { return cmdLifecycle(sub, rest); }
      if (DOCKER_SUBS[sub]) { return DOCKER_SUBS[sub](rest); }
      if (sub === '--help' || sub === 'help' || !sub) { return cmdHelp(); }
      var near = nearestSub(sub);
      return errRes({ cmd: 'unknown-sub', sub: sub },
        'docker: \'' + sub + '\' is not a docker command.\nSee \'docker --help\'',
        near ? ('拼字差一點——你是不是想打 docker ' + near + '？') : '這個子指令本港還不認得，輸入 help 看看學過哪些。');
    }

    function nearestSub(sub) {
      var known = ['run', 'ps', 'pull', 'push', 'images', 'stop', 'start', 'rm', 'logs',
        'exec', 'volume', 'network', 'build', 'compose'];
      for (var i = 0; i < known.length; i++) {
        if (levenshtein(sub, known[i]) <= 2) { return known[i]; }
      }
      return null;
    }

    function levenshtein(a, b) {
      var m = [];
      for (var i = 0; i <= b.length; i++) { m[i] = [i]; }
      for (var j = 0; j <= a.length; j++) { m[0][j] = j; }
      for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
          m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1,
            m[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1));
        }
      }
      return m[b.length][a.length];
    }

    // ---------- 入口 ----------
    function exec(input) {
      input = String(input || '').trim();
      if (st.shell) { return shellExec(input); }
      if (!input) { return okRes({ cmd: 'noop' }, []); }
      var chain = splitChain(input);
      if (chain) { return runChain(chain); }   // a && b、a ; b 串接
      return execOne(input);
    }

    function execOne(input) {
      var argv = tokenize(input);
      var head = argv[0];
      if (head === 'clear') { return okRes({ cmd: 'clear' }, [], { clear: true }); }
      if (head === 'help') { return cmdHelp(); }
      if (head === 'docker') { return dockerDispatch(argv[1], argv.slice(2)); }
      var tip = levenshtein(head, 'docker') <= 2
        ? '手滑了——是 docker 才對。'
        : '本港的終端機聽得懂 docker 指令、help 和 clear。';
      return errRes({ cmd: 'not-found', head: head }, 'sh: ' + head + ': command not found', tip);
    }

    // 支援用 && 或 ; 串接多個指令（&& 遇錯即停、; 一律續跑，比照真實 shell）
    function splitChain(input) {
      var re = /\s*(&&|;)\s*/g;
      var parts = [], seps = [], last = 0, m;
      while ((m = re.exec(input))) {
        parts.push(input.slice(last, m.index).trim());
        seps.push(m[1]);
        last = m.index + m[0].length;
      }
      if (!parts.length) { return null; }        // 沒有分隔符 → 單一指令
      parts.push(input.slice(last).trim());
      return { parts: parts, seps: seps };
    }

    function runChain(chain) {
      var parts = chain.parts, seps = chain.seps;
      var script = [], events = [], tip = null, last = null;
      for (var i = 0; i < parts.length; i++) {
        if (!parts[i]) { continue; }
        var r = exec(parts[i]);                  // 遞迴：單一指令或進入 shell 都會被正確處理
        last = r;
        if (r.script) { script = script.concat(r.script); }
        if (r.events) { events = events.concat(r.events); }
        if (r.tip && !tip) { tip = r.tip; }
        if (!r.ok && seps[i] === '&&') { break; } // && 短路：前一個失敗就停
      }
      if (!last) { return okRes({ cmd: 'noop' }, []); }
      var merged = {};
      Object.keys(last).forEach(function (k) { merged[k] = last[k]; });
      merged.script = script;
      merged.events = events;
      merged.tip = tip;
      merged.chained = true;
      return merged;
    }

    function getPrompt() {
      if (st.shell) {
        var c = engine.findContainer(st.shell);
        return { text: 'root@' + (c ? c.id.slice(0, 12) : 'container') + ':/app# ', shell: true };
      }
      return { text: CONFIG.TERMINAL.promptUser + '@' + CONFIG.TERMINAL.promptHost + ':~$ ', shell: false };
    }

    return {
      exec: exec,
      getPrompt: getPrompt,
      inShell: function () { return !!st.shell; },
      setLearnedLevel: function (lv) { st.learnedLevel = Math.max(st.learnedLevel, lv); },
      setBuildContext: function (ctx) { st.buildCtx = ctx; },
      setComposeProject: function (p) { st.composeProject = p; },
      resetSession: function () { st.shell = null; st.buildCtx = null; st.composeProject = null; }
    };
  }

  return { createCLI: createCLI };
}));
