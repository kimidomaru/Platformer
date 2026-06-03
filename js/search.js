// Search — filters topics from registry by name/domain keywords
var Search = (function () {
  var input, resultsEl, allTopics;

  function init() {
    input = document.getElementById('search-input');
    resultsEl = document.getElementById('search-results');
    allTopics = _buildIndex();

    input.placeholder = I18N.t('searchPlaceholder');

    input.addEventListener('input', _onInput);
    input.addEventListener('focus', function () {
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

  function _onInput() {
    var query = input.value.trim().toLowerCase();
    if (!query) {
      resultsEl.classList.add('hidden');
      return;
    }

    var matches = allTopics.filter(function (t) {
      return t.searchText.indexOf(query) !== -1;
    });

    if (matches.length === 0) {
      resultsEl.innerHTML = '<div class="search-result-item">' + I18N.t('noResults') + '</div>';
    } else {
      resultsEl.innerHTML = matches.map(function (t) {
        return '<div class="search-result-item" data-topic="' + t.id + '">'
          + '<div>' + t.domainIcon + ' ' + t.name + '</div>'
          + '<div class="result-domain">' + t.domain + '</div>'
          + '</div>';
      }).join('');
    }

    resultsEl.classList.remove('hidden');

    resultsEl.querySelectorAll('.search-result-item[data-topic]').forEach(function (item) {
      item.addEventListener('click', function () {
        window.location.hash = '#topic/' + item.getAttribute('data-topic');
        input.value = '';
        resultsEl.classList.add('hidden');
      });
    });
  }

  return { init: init };
})();
