// Constellation — force-directed topic map on canvas.
// Edges are HYBRID: shared tags (primary) + same domain (secondary) + optional
// per-topic `related: ['domain/topic', ...]` override in the registry.
var Constellation = (function () {
  var _container, _canvas, _ctx, _raf = null, _running = false;
  var _nodes = [], _edges = [], _adj = {};
  var _width = 0, _height = 0, _dpr = 1;
  var _hover = null, _selected = null;
  var _filterCert = 'all';     // 'all' | cert id | track id
  var _query = '';             // highlight query (name/tag substring)
  var _drag = null;
  var _view = { x: 0, y: 0, scale: 1 };
  var _pan = null;
  var _alpha = 1;              // simulation cooling
  var _mouseUpHandler = null;  // tracked for cleanup

  // Deterministic color per domain id
  function _domainColor(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return 'hsl(' + h + ', 65%, 55%)';
  }

  function _buildGraph() {
    var reg = window.K8S_REGISTRY;
    _nodes = []; _edges = []; _adj = {};
    var byPath = {};

    reg.domains.forEach(function (d) {
      (d.topics || []).forEach(function (t) {
        var node = {
          id: t.path,
          name: t.name,
          domainId: d.id,
          domainName: d.name,
          icon: d.icon,
          type: d.type || 'cert',
          cert: Array.isArray(d.cert) ? d.cert : (d.cert ? [d.cert] : []),
          track: Array.isArray(d.track) ? d.track : (d.track ? [d.track] : []),
          tags: t.tags || [],
          related: t.related || [],
          color: _domainColor(d.id),
          x: 0, y: 0, vx: 0, vy: 0
        };
        _nodes.push(node);
        byPath[t.path] = node;
        _adj[t.path] = {};
      });
    });

    // Initial positions — spread on a circle with jitter
    _nodes.forEach(function (n, i) {
      var ang = (i / _nodes.length) * Math.PI * 2;
      var r = 200 + Math.random() * 120;
      n.x = Math.cos(ang) * r;
      n.y = Math.sin(ang) * r;
    });

    function addEdge(a, b, w) {
      if (a === b) return;
      var key = a < b ? a + '|' + b : b + '|' + a;
      if (_adj[a][b]) { // strengthen existing
        _adj[a][b].w = Math.max(_adj[a][b].w, w);
        return;
      }
      var e = { a: a, b: b, w: w };
      _edges.push(e);
      _adj[a][b] = e; _adj[b][a] = e;
    }

    // Primary: shared tags
    for (var i = 0; i < _nodes.length; i++) {
      for (var j = i + 1; j < _nodes.length; j++) {
        var A = _nodes[i], B = _nodes[j];
        var shared = 0;
        for (var k = 0; k < A.tags.length; k++) {
          if (B.tags.indexOf(A.tags[k]) !== -1) shared++;
        }
        if (shared > 0) addEdge(A.id, B.id, shared + 1);
      }
    }

    // Secondary: same domain (keeps clusters cohesive even without shared tags)
    var byDomain = {};
    _nodes.forEach(function (n) {
      (byDomain[n.domainId] = byDomain[n.domainId] || []).push(n.id);
    });
    Object.keys(byDomain).forEach(function (dom) {
      var list = byDomain[dom];
      for (var a = 0; a < list.length; a++) {
        for (var b = a + 1; b < list.length; b++) addEdge(list[a], list[b], 1);
      }
    });

    // Override/boost: explicit related links
    _nodes.forEach(function (n) {
      n.related.forEach(function (rel) {
        if (byPath[rel]) addEdge(n.id, rel, 4);
      });
    });

    _alpha = 1;
  }

  function _matchesFilter(n) {
    if (_filterCert === 'all') return true;
    return n.cert.indexOf(_filterCert) !== -1 || n.track.indexOf(_filterCert) !== -1;
  }

  function _matchesQuery(n) {
    if (!_query) return false;
    var q = _query.toLowerCase();
    if (n.name.toLowerCase().indexOf(q) !== -1) return true;
    if (n.domainName.toLowerCase().indexOf(q) !== -1) return true;
    return n.tags.some(function (t) { return t.toLowerCase().indexOf(q) !== -1; });
  }

  // Is node n in the highlighted set? (selected/hover neighborhood OR query match)
  function _highlightInfo() {
    var focus = _selected || _hover;
    var set = null;
    if (focus) {
      set = {};
      set[focus.id] = 'focus';
      var nb = _adj[focus.id] || {};
      Object.keys(nb).forEach(function (id) { set[id] = 'neighbor'; });
    }
    return set;
  }

  // ── Physics ──
  function _tick() {
    if (_alpha < 0.05) _alpha = 0.05; // keep a little life for dragging
    var REP = 5500, SPRING = 0.012, GRAV = 0.04, DAMP = 0.85, LEN = 78;

    for (var i = 0; i < _nodes.length; i++) {
      var A = _nodes[i];
      if (!_matchesFilter(A)) continue;
      for (var j = i + 1; j < _nodes.length; j++) {
        var B = _nodes[j];
        if (!_matchesFilter(B)) continue;
        var dx = A.x - B.x, dy = A.y - B.y;
        var d2 = dx * dx + dy * dy || 0.01;
        var d = Math.sqrt(d2);
        var f = REP / d2;
        var fx = (dx / d) * f, fy = (dy / d) * f;
        A.vx += fx * _alpha; A.vy += fy * _alpha;
        B.vx -= fx * _alpha; B.vy -= fy * _alpha;
      }
      // gravity to center
      A.vx -= A.x * GRAV * _alpha;
      A.vy -= A.y * GRAV * _alpha;
    }

    _edges.forEach(function (e) {
      var A = _byId(e.a), B = _byId(e.b);
      if (!A || !B || !_matchesFilter(A) || !_matchesFilter(B)) return;
      var dx = B.x - A.x, dy = B.y - A.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      var target = LEN + 20 / e.w;
      var f = (d - target) * SPRING;
      var fx = (dx / d) * f, fy = (dy / d) * f;
      A.vx += fx * _alpha; A.vy += fy * _alpha;
      B.vx -= fx * _alpha; B.vy -= fy * _alpha;
    });

    _nodes.forEach(function (n) {
      if (_drag && _drag.node === n) return;
      n.vx *= DAMP; n.vy *= DAMP;
      n.x += n.vx; n.y += n.vy;
    });

    _alpha *= 0.995;
  }

  var _idMap = null;
  function _byId(id) {
    if (!_idMap) { _idMap = {}; _nodes.forEach(function (n) { _idMap[n.id] = n; }); }
    return _idMap[id];
  }

  // ── Rendering ──
  function _toScreen(n) {
    return {
      x: _width / 2 + _view.x + n.x * _view.scale,
      y: _height / 2 + _view.y + n.y * _view.scale
    };
  }

  function _draw() {
    _ctx.setTransform(_dpr, 0, 0, _dpr, 0, 0);
    _ctx.clearRect(0, 0, _width, _height);

    var hl = _highlightInfo();
    var hasQuery = !!_query;
    var styles = getComputedStyle(document.body);
    var dark = (styles.getPropertyValue('--text-primary').trim() || '').indexOf('255') !== -1
            || document.documentElement.getAttribute('data-theme') === 'dark'
            || document.body.classList.contains('dark');
    var baseEdge = dark ? 'rgba(150,170,210,' : 'rgba(90,110,150,';

    // Edges
    _edges.forEach(function (e) {
      var A = _byId(e.a), B = _byId(e.b);
      if (!A || !B) return;
      if (!_matchesFilter(A) || !_matchesFilter(B)) return;
      var pa = _toScreen(A), pb = _toScreen(B);
      var lit = hl && (hl[A.id] && hl[B.id]);
      _ctx.beginPath();
      _ctx.moveTo(pa.x, pa.y);
      _ctx.lineTo(pb.x, pb.y);
      if (lit) {
        _ctx.strokeStyle = 'rgba(90,140,255,0.7)';
        _ctx.lineWidth = Math.min(e.w, 4) * 0.7;
      } else {
        _ctx.strokeStyle = baseEdge + (hl ? 0.07 : 0.28) + ')';
        _ctx.lineWidth = 1;
      }
      _ctx.stroke();
    });

    // Nodes
    _nodes.forEach(function (n) {
      if (!_matchesFilter(n)) return;
      var p = _toScreen(n);
      var state = hl ? hl[n.id] : null;
      var queryHit = hasQuery && _matchesQuery(n);
      var dimmed = !queryHit && ((hl && !state) || (hasQuery && !state));
      var prog = State.getProgress(n.id);

      var r = (state === 'focus' ? 9 : 6) * (queryHit ? 1.25 : 1);
      _ctx.globalAlpha = dimmed ? 0.18 : 1;

      // glow for focus / query hit
      if (state === 'focus' || queryHit) {
        _ctx.beginPath();
        _ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
        _ctx.fillStyle = queryHit ? 'rgba(255,210,90,0.25)' : 'rgba(120,160,255,0.25)';
        _ctx.fill();
      }

      _ctx.beginPath();
      _ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      _ctx.fillStyle = n.color;
      _ctx.fill();

      // progress ring
      if (prog === 'completed') {
        _ctx.lineWidth = 2.5; _ctx.strokeStyle = '#3a9d6e'; _ctx.stroke();
      } else if (prog === 'in-progress') {
        _ctx.lineWidth = 2.5; _ctx.strokeStyle = '#d98a2b'; _ctx.stroke();
      }

      // label for focus, neighbor, query hit, or hover
      if (state || queryHit || _view.scale > 1.4) {
        _ctx.globalAlpha = dimmed ? 0.3 : 1;
        _ctx.fillStyle = styles.getPropertyValue('--text-primary').trim() || '#222';
        _ctx.font = (state === 'focus' ? '600 ' : '') + '11px system-ui, sans-serif';
        _ctx.textAlign = 'center';
        _ctx.fillText(n.name, p.x, p.y - r - 5);
      }
      _ctx.globalAlpha = 1;
    });
  }

  function _loop() {
    if (!_running) return;
    _tick();
    _draw();
    _raf = requestAnimationFrame(_loop);
  }

  // ── Hit testing ──
  function _nodeAt(sx, sy) {
    for (var i = _nodes.length - 1; i >= 0; i--) {
      var n = _nodes[i];
      if (!_matchesFilter(n)) continue;
      var p = _toScreen(n);
      var dx = sx - p.x, dy = sy - p.y;
      if (dx * dx + dy * dy <= 144) return n; // 12px radius
    }
    return null;
  }

  // ── View ──
  function render(container) {
    _container = container;
    var reg = window.K8S_REGISTRY;
    if (!reg) return;

    _buildGraph();
    _idMap = null;
    _selected = null; _hover = null; _query = ''; _filterCert = 'all';
    _view = { x: 0, y: 0, scale: 1 };

    var html = '<div class="topic-header"><h1>' + I18N.t('mapTitle') + '</h1>'
      + '<p class="map-sub">' + I18N.t('mapSubtitle') + '</p></div>';

    html += '<div class="map-toolbar">';
    html += '<input type="text" id="map-search" class="map-search" placeholder="' + I18N.t('mapSearchPlaceholder') + '" autocomplete="off">';
    html += '<select id="map-filter" class="map-filter"><option value="all">' + I18N.t('mapAllCerts') + '</option>';
    reg.certifications.forEach(function (c) {
      html += '<option value="' + c.id + '">' + c.label + '</option>';
    });
    (reg.skillTracks || []).forEach(function (tr) {
      html += '<option value="' + tr.id + '">' + tr.label + '</option>';
    });
    html += '</select>';
    html += '<button id="map-reset" class="btn btn-secondary">' + I18N.t('mapReset') + '</button>';
    html += '</div>';

    html += '<div class="map-wrap"><canvas id="map-canvas"></canvas>';
    html += '<div id="map-panel" class="map-panel hidden"></div>';
    html += '</div>';

    container.innerHTML = html;

    _canvas = document.getElementById('map-canvas');
    _ctx = _canvas.getContext('2d');
    _resize();
    window.addEventListener('resize', _resize);

    _bindEvents();
    _running = true;
    _loop();
  }

  function _resize() {
    if (!_canvas) return;
    var wrap = _canvas.parentElement;
    _dpr = window.devicePixelRatio || 1;
    _width = wrap.clientWidth;
    _height = Math.max(wrap.clientHeight, 480);
    _canvas.width = _width * _dpr;
    _canvas.height = _height * _dpr;
    _canvas.style.width = _width + 'px';
    _canvas.style.height = _height + 'px';
  }

  function _showPanel(n) {
    var panel = document.getElementById('map-panel');
    if (!panel) return;
    if (!n) { panel.classList.add('hidden'); return; }
    var prog = State.getProgress(n.id);
    var nb = Object.keys(_adj[n.id] || {});
    var html = '<button class="map-panel-close" data-action="close">&times;</button>';
    html += '<div class="map-panel-domain" style="color:' + n.color + '">' + n.icon + ' ' + n.domainName + '</div>';
    html += '<h3 class="map-panel-title">' + n.name + '</h3>';
    html += '<div class="map-panel-status badge badge-' + (prog === 'completed' ? 'done' : prog === 'in-progress' ? 'progress' : 'pending') + '">' + (I18N.t(prog) || prog) + '</div>';
    if (n.tags.length) {
      html += '<div class="map-panel-tags">';
      n.tags.forEach(function (t) { html += '<span class="map-tag" data-tag="' + t + '">' + t + '</span>'; });
      html += '</div>';
    }
    html += '<div class="map-panel-related"><strong>' + I18N.t('mapConnected') + ' (' + nb.length + ')</strong><ul>';
    nb.slice(0, 8).forEach(function (id) {
      var t = _byId(id);
      if (t) html += '<li data-goto="' + id + '">' + t.name + '</li>';
    });
    html += '</ul></div>';
    html += '<button class="btn btn-primary map-panel-open" data-goto="' + n.id + '">' + I18N.t('mapOpenTopic') + '</button>';
    panel.innerHTML = html;
    panel.classList.remove('hidden');

    panel.querySelector('[data-action="close"]').addEventListener('click', function () {
      _selected = null; _showPanel(null);
    });
    panel.querySelectorAll('[data-goto]').forEach(function (el) {
      el.addEventListener('click', function () {
        window.location.hash = '#topic/' + el.getAttribute('data-goto');
      });
    });
    panel.querySelectorAll('[data-tag]').forEach(function (el) {
      el.addEventListener('click', function () {
        var s = document.getElementById('map-search');
        s.value = el.getAttribute('data-tag');
        _query = s.value;
      });
    });
  }

  function _bindEvents() {
    var rect = function () { return _canvas.getBoundingClientRect(); };
    var _moved = false;       // pointer moved beyond threshold since mousedown
    var _downAt = null;       // {sx, sy}

    _canvas.addEventListener('mousemove', function (ev) {
      var r = rect();
      var sx = ev.clientX - r.left, sy = ev.clientY - r.top;
      if (_downAt && (Math.abs(sx - _downAt.sx) > 4 || Math.abs(sy - _downAt.sy) > 4)) _moved = true;

      if (_drag) {
        _drag.node.x = (sx - _width / 2 - _view.x) / _view.scale;
        _drag.node.y = (sy - _height / 2 - _view.y) / _view.scale;
        _drag.node.vx = 0; _drag.node.vy = 0;
        _alpha = Math.max(_alpha, 0.3);
        return;
      }
      if (_pan) {
        _view.x = _pan.vx + (sx - _pan.sx);
        _view.y = _pan.vy + (sy - _pan.sy);
        return;
      }
      var n = _nodeAt(sx, sy);
      _hover = n;
      _canvas.style.cursor = n ? 'pointer' : 'grab';
    });

    _canvas.addEventListener('mousedown', function (ev) {
      var r = rect();
      var sx = ev.clientX - r.left, sy = ev.clientY - r.top;
      _downAt = { sx: sx, sy: sy };
      _moved = false;
      var n = _nodeAt(sx, sy);
      if (n) {
        _drag = { node: n };
      } else {
        _pan = { sx: sx, sy: sy, vx: _view.x, vy: _view.y };
        _canvas.style.cursor = 'grabbing';
      }
    });

    if (_mouseUpHandler) window.removeEventListener('mouseup', _mouseUpHandler);
    _mouseUpHandler = _onMouseUp;
    window.addEventListener('mouseup', _onMouseUp);
    function _onMouseUp() {
      // A genuine click (no movement) selects the node under the press, or
      // deselects when on empty space.
      if (!_moved && _downAt) {
        var n = _drag ? _drag.node : null;
        _selected = n;
        _showPanel(n);
      }
      _drag = null; _pan = null; _downAt = null;
      if (_canvas) _canvas.style.cursor = 'grab';
    }

    _canvas.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var delta = ev.deltaY < 0 ? 1.12 : 0.89;
      var newScale = Math.min(3, Math.max(0.3, _view.scale * delta));
      _view.scale = newScale;
    }, { passive: false });

    var search = document.getElementById('map-search');
    search.addEventListener('input', function () { _query = search.value.trim(); });

    document.getElementById('map-filter').addEventListener('change', function (e) {
      _filterCert = e.target.value;
      _alpha = 0.6;
      // Drop a selection/hover that's no longer visible under the new filter
      if (_selected && !_matchesFilter(_selected)) { _selected = null; _showPanel(null); }
      _hover = null;
    });

    document.getElementById('map-reset').addEventListener('click', function () {
      _view = { x: 0, y: 0, scale: 1 };
      _selected = null; _hover = null; _query = '';
      search.value = '';
      document.getElementById('map-filter').value = 'all';
      _filterCert = 'all';
      _buildGraph(); _idMap = null;
      _showPanel(null);
    });
  }

  function destroy() {
    _running = false;
    if (_raf) cancelAnimationFrame(_raf);
    _raf = null;
    window.removeEventListener('resize', _resize);
    if (_mouseUpHandler) { window.removeEventListener('mouseup', _mouseUpHandler); _mouseUpHandler = null; }
  }

  return { render: render, destroy: destroy };
})();
