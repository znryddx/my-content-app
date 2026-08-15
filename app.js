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

  // 汇总板块：15 个行业的图标元数据（静态 UI，内容来自 data/hub/<日期>.json）
  var HUBMETA = {
    wine:   { char: '酒', color: '#8b1e2d', name: '酒' },
    tea:    { char: '茶', color: '#4f7a3a', name: '茶' },
    cig:    { char: '烟', color: '#6b7280', name: '香烟' },
    fish:   { char: '钓', color: '#2a6f97', name: '钓鱼' },
    bike:   { char: '机', color: '#b45309', name: '机车' },
    bill:   { char: '台', color: '#1f7a4d', name: '台球' },
    food:   { char: '食', color: '#d97706', name: '美食' },
    travel: { char: '旅', color: '#0e7490', name: '旅行' },
    cook:   { char: '烹', color: '#c2410c', name: '烹饪' },
    game:   { char: '游', color: '#6d28d9', name: '游戏' },
    music:  { char: '音', color: '#be185d', name: '音乐' },
    movie:  { char: '影', color: '#7c2d12', name: '电影' },
    fashion:{ char: '尚', color: '#db2777', name: '时尚' },
    wear:   { char: '穿', color: '#0891b2', name: '穿搭' },
    stock:  { char: '股', color: '#15803d', name: '股票' }
  };
  var HUB_ORDER = ['wine','tea','cig','fish','bike','bill','food','travel','cook','game','music','movie','fashion','wear','stock'];

  var cfg = null;
  var catMap = {};
  var currentCat = null;
  var currentDate = null;
  var currentDetail = { title: '', body: '' };

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
      '<div class="station-hint">器物图库 →</div>';
    ic.addEventListener('click', openImages);
    grid.appendChild(ic);

    // 追加「汇总」板块（手机桌面图标布局，每日各行业资讯）
    var hc = document.createElement('div');
    hc.className = 'station-card hub-tile';
    hc.innerHTML =
      '<div class="station-photo-wrap hub-tile-wrap">' + hubGlyphSVG() + '</div>' +
      '<div class="station-label">汇总</div>' +
      '<div class="station-hint">每日各行业资讯 →</div>';
    hc.addEventListener('click', openHub);
    grid.appendChild(hc);
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

  // ---------- 图片板块（共享图库，由 AI 推送进仓库）----------
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

  // ---------- 汇总板块（手机桌面图标布局，每日各行业真实资讯）----------
  function hubGlyphSVG() {
    return '<svg viewBox="0 0 48 48" width="46" height="46" fill="none" stroke="#9aa3b2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="9" y="9" width="13" height="13" rx="3"/><rect x="26" y="9" width="13" height="13" rx="3"/>' +
      '<rect x="9" y="26" width="13" height="13" rx="3"/><rect x="26" y="26" width="13" height="13" rx="3"/></svg>';
  }
  function openHub() {
    var b = $('#hubBoard');
    $('#hubTitle').textContent = '汇总';
    b.classList.add('open');
    b.setAttribute('aria-hidden', 'false');
    b.scrollTop = 0;
    var grid = $('#hubGrid');
    grid.innerHTML = '<div class="hub-loading">加载中…</div>';
    fetchJSON(DATA + 'hub/' + todayStr() + '.json').then(function (data) {
      if (!data || !Array.isArray(data.items) || !data.items.length) {
        grid.innerHTML = '<div class="hub-loading">今日汇总生成中…（每日 09:30 由 AI 抓取真实资讯刷新）</div>';
        return;
      }
      grid.innerHTML = '';
      data.items.forEach(function (it) {
        var m = HUBMETA[it.id] || { char: (it.label || '?').charAt(0), color: '#64748b', name: it.label || it.id };
        var tile = document.createElement('div');
        tile.className = 'hub-icon';
        tile.innerHTML = '<div class="hub-icon-tile" style="background:' + m.color + '">' + esc(m.char) + '</div>' +
          '<div class="hub-icon-label">' + esc(m.name) + '</div>';
        tile.addEventListener('click', function () {
          openDetail(m.name + ' · 今日热点', it.news || '暂无内容');
        });
        grid.appendChild(tile);
      });
    });
  }
  function closeHub() {
    var b = $('#hubBoard');
    b.classList.remove('open');
    b.setAttribute('aria-hidden', 'true');
  }
  // 图库数据来自仓库 manifest.json（AI 推送的图片都在这里，全端共享可见）
  function loadGallery() {
    fetch('./assets/uploads/manifest.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; })
      .then(function (list) {
        list = Array.isArray(list) ? list : [];
        list.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
        renderGallery(list);
      });
  }
  function renderGallery(list) {
    var grid = $('#imgGrid');
    if (!list || !list.length) {
      grid.innerHTML = '<div class="img-empty">图库还是空的<br><span>想加图？直接在聊天框发图给我，我帮你存进这个共享图库，刷新后这里就会出现。本机浏览器无法直连 GitHub，自助上传走不通——经我最稳。</span></div>';
      return;
    }
    grid.innerHTML = '';
    list.forEach(function (it) {
      var cell = document.createElement('div');
      cell.className = 'img-cell';
      cell.innerHTML = '<img class="img-thumb" src="' + esc(it.url) + '" alt="' + esc(it.name) + '" loading="lazy">' +
        '<div class="img-name">' + esc(it.name) + '</div>';
      cell.addEventListener('click', function () { window.open(it.url, '_blank'); });
      grid.appendChild(cell);
    });
  }
  // ---------- IndexedDB 本地存储（无需后端）----------
  var IDB_NAME = 'marvis_uploads', IDB_STORE = 'imgs';
  function idbOpen() {
    return new Promise(function (res, rej) {
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(IDB_STORE, { keyPath: 'id' }); };
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error); };
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

  // ---------- 启动 ----------
  fetch('./config.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (c) {
      cfg = c;
      (cfg.categories || []).forEach(function (cat) { catMap[cat.id] = cat; });
      if (cfg.app_title) {
        document.title = cfg.app_title;
        var tt = $('#topbarTitle');
        if (tt) tt.textContent = cfg.app_title;
      }
      renderHome();

      $('#cvBack').addEventListener('click', closeCategory);
      $('#cvDate').addEventListener('click', openDatePicker);
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
      $('#hubBack').addEventListener('click', closeHub);
      $('#imgUpload').addEventListener('click', function () { toast('在聊天框发图给我，我帮你存进共享图库'); });
    })
    .catch(function (e) {
      $('#scene').innerHTML = '<div class="station-grid"><div class="station-card"><div class="station-label">配置加载失败：' + esc(e.message) + '</div></div></div>';
    });
})();