// Assessment — performance evaluation, mastery inference, and readiness analysis
var Assessment = (function () {

  // ── Mastery thresholds (per-topic) ──
  var MASTERY_LEVELS = [
    { id: 'dominado',      labelKey: 'masteryDominado',      min: 90, color: 'var(--success)',     bg: 'var(--success-bg)' },
    { id: 'avancado',      labelKey: 'masteryAvancado',      min: 75, color: 'var(--accent)',      bg: 'var(--accent-light)' },
    { id: 'intermediario', labelKey: 'masteryIntermediario', min: 50, color: 'var(--warning)',     bg: 'var(--warning-bg)' },
    { id: 'iniciante',     labelKey: 'masteryIniciante',     min: 1,  color: 'var(--danger)',      bg: 'var(--danger-bg)' },
    { id: 'nao-iniciado',  labelKey: 'masteryNaoIniciado',   min: 0,  color: 'var(--text-muted)', bg: 'var(--bg-tertiary)' }
  ];

  // ── Readiness thresholds (per-certification) ──
  var READINESS_LEVELS = [
    { id: 'preparado',     labelKey: 'readinessPreparado',     min: 80, color: 'var(--success)' },
    { id: 'quase-pronto',  labelKey: 'readinessQuasePronto',  min: 66, color: 'var(--accent)' },
    { id: 'em-preparacao', labelKey: 'readinessEmPreparacao', min: 50, color: 'var(--warning)' },
    { id: 'nao-preparado', labelKey: 'readinessNaoPreparado', min: 0,  color: 'var(--danger)' }
  ];

  // ── Data helpers ──

  function _getTopicPct(topicPath) {
    var scores = State.getAllQuizScores();
    var s = scores[topicPath];
    if (!s || s.total === 0) return null;
    return (s.score / s.total) * 100;
  }

  function _getMasteryLevel(pct) {
    if (pct === null) return MASTERY_LEVELS[4]; // nao-iniciado
    for (var i = 0; i < MASTERY_LEVELS.length; i++) {
      if (pct >= MASTERY_LEVELS[i].min) return MASTERY_LEVELS[i];
    }
    return MASTERY_LEVELS[4];
  }

  function _getReadinessLevel(pct) {
    for (var i = 0; i < READINESS_LEVELS.length; i++) {
      if (pct >= READINESS_LEVELS[i].min) return READINESS_LEVELS[i];
    }
    return READINESS_LEVELS[3];
  }

  // Per-topic assessment
  function assessTopic(topicPath) {
    var pct = _getTopicPct(topicPath);
    return {
      path: topicPath,
      pct: pct !== null ? Math.round(pct) : 0,
      attempted: pct !== null,
      mastery: _getMasteryLevel(pct)
    };
  }

  // Per-domain assessment — equal weight among topics
  function assessDomain(domain) {
    var topics = domain.topics || [];
    if (topics.length === 0) return { domain: domain, pct: 0, attempted: 0, total: 0, mastery: MASTERY_LEVELS[4], topics: [] };

    var topicResults = [];
    var sum = 0;
    var attempted = 0;
    topics.forEach(function (t) {
      var r = assessTopic(t.path);
      topicResults.push(r);
      if (r.attempted) { sum += r.pct; attempted++; }
    });

    var avgPct = attempted > 0 ? sum / topics.length : 0; // unattempted count as 0
    return {
      domain: domain,
      pct: Math.round(avgPct),
      attempted: attempted,
      total: topics.length,
      mastery: _getMasteryLevel(attempted > 0 ? avgPct : null),
      topics: topicResults
    };
  }

  // Per-certification readiness
  function assessCert(certId) {
    var registry = window.K8S_REGISTRY;
    var cert = null;
    registry.certifications.forEach(function (c) { if (c.id === certId) cert = c; });
    if (!cert) return null;

    var domains = registry.domains.filter(function (d) {
      if (d.type === 'skill') return false; // exclude skill domains from cert assessment
      var certs = Array.isArray(d.cert) ? d.cert : [d.cert];
      return certs.indexOf(certId) !== -1;
    });

    var domainResults = [];
    var totalWeight = 0;
    var weightedSum = 0;
    var weakDomains = [];

    domains.forEach(function (d) {
      var r = assessDomain(d);
      domainResults.push(r);
      totalWeight += d.weight;
      weightedSum += d.weight * r.pct;
      if (r.pct < 66) weakDomains.push(r);
    });

    var overallPct = totalWeight > 0 ? weightedSum / totalWeight : 0;
    var readiness = _getReadinessLevel(overallPct);

    // Sort weak domains ascending — worst first
    weakDomains.sort(function (a, b) { return a.pct - b.pct; });

    return {
      cert: cert,
      domains: domainResults,
      overallPct: Math.round(overallPct),
      readiness: readiness,
      weakDomains: weakDomains,
      weakDomainNames: weakDomains.map(function (w) { return w.domain.name; })
    };
  }

  // Per-skill-track assessment (no readiness, no weight — simple average)
  function assessTrack(trackId) {
    var registry = window.K8S_REGISTRY;
    var track = null;
    (registry.skillTracks || []).forEach(function (t) { if (t.id === trackId) track = t; });
    if (!track) return null;

    var domains = registry.domains.filter(function (d) {
      if (d.type !== 'skill') return false;
      var tracks = Array.isArray(d.track) ? d.track : [d.track];
      return tracks.indexOf(trackId) !== -1;
    });

    var domainResults = [];
    var sum = 0;
    var count = 0;
    var weakDomains = [];

    domains.forEach(function (d) {
      if (!d.topics || d.topics.length === 0) return;
      var r = assessDomain(d);
      domainResults.push(r);
      sum += r.pct;
      count++;
      if (r.pct < 66) weakDomains.push(r);
    });

    var overallPct = count > 0 ? Math.round(sum / count) : 0;
    weakDomains.sort(function (a, b) { return a.pct - b.pct; });

    return {
      track: track,
      domains: domainResults,
      overallPct: overallPct,
      mastery: _getMasteryLevel(count > 0 ? overallPct : null),
      weakDomains: weakDomains,
      weakDomainNames: weakDomains.map(function (w) { return w.domain.name; })
    };
  }

  // ── SVG Radar Chart ──

  function _buildRadarSVG(domainResults, size) {
    var cx = size / 2;
    var cy = size / 2;
    var radius = (size / 2) - 40; // leave room for labels
    var n = domainResults.length;
    if (n < 3) return '<p style="color:var(--text-muted);text-align:center">' + I18N.t('assessMinRadar') + '</p>';

    var angleStep = (2 * Math.PI) / n;
    var startAngle = -Math.PI / 2; // start from top

    function polar(angle, r) {
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    }

    var svg = '<svg class="assess-radar-svg" viewBox="0 0 ' + size + ' ' + size + '" xmlns="http://www.w3.org/2000/svg">';

    // Background grid rings (25%, 50%, 75%, 100%)
    [0.25, 0.5, 0.75, 1.0].forEach(function (frac) {
      var r = radius * frac;
      var points = [];
      for (var i = 0; i < n; i++) {
        var p = polar(startAngle + i * angleStep, r);
        points.push(p.x.toFixed(1) + ',' + p.y.toFixed(1));
      }
      svg += '<polygon points="' + points.join(' ') + '" fill="none" stroke="var(--border)" stroke-width="1" opacity="0.6"/>';
    });

    // Axes
    for (var i = 0; i < n; i++) {
      var p = polar(startAngle + i * angleStep, radius);
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p.x.toFixed(1) + '" y2="' + p.y.toFixed(1) + '" stroke="var(--border)" stroke-width="1" opacity="0.4"/>';
    }

    // Data polygon
    var dataPoints = [];
    for (var i = 0; i < n; i++) {
      var frac = domainResults[i].pct / 100;
      var dp = polar(startAngle + i * angleStep, radius * frac);
      dataPoints.push(dp.x.toFixed(1) + ',' + dp.y.toFixed(1));
    }
    svg += '<polygon points="' + dataPoints.join(' ') + '" fill="var(--accent)" fill-opacity="0.2" stroke="var(--accent)" stroke-width="2"/>';

    // Data points (dots)
    for (var i = 0; i < n; i++) {
      var frac = domainResults[i].pct / 100;
      var dp = polar(startAngle + i * angleStep, radius * frac);
      svg += '<circle cx="' + dp.x.toFixed(1) + '" cy="' + dp.y.toFixed(1) + '" r="4" fill="var(--accent)" stroke="var(--bg-primary)" stroke-width="2"/>';
    }

    // Labels
    for (var i = 0; i < n; i++) {
      var labelR = radius + 22;
      var angle = startAngle + i * angleStep;
      var lp = polar(angle, labelR);
      var anchor = 'middle';
      if (Math.cos(angle) > 0.3) anchor = 'start';
      else if (Math.cos(angle) < -0.3) anchor = 'end';
      var name = domainResults[i].domain.name;
      if (name.length > 20) name = name.substring(0, 18) + '...';
      svg += '<text x="' + lp.x.toFixed(1) + '" y="' + lp.y.toFixed(1) + '" text-anchor="' + anchor + '" dominant-baseline="middle" fill="var(--text-secondary)" font-size="11" font-weight="500">';
      svg += name;
      svg += '</text>';
    }

    // Percentage labels on grid rings
    [25, 50, 75, 100].forEach(function (val) {
      var gp = polar(startAngle, radius * (val / 100));
      svg += '<text x="' + (gp.x + 4).toFixed(1) + '" y="' + (gp.y - 4).toFixed(1) + '" fill="var(--text-muted)" font-size="9">' + val + '%</text>';
    });

    svg += '</svg>';
    return svg;
  }

  // ── Render ──

  function render(container) {
    var registry = window.K8S_REGISTRY;
    if (!registry) return;

    // Build combined tab list: certs first, then skill tracks (if they have domains)
    var certIds = registry.certifications.map(function (c) { return { type: 'cert', id: c.id, label: c.label }; });
    var trackIds = [];
    (registry.skillTracks || []).forEach(function (track) {
      var hasDomains = registry.domains.some(function (d) {
        return d.type === 'skill' && d.track && d.track.indexOf(track.id) !== -1 && d.topics && d.topics.length > 0;
      });
      if (hasDomains) {
        trackIds.push({ type: 'skill', id: track.id, label: track.label });
      }
    });

    var activeTab = certIds.length > 0 ? certIds[0] : (trackIds.length > 0 ? trackIds[0] : null);
    if (!activeTab) return;

    _renderFull(container, activeTab, certIds, trackIds);
  }

  function _renderFull(container, activeTab, certTabs, trackTabs) {
    var registry = window.K8S_REGISTRY;
    var isCert = activeTab.type === 'cert';
    var result = isCert ? assessCert(activeTab.id) : assessTrack(activeTab.id);
    if (!result) return;

    var html = '<div class="topic-header"><h1>&#127919; ' + I18N.t('assessmentPageTitle') + '</h1></div>';

    // Cert tabs
    html += '<div class="assess-cert-tabs">';
    certTabs.forEach(function (tab) {
      html += '<button class="assess-cert-tab' + (tab.id === activeTab.id && tab.type === activeTab.type ? ' active' : '') + '" data-tab-type="cert" data-tab-id="' + tab.id + '">';
      html += tab.label;
      html += '</button>';
    });
    // Separator + skill tabs (if any)
    if (trackTabs.length > 0) {
      html += '<span style="border-left:2px solid var(--border);margin:0 0.25rem;height:1.5rem;display:inline-block;vertical-align:middle"></span>';
      trackTabs.forEach(function (tab) {
        html += '<button class="assess-cert-tab' + (tab.id === activeTab.id && tab.type === activeTab.type ? ' active' : '') + '" data-tab-type="skill" data-tab-id="' + tab.id + '" style="font-size:0.75rem">';
        html += tab.label;
        html += '</button>';
      });
    }
    html += '</div>';

    if (isCert) {
      // Readiness overview card (cert only)
      var readinessLabel = I18N.t(result.readiness.labelKey);
      html += '<div class="assess-readiness-card">';
      html += '<div class="assess-readiness-left">';
      html += '<div class="assess-score-ring" style="--ring-color:' + result.readiness.color + ';--ring-pct:' + result.overallPct + '">';
      html += '<span class="assess-score-value">' + result.overallPct + '%</span>';
      html += '</div>';
      html += '<div class="assess-readiness-info">';
      html += '<span class="assess-readiness-label" style="color:' + result.readiness.color + '">' + readinessLabel + '</span>';
      html += '<span class="assess-readiness-sub">' + result.cert.fullName + '</span>';
      html += '<span class="assess-readiness-sub">' + I18N.t('assessMinScore') + ' ' + result.cert.passScore + '% &bull; ' + I18N.t('assessEstimate') + ' ' + result.overallPct + '%</span>';
      html += '</div>';
      html += '</div>';
      html += '</div>';
    } else {
      // Skill track overview (no readiness, simpler card)
      var m = result.mastery;
      var mLabel = I18N.t(m.labelKey);
      html += '<div class="assess-readiness-card">';
      html += '<div class="assess-readiness-left">';
      html += '<div class="assess-score-ring" style="--ring-color:' + m.color + ';--ring-pct:' + result.overallPct + '">';
      html += '<span class="assess-score-value">' + result.overallPct + '%</span>';
      html += '</div>';
      html += '<div class="assess-readiness-info">';
      html += '<span class="assess-readiness-label" style="color:' + m.color + '">' + mLabel + '</span>';
      html += '<span class="assess-readiness-sub">' + result.track.fullName + '</span>';
      html += '</div>';
      html += '</div>';
      html += '</div>';
    }

    // Radar chart
    if (result.domains.length >= 3) {
      html += '<h2 class="section-title">' + I18N.t('assessDomainView') + '</h2>';
      html += '<div class="assess-radar-wrap">';
      html += _buildRadarSVG(result.domains, 380);
      html += '</div>';
    }

    // Domain detail cards
    html += '<div class="assess-domain-grid">';
    result.domains.forEach(function (dr) {
      var dm = dr.mastery;
      var dmLabel = I18N.t(dm.labelKey);
      html += '<div class="assess-domain-card">';
      html += '<div class="assess-domain-card-header">';
      html += '<span>' + dr.domain.icon + ' ' + dr.domain.name + '</span>';
      html += '<span class="assess-badge" style="background:' + dm.bg + ';color:' + dm.color + '">' + dmLabel + '</span>';
      html += '</div>';
      html += '<div class="assess-domain-bar-wrap">';
      html += '<div class="assess-domain-bar"><div class="assess-domain-bar-fill" style="width:' + dr.pct + '%;background:' + dm.color + '"></div></div>';
      html += '<span class="assess-domain-pct">' + dr.pct + '%</span>';
      html += '</div>';
      // Weight line: show cert weight or N/A for skills
      var weightLabel = (isCert && dr.domain.weight) ? dr.domain.weight + '%' : I18N.t('assessNoCertWeight');
      html += '<div class="assess-domain-meta">' + I18N.t('assessWeight') + ' ' + weightLabel + ' &bull; ' + I18N.t('assessTopics') + ' ' + dr.attempted + '/' + dr.total + ' ' + I18N.t('assessAttempted') + '</div>';

      // Per-topic breakdown
      if (dr.topics.length > 0) {
        html += '<div class="assess-topic-list">';
        dr.topics.forEach(function (tr) {
          var tm = tr.mastery;
          html += '<div class="assess-topic-row">';
          html += '<span class="assess-topic-name">' + _findTopicName(tr.path) + '</span>';
          html += '<span class="assess-badge assess-badge-sm" style="background:' + tm.bg + ';color:' + tm.color + '">' + (tr.attempted ? tr.pct + '%' : '--') + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      html += '</div>';
    });
    html += '</div>';

    // Weak domains
    if (result.weakDomains.length > 0) {
      html += '<h2 class="section-title" style="color:var(--danger)">' + I18N.t('assessWeakDomains') + '</h2>';
      html += '<div class="assess-weak-list">';
      result.weakDomains.forEach(function (w) {
        var wm = w.mastery;
        var weightStr = (isCert && w.domain.weight) ? I18N.t('assessWeight').toLowerCase() + ' ' + w.domain.weight + '%' : '';
        html += '<div class="assess-weak-item">';
        html += '<span class="assess-weak-icon">' + w.domain.icon + '</span>';
        html += '<div class="assess-weak-info">';
        html += '<span class="assess-weak-name">' + w.domain.name + '</span>';
        html += '<span class="assess-weak-detail">' + w.pct + '%' + (weightStr ? ' (' + weightStr + ')' : '') + ' &mdash; ' + I18N.t(wm.labelKey) + '</span>';
        html += '</div>';
        html += '<span class="assess-badge" style="background:var(--danger-bg);color:var(--danger)">' + I18N.t('assessReinforce') + '</span>';
        html += '</div>';
      });
      html += '</div>';

      // Recommendation
      var rec = result.weakDomainNames.length > 0
        ? I18N.t('assessFocusOn') + ' ' + result.weakDomainNames.join(', ')
        : I18N.t('assessKeepPracticing');
      html += '<div class="assess-recommendation">';
      html += '<strong>' + I18N.t('assessRecommendation') + '</strong> ' + rec;
      html += '</div>';
    }

    container.innerHTML = html;

    // Bind tabs
    container.querySelectorAll('.assess-cert-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var tabType = tab.getAttribute('data-tab-type');
        var tabId = tab.getAttribute('data-tab-id');
        _renderFull(container, { type: tabType, id: tabId, label: tab.textContent }, certTabs, trackTabs);
      });
    });
  }

  function _findTopicName(path) {
    var registry = window.K8S_REGISTRY;
    for (var i = 0; i < registry.domains.length; i++) {
      for (var j = 0; j < registry.domains[i].topics.length; j++) {
        if (registry.domains[i].topics[j].path === path) return registry.domains[i].topics[j].name;
      }
    }
    return path;
  }

  // ── Public API ──
  return {
    render: render,
    assessTopic: assessTopic,
    assessDomain: assessDomain,
    assessCert: assessCert,
    assessTrack: assessTrack
  };
})();
