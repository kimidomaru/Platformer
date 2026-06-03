// Sidebar — renders domain tree from registry, handles cert/skill filter, expand/collapse, active state
var Sidebar = (function () {
  var nav;
  var activeSection = 'certs'; // 'certs' | 'skills'
  var activeCert = 'all'; // 'all' | 'cka' | 'ckad' | ...
  var activeTrack = 'all'; // 'all' | 'prometheus' | 'argocd' | ...

  function init() {
    nav = document.getElementById('sidebar-nav');
    _render();
    _bindToggle();
    _bindFooterButtons();
  }

  function _hasSkillDomains() {
    var registry = window.K8S_REGISTRY;
    if (!registry || !registry.skillTracks || registry.skillTracks.length === 0) return false;
    // Check if there are actual skill domains with topics
    for (var i = 0; i < registry.domains.length; i++) {
      if (registry.domains[i].type === 'skill' && registry.domains[i].topics && registry.domains[i].topics.length > 0) return true;
    }
    return false;
  }

  function _render() {
    var registry = window.K8S_REGISTRY;
    if (!registry) return;

    var showSkills = _hasSkillDomains();
    var html = '';

    // Section toggle (only if skills exist)
    if (showSkills) {
      html += '<div class="section-toggle">';
      html += '<button class="section-btn' + (activeSection === 'certs' ? ' active' : '') + '" data-section="certs">' + I18N.t('sectionCerts') + '</button>';
      html += '<button class="section-btn' + (activeSection === 'skills' ? ' active' : '') + '" data-section="skills">' + I18N.t('sectionSkills') + '</button>';
      html += '</div>';
    }

    if (activeSection === 'certs') {
      html += _renderCertsSection(registry);
    } else {
      html += _renderSkillsSection(registry);
    }

    nav.innerHTML = html;

    // Bind section toggle
    if (showSkills) {
      nav.querySelectorAll('.section-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          activeSection = btn.getAttribute('data-section');
          _render();
        });
      });
    }

    // Bind cert filter
    nav.querySelectorAll('.cert-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeCert = btn.getAttribute('data-cert');
        nav.querySelectorAll('.cert-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        _render();
      });
    });

    // Bind track filter
    nav.querySelectorAll('.track-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeTrack = btn.getAttribute('data-track');
        nav.querySelectorAll('.track-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        _render();
      });
    });

    // Bind domain expand/collapse
    nav.querySelectorAll('.domain-header').forEach(function (header) {
      header.addEventListener('click', function () {
        header.classList.toggle('expanded');
        header.nextElementSibling.classList.toggle('expanded');
      });
    });

    // Bind topic clicks
    nav.querySelectorAll('.topic-link').forEach(function (link) {
      link.addEventListener('click', function () {
        window.location.hash = '#topic/' + link.getAttribute('data-topic');
      });
    });
  }

  function _renderCertsSection(registry) {
    // Cert filter tabs — grouped by provider
    var html = '<div class="cert-filter">';
    html += '<button class="cert-btn' + (activeCert === 'all' ? ' active' : '') + '" data-cert="all">' + I18N.t('certAll') + '</button>';

    // Group certs by group field
    var groups = {};
    var groupOrder = [];
    registry.certifications.forEach(function (cert) {
      var g = cert.group || 'other';
      if (!groups[g]) { groups[g] = []; groupOrder.push(g); }
      groups[g].push(cert);
    });
    groupOrder.forEach(function (g, idx) {
      if (idx > 0) {
        html += '<span class="cert-separator">|</span>';
      }
      groups[g].forEach(function (cert) {
        html += '<button class="cert-btn' + (activeCert === cert.id ? ' active' : '') + '" data-cert="' + cert.id + '">' + cert.label + '</button>';
      });
    });
    html += '</div>';

    // Domain groups (filtered by activeCert, cert-type only)
    registry.domains.forEach(function (domain) {
      if (domain.type === 'skill') return; // skip skill domains in cert section

      if (activeCert !== 'all') {
        var certs = Array.isArray(domain.cert) ? domain.cert : [domain.cert];
        if (certs.indexOf(activeCert) === -1) return;
      }

      html += _renderDomainGroup(domain, true);
    });

    return html;
  }

  function _renderSkillsSection(registry) {
    // Track filter tabs
    var html = '<div class="cert-filter">';
    html += '<button class="track-btn' + (activeTrack === 'all' ? ' active' : '') + '" data-track="all">' + I18N.t('skillTrackAll') + '</button>';
    (registry.skillTracks || []).forEach(function (track) {
      // Only show tracks that have at least one domain with topics
      var hasDomains = registry.domains.some(function (d) {
        return d.type === 'skill' && d.track && d.track.indexOf(track.id) !== -1 && d.topics && d.topics.length > 0;
      });
      if (!hasDomains) return;
      html += '<button class="track-btn' + (activeTrack === track.id ? ' active' : '') + '" data-track="' + track.id + '">' + track.label + '</button>';
    });
    html += '</div>';

    // Domain groups (filtered by activeTrack, skill-type only)
    var hasAny = false;
    registry.domains.forEach(function (domain) {
      if (domain.type !== 'skill') return; // skip cert domains in skill section
      if (!domain.topics || domain.topics.length === 0) return;

      if (activeTrack !== 'all') {
        var tracks = Array.isArray(domain.track) ? domain.track : [domain.track];
        if (tracks.indexOf(activeTrack) === -1) return;
      }

      hasAny = true;
      html += _renderDomainGroup(domain, false);
    });

    if (!hasAny) {
      html += '<div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:0.85rem;font-style:italic">' + I18N.t('noSkillsYet') + '</div>';
    }

    return html;
  }

  function _renderDomainGroup(domain, showWeight) {
    var html = '<div class="domain-group" data-domain="' + domain.id + '">';
    html += '<button class="domain-header">';
    html += '<span class="arrow">&#9654;</span> ';
    html += domain.icon + ' ' + domain.name;
    if (showWeight && domain.weight) {
      html += ' <span style="margin-left:auto;font-size:0.7rem;opacity:0.6">' + domain.weight + '%</span>';
    }
    html += '</button>';
    html += '<div class="domain-topics">';

    if (domain.topics.length === 0) {
      html += '<div style="padding:0.4rem 1.25rem 0.4rem 2.25rem;font-size:0.78rem;color:var(--text-muted);font-style:italic">' + I18N.t('comingSoon') + '</div>';
    } else {
      domain.topics.forEach(function (topic) {
        var status = State.getProgress(topic.path);
        html += '<button class="topic-link" data-topic="' + topic.path + '">';
        html += '<span>' + topic.name + '</span>';
        html += '<span class="status-dot ' + status + '"></span>';
        html += '</button>';
      });
    }

    html += '</div></div>';
    return html;
  }

  function setActive(topicPath) {
    // Determine if this topic is in a skill domain and switch section if needed
    var registry = window.K8S_REGISTRY;
    if (registry) {
      for (var i = 0; i < registry.domains.length; i++) {
        var d = registry.domains[i];
        for (var j = 0; j < (d.topics || []).length; j++) {
          if (d.topics[j].path === topicPath) {
            if (d.type === 'skill' && activeSection !== 'skills') {
              activeSection = 'skills';
              _render();
            } else if (d.type !== 'skill' && activeSection !== 'certs') {
              activeSection = 'certs';
              _render();
            }
            break;
          }
        }
      }
    }

    nav.querySelectorAll('.topic-link').forEach(function (link) {
      link.classList.remove('active');
      if (link.getAttribute('data-topic') === topicPath) {
        link.classList.add('active');
        var group = link.closest('.domain-group');
        if (group) {
          group.querySelector('.domain-header').classList.add('expanded');
          group.querySelector('.domain-topics').classList.add('expanded');
        }
      }
    });
    document.querySelectorAll('.sidebar-btn').forEach(function (btn) {
      btn.classList.remove('active');
    });
  }

  function setActiveButton(route) {
    nav.querySelectorAll('.topic-link').forEach(function (l) { l.classList.remove('active'); });
    document.querySelectorAll('.sidebar-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-route') === route);
    });
  }

  function refreshStatus() {
    nav.querySelectorAll('.topic-link').forEach(function (link) {
      var topicPath = link.getAttribute('data-topic');
      var status = State.getProgress(topicPath);
      link.querySelector('.status-dot').className = 'status-dot ' + status;
    });
  }

  function _bindToggle() {
    var toggle = document.getElementById('sidebar-toggle');
    var sidebar = document.getElementById('sidebar');
    toggle.addEventListener('click', function () { sidebar.classList.toggle('open'); });
    window.addEventListener('hashchange', function () { sidebar.classList.remove('open'); });
  }

  function _bindFooterButtons() {
    document.querySelectorAll('.sidebar-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.location.hash = '#' + btn.getAttribute('data-route');
      });
    });
  }

  return {
    init: init,
    setActive: setActive,
    setActiveButton: setActiveButton,
    refreshStatus: refreshStatus
  };
})();
