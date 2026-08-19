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

  // 汇总板块：17 个行业的图标元数据（静态 UI，内容来自 data/hub/<日期>.json）
  var HUBMETA = {
    wine:    { char: '酒', color: '#8b1e2d', name: '酒' },
    tea:     { char: '茶', color: '#4f7a3a', name: '茶' },
    travel:  { char: '旅', color: '#0e7490', name: '旅行' },
    game:    { char: '游', color: '#6d28d9', name: '游戏' },
    music:   { char: '音', color: '#be185d', name: '音乐' },
    movie:   { char: '影', color: '#7c2d12', name: '电影' },
    stock:   { char: '股', color: '#15803d', name: '股票' },
    bike:    { char: '机', color: '#b45309', name: '机车' },
    fashion: { char: '尚', color: '#db2777', name: '时尚穿搭' },
    food:    { char: '食', color: '#d97706', name: '美食' },
    tech:    { char: '科', color: '#2563eb', name: '科技' },
    craft:   { char: '创', color: '#7c3aed', name: '文创' },
    wellness:{ char: '养', color: '#0d9488', name: '养生' },
    book:    { char: '书', color: '#a16207', name: '读书' },
    home:    { char: '居', color: '#65a30d', name: '家居' },
    auto:    { char: '车', color: '#1d4ed8', name: '汽车' },
    biz:     { char: '财', color: '#b91c1c', name: '财经' }
  };
  var HUB_ORDER = ['wine','tea','travel','game','music','movie','stock','bike','fashion','food','tech','craft','wellness','book','home','auto','biz'];

  var cfg = null;
  var catMap = {};
  var currentCat = null;
  var currentDate = null;
  var currentHubDate = null;
  var currentDailyDate = null;
  var currentDetail = { title: '', body: '' };

  // 平台模块全局
  var PLAT = null;
  var currentPlatDate = null;
  var platLevel = 0;
  var platPlatform = null;
  var platReadFilter = false;

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

    // 追加「日常」板块（活人感灵感板，风趣幽默，由 AI 策展）
    var dc = document.createElement('div');
    dc.className = 'station-card daily-tile';
    dc.innerHTML =
      '<div class="station-photo-wrap hub-tile-wrap">' + dailyGlyphSVG() + '</div>' +
      '<div class="station-label">日常</div>' +
      '<div class="station-hint">每日生活灵感 →</div>';
    dc.addEventListener('click', openDaily);
    grid.appendChild(dc);

    // 追加「法规」板块（每日知识：每本"书"从第一页往后翻，纯静态零成本）
    var lc = document.createElement('div');
    lc.className = 'station-card law-tile';
    lc.innerHTML =
      '<div class="station-photo-wrap hub-tile-wrap">' + lawGlyphSVG() + '</div>' +
      '<div class="station-label">法规</div>' +
      '<div class="station-hint">每日法规知识 →</div>';
    lc.addEventListener('click', openLaw);
    grid.appendChild(lc);

    // 追加「平台」板块（每日各平台选题方向 + 已读）
    if (PLAT) {
      var pc = document.createElement('div');
      pc.className = 'station-card plat-tile';
      pc.innerHTML =
        '<div class="station-photo-wrap plat-tile-wrap">' + platGlyphSVG() + '</div>' +
        '<div class="station-label">' + esc(PLAT.label || '平台') + '</div>' +
        '<div class="station-hint">每日选题 →</div>';
      pc.addEventListener('click', openPlatform);
      grid.appendChild(pc);
    }
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
    fetchJSON(DATA + 'hub/dates.json').then(function (dates) {
      var date = (dates && dates.length) ? dates[dates.length - 1] : todayStr();
      loadHub(date);
    });
  }
  function hubMarkKey(itemId, date) { return 'hubmark::' + itemId + '::' + date; }
  function loadHub(date) {
    currentHubDate = date;
    $('#hubDate').textContent = dateLabel(date).slice(0, 10) + ' ▾';
    var grid = $('#hubGrid');
    grid.innerHTML = '<div class="hub-loading">加载中…</div>';
    fetchJSON(DATA + 'hub/' + date + '.json').then(function (data) {
      if (!data || !Array.isArray(data.items) || !data.items.length) {
        grid.innerHTML = '<div class="hub-loading">该日汇总生成中…（每日 09:30 由 AI 抓取真实资讯刷新）</div>';
        return;
      }
      grid.innerHTML = '';
      data.items.forEach(function (it) {
        var m = HUBMETA[it.id] || { char: (it.label || '?').charAt(0), color: '#64748b', name: it.label || it.id };
        var body = it.news || '暂无内容';
        var key = hubMarkKey(it.id, date);
        var mark = {};
        try { mark = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) {}
        var card = document.createElement('div');
        card.className = 'content-card hub-card' + (mark.hl ? ' hl' : '');
        card.innerHTML =
          '<div class="content-title"><span class="hub-badge" style="background:' + m.color + '">' + esc(m.char) + '</span>' + esc(m.name) + ' · 行业热点</div>' +
          '<div class="content-body hub-body">' + esc(body) + '</div>' +
          '<div class="law-marks">' +
            '<button class="mark-btn' + (mark.read ? ' active' : '') + '" data-k="read">✓ 已读</button>' +
            '<button class="mark-btn' + (mark.fav ? ' active' : '') + '" data-k="fav">★ 收藏</button>' +
            '<button class="mark-btn' + (mark.hl ? ' active' : '') + '" data-k="hl">▏ 划线</button>' +
          '</div>';
        card.querySelector('.hub-body').addEventListener('click', function () {
          openDetail(m.name + ' · 今日热点', body);
        });
        card.querySelectorAll('.mark-btn').forEach(function (btn) {
          btn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var k = btn.getAttribute('data-k');
            mark[k] = !mark[k];
            try { localStorage.setItem(key, JSON.stringify(mark)); } catch (e) {}
            btn.classList.toggle('active', mark[k]);
            if (k === 'hl') card.classList.toggle('hl', mark.hl);
            toast(k === 'fav' ? (mark.fav ? '已收藏' : '已取消收藏') :
                  (k === 'read' ? (mark.read ? '标记已读' : '取消已读') :
                  (mark.hl ? '已划线' : '取消划线')));
          });
        });
        grid.appendChild(card);
      });
    });
  }
  function closeHub() {
    var b = $('#hubBoard');
    b.classList.remove('open');
    b.setAttribute('aria-hidden', 'true');
  }
  // ---------- 日常板块（活人感灵感板：风趣幽默，由 AI 策展，不教拍摄）----------
  function dailyGlyphSVG() {
    return '<svg viewBox="0 0 48 48" width="46" height="46" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="24" cy="24" r="9"/>' +
      '<path d="M24 6v5M24 37v5M6 24h5M37 24h5M11 11l3.5 3.5M33.5 33.5L37 37M37 11l-3.5 3.5M14.5 33.5L11 37"/>' +
      '<circle cx="21" cy="22" r="1.1" fill="#f59e0b" stroke="none"/><circle cx="27" cy="22" r="1.1" fill="#f59e0b" stroke="none"/>' +
      '<path d="M20.5 27q3.5 3 7 0"/></svg>';
  }
  function openDaily() {
    var b = $('#dailyBoard');
    $('#dailyTitle').textContent = '日常';
    b.classList.add('open');
    b.setAttribute('aria-hidden', 'false');
    b.scrollTop = 0;
    var c = $('#dailyContent');
    c.innerHTML = '<div class="content-card"><div class="content-title">加载中…</div></div>';
    fetchJSON(DATA + 'daily/dates.json').then(function (dates) {
      var date = (dates && dates.length) ? dates[dates.length - 1] : todayStr();
      loadDaily(date);
    });
  }
  function loadDaily(date) {
    currentDailyDate = date;
    $('#dailyDate').textContent = dateLabel(date).slice(0, 10) + ' ▾';
    var c = $('#dailyContent');
    c.innerHTML = '<div class="content-card"><div class="content-title">加载中…</div></div>';
    fetchJSON(DATA + 'daily/' + date + '.json').then(function (data) {
      var cells = (data && data.cells) ? data.cells : [];
      c.innerHTML = '';
      if (!cells.length) {
        c.innerHTML = '<div class="content-card"><div class="content-body">今日灵感生成中…（每日由 AI 策展刷新）</div></div>';
        return;
      }
      cells.forEach(function (cell) {
        var title = cell.title || cell.id || '灵感';
        var body = cell.body || '今日内容生成中…';
        var card = document.createElement('div');
        card.className = 'content-card';
        card.innerHTML = '<div class="content-title">' + esc(title) + '</div><div class="content-body">' + esc(body) + '</div>';
        card.addEventListener('click', function () { openDetail(title, body); });
        c.appendChild(card);
      });
    });
  }
  function closeDaily() {
    var b = $('#dailyBoard');
    b.classList.remove('open');
    b.setAttribute('aria-hidden', 'true');
  }
  function openDailyDatePicker() {
    fetchJSON(DATA + 'daily/dates.json').then(function (dates) {
      var list = $('#dateList');
      if (!dates || !dates.length) {
        list.innerHTML = '<div class="date-chip">暂无历史，部署后每日自动生成</div>';
      } else {
        list.innerHTML = '';
        dates.forEach(function (dt) {
          var ch = document.createElement('div');
          ch.className = 'date-chip' + (dt === currentDailyDate ? ' active' : '');
          ch.textContent = dateLabel(dt) + (dt === todayStr() ? '（今天）' : '');
          ch.addEventListener('click', function () { hideDateSheet(); loadDaily(dt); });
          list.appendChild(ch);
        });
      }
      var s = $('#dateSheet');
      s.classList.add('show');
      s.setAttribute('aria-hidden', 'false');
    });
  }
  // 汇总日期选择：复用全局 #dateSheet / #dateList 弹层
  function openHubDatePicker() {
    fetchJSON(DATA + 'hub/dates.json').then(function (dates) {
      var list = $('#dateList');
      if (!dates || !dates.length) {
        list.innerHTML = '<div class="date-chip">暂无历史，部署后每日自动生成</div>';
      } else {
        list.innerHTML = '';
        dates.forEach(function (dt) {
          var c = document.createElement('div');
          c.className = 'date-chip' + (dt === currentHubDate ? ' active' : '');
          c.textContent = dateLabel(dt) + (dt === todayStr() ? '（今天）' : '');
          c.addEventListener('click', function () {
            hideDateSheet();
            loadHub(dt);
          });
          list.appendChild(c);
        });
      }
      var s = $('#dateSheet');
      s.classList.add('show');
      s.setAttribute('aria-hidden', 'false');
    });
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

  // ---------- 法规板块（每日知识：每本"书"从第一页往后翻，纯静态零成本）----------
  var LAW_PATH = './data/law/books.json';
  var booksCache = null;
  var currentLawDate = null;
  function lawGlyphSVG() {
    return '<svg viewBox="0 0 48 48" width="46" height="46" fill="none" stroke="#3a6b5e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M24 8v32"/><path d="M14 14h20"/><path d="M14 14l-7 9h14z"/><path d="M34 14l-7 9h14z"/><path d="M16 40h16"/>' +
      '<circle cx="24" cy="8" r="2.2" fill="#3a6b5e" stroke="none"/></svg>';
  }
  function loadBooks() {
    if (booksCache) return Promise.resolve(booksCache);
    return fetchJSON(LAW_PATH).then(function (b) {
      booksCache = (b && b.topics) ? b : { startDate: todayStr(), topics: [] };
      return booksCache;
    });
  }
  function daysSince(start, dateStr) {
    var s = new Date(start + 'T00:00:00');
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(s) || isNaN(d)) return 0;
    return Math.floor((d - s) / 86400000);
  }
  function lawMarkKey(topicId, date) { return 'lawmark::' + topicId + '::' + date; }
  function openLaw() {
    var b = $('#lawBoard');
    $('#lawTitle').textContent = '每日法规';
    b.classList.add('open'); b.setAttribute('aria-hidden', 'false'); b.scrollTop = 0;
    loadLaw(todayStr());
  }
  function closeLaw() {
    var b = $('#lawBoard');
    b.classList.remove('open'); b.setAttribute('aria-hidden', 'true');
  }
  function loadLaw(date) {
    currentLawDate = date;
    $('#lawDate').textContent = dateLabel(date).slice(0, 10) + ' ▾';
    var cont = $('#lawContent');
    cont.innerHTML = '<div class="content-card"><div class="content-title">加载中…</div></div>';
    loadBooks().then(function (books) {
      var topics = books.topics || [];
      var idx = daysSince(books.startDate || date, date);
      cont.innerHTML = '';
      if (!topics.length) {
        cont.innerHTML = '<div class="content-card"><div class="content-body">知识库尚未生成，请稍后刷新</div></div>';
        return;
      }
      topics.forEach(function (t) {
        var pts = t.points || [];
        if (!pts.length) {
          var e = document.createElement('div'); e.className = 'content-card';
          e.innerHTML = '<div class="content-title">' + esc(t.name || t.id) + '</div><div class="content-body">该领域内容生成中…</div>';
          cont.appendChild(e); return;
        }
        var i = ((idx % pts.length) + pts.length) % pts.length;
        var p = pts[i];
        var key = lawMarkKey(t.id, date);
        var mark = {};
        try { mark = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) {}
        var body = p.body || p.title || '';
        var card = document.createElement('div');
        card.className = 'content-card law-card' + (mark.hl ? ' hl' : '');
        card.innerHTML =
          '<div class="content-title">' + esc(t.name || t.id) + ' <span class="law-page">第 ' + (i + 1) + ' / ' + pts.length + ' 条</span></div>' +
          '<div class="content-body law-body">' + esc(body) + '</div>' +
          '<div class="law-marks">' +
            '<button class="mark-btn' + (mark.read ? ' active' : '') + '" data-k="read">✓ 已读</button>' +
            '<button class="mark-btn' + (mark.fav ? ' active' : '') + '" data-k="fav">★ 收藏</button>' +
            '<button class="mark-btn' + (mark.hl ? ' active' : '') + '" data-k="hl">▏ 划线</button>' +
          '</div>';
        card.querySelector('.law-body').addEventListener('click', function () {
          openDetail((t.name || t.id) + ' · 第 ' + (i + 1) + ' 条', body);
        });
        card.querySelectorAll('.mark-btn').forEach(function (btn) {
          btn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var k = btn.getAttribute('data-k');
            mark[k] = !mark[k];
            try { localStorage.setItem(key, JSON.stringify(mark)); } catch (e) {}
            btn.classList.toggle('active', mark[k]);
            if (k === 'hl') card.classList.toggle('hl', mark.hl);
            toast(k === 'fav' ? (mark.fav ? '已收藏' : '已取消收藏') :
                  (k === 'read' ? (mark.read ? '标记已读' : '取消已读') :
                  (mark.hl ? '已划线' : '取消划线')));
          });
        });
        cont.appendChild(card);
      });
    });
  }
  function shiftDate(dateStr, delta) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    var m = ('0' + (d.getMonth() + 1)).slice(-2), day = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function openLawDatePicker() {
    var input = $('#lawDateInput');
    if (input) input.value = currentLawDate || todayStr();
    var list = $('#lawDateList');
    if (list) {
      list.innerHTML = '';
      [['今天', 0], ['昨天', -1], ['一周前', -7], ['一月前', -30]].forEach(function (p) {
        var dt = shiftDate(currentLawDate || todayStr(), p[1]);
        var c = document.createElement('div');
        c.className = 'date-chip' + (dt === currentLawDate ? ' active' : '');
        c.textContent = dateLabel(dt) + (dt === todayStr() ? '（今天）' : '');
        c.addEventListener('click', function () { hideLawDateSheet(); loadLaw(dt); });
        list.appendChild(c);
      });
    }
    var s = $('#lawDateSheet');
    if (s) { s.classList.add('show'); s.setAttribute('aria-hidden', 'false'); }
  }
  function hideLawDateSheet() {
    var s = $('#lawDateSheet');
    if (s) { s.classList.remove('show'); s.setAttribute('aria-hidden', 'true'); }
  }

  // ---------- 平台模块（每日各平台选题方向 + 已读）----------
  function platGlyphSVG() {
    return '<svg viewBox="0 0 48 48" width="46" height="46" fill="none" stroke="#3a6b5e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="8" y="11" width="32" height="22" rx="4"/><path d="M8 19h32"/>' +
      '<circle cx="15" cy="15" r="1.3" fill="#3a6b5e" stroke="none"/><circle cx="21" cy="15" r="1.3" fill="#3a6b5e" stroke="none"/><circle cx="27" cy="15" r="1.3" fill="#3a6b5e" stroke="none"/><circle cx="33" cy="15" r="1.3" fill="#3a6b5e" stroke="none"/>' +
      '<path d="M15 36h18"/></svg>';
  }
  function platReadKey(date, pid, cid) { return 'pread::' + date + '|' + pid + '|' + cid; }
  function prIs(date, pid, cid) {
    try { return !!localStorage.getItem(platReadKey(date, pid, cid)); } catch (e) { return false; }
  }
  function prSet(date, pid, cid, v) {
    try { if (v) localStorage.setItem(platReadKey(date, pid, cid), '1'); else localStorage.removeItem(platReadKey(date, pid, cid)); } catch (e) {}
  }
  function platReadMap() {
    var m = {};
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('pread::') === 0) m[k] = 1; } } catch (e) {}
    return m;
  }
  function fetchPlatform(date) { return fetchJSON(DATA + 'platform/' + date + '.json'); }
  function fetchPlatformDates() { return fetchJSON(DATA + 'platform/dates.json').then(function (a) { return Array.isArray(a) ? a : []; }); }
  function CATLABEL(cid) {
    var m = { bracelet: '手串', incense: '香道', burner: '香炉', statue: '造像', agarwood: '沉香', inlay: '百宝嵌', teaware: '茶空间', gift: '高端礼品' };
    return m[cid] || cid;
  }
  function openPlatform() {
    if (!PLAT) return;
    fetchPlatformDates().then(function (dates) {
      var date = (dates && dates.length) ? dates[dates.length - 1] : todayStr();
      currentPlatDate = date;
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
    fetchPlatform(currentPlatDate).then(function (doc) {
      var reads = platReadMap();
      var nCat = (PLAT.categories || []).length;
      var totalAll = (PLAT.platforms || []).length * nCat;
      var total = 0;
      content.innerHTML = '';
      (PLAT.platforms || []).forEach(function (p) {
        var prefix = currentPlatDate + '|' + p.id + '|';
        var cnt = 0;
        (PLAT.categories || []).forEach(function (cid) { if (reads[prefix + cid]) cnt++; });
        total += cnt;
        if (platReadFilter && cnt >= nCat) return;
        var pct = nCat ? Math.round(cnt / nCat * 100) : 0;
        var card = document.createElement('div');
        card.className = 'station-card plat-platform-card';
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
        '<div class="pp-bar"><div class="pp-bar-fill" style="width:' + tpct + '%"></div></div>' +
        '<div class="plat-filter"><button id="platFilterBtn" class="' + (platReadFilter ? 'active' : '') + '">' + (platReadFilter ? '显示全部' : '只看未读') + '</button></div>';
      content.insertBefore(h, content.firstChild);
      if (totalAll && total >= totalAll) {
        var done = document.createElement('div');
        done.className = 'plat-all-done';
        done.textContent = '今日已全部读完 ✓';
        content.insertBefore(done, content.firstChild);
      }
      var fb = $('#platFilterBtn');
      if (fb) fb.addEventListener('click', function (e) { e.stopPropagation(); platReadFilter = !platReadFilter; renderPlatformSelector(); });
    });
  }
  function openPlatformCategories(pid) {
    platLevel = 2; platPlatform = pid;
    var p = null;
    (PLAT.platforms || []).forEach(function (x) { if (x.id === pid) p = x; });
    $('#cvTitle').textContent = (p ? p.name : pid) + ' · 选题';
    $('#cvDate').textContent = dateLabel(currentPlatDate).slice(0, 10) + ' ▾';
    var cv = $('#cv');
    cv.classList.add('open'); cv.setAttribute('aria-hidden', 'false'); cv.scrollTop = 0;
    var content = $('#cvContent');
    content.innerHTML = '<div class="content-card"><div class="content-title">加载中…</div></div>';
    fetchPlatform(currentPlatDate).then(function (doc) {
      var cats = (doc && doc.platforms && doc.platforms[pid] && doc.platforms[pid].categories) || {};
      var reads = platReadMap();
      var nCat = (PLAT.categories || []).length;
      var cnt = 0; var unread = [];
      (PLAT.categories || []).forEach(function (cid) { if (reads[currentPlatDate + '|' + pid + '|' + cid]) cnt++; else unread.push(cid); });
      content.innerHTML = '';
      var info = document.createElement('div');
      info.className = 'plat-cat-stat';
      info.innerHTML = '已读 <b>' + cnt + ' / ' + nCat + '</b>' +
        (unread.length ? ' · 未读：' + unread.map(function (c) { return esc(CATLABEL(c)); }).join('、') : '（全部读完）');
      content.appendChild(info);
      (PLAT.categories || []).forEach(function (cid) {
        var it = cats[cid] || {};
        var isR = !!reads[currentPlatDate + '|' + pid + '|' + cid];
        var card = document.createElement('div');
        card.className = 'station-card plat-cat-card' + (isR ? ' read' : '');
        card.innerHTML =
          '<div class="pp-row"><div class="pp-name">' + esc(CATLABEL(cid)) + '</div>' +
          (isR ? '<div class="pp-count">✓ 已读</div>' : '<div class="pp-count unread">未读</div>') + '</div>';
        card.addEventListener('click', function () { openPlatformTopic(pid, cid, it); });
        content.appendChild(card);
      });
    });
  }
  function openPlatformTopic(pid, cid, item) {
    var title = item.title || '选题';
    var body = item.body || '';
    var hook = item.hook || '';
    var photo = item.photo || '';
    var interact = item.interact || '';
    currentDetail = { title: title, body: [title, body, hook, photo, interact].join('\n') };
    $('#detailTitle').textContent = title;
    var segs = '';
    if (body) segs += '<div class="pt-seg"><div class="pt-seg-h">正文文案</div><div class="pt-seg-b">' + esc(body) + '</div></div>';
    if (hook) segs += '<div class="pt-seg"><div class="pt-seg-h">开头钩子</div><div class="pt-seg-b">' + esc(hook) + '</div></div>';
    if (photo) segs += '<div class="pt-seg"><div class="pt-seg-h">配图建议</div><div class="pt-seg-b">' + esc(photo) + '</div></div>';
    if (interact) segs += '<div class="pt-seg"><div class="pt-seg-h">互动引导</div><div class="pt-seg-b">' + esc(interact) + '</div></div>';
    $('#detailBody').innerHTML = segs || '（今日尚未生成）';
    var rb = $('#detailRead');
    if (rb) {
      rb.style.display = '';
      var isRead = prIs(currentPlatDate, pid, cid);
      rb.textContent = isRead ? '✓ 已读' : '标记已读';
      rb.classList.toggle('active', isRead);
      rb.onclick = function () {
        var now = !prIs(currentPlatDate, pid, cid);
        prSet(currentPlatDate, pid, cid, now);
        rb.textContent = now ? '✓ 已读' : '标记已读';
        rb.classList.toggle('active', now);
        if (platLevel === 2) openPlatformCategories(platPlatform);
        toast(now ? '标记已读' : '取消已读');
      };
    }
    var m = $('#detailModal');
    m.classList.add('show'); m.setAttribute('aria-hidden', 'false');
    var mk = $('#detailMask'); mk.classList.add('show'); mk.setAttribute('aria-hidden', 'false');
    $('#detailBody').scrollTop = 0;
  }
  function openPlatformDatePicker() {
    fetchPlatformDates().then(function (dates) {
      var list = $('#dateList');
      if (!dates.length) { list.innerHTML = '<div class="date-chip">暂无历史，部署后每日自动生成</div>'; }
      else {
        list.innerHTML = '';
        dates.forEach(function (dt) {
          var c = document.createElement('div');
          c.className = 'date-chip' + (dt === currentPlatDate ? ' active' : '');
          c.textContent = dateLabel(dt) + (dt === todayStr() ? '（今天）' : '');
          c.addEventListener('click', function () { hideDateSheet(); currentPlatDate = dt; if (platLevel === 2) openPlatformCategories(platPlatform); else renderPlatformSelector(); });
          list.appendChild(c);
        });
      }
      var s = $('#dateSheet'); s.classList.add('show'); s.setAttribute('aria-hidden', 'false');
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
        if (platLevel === 2) { renderPlatformSelector(); }
        else if (platLevel === 1) { platLevel = 0; closeCategory(); }
        else closeCategory();
      });
      $('#cvDate').addEventListener('click', function () {
        if (platLevel >= 1) openPlatformDatePicker(); else openDatePicker();
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
      $('#hubBack').addEventListener('click', closeHub);
      $('#hubDate').addEventListener('click', openHubDatePicker);
      $('#dailyBack').addEventListener('click', closeDaily);
      $('#dailyDate').addEventListener('click', openDailyDatePicker);
      $('#imgUpload').addEventListener('click', function () { toast('在聊天框发图给我，我帮你存进共享图库'); });

      $('#lawBack').addEventListener('click', closeLaw);
      $('#lawDate').addEventListener('click', openLawDatePicker);
      $('#lawDateClose').addEventListener('click', hideLawDateSheet);
      var lawInput = $('#lawDateInput');
      if (lawInput) lawInput.addEventListener('change', function () {
        var v = lawInput.value;
        if (v) { hideLawDateSheet(); loadLaw(v); }
      });
    })
    .catch(function (e) {
      $('#scene').innerHTML = '<div class="station-grid"><div class="station-card"><div class="station-label">配置加载失败：' + esc(e.message) + '</div></div></div>';
    });
})();