// Loader — dynamically loads topic.js files via <script> tags (works with file://)
// When language=EN, tries topic-en.js first; falls back to topic.js (PT) if not found
var Loader = (function () {
  var loaded = {};

  function _getLang() {
    try {
      var raw = localStorage.getItem('k8s_lang');
      return raw === 'en' ? 'en' : 'pt';
    } catch (e) { return 'pt'; }
  }

  function _injectScript(src, onSuccess, onError) {
    var script = document.createElement('script');
    script.src = src;
    script.onload = onSuccess;
    script.onerror = onError;
    document.body.appendChild(script);
  }

  function loadTopic(topicPath) {
    return new Promise(function (resolve, reject) {
      var lang = _getLang();

      // Helper: resolve with PT content (fallback)
      function resolvePT() {
        if (window.K8S_CONTENT && window.K8S_CONTENT[topicPath]) {
          resolve(window.K8S_CONTENT[topicPath]);
        } else {
          reject(new Error('Content not registered: ' + topicPath));
        }
      }

      // If EN requested, try EN file first
      if (lang === 'en') {
        var enKey = topicPath + '__en';

        // Already loaded EN
        if (loaded[enKey] === 'done') {
          var enContent = window.K8S_CONTENT_EN && window.K8S_CONTENT_EN[topicPath];
          if (enContent) { resolve(enContent); return; }
          // EN file exists but content not available? fall through to PT
        }

        // EN load in progress
        if (loaded[enKey] === 'loading') {
          var check = setInterval(function () {
            if (loaded[enKey] !== 'loading') {
              clearInterval(check);
              var c = window.K8S_CONTENT_EN && window.K8S_CONTENT_EN[topicPath];
              if (c) { resolve(c); } else { _loadPT(topicPath, resolve, reject); }
            }
          }, 50);
          return;
        }

        // EN not yet attempted — try loading topic-en.js
        if (!loaded[enKey]) {
          loaded[enKey] = 'loading';
          _injectScript(
            'content/' + topicPath + '/topic-en.js',
            function () {
              loaded[enKey] = 'done';
              var enContent = window.K8S_CONTENT_EN && window.K8S_CONTENT_EN[topicPath];
              if (enContent) {
                resolve(enContent);
              } else {
                // EN file loaded but didn't register content — fall back to PT
                _loadPT(topicPath, resolve, reject);
              }
            },
            function () {
              // EN file not found — fall back to PT
              loaded[enKey] = 'missing';
              _loadPT(topicPath, resolve, reject);
            }
          );
          return;
        }
      }

      // PT path (or EN missing)
      _loadPT(topicPath, resolve, reject);
    });
  }

  function _loadPT(topicPath, resolve, reject) {
    var key = topicPath;

    if (window.K8S_CONTENT && window.K8S_CONTENT[key]) {
      resolve(window.K8S_CONTENT[key]);
      return;
    }

    if (loaded[key] === 'loading') {
      var check = setInterval(function () {
        if (window.K8S_CONTENT && window.K8S_CONTENT[key]) {
          clearInterval(check);
          resolve(window.K8S_CONTENT[key]);
        }
      }, 50);
      return;
    }

    loaded[key] = 'loading';

    _injectScript(
      'content/' + topicPath + '/topic.js',
      function () {
        loaded[key] = 'done';
        if (window.K8S_CONTENT && window.K8S_CONTENT[key]) {
          resolve(window.K8S_CONTENT[key]);
        } else {
          reject(new Error('Content not registered: ' + key));
        }
      },
      function () {
        loaded[key] = 'error';
        reject(new Error('Failed to load: ' + topicPath));
      }
    );
  }

  // Check if EN content is available for a given topic (after loading)
  function hasEnContent(topicPath) {
    return !!(window.K8S_CONTENT_EN && window.K8S_CONTENT_EN[topicPath]);
  }

  // Preload multiple topics (for exam mode)
  function loadMultiple(paths) {
    return Promise.all(paths.map(loadTopic));
  }

  return {
    loadTopic: loadTopic,
    loadMultiple: loadMultiple,
    hasEnContent: hasEnContent
  };
})();
