// Dashboard — progress overview, stats, and recent topics
var Dashboard = (function () {

  function render(container) {
    var registry = window.K8S_REGISTRY;
    if (!registry) return;

    var progress = State.getAllProgress();
    var scores = State.getAllQuizScores();
    var recent = State.getRecent();

    var totalTopics = 0;
    var completed = 0;
    var inProgress = 0;

    registry.domains.forEach(function (d) {
      d.topics.forEach(function (t) {
        totalTopics++;
        var s = progress[t.path] || 'not-started';
        if (s === 'completed') completed++;
        else if (s === 'in-progress') inProgress++;
      });
    });

    var html = '<div class="topic-header"><h1>' + I18N.t('dashboardTitle') + '</h1></div>';

    // Spaced-repetition daily review widget
    html += _renderReviewWidget();

    // Weak-spot review widget (quiz error analytics)
    html += _renderWeakWidget();

    // Quiz Analytics widget (domain score breakdown)
    html += _renderQuizAnalytics(registry, scores);

    // KubeAstronaut Progress (kubernetes cert-type domains only)
    html += _renderKubeAstronautProgress(registry, progress);

    // Cloud Provider Progress (AWS, Azure, etc.)
    html += _renderCloudProviderProgress(registry, progress);

    // Skills Progress (skill-type domains only)
    html += _renderSkillsProgress(registry, progress);

    // Stats cards
    html += '<div class="dashboard-grid">';
    html += _statCard(totalTopics, I18N.t('totalTopics'));
    html += _statCard(completed, I18N.t('completedTopics'));
    html += _statCard(inProgress, I18N.t('inProgressTopics'));
    html += _statCard(totalTopics > 0 ? Math.round((completed / totalTopics) * 100) + '%' : '0%', I18N.t('overallProgress'));
    html += '</div>';

    // Domain progress — cert domains
    html += '<h2 class="section-title">' + I18N.t('domainProgressTitle') + '</h2>';
    html += '<div class="domain-progress">';
    registry.domains.forEach(function (domain) {
      if (domain.type === 'skill') return; // separate section for skills
      html += _renderDomainProgressItem(domain, progress);
    });
    html += '</div>';

    // Domain progress — skill domains (if any exist with topics)
    var hasSkillDomains = registry.domains.some(function (d) {
      return d.type === 'skill' && d.topics && d.topics.length > 0;
    });
    if (hasSkillDomains) {
      html += '<h2 class="section-title">' + I18N.t('skillsProgressTitle') + '</h2>';
      html += '<div class="domain-progress">';
      registry.domains.forEach(function (domain) {
        if (domain.type !== 'skill') return;
        if (!domain.topics || domain.topics.length === 0) return;
        html += _renderDomainProgressItem(domain, progress);
      });
      html += '</div>';
    }

    // Recent topics
    if (recent.length > 0) {
      html += '<h2 class="section-title">' + I18N.t('recentTopicsTitle') + '</h2>';
      html += '<div class="recent-topics">';
      recent.forEach(function (r) {
        var status = progress[r.id] || 'not-started';
        var quizScore = scores[r.id];
        html += '<div class="recent-topic-item" data-topic="' + r.id + '">';
        html += '<span>' + r.name + '</span>';
        html += '<span style="display:flex;align-items:center;gap:0.5rem">';
        if (quizScore) {
          html += '<span class="badge badge-' + (quizScore.score / quizScore.total >= 0.8 ? 'easy' : quizScore.score / quizScore.total >= 0.6 ? 'medium' : 'hard') + '">';
          html += Math.round((quizScore.score / quizScore.total) * 100) + '%</span>';
        }
        html += '<span class="badge badge-' + (status === 'completed' ? 'done' : status === 'in-progress' ? 'progress' : 'pending') + '">';
        html += _statusLabel(status) + '</span>';
        html += '</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Quiz scores summary
    var scoreKeys = Object.keys(scores);
    if (scoreKeys.length > 0) {
      html += '<h2 class="section-title">' + I18N.t('quizResultsTitle') + '</h2>';
      html += '<div class="recent-topics">';
      scoreKeys.forEach(function (key) {
        var s = scores[key];
        var pct = Math.round((s.score / s.total) * 100);
        var topicInfo = _findTopic(key);
        html += '<div class="recent-topic-item" data-topic="' + key + '">';
        html += '<span>' + (topicInfo ? topicInfo.name : key) + '</span>';
        html += '<span class="badge badge-' + (pct >= 80 ? 'easy' : pct >= 60 ? 'medium' : 'hard') + '">' + pct + '% (' + s.score + '/' + s.total + ')</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    container.innerHTML = html;

    // Bind clicks on recent topics
    container.querySelectorAll('[data-topic]').forEach(function (el) {
      el.addEventListener('click', function () {
        window.location.hash = '#topic/' + el.getAttribute('data-topic');
      });
    });

    // Bind review widget button
    var reviewBtn = container.querySelector('[data-action="review"]');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', function () { window.location.hash = '#review'; });
    }

    // Bind weak-spot widget button
    var weakBtn = container.querySelector('[data-action="weak"]');
    if (weakBtn) {
      weakBtn.addEventListener('click', function () { window.location.hash = '#weak'; });
    }
  }

  function _renderWeakWidget() {
    if (typeof State.getWeakCount !== 'function') return '';
    var count = State.getWeakCount();
    if (count === 0) return '';
    var byTopic = State.getWeakByTopic().slice(0, 4);

    var html = '<div class="review-widget has-due weak-widget">';
    html += '<div class="review-widget-icon">&#129514;</div>';
    html += '<div class="review-widget-info">';
    html += '<h2 class="review-widget-title">' + I18N.t('weakWidgetTitle') + '</h2>';
    html += '<p class="review-widget-sub"><strong>' + count + '</strong> ' + I18N.t('weakWidgetSub');
    if (byTopic.length) {
      var names = byTopic.map(function (b) {
        return (b.topicName || b.domain || b.topicPath) + ' (' + b.count + ')';
      }).join(' &bull; ');
      html += '<br><span style="font-size:0.8rem">' + names + '</span>';
    }
    html += '</p>';
    html += '</div>';
    html += '<button class="btn btn-primary" data-action="weak">' + I18N.t('weakWidgetBtn') + '</button>';
    html += '</div>';
    return html;
  }

  function _renderReviewWidget() {
    if (typeof SRS === 'undefined') return '';
    var due = SRS.getDueCount();
    var tracked = SRS.getTrackedCount();
    if (tracked === 0) return ''; // nothing scheduled yet — keep dashboard clean

    var html = '<div class="review-widget' + (due > 0 ? ' has-due' : '') + '">';
    html += '<div class="review-widget-icon">&#9201;</div>';
    html += '<div class="review-widget-info">';
    html += '<h2 class="review-widget-title">' + I18N.t('reviewDueWidget') + '</h2>';
    if (due > 0) {
      html += '<p class="review-widget-sub"><strong>' + due + '</strong> ' + I18N.t('reviewDueCards') + '</p>';
    } else {
      html += '<p class="review-widget-sub">' + I18N.t('reviewUpToDate') + '</p>';
    }
    html += '</div>';
    if (due > 0) {
      html += '<button class="btn btn-primary" data-action="review">' + I18N.t('reviewStartBtn') + '</button>';
    }
    html += '</div>';
    return html;
  }

  function _renderDomainProgressItem(domain, progress) {
    var domainTotal = domain.topics.length;
    var domainDone = 0;
    domain.topics.forEach(function (t) {
      if (progress[t.path] === 'completed') domainDone++;
    });
    var pct = domainTotal > 0 ? Math.round((domainDone / domainTotal) * 100) : 0;

    var html = '<div class="domain-progress-item">';
    html += '<span class="domain-name">' + domain.icon + ' ' + domain.name + '</span>';
    html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
    html += '<span class="progress-text">' + pct + '%</span>';
    html += '</div>';
    return html;
  }

  function _statCard(value, label) {
    return '<div class="stat-card"><div class="stat-value">' + value + '</div><div class="stat-label">' + label + '</div></div>';
  }

  function _statusLabel(status) {
    return I18N.t(status) || status;
  }

  function _renderKubeAstronautProgress(registry, progress) {
    var certs = registry.certifications.filter(function (c) {
      return c.group === 'kubernetes';
    });
    var certStats = [];
    var allDone = true;

    certs.forEach(function (cert) {
      var certDomains = registry.domains.filter(function (d) {
        // Only count cert-type domains (explicit check for safety)
        if (d.type === 'skill') return false;
        var c = Array.isArray(d.cert) ? d.cert : [d.cert];
        return c.indexOf(cert.id) !== -1;
      });
      var total = 0;
      var done = 0;
      certDomains.forEach(function (d) {
        d.topics.forEach(function (t) {
          total++;
          if (progress[t.path] === 'completed') done++;
        });
      });
      var pct = total > 0 ? Math.round((done / total) * 100) : 0;
      if (pct < 100) allDone = false;
      certStats.push({ cert: cert, total: total, done: done, pct: pct });
    });

    var overallPct = 0;
    if (certStats.length > 0) {
      var sum = 0;
      certStats.forEach(function (cs) { sum += cs.pct; });
      overallPct = Math.round(sum / certStats.length);
    }

    var html = '<div class="kubeastronaut-card">';
    html += '<div class="kubeastronaut-header">';
    html += '<div class="kubeastronaut-icon">' + (allDone ? '&#128640;' : '&#9784;') + '</div>';
    html += '<div class="kubeastronaut-info">';
    html += '<h2 class="kubeastronaut-title">Kubernetes</h2>';
    html += '<p class="kubeastronaut-sub">' + (allDone ? I18N.t('allCertsDone') : I18N.t('completeCerts')) + '</p>';
    html += '</div>';
    html += '<div class="kubeastronaut-pct">' + overallPct + '%</div>';
    html += '</div>';

    html += '<div class="kubeastronaut-certs">';
    certStats.forEach(function (cs) {
      var color = cs.pct >= 100 ? 'var(--success)' : cs.pct > 0 ? 'var(--accent)' : 'var(--text-muted)';
      html += '<div class="kubeastronaut-cert-item">';
      html += '<div class="kubeastronaut-cert-row">';
      html += '<span class="kubeastronaut-cert-label">' + cs.cert.label + '</span>';
      html += '<span class="kubeastronaut-cert-detail" style="color:' + color + '">' + cs.done + '/' + cs.total + '</span>';
      html += '</div>';
      html += '<div class="kubeastronaut-cert-bar"><div class="kubeastronaut-cert-fill" style="width:' + cs.pct + '%;background:' + color + '"></div></div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    return html;
  }

  function _renderCloudProviderProgress(registry, progress) {
    // Group cloud certs by provider (aws, azure, gcp, etc.)
    var providers = {};
    registry.certifications.forEach(function (cert) {
      if (cert.group === 'kubernetes') return; // skip K8s certs
      var g = cert.group || 'other';
      if (!providers[g]) providers[g] = [];
      providers[g].push(cert);
    });

    var providerMeta = {
      aws:   { title: 'AWS Certifications',   icon: '&#9729;',  color: 'var(--warning, #ff9900)' },
      azure: { title: 'Azure Certifications',  icon: '&#9729;',  color: 'var(--info, #0078d4)' },
      gcp:   { title: 'GCP Certifications',    icon: '&#9729;',  color: 'var(--success, #34a853)' }
    };

    var html = '';
    Object.keys(providers).forEach(function (provKey) {
      var certs = providers[provKey];
      var meta = providerMeta[provKey] || { title: provKey + ' Certifications', icon: '&#9729;', color: 'var(--accent)' };
      var certStats = [];
      var allDone = true;

      certs.forEach(function (cert) {
        var certDomains = registry.domains.filter(function (d) {
          if (d.type === 'skill') return false;
          var c = Array.isArray(d.cert) ? d.cert : [d.cert];
          return c.indexOf(cert.id) !== -1;
        });
        var total = 0;
        var done = 0;
        certDomains.forEach(function (d) {
          d.topics.forEach(function (t) {
            total++;
            if (progress[t.path] === 'completed') done++;
          });
        });
        var pct = total > 0 ? Math.round((done / total) * 100) : 0;
        if (pct < 100) allDone = false;
        certStats.push({ cert: cert, total: total, done: done, pct: pct });
      });

      if (certStats.length === 0) return;

      var overallPct = 0;
      var sum = 0;
      certStats.forEach(function (cs) { sum += cs.pct; });
      overallPct = Math.round(sum / certStats.length);

      html += '<div class="kubeastronaut-card" style="border-color:' + meta.color + ';margin-top:1rem">';
      html += '<div class="kubeastronaut-header">';
      html += '<div class="kubeastronaut-icon">' + meta.icon + '</div>';
      html += '<div class="kubeastronaut-info">';
      html += '<h2 class="kubeastronaut-title">' + meta.title + '</h2>';
      html += '<p class="kubeastronaut-sub">' + (allDone ? I18N.t('cloudCertsDone') : I18N.t('completeCloudCerts')) + '</p>';
      html += '</div>';
      html += '<div class="kubeastronaut-pct">' + overallPct + '%</div>';
      html += '</div>';

      html += '<div class="kubeastronaut-certs">';
      certStats.forEach(function (cs) {
        var color = cs.pct >= 100 ? 'var(--success)' : cs.pct > 0 ? meta.color : 'var(--text-muted)';
        html += '<div class="kubeastronaut-cert-item">';
        html += '<div class="kubeastronaut-cert-row">';
        html += '<span class="kubeastronaut-cert-label">' + cs.cert.label + '</span>';
        html += '<span class="kubeastronaut-cert-detail" style="color:' + color + '">' + cs.done + '/' + cs.total + '</span>';
        html += '</div>';
        html += '<div class="kubeastronaut-cert-bar"><div class="kubeastronaut-cert-fill" style="width:' + cs.pct + '%;background:' + color + '"></div></div>';
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    });

    return html;
  }

  function _renderSkillsProgress(registry, progress) {
    var tracks = registry.skillTracks || [];
    if (tracks.length === 0) return '';

    // Check if there are any skill domains with topics
    var skillDomains = registry.domains.filter(function (d) {
      return d.type === 'skill' && d.topics && d.topics.length > 0;
    });
    if (skillDomains.length === 0) return '';

    // Build per-track stats
    var trackStats = [];
    var allDone = true;

    tracks.forEach(function (track) {
      var trackDomains = skillDomains.filter(function (d) {
        var t = Array.isArray(d.track) ? d.track : [d.track];
        return t.indexOf(track.id) !== -1;
      });
      if (trackDomains.length === 0) return;

      var total = 0;
      var done = 0;
      trackDomains.forEach(function (d) {
        d.topics.forEach(function (t) {
          total++;
          if (progress[t.path] === 'completed') done++;
        });
      });
      var pct = total > 0 ? Math.round((done / total) * 100) : 0;
      if (pct < 100) allDone = false;
      trackStats.push({ track: track, total: total, done: done, pct: pct });
    });

    if (trackStats.length === 0) return '';

    var overallPct = 0;
    var sum = 0;
    trackStats.forEach(function (ts) { sum += ts.pct; });
    overallPct = Math.round(sum / trackStats.length);

    var html = '<div class="kubeastronaut-card" style="border-color:var(--accent);margin-top:1rem">';
    html += '<div class="kubeastronaut-header">';
    html += '<div class="kubeastronaut-icon">&#128736;</div>';
    html += '<div class="kubeastronaut-info">';
    html += '<h2 class="kubeastronaut-title">' + I18N.t('sectionSkills') + '</h2>';
    html += '<p class="kubeastronaut-sub">' + I18N.t('skillsSubtitle') + '</p>';
    html += '</div>';
    html += '<div class="kubeastronaut-pct">' + overallPct + '%</div>';
    html += '</div>';

    html += '<div class="kubeastronaut-certs">';
    trackStats.forEach(function (ts) {
      var color = ts.pct >= 100 ? 'var(--success)' : ts.pct > 0 ? 'var(--accent)' : 'var(--text-muted)';
      html += '<div class="kubeastronaut-cert-item">';
      html += '<div class="kubeastronaut-cert-row">';
      html += '<span class="kubeastronaut-cert-label">' + ts.track.label + '</span>';
      html += '<span class="kubeastronaut-cert-detail" style="color:' + color + '">' + ts.done + '/' + ts.total + '</span>';
      html += '</div>';
      html += '<div class="kubeastronaut-cert-bar"><div class="kubeastronaut-cert-fill" style="width:' + ts.pct + '%;background:' + color + '"></div></div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    return html;
  }

  function _renderQuizAnalytics(registry, scores) {
    var scoreKeys = Object.keys(scores);
    if (scoreKeys.length < 3) return ''; // only show when there's meaningful data

    // Build domain-level quiz stats
    var domainStats = {};
    scoreKeys.forEach(function (topicPath) {
      var domainId = topicPath.split('/')[0];
      var s = scores[topicPath];
      var pct = Math.round((s.score / s.total) * 100);
      if (!domainStats[domainId]) {
        domainStats[domainId] = { total: 0, sum: 0, count: 0 };
      }
      domainStats[domainId].sum += pct;
      domainStats[domainId].count++;
    });

    // Get domain names from registry
    var domainNames = {};
    registry.domains.forEach(function (d) { domainNames[d.id] = d.name; });

    // Convert to sorted array (worst first)
    var stats = Object.keys(domainStats).map(function (id) {
      var d = domainStats[id];
      return {
        id: id,
        name: domainNames[id] || id,
        avg: Math.round(d.sum / d.count),
        count: d.count
      };
    });
    stats.sort(function (a, b) { return a.avg - b.avg; });

    var html = '<div class="quiz-analytics-widget">';
    html += '<div class="quiz-analytics-header">';
    html += '<h2 class="section-title" style="margin:0">' + I18N.t('quizAnalyticsTitle') + '</h2>';
    html += '<span class="quiz-analytics-sub">' + scoreKeys.length + ' ' + I18N.t('quizAnalyticsSub') + '</span>';
    html += '</div>';
    html += '<div class="quiz-analytics-grid">';

    stats.slice(0, 8).forEach(function (s) {
      var color = s.avg >= 80 ? 'var(--success, #22c55e)' : s.avg >= 60 ? 'var(--warning, #f59e0b)' : 'var(--danger, #ef4444)';
      var label = s.avg >= 80 ? I18N.t('quizAnalyticsGood') : s.avg >= 60 ? I18N.t('quizAnalyticsFair') : I18N.t('quizAnalyticsWeak');
      html += '<div class="quiz-analytics-item">';
      html += '<div class="quiz-analytics-item-header">';
      html += '<span class="quiz-analytics-domain">' + s.name + '</span>';
      html += '<span class="quiz-analytics-pct" style="color:' + color + '">' + s.avg + '%</span>';
      html += '</div>';
      html += '<div class="quiz-analytics-bar-bg"><div class="quiz-analytics-bar-fill" style="width:' + s.avg + '%;background:' + color + '"></div></div>';
      html += '<div class="quiz-analytics-item-footer">';
      html += '<span class="quiz-analytics-label" style="color:' + color + '">' + label + '</span>';
      html += '<span class="quiz-analytics-count">' + s.count + ' ' + I18N.t('quizAnalyticsTopics') + '</span>';
      html += '</div>';
      html += '</div>';
    });

    html += '</div>';

    // Overall average
    var totalSum = 0;
    stats.forEach(function (s) { totalSum += s.avg; });
    var overall = stats.length > 0 ? Math.round(totalSum / stats.length) : 0;
    html += '<div class="quiz-analytics-footer">';
    html += I18N.t('quizAnalyticsOverall') + ' <strong>' + overall + '%</strong>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function _findTopic(path) {
    var registry = window.K8S_REGISTRY;
    for (var i = 0; i < registry.domains.length; i++) {
      for (var j = 0; j < registry.domains[i].topics.length; j++) {
        if (registry.domains[i].topics[j].path === path) return registry.domains[i].topics[j];
      }
    }
    return null;
  }

  return { render: render };
})();
