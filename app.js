// ===== Marvis 工位风格 App =====
// 主页：等距工位网格（每品类一个工位 + 围巾色 = 品类标识）
// 品类页：内容卡片网格（6 宫格）
// 详情：全屏弹层 + 复制
(function () {
  'use strict';

  var DATA = './data/';

  // 围巾色（每个品类的标识色，对应显示器屏幕色块 + 小马围巾）
  var SCARF = {
    brief:    '#ef4444',  // 红色（每日简报，醒目）
    bracelet: '#10b981',  // 绿色（手串）
    incense:  '#3b82f6',  // 蓝色（香道）
    burner:   '#f59e0b',  // 黄色（香炉）
    statue:   '#3a6b5e',  // 墨绿（造像）
    agarwood: '#8a5a3c',  // 棕（沉香）
    inlay:    '#a855f7',  // 紫（百宝嵌）
    teaware:  '#06b6d4',  // 青（茶空间）
    gift:     '#ec4899'   // 粉（礼品）
  };

  var cfg = null;
  var catMap = {};
  var currentCat = null;
  var currentDate = null;
  var currentDetail = { title: '', body: '' };

  // 平台模块状态
  var PLAT = null;            // config.platforms_module
  var mode = 'cat';           // 'cat'（品类视图） | 'plat'（平台模块）
  var platLevel = 1;         // 1=平台选择器 2=品类列表
  var platPlatform = null;    // 当前平台 id
  var currentPlatDate = null; // 当前平台选题日期

  // ---------- 工具 ----------
  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function todayStr() {
    var d = new Date();
    var m = ('0' + (d.getMonth() + 1)).slice(-2), day = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '-' + m + '-' + day;
  }
  var WK = ['日', '一', '二', '三', '四', '五', '六'];
  function dateLabel(d) {
    var p = String(d).split('-');
    if (p.length !== 3) return d;
    var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    return d + ' 星期' + WK[dt.getDay()];
  }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(t).then(function () { toast('已复制'); }, function () { fallbackCopy(t); });
    } else { fallbackCopy(t); }
  }
  function fallbackCopy(t) {
    var ta = document.createElement('textarea');
    ta.value = t;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('请长按选择复制'); }
    document.body.removeChild(ta);
  }

  // ---------- 数据 ----------
  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  function fetchData(catId, date) { return fetchJSON(DATA + catId + '/' + date + '.json'); }
  function fetchDates(catId) { return fetchJSON(DATA + catId + '/dates.json').then(function (a) { return Array.isArray(a) ? a : []; }); }

  function cellsOf(cat) { return (cat && cat.cells) ? cat.cells : (cfg.cells || []); }
  function cellTitle(cat, meta) {
    var ov = (cat && cat.cell_titles) || {};
    if (meta.id && ov[meta.id]) return ov[meta.id];
    return meta.title || meta.id || '';
  }

  // ---------- 主页：Marvis 工位网格 ----------
  function renderHome() {
    var scene = $('#scene');
    scene.innerHTML = '<div class="station-grid" id="stationGrid"></div>';
    var grid = $('#stationGrid');

    (cfg.categories || []).forEach(function (cat, i) {
      var scarf = SCARF[cat.id] || '#3a6b5e';
      var card = document.createElement('div');
      card.className = 'station-card';
      var svg = window.OfficeArt.station({ label: cat.label, scarfColor: scarf }, i);
      var photoThumb = encodeURIComponent(cat.label) + '@thumb.webp';
      var photoWebp = encodeURIComponent(cat.label) + '.webp';
      card.innerHTML =
        '<div class="station-photo-wrap">' +
          '<img class="station-photo" src="assets/station/' + photoThumb + '" alt="' + esc(cat.label) + '"' +
          ' decoding="async"' +
          ' onload="this.nextElementSibling.style.display=\'none\';"' +
          ' onerror="if(String(this.src).indexOf(\'@thumb.webp\')>=0){this.src=this.src.replace(\'@thumb.webp\',\'.webp\');}else if(String(this.src).endsWith(\'.webp\')){this.src=this.src.replace(\'.webp\',\'.png\');}else{this.style.display=\'none\';this.nextElementSibling.style.display=\'block\';}">' +
          '<div class="station-svg" style="display:none;">' + svg + '</div>' +
        '</div>' +
        '<div class="station-label">' + esc(cat.label) + '</div>' +
        '<div class="station-hint">点击进入 →</div>';
      card.addEventListener('click', function () { openCategory(cat.id); });
      grid.appendChild(card);
    });

    // 追加「图片」板块（独立画廊，不参与每日内容生成）
    var ic = document.createElement('div');
    ic.className = 'station-card img-tile';
    ic.innerHTML =
      '<div class="station-photo-wrap img-tile-wrap">' + cameraSVG() + '</div>' +
      '<div class="station-label">图片</div>' +
      '<div class="station-hint">上传器物图 →</div>';
    ic.addEventListener('click', openImages);
    grid.appendChild(ic);

    // 平台模块入口（每日各平台选题方向 + 已读）
    if (PLAT) {
      var pc = document.createElement('div');
      pc.className = 'station-card plat-tile';
      pc.innerHTML =
        '<div class="station-photo-wrap plat-tile-wrap">' + platSVG() + '</div>' +
        '<div class="station-label">' + esc(PLAT.label) + '</div>' +
        '<div class="station-hint">每日选题 →</div>';
      pc.addEventListener('click', openPlatform);
      grid.appendChild(pc);
    }
  }

  // 平台模块图标（四宫格代表四个平台）
  function platSVG() {
    return '<svg viewBox="0 0 48 48" width="46" height="46" fill="none" stroke="#9aa3b2" stroke-width="2" stroke-linejoin="round">' +
      '<rect x="8" y="8" width="15" height="15" rx="3"/>' +
      '<rect x="25" y="8" width="15" height="15" rx="3"/>' +
      '<rect x="8" y="25" width="15" height="15" rx="3"/>' +
      '<rect x="25" y="25" width="15" height="15" rx="3"/>' +
      '<circle cx="15.5" cy="15.5" r="3.2" fill="#3a6b5e" stroke="none"/>' +
      '<circle cx="32.5" cy="15.5" r="3.2" fill="#ec4899" stroke="none"/>' +
      '<circle cx="15.5" cy="32.5" r="3.2" fill="#3b82f6" stroke="none"/>' +
      '<circle cx="32.5" cy="32.5" r="3.2" fill="#f59e0b" stroke="none"/></svg>';
  }

  // ---------- 品类页：内容卡片 ----------
  function openCategory(catId) {
    currentCat = catId;
    fetchDates(catId).then(function (dates) {
      var date = (dates && dates.length) ? dates[dates.length - 1] : todayStr();
      loadCategory(catId, date);
    });
  }

  function loadCategory(catId, date) {
    currentDate = date;
    var cat = catMap[catId];

    $('#cvTitle').textContent = cat ? cat.label : catId;
    $('#cvDate').textContent = dateLabel(date).slice(0, 10) + ' ▾';

    var cv = $('#cv');
    cv.classList.add('open');
    cv.setAttribute('aria-hidden', 'false');
    cv.scrollTop = 0;

    var content = $('#cvContent');
    content.innerHTML = '<div class="content-card"><div class="content-title">加载中…</div></div>';

    fetchData(catId, date).then(function (data) {
      var byId = {};
      if (data && data.cells) data.cells.forEach(function (c) { byId[c.id] = c; });
      var meta = cellsOf(cat);
      content.innerHTML = '';
      if (!meta.length) {
        content.innerHTML = '<div class="content-card"><div class="content-body">该品类暂无内容模块</div></div>';
        return;
      }
      meta.forEach(function (cm) {
        var display = cellTitle(cat, cm);
        var body = (byId[cm.id] && byId[cm.id].body) || '今日内容生成中…';
        var card = document.createElement('div');
        card.className = 'content-card';
        card.innerHTML = '<div class="content-title">' + esc(display) + '</div><div class="content-body">' + esc(body) + '</div>';
        card.addEventListener('click', function () { openDetail(display, body); });
        content.appendChild(card);
      });
    });
  }

  function closeCategory() {
    var cv = $('#cv');
    cv.classList.remove('open');
    cv.setAttribute('aria-hidden', 'true');
  }

  // ---------- 内容详情弹层 ----------
  function openDetail(title, body) {
    currentDetail.title = title;
    currentDetail.body = body;
    $('#detailTitle').textContent = title;
    $('#detailBody').textContent = body;
    $('#detailRead').style.display = 'none';
    var m = $('#detailModal');
    m.classList.add('show');
    m.setAttribute('aria-hidden', 'false');
    var mk = $('#detailMask');
    mk.classList.add('show');
    mk.setAttribute('aria-hidden', 'false');
    $('#detailBody').scrollTop = 0;
  }
  function closeDetail() {
    var m = $('#detailModal');
    m.classList.remove('show');
    m.setAttribute('aria-hidden', 'true');
    var mk = $('#detailMask');
    mk.classList.remove('show');
    mk.setAttribute('aria-hidden', 'true');
  }

  // ---------- 日期选择 ----------
  function openDatePicker() {
    if (!currentCat) return;
    fetchDates(currentCat).then(function (dates) {
      var list = $('#dateList');
      if (!dates.length) {
        list.innerHTML = '<div class="date-chip">暂无历史，部署后每日自动生成</div>';
      } else {
        list.innerHTML = '';
        dates.forEach(function (dt) {
          var c = document.createElement('div');
          c.className = 'date-chip' + (dt === currentDate ? ' active' : '');
          c.textContent = dateLabel(dt) + (dt === todayStr() ? '（今天）' : '');
          c.addEventListener('click', function () {
            hideDateSheet();
            loadCategory(currentCat, dt);
          });
          list.appendChild(c);
        });
      }
      var s = $('#dateSheet');
      s.classList.add('show');
      s.setAttribute('aria-hidden', 'false');
    });
  }
  function hideDateSheet() {
    var s = $('#dateSheet');
    s.classList.remove('show');
    s.setAttribute('aria-hidden', 'true');
  }

  // ---------- 图片板块（画廊 + 上传）----------
  function cameraSVG() {
    return '<svg viewBox="0 0 48 48" width="46" height="46" fill="none" stroke="#9aa3b2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="7" y="14" width="34" height="26" rx="4"/>' +
      '<path d="M17 14l2.5-4h9L31 14"/>' +
      '<circle cx="24" cy="27" r="7"/>' +
      '<path d="M24 23v8M20 27h8"/></svg>';
  }
  function openImages() {
    $('#imgTitle').textContent = '图片';
    var b = $('#imgBoard');
    b.classList.add('open');
    b.setAttribute('aria-hidden', 'false');
    b.scrollTop = 0;
    loadGallery();
  }
  function closeImages() {
    var b = $('#imgBoard');
    b.classList.remove('open');
    b.setAttribute('aria-hidden', 'true');
  }
  function loadGallery() {
    var remote = fetch('./assets/uploads/manifest.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
    var local = idbAll().catch(function () { return []; });
    Promise.all([remote, local]).then(function (pairs) {
      var rem = pairs[0] || [], loc = pairs[1] || [];
      var map = {};
      rem.forEach(function (it) { map[it.name] = it; });
      loc.forEach(function (it) { map[it.name] = it; }); // 本地优先覆盖同名
      var list = Object.keys(map).map(function (k) { return map[k]; });
      list.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      renderGallery(list);
    });
  }
  function renderGallery(list) {
    var grid = $('#imgGrid');
    if (!list || !list.length) {
      grid.innerHTML = '<div class="img-empty">还没有图片<br><span>点右上角「＋ 上传」把器物图存到这里（仅本机可看）。想让我（AI）也看到并推进各板块内容，直接在这个聊天框发图给我即可。</span></div>';
      return;
    }
    grid.innerHTML = '';
    list.forEach(function (it) {
      var cell = document.createElement('div');
      cell.className = 'img-cell';
      var del = it.local ? '<button class="img-del" title="删除">×</button>' : '';
      cell.innerHTML = '<img class="img-thumb" src="' + esc(it.url) + '" alt="' + esc(it.name) + '" loading="lazy">' + del +
        '<div class="img-name">' + esc(it.name) + (it.local ? ' · 本机' : '') + '</div>';
      cell.addEventListener('click', function () { window.open(it.url, '_blank'); });
      if (it.local) {
        cell.querySelector('.img-del').addEventListener('click', function (ev) {
          ev.stopPropagation();
          idbDel(it.id).then(function () { loadGallery(); toast('已删除'); });
        });
      }
      grid.appendChild(cell);
    });
  }
  // ---------- IndexedDB 本地存储（无需后端）----------
  var IDB_NAME = 'marvis_uploads', IDB_STORE = 'imgs', IDB_READS = 'preads';
  function idbOpen() {
    return new Promise(function (res, rej) {
      var req = indexedDB.open(IDB_NAME, 2);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(IDB_READS)) db.createObjectStore(IDB_READS, { keyPath: 'key' });
      };
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error); };
    });
  }
  // 平台选题「已读」存储：key = "<date>|<platform>|<category>"
  function prGet(key) {
    return idbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(IDB_READS, 'readonly');
        var rq = tx.objectStore(IDB_READS).get(key);
        rq.onsuccess = function () { res(rq.result || null); };
        rq.onerror = function () { rej(rq.error); };
      });
    });
  }
  function prSet(rec) {
    return idbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(IDB_READS, 'readwrite');
        tx.objectStore(IDB_READS).put(rec);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function prDel(key) {
    return idbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(IDB_READS, 'readwrite');
        tx.objectStore(IDB_READS).delete(key);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function prAll() {
    return idbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(IDB_READS, 'readonly');
        var rq = tx.objectStore(IDB_READS).getAll();
        rq.onsuccess = function () { res(rq.result || []); };
        rq.onerror = function () { rej(rq.error); };
      });
    });
  }
  function idbAll() {
    return idbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var rq = tx.objectStore(IDB_STORE).getAll();
        rq.onsuccess = function () { res(rq.result || []); };
        rq.onerror = function () { rej(rq.error); };
      });
    });
  }
  function idbPut(rec) {
    return idbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(rec);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function idbDel(id) {
    return idbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(id);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  // 前端压缩为 dataURL（最长边 1600 / JPEG 0.82），直接存 IndexedDB，刷新后仍在
  function fileToDataUrl(file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, maxDim / Math.max(w, h));
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var cvs = document.createElement('canvas');
        cvs.width = cw; cvs.height = ch;
        cvs.getContext('2d').drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        resolve(cvs.toDataURL('image/jpeg', quality));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
      img.src = url;
    });
  }
  // 前端压缩为 blob（最长边 1600 / JPEG 0.82），供 POST 到 Worker
  function resizeImageFile(file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, maxDim / Math.max(w, h));
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var cvs = document.createElement('canvas');
        cvs.width = cw; cvs.height = ch;
        cvs.getContext('2d').drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        cvs.toBlob(function (blob) { if (blob) resolve(blob); else reject(new Error('编码失败')); }, 'image/jpeg', quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
      img.src = url;
    });
  }
  function uploadFiles(files) {
    var ep = (cfg && cfg.upload_endpoint) || '';
    var arr = Array.prototype.slice.call(files || []);
    if (!arr.length) return;
    if (ep) {
      uploadToWorker(ep, arr, 0);
    } else {
      saveLocal(arr, 0);
    }
  }
  // 后端已部署：直接 POST 到 Worker，写进仓库（我和画廊都可见）
  function uploadToWorker(ep, arr, idx) {
    toast('上传中 1/' + arr.length);
    (function next() {
      if (idx >= arr.length) { toast('已上传 ✓'); loadGallery(); return; }
      var f = arr[idx]; idx++;
      toast('上传中 ' + idx + '/' + arr.length);
      resizeImageFile(f, 1600, 0.82).then(function (blob) {
        var fd = new FormData();
        var jpg = (f.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
        fd.append('file', blob, jpg);
        return fetch(ep, { method: 'POST', body: fd });
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.error) throw new Error(j.error);
        setTimeout(next, 200);
      }).catch(function (e) {
        console.error('[上传] Worker 远程上传失败：', e);
        toast('远程上传失败：' + e.message + '（已存本机，我看不到）');
        fileToDataUrl(f, 1600, 0.82).then(function (du) {
          return idbPut({ id: 'l_' + Date.now() + '_' + idx, name: f.name || ('图片' + idx), url: du, ts: Date.now(), local: true });
        }).then(function () { setTimeout(next, 200); }).catch(function () { setTimeout(next, 200); });
      });
    })();
  }
  // 后端未部署：存浏览器本机 IndexedDB（仅自己可见）
  function saveLocal(arr, idx) {
    toast('保存中 1/' + arr.length);
    (function next() {
      if (idx >= arr.length) { toast('已存到本机 ✓'); loadGallery(); return; }
      var f = arr[idx]; idx++;
      toast('保存中 ' + idx + '/' + arr.length);
      fileToDataUrl(f, 1600, 0.82).then(function (dataUrl) {
        return idbPut({ id: 'l_' + Date.now() + '_' + idx, name: f.name || ('图片' + idx), url: dataUrl, ts: Date.now(), local: true });
      }).then(function () { setTimeout(next, 120); }).catch(function (e) {
        toast('保存失败：' + e.message);
        setTimeout(next, 120);
      });
    })();
  }

  // ---------- 平台模块：每日选题方向 + 已读 ----------
  function fetchPlatform(date) { return fetchJSON(DATA + 'platform/' + date + '.json'); }
  function fetchPlatformDates() { return fetchJSON(DATA + 'platform/dates.json').then(function (a) { return Array.isArray(a) ? a : []; }); }

  function openPlatform() {
    mode = 'plat';
    fetchPlatformDates().then(function (dates) {
      currentPlatDate = dates.length ? dates[dates.length - 1] : todayStr();
      renderPlatformSelector();
    });
  }

  function renderPlatformSelector() {
    platLevel = 1; platPlatform = null;
    $('#cvTitle').textContent = (PLAT.label || '平台') + ' · 每日选题';
    $('#cvDate').textContent = dateLabel(currentPlatDate).slice(0, 10) + ' ▾';
    var cv = $('#cv');
    cv.classList.add('open'); cv.setAttribute('aria-hidden', 'false'); cv.scrollTop = 0;
    var content = $('#cvContent');
    content.innerHTML = '<div class="content-card"><div class="content-title">加载中…</div></div>';
    prAll().then(function (all) {
      var reads = {};
      (all || []).forEach(function (r) { if (r.key) reads[r.key] = 1; });
      var nCat = (PLAT.categories || []).length;
      var totalAll = (PLAT.platforms || []).length * nCat;
      var total = 0;
      content.innerHTML = '';
      (PLAT.platforms || []).forEach(function (p) {
        var prefix = currentPlatDate + '|' + p.id + '|';
        var cnt = 0;
        (PLAT.categories || []).forEach(function (cid) { if (reads[prefix + cid]) cnt++; });
        total += cnt;
        var pct = nCat ? Math.round(cnt / nCat * 100) : 0;
        var card = document.createElement('div');
        card.className = 'plat-platform-card';
        card.innerHTML =
          '<div class="pp-row"><div class="pp-name">' + esc(p.name) + '</div>' +
          '<div class="pp-count">' + cnt + '/' + nCat + ' 已读</div></div>' +
          '<div class="pp-bar"><div class="pp-bar-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="pp-go">进入 →</div>';
        card.addEventListener('click', function () { openPlatformCategories(p.id); });
        content.appendChild(card);
      });
      var tpct = totalAll ? Math.round(total / totalAll * 100) : 0;
      var h = document.createElement('div');
      h.className = 'plat-progress-head';
      h.innerHTML = '今日总进度 <b>' + total + ' / ' + totalAll + '</b> 已读' +
        '<div class="pp-bar"><div class="pp-bar-fill" style="width:' + tpct + '%"></div></div>';
      content.insertBefore(h, content.firstChild);
    });
  }

  function openPlatformCategories(pid) {
    platLevel = 2; platPlatform = pid;
    var p = null;
    (PLAT.platforms || []).forEach(function (x) { if (x.id === pid) p = x; });
    $('#cvTitle').textContent = (p ? p.name : '') + ' · 今日选题';
    var content = $('#cvContent');
    content.innerHTML = '<div class="content-card"><div class="content-title">加载中…</div></div>';
    var cv = $('#cv');
    cv.classList.add('open'); cv.setAttribute('aria-hidden', 'false'); cv.scrollTop = 0;

    prAll().then(function (all) {
      var prefix = currentPlatDate + '|' + pid + '|';
      var readMap = {};
      (all || []).forEach(function (r) { if (r.key && r.key.indexOf(prefix) === 0) readMap[r.key] = 1; });
      fetchPlatform(currentPlatDate).then(function (data) {
        var cats = (data && data.platforms && data.platforms[pid]) ? data.platforms[pid].categories : {};
        content.innerHTML = '';
        (PLAT.categories || []).forEach(function (cid) {
          var cat = catMap[cid];
          var item = cats[cid] || {};
          var title = item.title || '（今日尚未生成）';
          var key = currentPlatDate + '|' + pid + '|' + cid;
          var read = !!readMap[key];
          var card = document.createElement('div');
          card.className = 'plat-cat-card' + (read ? ' read' : '');
          card.innerHTML =
            '<div class="pc-dot' + (read ? ' on' : '') + '"></div>' +
            '<div class="pc-body"><div class="pc-label">' + esc(cat ? cat.label : cid) + '</div>' +
            '<div class="pc-title">' + esc(title) + '</div></div>' +
            (read ? '<div class="pc-readtag">已读</div>' : '');
          card.addEventListener('click', function () { openPlatformTopic(pid, cid, item); });
          content.appendChild(card);
        });
      }).catch(function () {
        content.innerHTML = '<div class="content-card"><div class="content-body">今日数据加载失败，请稍后重试</div></div>';
      });
    });
  }

  function openPlatformTopic(pid, cid, item) {
    var title = item.title || '选题';
    var segs = [];
    if (item.hook || item.photo || item.interact) {
      if (item.hook) segs.push(['开头钩子', item.hook]);
      if (item.photo) segs.push(['配图建议', item.photo]);
      if (item.interact) segs.push(['互动引导', item.interact]);
    } else {
      segs.push(['选题方向', item.body || '（今日尚未生成）']);
    }
    var fullText = title + '\n\n' + segs.map(function (s) {
      return s[0] + '：\n' + s[1];
    }).join('\n\n');
    currentDetail = { title: title, body: fullText };
    $('#detailTitle').textContent = title;
    $('#detailBody').innerHTML = segs.map(function (s) {
      return '<div class="pt-seg"><div class="pt-seg-h">' + esc(s[0]) + '</div><div class="pt-seg-b">' + esc(s[1]) + '</div></div>';
    }).join('');
    var key = currentPlatDate + '|' + pid + '|' + cid;
    var btn = $('#detailRead');
    btn.style.display = '';
    prGet(key).then(function (rec) { refreshReadBtn(btn, !!rec); });
    btn.onclick = function () {
      prGet(key).then(function (rec) {
        if (rec) { prDel(key).then(function () { refreshReadBtn(btn, false); }); }
        else { prSet({ key: key, ts: Date.now() }).then(function () { refreshReadBtn(btn, true); }); }
      });
    };
    var m = $('#detailModal');
    m.classList.add('show'); m.setAttribute('aria-hidden', 'false');
    var mk = $('#detailMask');
    mk.classList.add('show'); mk.setAttribute('aria-hidden', 'false');
    $('#detailBody').scrollTop = 0;
  }

  function refreshReadBtn(btn, done) {
    btn.textContent = done ? '已读 ✓' : '标记已读';
    btn.classList.toggle('done', done);
    if (mode === 'plat' && platLevel === 2) openPlatformCategories(platPlatform); // 刷新列表圆点
  }

  function openPlatformDatePicker() {
    fetchPlatformDates().then(function (dates) {
      prAll().then(function (all) {
        var reads = {};
        (all || []).forEach(function (r) { if (r.key) reads[r.key] = 1; });
        var nCat = (PLAT.categories || []).length;
        var totalAll = (PLAT.platforms || []).length * nCat;
        var list = $('#dateList');
        if (!dates.length) {
          list.innerHTML = '<div class="date-chip">暂无历史，部署后每日自动生成</div>';
        } else {
          list.innerHTML = '';
          dates.forEach(function (dt) {
            var cnt = 0;
            (PLAT.platforms || []).forEach(function (p) {
              (PLAT.categories || []).forEach(function (cid) { if (reads[dt + '|' + p.id + '|' + cid]) cnt++; });
            });
            var c = document.createElement('div');
            c.className = 'date-chip' + (dt === currentPlatDate ? ' active' : '');
            c.innerHTML = dateLabel(dt) + (dt === todayStr() ? '（今天）' : '') +
              ' <span class="dc-prog">' + cnt + '/' + totalAll + '</span>';
            c.addEventListener('click', function () {
              hideDateSheet();
              currentPlatDate = dt;
              if (platLevel === 2) openPlatformCategories(platPlatform);
              else renderPlatformSelector();
            });
            list.appendChild(c);
          });
        }
        var s = $('#dateSheet');
        s.classList.add('show'); s.setAttribute('aria-hidden', 'false');
      });
    });
  }

  // ---------- 启动 ----------
  fetch('./config.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (c) {
      cfg = c;
      (cfg.categories || []).forEach(function (cat) { catMap[cat.id] = cat; });
      PLAT = cfg.platforms_module || null;
      if (cfg.app_title) {
        document.title = cfg.app_title;
        var tt = $('#topbarTitle');
        if (tt) tt.textContent = cfg.app_title;
      }
      renderHome();

      $('#cvBack').addEventListener('click', function () {
        if (mode === 'plat') {
          if (platLevel === 2) { renderPlatformSelector(); }
          else { mode = 'cat'; closeCategory(); }
        } else { closeCategory(); }
      });
      $('#cvDate').addEventListener('click', function () {
        if (mode === 'plat') openPlatformDatePicker(); else openDatePicker();
      });
      $('#detailKnown').addEventListener('click', closeDetail);
      $('#detailMask').addEventListener('click', closeDetail);
      $('#detailCopy').addEventListener('click', function () {
        if (!currentDetail.body) return;
        copyText(currentDetail.body);
        var btn = $('#detailCopy');
        var old = btn.textContent;
        btn.textContent = '已复制 ✓';
        setTimeout(function () { btn.textContent = old; }, 1500);
      });
      $('#dateClose').addEventListener('click', hideDateSheet);

      $('#imgBack').addEventListener('click', closeImages);
      $('#imgUpload').addEventListener('click', function () { $('#imgFile').click(); });
      $('#imgFile').addEventListener('change', function (e) { uploadFiles(e.target.files); e.target.value = ''; });
    })
    .catch(function (e) {
      $('#scene').innerHTML = '<div class="station-grid"><div class="station-card"><div class="station-label">配置加载失败：' + esc(e.message) + '</div></div></div>';
    });
})();