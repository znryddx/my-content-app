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
    fetch('./assets/uploads/manifest.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(renderGallery)
      .catch(function () { renderGallery([]); });
  }
  function renderGallery(list) {
    var grid = $('#imgGrid');
    if (!list || !list.length) {
      grid.innerHTML = '<div class="img-empty">还没有图片<br><span>点右上角「＋ 上传」把你的器物图传上来，方便后续各板块内容推进</span></div>';
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
    if (!ep) { toast('上传服务部署中，请稍候'); return; }
    var arr = Array.prototype.slice.call(files || []);
    if (!arr.length) return;
    var idx = 0;
    toast('上传中 1/' + arr.length);
    function next() {
      if (idx >= arr.length) { toast('上传完成 ✓'); loadGallery(); return; }
      var f = arr[idx]; idx++;
      toast('上传中 ' + idx + '/' + arr.length);
      resizeImageFile(f, 1600, 0.82).then(function (blob) {
        var fd = new FormData();
        var jpg = (f.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
        fd.append('file', blob, jpg);
        return fetch(ep, { method: 'POST', body: fd });
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.error) throw new Error(j.error);
        setTimeout(next, 250);
      }).catch(function (e) {
        toast('上传失败：' + e.message);
        setTimeout(next, 250);
      });
    }
    next();
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
      $('#imgUpload').addEventListener('click', function () { $('#imgFile').click(); });
      $('#imgFile').addEventListener('change', function (e) { uploadFiles(e.target.files); e.target.value = ''; });
    })
    .catch(function (e) {
      $('#scene').innerHTML = '<div class="station-grid"><div class="station-card"><div class="station-label">配置加载失败：' + esc(e.message) + '</div></div></div>';
    });
})();