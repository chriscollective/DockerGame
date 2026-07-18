/*
 * engine.js — 模擬 Docker 引擎（純狀態機，不碰 DOM；UMD）
 * 管理 images / containers / volumes / networks，發事件給 UI 訂閱。
 * 錯誤訊息比照真實 Docker daemon 的措辭。
 */
(function (root, factory) {
  var CONFIG = (typeof module !== 'undefined' && module.exports)
    ? require('./config.js')
    : root.DG.CONFIG;
  var mod = factory(CONFIG);
  if (typeof module !== 'undefined' && module.exports) { module.exports = mod; }
  root.DG = root.DG || {};
  root.DG.createEngine = mod.createEngine;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (CONFIG) {
  'use strict';

  var HEX = '0123456789abcdef';

  function randHex(n) {
    var s = '';
    for (var i = 0; i < n; i++) { s += HEX[Math.floor(Math.random() * 16)]; }
    return s;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function parseRef(ref) {
    // 'nginx:1.27' -> {repo:'nginx', tag:'1.27'}；無 tag 補 latest
    var idx = ref.lastIndexOf(':');
    if (idx > 0 && ref.indexOf('/') < idx) {
      return { repo: ref.slice(0, idx), tag: ref.slice(idx + 1) };
    }
    return { repo: ref, tag: 'latest' };
  }

  function createEngine() {
    var state = {
      images: [],       // {repo, tag, id, size, layers:[{id,size}], created}
      containers: [],   // 見 makeContainer
      volumes: [],      // {name, driver, data:{cargo:[]}}
      networks: [],     // {name, driver, builtin}
      buildCache: {},   // layerKey -> true
      usedNames: {}
    };
    var listeners = {};
    var pending = [];   // 本次指令累積的事件（給 UI/關卡檢查）

    function on(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    }

    function emit(type, payload) {
      var evt = { type: type, data: payload || {} };
      pending.push(evt);
      (listeners[type] || []).forEach(function (fn) { fn(evt.data); });
      (listeners['*'] || []).forEach(function (fn) { fn(evt); });
    }

    function takeEvents() {
      var out = pending.slice();
      pending = [];
      return out;
    }

    function reset() {
      state.images = [];
      state.containers = [];
      state.volumes = [];
      state.networks = [
        { name: 'bridge', driver: 'bridge', builtin: true },
        { name: 'host', driver: 'host', builtin: true },
        { name: 'none', driver: 'null', builtin: true }
      ];
      state.buildCache = {};
      state.usedNames = {};
      pending = [];
      emit('reset', {});
    }
    reset();

    // ---------- 查找 ----------
    function findImage(ref) {
      var r = parseRef(ref);
      for (var i = 0; i < state.images.length; i++) {
        var im = state.images[i];
        if ((im.repo === r.repo && im.tag === r.tag) || im.id.indexOf(ref) === 0) {
          return im;
        }
      }
      return null;
    }

    function findContainer(ref) {
      for (var i = 0; i < state.containers.length; i++) {
        var c = state.containers[i];
        if (c.name === ref || c.id.indexOf(ref) === 0) { return c; }
      }
      return null;
    }

    function findVolume(name) {
      for (var i = 0; i < state.volumes.length; i++) {
        if (state.volumes[i].name === name) { return state.volumes[i]; }
      }
      return null;
    }

    function findNetwork(name) {
      for (var i = 0; i < state.networks.length; i++) {
        if (state.networks[i].name === name) { return state.networks[i]; }
      }
      return null;
    }

    function randomName() {
      for (var t = 0; t < 50; t++) {
        var n = pick(CONFIG.NAME_ADJ) + '_' + pick(CONFIG.NAME_SUR);
        if (!state.usedNames[n]) { return n; }
      }
      return 'sailor_' + randHex(4);
    }

    // ---------- pull ----------
    function pull(ref) {
      var r = parseRef(ref);
      var cat = CONFIG.REGISTRY[r.repo];
      if (!cat || cat.tags.indexOf(r.tag) < 0) {
        return { ok: false, notFound: true,
          error: 'Error response from daemon: pull access denied for ' + r.repo +
            ', repository does not exist or may require \'docker login\'' };
      }
      var existing = findImage(r.repo + ':' + r.tag);
      if (existing) {
        emit('pull:cached', { repo: r.repo, tag: r.tag });
        return { ok: true, image: existing, alreadyExists: true };
      }
      var layers = cat.layerSizes.map(function (sz) {
        return { id: randHex(12), size: sz };
      });
      var img = {
        repo: r.repo, tag: r.tag, id: randHex(12), size: cat.size,
        sizeNum: cat.sizeNum, layers: layers, created: Date.now(), builtLocal: false
      };
      state.images.push(img);
      emit('pull:done', { image: img });
      return { ok: true, image: img, alreadyExists: false, layers: layers };
    }

    // ---------- run ----------
    function makeContainer(img, opts, cat) {
      var c = {
        id: randHex(64),
        name: opts.name || randomName(),
        image: img.repo + (img.tag === 'latest' ? '' : ':' + img.tag),
        imageRef: img.repo + ':' + img.tag,
        command: (cat && cat.command) || img.cmd || 'sh',
        status: 'running',
        exitCode: null,
        ports: opts.ports || [],       // [{host, cont}]
        mounts: opts.mounts || [],     // [{volume, dest}]
        env: opts.env || {},
        network: opts.network || 'bridge',
        created: Date.now(),
        logs: [],
        files: {},
        ephemeral: { cargo: [] }
      };
      var files = (cat && cat.files) || {};
      Object.keys(files).forEach(function (k) { c.files[k] = files[k]; });
      return c;
    }

    function checkRunConflicts(opts) {
      if (opts.name) {
        var dup = findContainer(opts.name);
        if (dup && dup.name === opts.name) {
          return 'docker: Error response from daemon: Conflict. The container name "/' +
            opts.name + '" is already in use by container "' + dup.id +
            '". You have to remove (or rename) that container to be able to reuse that name.';
        }
      }
      var ports = opts.ports || [];
      for (var i = 0; i < ports.length; i++) {
        var host = ports[i].host;
        var clash = state.containers.some(function (c) {
          return c.status === 'running' && c.ports.some(function (p) { return p.host === host; });
        });
        if (clash) {
          return 'docker: Error response from daemon: driver failed programming external ' +
            'connectivity on endpoint: Bind for 0.0.0.0:' + host +
            ' failed: port is already allocated.';
        }
      }
      if (opts.network && opts.network !== 'bridge' && !findNetwork(opts.network)) {
        return 'docker: Error response from daemon: network ' + opts.network + ' not found.';
      }
      return null;
    }

    function run(opts) {
      // opts: {image, name, detach, ports, env, mounts:[{volume,dest}], network}
      var r = parseRef(opts.image);
      var cat = CONFIG.REGISTRY[r.repo];
      var pulled = null;
      var img = findImage(r.repo + ':' + r.tag);
      if (!img) {
        var pr = pull(opts.image);
        if (!pr.ok) {
          return { ok: false, imageMissing: true,
            error: 'Unable to find image \'' + r.repo + ':' + r.tag + '\' locally\n' +
              'docker: Error response from daemon: pull access denied for ' + r.repo +
              ', repository does not exist or may require \'docker login\'.\n' +
              'See \'docker run --help\'.' };
        }
        img = pr.image;
        pulled = pr;
      }
      var conflict = checkRunConflicts(opts);
      if (conflict) { return { ok: false, error: conflict, conflict: true }; }

      (opts.mounts || []).forEach(function (m) {   // -v 的具名 volume 不存在就自動建立（真實行為）
        if (!findVolume(m.volume)) { volumeCreate(m.volume, true); }
      });
      var c = makeContainer(img, opts, cat);
      state.usedNames[c.name] = true;
      state.containers.push(c);
      writeStartupLogs(c, cat);
      emit('container:create', { container: c, pulled: !!pulled });
      if (cat && cat.kind === 'oneshot') {
        c.status = 'exited';
        c.exitCode = 0;
        emit('container:die', { container: c });
      } else {
        emit('container:start', { container: c });
      }
      return { ok: true, container: c, pulled: pulled, oneshot: !!(cat && cat.kind === 'oneshot') };
    }

    function writeStartupLogs(c, cat) {
      var repo = parseRef(c.imageRef).repo;
      if (repo === 'whale-app') {
        if (c.env.MODE) {
          c.logs.push('[notify] boot ok', '[notify] MODE=' + c.env.MODE,
            '[notify] listening on :3000 — all lights green');
        } else {
          c.logs.push('[notify] boot...',
            '[notify] ERROR: environment variable MODE is not set',
            '[notify] hint: MODE comes from an env var (-e MODE=...), not from a file — config.txt explains',
            '[notify] service degraded — notifications are NOT being sent');
        }
      } else if (repo === 'harbor-db') {
        c.logs.push('harbor-db: ready to accept cargo on /data');
      } else if (repo === 'nginx') {
        c.logs.push('/docker-entrypoint.sh: Configuration complete; ready for start up',
          '2026/07/17 00:00:01 [notice] 1#1: start worker processes');
      } else if (repo === 'webapp') {
        c.logs.push('[webapp] up — waiting for db at db:5432 (tcp)');
      } else if (cat && cat.kind === 'oneshot') {
        c.logs.push('(hello-world output)');
      }
    }

    // ---------- 生命週期 ----------
    function stop(ref) {
      var c = findContainer(ref);
      if (!c) { return { ok: false, error: 'Error response from daemon: No such container: ' + ref }; }
      if (c.status !== 'running') { return { ok: true, container: c, already: true }; }
      c.status = 'exited';
      c.exitCode = 0;
      emit('container:stop', { container: c });
      return { ok: true, container: c };
    }

    function start(ref) {
      var c = findContainer(ref);
      if (!c) { return { ok: false, error: 'Error response from daemon: No such container: ' + ref }; }
      if (c.status === 'running') { return { ok: true, container: c, already: true }; }
      for (var i = 0; i < c.ports.length; i++) {
        var host = c.ports[i].host;
        var clash = state.containers.some(function (o) {
          return o !== c && o.status === 'running' &&
            o.ports.some(function (p) { return p.host === host; });
        });
        if (clash) {
          return { ok: false, error: 'Error response from daemon: driver failed programming ' +
            'external connectivity: Bind for 0.0.0.0:' + host + ' failed: port is already allocated.' };
        }
      }
      c.status = 'running';
      c.exitCode = null;
      emit('container:start', { container: c });
      return { ok: true, container: c };
    }

    function rm(ref, force) {
      var c = findContainer(ref);
      if (!c) { return { ok: false, error: 'Error response from daemon: No such container: ' + ref }; }
      if (c.status === 'running' && !force) {
        return { ok: false, running: true,
          error: 'Error response from daemon: cannot remove container "/' + c.name +
            '": container is running: stop the container before removing or force remove' };
      }
      if (c.status === 'running') {
        c.status = 'exited';
        c.exitCode = 137;
        emit('container:stop', { container: c, killed: true });
      }
      state.containers = state.containers.filter(function (o) { return o !== c; });
      delete state.usedNames[c.name];
      emit('container:remove', { container: c });
      return { ok: true, container: c };
    }

    // ---------- exec ----------
    function execCmd(ref, argv) {
      var c = findContainer(ref);
      if (!c) { return { ok: false, error: 'Error response from daemon: No such container: ' + ref }; }
      if (c.status !== 'running') {
        return { ok: false, notRunning: true,
          error: 'Error response from daemon: container ' + c.id.slice(0, 12) + ' is not running' };
      }
      var cmd = argv[0];
      if (cmd === 'ping') { return execPing(c, argv[1]); }
      if (cmd === 'store') { return execStore(c, argv.slice(1).join(' ')); }
      if (cmd === 'list') { return execList(c); }
      if (cmd === 'ls') { return { ok: true, output: Object.keys(c.files).sort() }; }
      if (cmd === 'cat') {
        var f = argv[1] || '';
        if (c.files[f] === undefined) {
          return { ok: false, error: 'cat: ' + (f || '(無檔名)') + ': No such file or directory' };
        }
        return { ok: true, output: c.files[f].split('\n'), file: f };
      }
      return { ok: false,
        error: 'OCI runtime exec failed: exec failed: unable to start container process: ' +
          'exec: "' + cmd + '": executable file not found in $PATH: unknown' };
    }

    function execPing(c, target) {
      if (!target) { return { ok: false, error: 'ping: usage error: Destination address required' }; }
      var t = findContainer(target);
      var reachable = !!(t && t.status === 'running' &&
        c.network === t.network && c.network !== 'bridge');
      emit('ping', { from: c.name, to: target, ok: reachable, network: c.network });
      if (!reachable) {
        return { ok: false, pingFail: true, error: 'ping: bad address \'' + target + '\'' };
      }
      var ip = '172.20.0.' + (2 + state.containers.indexOf(t));
      return { ok: true, ping: true, output: [
        'PING ' + target + ' (' + ip + '): 56 data bytes',
        '64 bytes from ' + ip + ': seq=0 ttl=64 time=0.084 ms',
        '64 bytes from ' + ip + ': seq=1 ttl=64 time=0.071 ms',
        '--- ' + target + ' ping statistics ---',
        '2 packets transmitted, 2 packets received, 0% packet loss'
      ] };
    }

    function cargoStore(c) {
      // 有掛 volume 就寫 volume（持久），否則寫容器內（暫時）
      var m = c.mounts[0];
      if (m) {
        var v = findVolume(m.volume);
        if (v) { return { list: v.data.cargo, persistent: true, volume: v.name }; }
      }
      return { list: c.ephemeral.cargo, persistent: false };
    }

    function execStore(c, item) {
      if (!item) { return { ok: false, error: 'store: missing cargo name' }; }
      var s = cargoStore(c);
      s.list.push(item);
      emit('cargo:store', { container: c, item: item, persistent: s.persistent, volume: s.volume });
      return { ok: true, stored: item, persistent: s.persistent,
        output: ['stored "' + item + '" -> /data/cargo.db' +
          (s.persistent ? '  (volume: ' + s.volume + ')' : '')] };
    }

    function execList(c) {
      var s = cargoStore(c);
      emit('cargo:list', { container: c, count: s.list.length, persistent: s.persistent });
      if (!s.list.length) { return { ok: true, empty: true, output: ['(empty) — /data/cargo.db has no records'] }; }
      return { ok: true, items: s.list.slice(),
        output: s.list.map(function (it, i) { return (i + 1) + '. ' + it; }) };
    }

    // ---------- volume / network ----------
    function volumeCreate(name, implicit) {
      if (findVolume(name)) { return { ok: true, name: name, existed: true }; }
      var v = { name: name, driver: 'local', data: { cargo: [] }, created: Date.now() };
      state.volumes.push(v);
      emit('volume:create', { volume: v, implicit: !!implicit });
      return { ok: true, name: name, volume: v };
    }

    function networkCreate(name) {
      if (findNetwork(name)) {
        return { ok: false, error: 'Error response from daemon: network with name ' + name + ' already exists' };
      }
      var n = { name: name, driver: 'bridge', builtin: false, id: randHex(64) };
      state.networks.push(n);
      emit('network:create', { network: n });
      return { ok: true, network: n };
    }

    // ---------- build ----------
    function build(tag, steps, fileVersions) {
      // steps: [{inst:'FROM'|'COPY'|..., text, file?}]；fileVersions: {'server.js': 2}
      var keyAcc = '';
      var results = [];
      steps.forEach(function (s) {
        var ver = (s.file && fileVersions && fileVersions[s.file]) || 0;
        keyAcc += '|' + s.text + '@' + ver;
        var cached = !!state.buildCache[keyAcc];
        state.buildCache[keyAcc] = true;
        results.push({ step: s, cached: cached, layerId: randHex(12) });
      });
      var r = parseRef(tag);
      var old = findImage(r.repo + ':' + r.tag);
      if (old) { state.images = state.images.filter(function (i) { return i !== old; }); }
      var img = { repo: r.repo, tag: r.tag, id: randHex(12), size: '156MB', sizeNum: 156000000,
        layers: results.map(function (x) { return { id: x.layerId, size: '' }; }),
        created: Date.now(), builtLocal: true };
      state.images.push(img);
      emit('build:done', { image: img, steps: results });
      return { ok: true, image: img, steps: results };
    }

    // ---------- compose ----------
    function composeUp(project) {
      // project: {name, services:[{name,image,ports,volume,network,dependsOn}], networks:[], volumes:[]}
      var created = { networks: [], volumes: [], containers: [] };
      (project.networks || []).forEach(function (n) {
        var full = project.name + '_' + n;
        if (!findNetwork(full)) { networkCreate(full); created.networks.push(full); }
      });
      (project.volumes || []).forEach(function (v) {
        var full = project.name + '_' + v;
        if (!findVolume(full)) { volumeCreate(full); created.volumes.push(full); }
      });
      var svcs = sortByDeps(project.services || []);
      for (var i = 0; i < svcs.length; i++) {
        var s = svcs[i];
        var res = run({
          image: s.image, name: project.name + '-' + s.name + '-1', detach: true,
          ports: s.ports || [],
          mounts: (s.volume ? [{ volume: project.name + '_' + s.volume.name, dest: s.volume.dest }] : []),
          network: s.network ? project.name + '_' + s.network : 'bridge',
          env: s.env || {}
        });
        if (!res.ok) { return { ok: false, error: res.error, created: created }; }
        created.containers.push(res.container);
      }
      emit('compose:up', { project: project.name, created: created });
      return { ok: true, created: created };
    }

    function sortByDeps(services) {
      var out = [];
      var done = {};
      function visit(s) {
        if (done[s.name]) { return; }
        (s.dependsOn || []).forEach(function (d) {
          var dep = services.filter(function (x) { return x.name === d; })[0];
          if (dep) { visit(dep); }
        });
        done[s.name] = true;
        out.push(s);
      }
      services.forEach(visit);
      return out;
    }

    return {
      state: state,
      on: on,
      emit: emit,
      takeEvents: takeEvents,
      reset: reset,
      parseRef: parseRef,
      findImage: findImage,
      findContainer: findContainer,
      findVolume: findVolume,
      findNetwork: findNetwork,
      pull: pull,
      run: run,
      stop: stop,
      start: start,
      rm: rm,
      execCmd: execCmd,
      volumeCreate: volumeCreate,
      networkCreate: networkCreate,
      build: build,
      composeUp: composeUp
    };
  }

  return { createEngine: createEngine };
}));
