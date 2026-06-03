// Router — hash-based navigation controller
var Router = (function () {
  var contentArea, breadcrumbEl;

  function init() {
    contentArea = document.getElementById('content-area');
    breadcrumbEl = document.getElementById('breadcrumb');

    window.addEventListener('hashchange', _onRoute);
    _onRoute();
  }

  function _onRoute() {
    Exam.destroy();
    if (typeof Constellation !== 'undefined') Constellation.destroy();
    var hash = window.location.hash.slice(1) || 'dashboard';
    var parts = hash.split('/');
    var route = parts[0];

    if (route === 'topic' && parts.length >= 3) {
      var topicPath = parts.slice(1).join('/');
      _loadTopic(topicPath);
    } else if (route === 'dashboard') {
      _setBreadcrumb([{ label: 'Dashboard' }]);
      Sidebar.setActiveButton('dashboard');
      Dashboard.render(contentArea);
    } else if (route === 'exam') {
      _setBreadcrumb([{ label: 'Simulado' }]);
      Sidebar.setActiveButton('exam');
      Exam.render(contentArea);
    } else if (route === 'assessment') {
      _setBreadcrumb([{ label: 'Avaliacao' }]);
      Sidebar.setActiveButton('assessment');
      Assessment.render(contentArea);
    } else if (route === 'review') {
      _setBreadcrumb([{ label: I18N.t('reviewTitle') }]);
      Sidebar.setActiveButton('review');
      Review.render(contentArea);
    } else if (route === 'map') {
      _setBreadcrumb([{ label: I18N.t('mapTitle') }]);
      Sidebar.setActiveButton('map');
      Constellation.render(contentArea);
    } else if (route === 'weak') {
      _setBreadcrumb([{ label: I18N.t('btnExam'), href: '#exam' }, { label: I18N.t('weakReview') }]);
      Sidebar.setActiveButton('exam');
      Exam.renderWeak(contentArea);
    } else if (route === 'cheatsheet') {
      _setBreadcrumb([{ label: 'Cheatsheet' }]);
      Sidebar.setActiveButton('cheatsheet');
      Cheatsheet.render(contentArea);
    } else if (route === 'trails') {
      var trailId = parts[1] || null;
      if (trailId) {
        _setBreadcrumb([{ label: I18N.t('btnTrails'), href: '#trails' }, { label: trailId }]);
      } else {
        _setBreadcrumb([{ label: I18N.t('btnTrails') }]);
      }
      Sidebar.setActiveButton('trails');
      Trails.render(contentArea, trailId);
    } else {
      window.location.hash = '#dashboard';
    }
  }

  function _loadTopic(topicPath) {
    var registry = window.K8S_REGISTRY;
    var domainMeta = null;
    var topicMeta = null;

    for (var i = 0; i < registry.domains.length; i++) {
      for (var j = 0; j < registry.domains[i].topics.length; j++) {
        if (registry.domains[i].topics[j].path === topicPath) {
          domainMeta = registry.domains[i];
          topicMeta = registry.domains[i].topics[j];
          break;
        }
      }
      if (topicMeta) break;
    }

    if (!topicMeta) {
      contentArea.innerHTML = '<div class="empty-state"><p>Topico nao encontrado.</p></div>';
      return;
    }

    _setBreadcrumb([
      { label: 'Dashboard', href: '#dashboard' },
      { label: domainMeta.name, href: null },
      { label: topicMeta.name }
    ]);

    Sidebar.setActive(topicPath);
    contentArea.innerHTML = '<div class="loading"><p>Carregando...</p></div>';

    Loader.loadTopic(topicPath).then(function (content) {
      Renderer.renderTopic(contentArea, topicPath, content);
    }).catch(function (err) {
      contentArea.innerHTML = '<div class="empty-state"><div class="empty-icon">&#9888;</div><p>Erro ao carregar topico: ' + err.message + '</p></div>';
    });
  }

  function _setBreadcrumb(items) {
    var html = '';
    items.forEach(function (item, idx) {
      if (idx > 0) html += '<span class="sep">/</span>';
      if (item.href) {
        html += '<a href="' + item.href + '">' + item.label + '</a>';
      } else {
        html += '<span>' + item.label + '</span>';
      }
    });
    breadcrumbEl.innerHTML = html;
  }

  return { init: init };
})();
