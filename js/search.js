// Search — title/domain/tag matching plus optional full-text body search.
// The body index (content/search-index.js, ~1 MB) is injected lazily on first use,
// so it never weighs on initial page load and still works over file://.
var Search = (function () {
  var input, resultsEl, allTopics, byPath;
  var bodyIndex = null;        // { path: "stripped prose" }
  var bodyLower = null;        // { path: lowercased prose } (built once)
  var bodyState = 'idle';      // idle | loading | ready | missing

  var MAX_STRONG = 12;
  var MAX_BODY = 10;
  var SNIPPET_PAD = 60;

  function init() {
    input = document.getElementById('search-input');
    resultsEl = document.getElementById('search-results');
    allTopics = _buildIndex();
    byPath = {};
    allTopics.forEach(function (t) { byPath[t.id] = t; });

    input.placeholder = I18N.t('searchPlaceholder');

    input.addEventListener('input', _onInput);
    input.addEventListener('focus', function () {
      _ensureBodyIndex();
      if (input.value.trim()) _onInput();
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search-box')) {
        resultsEl.classList.add('hidden');
      }
    });
  }

  function _buildIndex() {
    var registry = window.K8S_REGISTRY;
    if (!registry) return [];

    var topics = [];
    registry.domains.forEach(function (domain) {
      domain.topics.forEach(function (topic) {
        topics.push({
          id: topic.path,
          name: topic.name,
          domain: domain.name,
          domainIcon: domain.icon,
          difficulty: topic.difficulty,
          searchText: (topic.name + ' ' + domain.name + ' ' + (topic.tags || []).join(' ')).toLowerCase()
        });
      });
    });
    return topics;
  }

  // Lazily inject the full-text index. Re-runs the current search when ready.
  function _ensureBodyIndex() {
    if (bodyState === 'ready' || bodyState === 'loading') return;
    if (window.K8S_SEARCH_INDEX) { _adoptIndex(); return; }
    bodyState = 'loading';
    var script = document.createElement('script');
    script.src = 'content/search-index.js';
    script.onload = function () {
      if (window.K8S_SEARCH_INDEX) { _adoptIndex(); }
      else { bodyState = 'missing'; }
    };
    script.onerror = function () { bodyState = 'missing'; };
    document.body.appendChild(script);
  }

  function _adoptIndex() {
    bodyIndex = window.K8S_SEARCH_INDEX;
    bodyLower = {};
    Object.keys(bodyIndex).forEach(function (k) {
      bodyLower[k] = bodyIndex[k].toLowerCase();
    });
    bodyState = 'ready';
    if (input && input.value.trim() && !resultsEl.classList.contains('hidden')) {
      _onInput();
    }
  }

  function _onInput() {
    var query = input.value.trim().toLowerCase();
    if (!query) {
      resultsEl.classList.add('hidden');
      return;
    }

    _ensureBodyIndex();

    // Strong matches: name / domain / tags
    var strong = [];
    var strongSet = {};
    for (var i = 0; i < allTopics.length && strong.length < MAX_STRONG; i++) {
      if (allTopics[i].searchText.indexOf(query) !== -1) {
        strong.push(allTopics[i]);
        strongSet[allTopics[i].id] = true;
      }
    }

    // Body matches: topics whose theory contains the query but weren't strong hits
    var body = [];
    if (bodyState === 'ready' && query.length >= 3) {
      var keys = Object.keys(bodyLower);
      for (var j = 0; j < keys.length && body.length < MAX_BODY; j++) {
        var path = keys[j];
        if (strongSet[path] || !byPath[path]) continue;
        var pos = bodyLower[path].indexOf(query);
        if (pos !== -1) {
          body.push({ meta: byPath[path], snippet: _snippet(bodyIndex[path], pos, query.length) });
        }
      }
    }

    if (!strong.length && !body.length) {
      resultsEl.innerHTML = '<div class="search-result-item">' + I18N.t('noResults') + '</div>';
      resultsEl.classList.remove('hidden');
      return;
    }

    var html = '';
    strong.forEach(function (t) {
      html += '<div class="search-result-item" data-topic="' + t.id + '">'
        + '<div>' + t.domainIcon + ' ' + _esc(t.name) + '</div>'
        + '<div class="result-domain">' + _esc(t.domain) + '</div>'
        + '</div>';
    });

    if (body.length) {
      html += '<div class="search-section-label">' + I18N.t('inContent') + '</div>';
      body.forEach(function (b) {
        html += '<div class="search-result-item" data-topic="' + b.meta.id + '">'
          + '<div>' + b.meta.domainIcon + ' ' + _esc(b.meta.name) + '</div>'
          + '<div class="result-snippet">' + b.snippet + '</div>'
          + '</div>';
      });
    }

    resultsEl.innerHTML = html;
    resultsEl.classList.remove('hidden');

    resultsEl.querySelectorAll('.search-result-item[data-topic]').forEach(function (item) {
      item.addEventListener('click', function () {
        window.location.hash = '#topic/' + item.getAttribute('data-topic');
        input.value = '';
        resultsEl.classList.add('hidden');
      });
    });
  }

  // Build a ~120-char excerpt around the match with the query <mark>ed.
  function _snippet(text, pos, qlen) {
    var start = Math.max(0, pos - SNIPPET_PAD);
    var end = Math.min(text.length, pos + qlen + SNIPPET_PAD);
    var pre = (start > 0 ? '…' : '') + text.slice(start, pos);
    var hit = text.slice(pos, pos + qlen);
    var post = text.slice(pos + qlen, end) + (end < text.length ? '…' : '');
    return _esc(pre) + '<mark>' + _esc(hit) + '</mark>' + _esc(post);
  }

  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { init: init };
})();
