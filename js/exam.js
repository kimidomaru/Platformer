// Exam — simulated exam mode with timer and random questions
var Exam = (function () {
  var timerId = null;

  // Helper: check if a domain is cert-type (not skill)
  function _isCertDomain(domain) {
    return domain.type !== 'skill';
  }

  // Map domain NAME -> blueprint weight (cert-type domains). Used to sample a
  // shortened exam proportionally to each domain's exam weight, not its raw
  // question count — so a quick/challenge run mirrors the real cert blueprint.
  function _buildDomainWeights() {
    var registry = window.K8S_REGISTRY;
    var map = {};
    (registry.domains || []).forEach(function (d) {
      if (d.type === 'skill') return;
      map[d.name] = (typeof d.weight === 'number' && d.weight > 0) ? d.weight : 1;
    });
    return map;
  }

  function _shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // Pick `target` questions from `questions`, allocating slots across domains in
  // proportion to blueprint weight (largest-remainder), then filling any shortfall
  // (domains with too few questions) from the leftover pool. Falls back to a plain
  // shuffle when weights don't apply. Returns a shuffled array of <= target items.
  function _weightedSample(questions, target) {
    if (!target || target >= questions.length) return _shuffle(questions.slice());

    var weights = _buildDomainWeights();

    // group by domain
    var groups = {};
    questions.forEach(function (q) {
      var d = q.domain || 'Other';
      (groups[d] = groups[d] || []).push(q);
    });
    var domains = Object.keys(groups);

    // if no domain has a known blueprint weight, just shuffle+slice uniformly
    var anyWeighted = domains.some(function (d) { return weights[d] !== undefined && weights[d] !== 1; });
    if (!anyWeighted) return _shuffle(questions.slice()).slice(0, target);

    var sumW = domains.reduce(function (s, d) { return s + (weights[d] || 1); }, 0);

    // ideal (fractional) allocation per domain
    var alloc = {}, remainder = [], used = 0;
    domains.forEach(function (d) {
      var ideal = target * (weights[d] || 1) / sumW;
      var base = Math.min(groups[d].length, Math.floor(ideal));
      alloc[d] = base;
      used += base;
      remainder.push({ d: d, frac: ideal - Math.floor(ideal) });
    });

    // distribute the leftover slots by largest fractional remainder (respecting capacity)
    remainder.sort(function (a, b) { return b.frac - a.frac; });
    var ri = 0;
    while (used < target) {
      var progressed = false;
      for (ri = 0; ri < remainder.length && used < target; ri++) {
        var d2 = remainder[ri].d;
        if (alloc[d2] < groups[d2].length) { alloc[d2]++; used++; progressed = true; }
      }
      if (!progressed) break; // all domains exhausted
    }

    // collect picks
    var picked = [];
    domains.forEach(function (d) {
      var pool = _shuffle(groups[d].slice());
      for (var k = 0; k < alloc[d]; k++) picked.push(pool[k]);
    });

    // if still short (rare), top up from any remaining questions
    if (picked.length < target) {
      var chosen = {};
      picked.forEach(function (q) { chosen[(q.source || '') + '|' + q.question] = true; });
      var rest = _shuffle(questions.filter(function (q) {
        return !chosen[(q.source || '') + '|' + q.question];
      }));
      for (var m = 0; m < rest.length && picked.length < target; m++) picked.push(rest[m]);
    }

    return _shuffle(picked);
  }

  // Helper: check if any skill domains have quiz-enabled topics
  function _hasSkillQuizTopics() {
    var registry = window.K8S_REGISTRY;
    for (var i = 0; i < registry.domains.length; i++) {
      var d = registry.domains[i];
      if (d.type !== 'skill') continue;
      for (var j = 0; j < (d.topics || []).length; j++) {
        if (d.topics[j].hasQuiz) return true;
      }
    }
    return false;
  }

  function render(container) {
    var registry = window.K8S_REGISTRY;
    if (!registry) return;

    var html = '<div class="topic-header"><h1>' + I18N.t('examTitle') + '</h1></div>';
    html += '<p style="margin-bottom:1.5rem;color:var(--text-secondary)">' + I18N.t('examIntro') + ' <strong>66%</strong>.</p>';

    // Stats (cert topics only for bank count)
    var totalQs = 0;
    registry.domains.forEach(function (d) {
      if (_isCertDomain(d)) {
        d.topics.forEach(function (t) { if (t.hasQuiz) totalQs++; });
      }
    });
    html += '<p style="margin-bottom:1.25rem;color:var(--text-secondary);font-size:0.9rem">' + I18N.t('questionBank') + ' <strong>' + totalQs + ' ' + I18N.t('topicsWithQuiz') + '</strong></p>';

    // ── PRIMARY: certification/skill-oriented (the default intent) ──
    html += '<h3 style="font-size:0.95rem;margin:0 0 0.75rem;color:var(--text-primary)">' + I18N.t('examModeOriented') + '</h3>';
    html += '<div class="dashboard-grid" style="margin-bottom:1.75rem">';

    html += '<div class="stat-card" style="cursor:pointer;border:2px solid var(--info, #0078d4)" data-mode="cert">';
    html += '<div class="stat-value" style="font-size:1.5rem">&#127891;</div>';
    html += '<div class="stat-label"><strong>' + I18N.t('byCert') + '</strong><br>' + I18N.t('byCertDesc') + '<br><small style="color:var(--text-secondary)">' + I18N.t('byCertSub') + '</small></div>';
    html += '</div>';

    if (_hasSkillQuizTopics()) {
      html += '<div class="stat-card" style="cursor:pointer;border:2px solid var(--warning)" data-mode="skill-pick">';
      html += '<div class="stat-value" style="font-size:1.5rem">&#128736;</div>';
      html += '<div class="stat-label"><strong>' + I18N.t('bySkill') + '</strong><br>' + I18N.t('bySkillDesc') + '<br><small style="color:var(--text-secondary)">' + I18N.t('bySkillSub') + '</small></div>';
      html += '</div>';
    }

    html += '<div class="stat-card" style="cursor:pointer" data-mode="domain">';
    html += '<div class="stat-value" style="font-size:1.5rem">&#127919;</div>';
    html += '<div class="stat-label"><strong>' + I18N.t('byDomain') + '</strong><br>' + I18N.t('byDomainDesc') + '<br><small style="color:var(--text-secondary)">' + I18N.t('byDomainSub') + '</small></div>';
    html += '</div>';
    html += '</div>';

    // ── SECONDARY: general mixed modes (cross all certifications) ──
    html += '<h3 style="font-size:0.95rem;margin:0 0 0.35rem;color:var(--text-secondary)">' + I18N.t('examModeGeneral') + '</h3>';
    html += '<p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 0.75rem">' + I18N.t('examModeGeneralNote') + '</p>';
    html += '<div class="dashboard-grid" style="margin-bottom:1.5rem">';

    html += '<div class="stat-card" style="cursor:pointer" data-mode="full">';
    html += '<div class="stat-value" style="font-size:1.5rem">&#128218;</div>';
    html += '<div class="stat-label"><strong>' + I18N.t('generalExam') + '</strong><br>' + I18N.t('generalExamDesc') + '<br><small style="color:var(--text-secondary)">' + I18N.t('generalExamSub') + '</small></div>';
    html += '</div>';

    html += '<div class="stat-card" style="cursor:pointer" data-mode="quick">';
    html += '<div class="stat-value" style="font-size:1.5rem">&#9889;</div>';
    html += '<div class="stat-label"><strong>' + I18N.t('quickMode') + '</strong><br>' + I18N.t('quickModeDesc') + '<br><small style="color:var(--text-secondary)">' + I18N.t('quickModeSub') + '</small></div>';
    html += '</div>';

    html += '<div class="stat-card" style="cursor:pointer" data-mode="hard">';
    html += '<div class="stat-value" style="font-size:1.5rem">&#128293;</div>';
    html += '<div class="stat-label"><strong>' + I18N.t('challenge') + '</strong><br>' + I18N.t('challengeDesc') + '<br><small style="color:var(--text-secondary)">' + I18N.t('challengeSub') + '</small></div>';
    html += '</div>';
    html += '</div>';

    // Weak-Spot review card (only if there are weak questions)
    var weakCount = State.getWeakCount();
    if (weakCount > 0) {
      html += '<div class="dashboard-grid" style="margin-bottom:1.5rem">';
      html += '<div class="stat-card" style="cursor:pointer;border:2px solid var(--danger)" data-mode="weak">';
      html += '<div class="stat-value" style="font-size:1.5rem">&#129514;</div>';
      html += '<div class="stat-label"><strong>' + I18N.t('weakReview') + '</strong><br>' + weakCount + ' ' + I18N.t('weakReviewDesc') + '<br><small style="color:var(--text-secondary)">' + I18N.t('weakReviewSub') + '</small></div>';
      html += '</div>';
      html += '</div>';
    }

    // Last results
    var lastResult = _getLastResult();
    if (lastResult) {
      html += '<div style="padding:1rem;background:var(--bg-secondary);border-radius:8px;margin-bottom:1rem">';
      html += '<h3 style="margin-bottom:0.5rem;font-size:1rem">' + I18N.t('lastResult') + '</h3>';
      html += '<p style="margin:0;color:var(--text-secondary)">';
      html += 'Score: <strong>' + lastResult.pct + '%</strong> (' + lastResult.score + '/' + lastResult.total + ') - ';
      html += lastResult.pct >= (lastResult.passScore || 66)
        ? '<span style="color:var(--success)">' + I18N.t('passedLabel') + '</span>'
        : '<span style="color:var(--danger)">' + I18N.t('failedLabel') + '</span>';
      html += ' - ' + lastResult.date;
      html += '</p></div>';
    }

    // History section
    var history = _getHistory();
    if (history.length > 0) {
      html += '<div style="margin-bottom:1.5rem">';
      html += '<h3 style="font-size:1rem;margin-bottom:0.75rem;color:var(--text-secondary)">' + I18N.t('examHistory') + '</h3>';
      html += '<table class="exam-history-table">';
      html += '<thead><tr><th>' + I18N.t('histColNum') + '</th><th>' + I18N.t('histColDate') + '</th><th>' + I18N.t('histColScore') + '</th><th>' + I18N.t('histColQuestions') + '</th><th>' + I18N.t('histColResult') + '</th></tr></thead>';
      html += '<tbody>';
      history.forEach(function (r, i) {
        var passed = r.pct >= (r.passScore || 66);
        html += '<tr>';
        html += '<td style="color:var(--text-muted)">' + (i + 1) + '</td>';
        html += '<td>' + r.date + '</td>';
        html += '<td><strong>' + r.pct + '%</strong></td>';
        html += '<td style="color:var(--text-secondary)">' + r.score + '/' + r.total + '</td>';
        html += '<td style="color:' + (passed ? 'var(--success)' : 'var(--danger)') + ';font-weight:600">' + (passed ? '&#10004; ' + I18N.t('passedLabel') : '&#10008; ' + I18N.t('failedLabel')) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += '</div>';
    }

    container.innerHTML = html;

    container.querySelectorAll('[data-mode]').forEach(function (card) {
      card.addEventListener('click', function () {
        var mode = card.getAttribute('data-mode');
        if (mode === 'domain') {
          _showDomainPicker(container);
        } else if (mode === 'cert') {
          _showCertPicker(container);
        } else if (mode === 'skill-pick') {
          _showSkillPicker(container);
        } else if (mode === 'weak') {
          _startWeakReview(container);
        } else {
          _startExam(container, mode);
        }
      });
    });
  }

  function _showDomainPicker(container) {
    var registry = window.K8S_REGISTRY;
    var html = '<div class="topic-header"><h1>' + I18N.t('selectDomainTitle') + '</h1></div>';
    html += '<p style="margin-bottom:1.5rem;color:var(--text-secondary)">' + I18N.t('selectDomainDesc') + '</p>';

    html += '<div style="display:flex;flex-direction:column;gap:0.75rem">';
    registry.domains.forEach(function (domain, idx) {
      var topicCount = 0;
      domain.topics.forEach(function (t) { if (t.hasQuiz) topicCount++; });
      if (topicCount === 0) return;

      // Show type badge for skill domains
      var badge = domain.type === 'skill' ? ' <span style="font-size:0.7rem;color:var(--warning);font-weight:600">SKILL</span>' : '';

      html += '<div class="stat-card" style="cursor:pointer;text-align:left;padding:1rem" data-domain="' + idx + '">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center">';
      html += '<div>';
      html += '<strong>' + domain.name + '</strong>' + badge;
      html += '<br><small style="color:var(--text-secondary)">' + topicCount + ' ' + I18N.t('topicsWithQuizIn') + '</small>';
      html += '</div>';
      html += '<span style="color:var(--accent);font-size:1.2rem">&#8594;</span>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div style="margin-top:1.5rem">';
    html += '<button class="btn btn-secondary" onclick="window.location.hash=\'#exam\'">' + I18N.t('backLabel') + '</button>';
    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll('[data-domain]').forEach(function (card) {
      card.addEventListener('click', function () {
        var domainIdx = parseInt(card.getAttribute('data-domain'));
        _startExam(container, 'domain', domainIdx);
      });
    });
  }

  // Count quiz-enabled topics belonging to a given certification id
  function _countCertQuizTopics(certId) {
    var registry = window.K8S_REGISTRY;
    var count = 0;
    registry.domains.forEach(function (domain) {
      if (domain.type === 'skill') return;
      if (!domain.cert || domain.cert.indexOf(certId) === -1) return;
      (domain.topics || []).forEach(function (t) { if (t.hasQuiz) count++; });
    });
    return count;
  }

  function _showCertPicker(container) {
    var registry = window.K8S_REGISTRY;
    var groupLabels = { kubernetes: 'Kubernetes', aws: 'AWS', azure: 'Azure' };

    var html = '<div class="topic-header"><h1>' + I18N.t('selectCertTitle') + '</h1></div>';
    html += '<p style="margin-bottom:1.5rem;color:var(--text-secondary)">' + I18N.t('selectCertDesc') + '</p>';

    // Group certifications by their `group` field, preserving registry order
    var order = [];
    var grouped = {};
    (registry.certifications || []).forEach(function (cert) {
      var g = cert.group || 'other';
      if (!grouped[g]) { grouped[g] = []; order.push(g); }
      grouped[g].push(cert);
    });

    order.forEach(function (g) {
      html += '<h3 style="font-size:0.9rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin:1.25rem 0 0.5rem">' + (groupLabels[g] || g) + '</h3>';
      html += '<div style="display:flex;flex-direction:column;gap:0.75rem">';
      grouped[g].forEach(function (cert) {
        var topicCount = _countCertQuizTopics(cert.id);
        var disabled = topicCount === 0;
        html += '<div class="stat-card" style="text-align:left;padding:1rem;' + (disabled ? 'opacity:0.45;cursor:not-allowed' : 'cursor:pointer') + '"' + (disabled ? '' : ' data-cert="' + cert.id + '"') + '>';
        html += '<div style="display:flex;justify-content:space-between;align-items:center">';
        html += '<div>';
        html += '<strong>' + cert.label + '</strong> <span style="color:var(--text-secondary);font-size:0.9rem">' + cert.fullName + '</span>';
        html += '<br><small style="color:var(--text-secondary)">' + topicCount + ' ' + I18N.t('topicsWithQuizInCert') + ' &bull; ' + I18N.t('passScoreLabel') + ' ' + (cert.passScore || 66) + '%</small>';
        html += '</div>';
        if (!disabled) html += '<span style="color:var(--accent);font-size:1.2rem">&#8594;</span>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    });

    html += '<div style="margin-top:1.5rem">';
    html += '<button class="btn btn-secondary" onclick="window.location.hash=\'#exam\'">' + I18N.t('backLabel') + '</button>';
    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll('[data-cert]').forEach(function (card) {
      card.addEventListener('click', function () {
        var certId = card.getAttribute('data-cert');
        var certMeta = (registry.certifications || []).filter(function (c) { return c.id === certId; })[0];
        _showModeSelection(container, 'cert', certId, certMeta ? certMeta.label : certId);
      });
    });
  }

  // Skill picker — list skill-type domains individually (scoped, not mixed)
  function _showSkillPicker(container) {
    var registry = window.K8S_REGISTRY;
    var html = '<div class="topic-header"><h1>' + I18N.t('selectSkillTitle') + '</h1></div>';
    html += '<p style="margin-bottom:1.5rem;color:var(--text-secondary)">' + I18N.t('selectSkillDesc') + '</p>';

    html += '<div style="display:flex;flex-direction:column;gap:0.75rem">';
    registry.domains.forEach(function (domain, idx) {
      if (domain.type !== 'skill') return;
      var topicCount = 0;
      (domain.topics || []).forEach(function (t) { if (t.hasQuiz) topicCount++; });
      if (topicCount === 0) return;

      html += '<div class="stat-card" style="cursor:pointer;text-align:left;padding:1rem" data-skill-idx="' + idx + '">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center">';
      html += '<div>';
      html += '<strong>' + (domain.icon ? domain.icon + ' ' : '') + domain.name + '</strong>';
      html += '<br><small style="color:var(--text-secondary)">' + topicCount + ' ' + I18N.t('topicsWithQuizInSkill') + '</small>';
      html += '</div>';
      html += '<span style="color:var(--accent);font-size:1.2rem">&#8594;</span>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div style="margin-top:1.5rem">';
    html += '<button class="btn btn-secondary" onclick="window.location.hash=\'#exam\'">' + I18N.t('backLabel') + '</button>';
    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll('[data-skill-idx]').forEach(function (card) {
      card.addEventListener('click', function () {
        var idx = parseInt(card.getAttribute('data-skill-idx'));
        _showModeSelection(container, 'skill', idx, registry.domains[idx].name);
      });
    });
  }

  // Length selection — scoped to a chosen cert or skill (full / quick / challenge)
  function _showModeSelection(container, scopeType, scopeId, scopeLabel) {
    var html = '<div class="topic-header"><h1>' + I18N.t('chooseLengthTitle') + '</h1></div>';
    html += '<p style="margin-bottom:1.5rem;color:var(--text-secondary)">' + I18N.t('chooseLengthDesc') + ' <strong>' + scopeLabel + '</strong></p>';

    html += '<div class="dashboard-grid" style="margin-bottom:1.5rem">';

    html += '<div class="stat-card" style="cursor:pointer;border:2px solid var(--accent)" data-len="full">';
    html += '<div class="stat-value" style="font-size:1.5rem">&#128218;</div>';
    html += '<div class="stat-label"><strong>' + I18N.t('fullExam') + '</strong><br>' + I18N.t('fullExamDesc') + '<br><small style="color:var(--text-secondary)">' + I18N.t('fullExamSub') + '</small></div>';
    html += '</div>';

    html += '<div class="stat-card" style="cursor:pointer" data-len="quick">';
    html += '<div class="stat-value" style="font-size:1.5rem">&#9889;</div>';
    html += '<div class="stat-label"><strong>' + I18N.t('quickMode') + '</strong><br>' + I18N.t('quickModeDesc') + '<br><small style="color:var(--text-secondary)">' + I18N.t('quickModeSub') + '</small></div>';
    html += '</div>';

    html += '<div class="stat-card" style="cursor:pointer" data-len="hard">';
    html += '<div class="stat-value" style="font-size:1.5rem">&#128293;</div>';
    html += '<div class="stat-label"><strong>' + I18N.t('challenge') + '</strong><br>' + I18N.t('challengeDesc') + '<br><small style="color:var(--text-secondary)">' + I18N.t('challengeSub') + '</small></div>';
    html += '</div>';
    html += '</div>';

    html += '<div style="margin-top:0.5rem">';
    html += '<button class="btn btn-secondary" data-back="' + scopeType + '">' + I18N.t('backLabel') + '</button>';
    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll('[data-len]').forEach(function (card) {
      card.addEventListener('click', function () {
        var len = card.getAttribute('data-len');
        if (scopeType === 'cert') {
          _startExam(container, 'cert', undefined, scopeId, len);
        } else {
          _startExam(container, 'skill', scopeId, undefined, len);
        }
      });
    });

    var backBtn = container.querySelector('[data-back]');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (scopeType === 'cert') _showCertPicker(container);
        else _showSkillPicker(container);
      });
    }
  }

  function _startExam(container, mode, domainIdx, certId, lengthMode) {
    var registry = window.K8S_REGISTRY;
    var allPaths = [];
    var passScore = 66;

    if (mode === 'cert' && certId) {
      // Cert exam: all quiz topics from cert-type domains tied to this cert
      registry.domains.forEach(function (domain) {
        if (domain.type === 'skill') return;
        if (!domain.cert || domain.cert.indexOf(certId) === -1) return;
        (domain.topics || []).forEach(function (topic) {
          if (topic.hasQuiz) allPaths.push(topic.path);
        });
      });
      var certMeta = (registry.certifications || []).filter(function (c) { return c.id === certId; })[0];
      if (certMeta && certMeta.passScore) passScore = certMeta.passScore;
    } else if (mode === 'domain' && domainIdx !== undefined) {
      var domain = registry.domains[domainIdx];
      domain.topics.forEach(function (topic) {
        if (topic.hasQuiz) allPaths.push(topic.path);
      });
    } else if (mode === 'skill') {
      if (domainIdx !== undefined) {
        // Scoped skill: a single skill-type domain only
        var sd = registry.domains[domainIdx];
        (sd.topics || []).forEach(function (topic) {
          if (topic.hasQuiz) allPaths.push(topic.path);
        });
      } else {
        // Legacy: all skill-type domains mixed
        registry.domains.forEach(function (domain) {
          if (domain.type !== 'skill') return;
          (domain.topics || []).forEach(function (topic) {
            if (topic.hasQuiz) allPaths.push(topic.path);
          });
        });
      }
    } else {
      // full, quick, hard (general/mixed): cert-type domains only
      registry.domains.forEach(function (domain) {
        if (domain.type === 'skill') return;
        domain.topics.forEach(function (topic) {
          if (topic.hasQuiz) allPaths.push(topic.path);
        });
      });
    }

    container.innerHTML = '<div class="loading"><p>' + I18N.t('loadingQuestions') + '</p></div>';

    Loader.loadMultiple(allPaths).then(function () {
      var questions = [];
      allPaths.forEach(function (path) {
        var content = window.K8S_CONTENT[path];
        if (content && content.quiz) {
          content.quiz.forEach(function (q) {
            var domainName = '';
            registry.domains.forEach(function (d) {
              d.topics.forEach(function (t) {
                if (t.path === path) domainName = d.name;
              });
            });
            questions.push(Object.assign({}, q, { source: path, domain: domainName }));
          });
        }
      });

      // Shuffle using Fisher-Yates
      _shuffle(questions);

      // Effective length: scoped exams (cert/skill) carry their length in
      // lengthMode; general mixed exams carry it directly in `mode`.
      // Shortened runs sample proportionally to each domain's blueprint weight
      // (_weightedSample) so the mix mirrors the real exam instead of the bank.
      var lengthSel = lengthMode || mode;
      var timeMinutes = 120;
      if (lengthSel === 'quick') {
        questions = _weightedSample(questions, 20);
        timeMinutes = 30;
      } else if (lengthSel === 'hard') {
        questions = _weightedSample(questions, 25);
        timeMinutes = 45;
      } else if (mode === 'skill') {
        // Full-length scoped skill exam (single domain → no weighting needed)
        questions = questions.slice(0, 40);
        timeMinutes = Math.max(20, Math.ceil(questions.length * 1.4));
      } else if (mode === 'domain') {
        timeMinutes = Math.max(15, Math.ceil(questions.length * 1.5));
      } else if (mode === 'cert') {
        timeMinutes = Math.max(20, Math.ceil(questions.length * 1.5));
      }

      if (questions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128221;</div><p>' + I18N.t('noQuestionsAvailable') + '</p></div>';
        return;
      }

      _runExam(container, questions, timeMinutes, mode, passScore);
    }).catch(function () {
      container.innerHTML = '<div class="empty-state"><p>' + I18N.t('loadingError') + '</p></div>';
    });
  }

  // Weak-Spot review — rebuild a quiz from stored wrong questions (no topic load needed)
  function _startWeakReview(container) {
    var weak = State.getWeakQuestions();
    if (weak.length === 0) {
      container.innerHTML = '<div class="topic-header"><h1>' + I18N.t('weakReview') + '</h1></div>'
        + '<div class="empty-state"><div class="empty-icon">&#127881;</div><p>' + I18N.t('weakNone') + '</p>'
        + '<button class="btn btn-primary" onclick="window.location.hash=\'#exam\'" style="margin-top:1rem">' + I18N.t('backLabel') + '</button></div>';
      return;
    }
    var questions = weak.map(function (r) {
      return {
        question: r.question, options: r.options, correct: r.correct,
        explanation: r.explanation, reference: r.reference,
        domain: r.domain, source: r.topicPath
      };
    });
    // Shuffle (Fisher-Yates)
    for (var i = questions.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = questions[i]; questions[i] = questions[j]; questions[j] = t;
    }
    var minutes = Math.max(5, Math.ceil(questions.length * 1.2));
    _runExam(container, questions, minutes, 'weak');
  }

  // Route entry point (#weak)
  function renderWeak(container) {
    _startWeakReview(container);
  }

  function _runExam(container, questions, minutes, mode, passScore) {
    var state = {
      current: 0,
      answers: new Array(questions.length).fill(null),
      flagged: new Array(questions.length).fill(false),
      timeLeft: minutes * 60,
      initialTime: minutes * 60,
      mode: mode || 'full',
      passScore: passScore || 66
    };

    _renderExamQuestion(container, questions, state);

    if (timerId) clearInterval(timerId);
    timerId = setInterval(function () {
      state.timeLeft--;
      if (state.timeLeft <= 0) {
        clearInterval(timerId);
        _finishExam(container, questions, state);
        return;
      }
      var timerEl = container.querySelector('.exam-timer');
      if (timerEl) {
        timerEl.textContent = _formatTime(state.timeLeft);
        timerEl.className = 'exam-timer' + (state.timeLeft < 300 ? ' critical' : state.timeLeft < 600 ? ' warning' : '');
      }
    }, 1000);
  }

  function _renderExamQuestion(container, questions, state) {
    var q = questions[state.current];
    var i = state.current;

    var html = '<div class="quiz-container">';

    // Header with timer and progress
    html += '<div class="exam-header">';
    html += '<span>' + I18N.t('questionLabel') + ' ' + (i + 1) + ' / ' + questions.length + '</span>';
    html += '<span class="exam-timer">' + _formatTime(state.timeLeft) + '</span>';
    html += '</div>';

    // Progress bar
    var answered = state.answers.filter(function (a) { return a !== null; }).length;
    var progressPct = Math.round((answered / questions.length) * 100);
    html += '<div style="background:var(--bg-secondary);border-radius:4px;height:6px;margin-bottom:1rem;overflow:hidden">';
    html += '<div style="background:var(--accent);height:100%;width:' + progressPct + '%;transition:width 0.3s"></div>';
    html += '</div>';
    html += '<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:1rem">' + answered + '/' + questions.length + ' ' + I18N.t('answeredLabel');
    if (q.domain) html += ' &bull; ' + I18N.t('domainLabel') + ' ' + q.domain;
    html += '</div>';

    // Question
    html += '<div class="quiz-question">';
    html += '<h3>' + q.question + '</h3>';
    html += '<div class="quiz-options">';
    q.options.forEach(function (opt, idx) {
      var marker = String.fromCharCode(65 + idx);
      var cls = 'quiz-option' + (state.answers[i] === idx ? ' selected' : '');
      html += '<button class="' + cls + '" data-idx="' + idx + '">';
      html += '<span class="option-marker">' + marker + '</span>';
      html += '<span>' + opt + '</span>';
      html += '</button>';
    });
    html += '</div></div>';

    // Navigation
    html += '<div class="quiz-nav">';
    if (i > 0) html += '<button class="btn btn-secondary" data-action="prev">' + I18N.t('prevLabel') + '</button>';
    var flagLabel = state.flagged[i] ? I18N.t('flaggedLabel') : I18N.t('flagLabel');
    html += '<button class="btn btn-secondary" data-action="flag" style="font-size:0.85rem">' + flagLabel + '</button>';
    if (i < questions.length - 1) html += '<button class="btn btn-primary" data-action="next">' + I18N.t('nextLabel') + '</button>';
    html += '<button class="btn btn-danger" data-action="finish" style="margin-left:auto">' + I18N.t('finishLabel') + '</button>';
    html += '</div>';

    // Quick navigation panel
    html += '<div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border)">';
    html += '<div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.5rem">' + I18N.t('quickNavLabel') + '</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
    for (var qi = 0; qi < questions.length; qi++) {
      var bgColor = 'var(--bg-secondary)';
      var textStyle = '';
      if (qi === i) { bgColor = 'var(--accent)'; textStyle = 'color:white;'; }
      else if (state.answers[qi] !== null) { bgColor = 'var(--success)'; textStyle = 'color:white;'; }
      if (state.flagged[qi] && qi !== i) { bgColor = '#f59e0b'; textStyle = 'color:white;'; }
      html += '<button data-goto="' + qi + '" style="width:32px;height:32px;border:none;border-radius:4px;cursor:pointer;font-size:0.75rem;background:' + bgColor + ';' + textStyle + '">' + (qi + 1) + '</button>';
    }
    html += '</div>';
    html += '<div style="margin-top:0.5rem;font-size:0.75rem;color:var(--text-secondary)">';
    html += '<span style="display:inline-block;width:12px;height:12px;background:var(--success);border-radius:2px;vertical-align:middle;margin-right:4px"></span> ' + I18N.t('legendAnswered') + ' ';
    html += '<span style="display:inline-block;width:12px;height:12px;background:#f59e0b;border-radius:2px;vertical-align:middle;margin-right:4px;margin-left:8px"></span> ' + I18N.t('legendFlagged') + ' ';
    html += '<span style="display:inline-block;width:12px;height:12px;background:var(--accent);border-radius:2px;vertical-align:middle;margin-right:4px;margin-left:8px"></span> ' + I18N.t('legendCurrent');
    html += '</div>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    // Event: select answer
    container.querySelectorAll('.quiz-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.answers[i] = parseInt(btn.getAttribute('data-idx'));
        _renderExamQuestion(container, questions, state);
      });
    });

    // Event: navigation
    container.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-action');
        if (action === 'prev') { state.current--; _renderExamQuestion(container, questions, state); }
        else if (action === 'next') { state.current++; _renderExamQuestion(container, questions, state); }
        else if (action === 'flag') { state.flagged[i] = !state.flagged[i]; _renderExamQuestion(container, questions, state); }
        else if (action === 'finish') {
          var unanswered = state.answers.filter(function (a) { return a === null; }).length;
          if (unanswered > 0) {
            if (!confirm(unanswered + I18N.t('unansweredWarning'))) return;
          }
          clearInterval(timerId);
          _finishExam(container, questions, state);
        }
      });
    });

    // Event: goto question
    container.querySelectorAll('[data-goto]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.current = parseInt(btn.getAttribute('data-goto'));
        _renderExamQuestion(container, questions, state);
      });
    });
  }

  function _finishExam(container, questions, state) {
    var score = 0;
    questions.forEach(function (q, i) {
      if (state.answers[i] === q.correct) score++;
    });
    var pct = Math.round((score / questions.length) * 100);
    var isSkillMode = state.mode === 'skill';
    var noPassFail = state.mode === 'skill' || state.mode === 'weak';
    var passScore = state.passScore || 66;
    var passed = pct >= passScore;

    if (state.mode !== 'weak') _saveResult(pct, score, questions.length, passScore);

    // Record per-question analytics for Weak-Spot review
    questions.forEach(function (q, i) {
      if (!q.question) return;
      State.recordQuizAnswer({
        topicPath: q.source || '', topicName: '', domain: q.domain || '',
        question: q.question, options: q.options, correct: q.correct,
        explanation: q.explanation, reference: q.reference
      }, state.answers[i] === q.correct);
    });

    // Domain breakdown
    var domainScores = {};
    questions.forEach(function (q, i) {
      var d = q.domain || 'Other';
      if (!domainScores[d]) domainScores[d] = { correct: 0, total: 0 };
      domainScores[d].total++;
      if (state.answers[i] === q.correct) domainScores[d].correct++;
    });

    var html = '<div class="quiz-results">';
    html += '<div class="score" style="color:' + (passed ? 'var(--success)' : 'var(--danger)') + '">' + pct + '%</div>';
    html += '<div class="score-label">' + score + '/' + questions.length + ' ' + I18N.t('correctsOf') + '</div>';
    if (state.mode === 'weak') {
      html += '<p style="margin-bottom:1rem;color:var(--text-secondary)">' + I18N.t('weakRemaining') + ' <strong>' + State.getWeakCount() + '</strong></p>';
    }
    if (!noPassFail) {
      html += '<p style="margin-bottom:1rem;font-size:1.2rem;font-weight:bold;color:' + (passed ? 'var(--success)' : 'var(--danger)') + '">';
      html += passed ? '&#10004; ' + I18N.t('passedLabel').toUpperCase() : '&#10008; ' + I18N.t('failedLabel').toUpperCase();
      html += '</p>';
    }

    var totalTime = (state.initialTime || 0) - state.timeLeft;
    html += '<p style="margin-bottom:1.5rem;color:var(--text-secondary)">' + (noPassFail ? '' : I18N.t('minScore') + ' ' + passScore + '% &bull; ') + I18N.t('timeUsed') + ' ' + _formatTime(totalTime) + '</p>';

    // Domain breakdown table
    html += '<div style="margin-bottom:2rem;text-align:left">';
    html += '<h3 style="margin-bottom:1rem;font-size:1rem">' + I18N.t('domainPerformance') + '</h3>';
    html += '<table class="info-table" style="width:100%">';
    html += '<tr><th>' + I18N.t('histColDate').replace('Date', I18N.t('byDomain')) + '</th><th>' + I18N.t('legendAnswered') + '</th><th>%</th></tr>';
    var domainKeys = Object.keys(domainScores).sort();
    domainKeys.forEach(function (d) {
      var ds = domainScores[d];
      var dpct = Math.round((ds.correct / ds.total) * 100);
      var color = dpct >= 66 ? 'var(--success)' : dpct >= 50 ? '#f59e0b' : 'var(--danger)';
      html += '<tr>';
      html += '<td>' + d + '</td>';
      html += '<td>' + ds.correct + '/' + ds.total + '</td>';
      html += '<td style="color:' + color + ';font-weight:bold">' + dpct + '%</td>';
      html += '</tr>';
    });
    html += '</table>';
    html += '</div>';

    // Actions
    html += '<div style="display:flex;gap:0.75rem;flex-wrap:wrap;justify-content:center;margin-bottom:2rem">';
    html += '<button class="btn btn-primary" onclick="window.location.hash=\'#exam\'">' + I18N.t('newExam') + '</button>';
    html += '<button class="btn btn-secondary" data-action="review">' + I18N.t('reviewAnswers') + '</button>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    var reviewBtn = container.querySelector('[data-action="review"]');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', function () {
        _showReview(container, questions, state);
      });
    }
  }

  function _showReview(container, questions, state) {
    var html = '<div class="topic-header"><h1>' + I18N.t('reviewTitle') + '</h1></div>';
    html += '<div style="display:flex;gap:0.75rem;margin-bottom:1.5rem;flex-wrap:wrap">';
    html += '<button class="btn btn-secondary" onclick="window.location.hash=\'#exam\'">' + I18N.t('backToExam') + '</button>';
    html += '<button class="btn btn-secondary" data-filter="all">' + I18N.t('filterAll') + '</button>';
    html += '<button class="btn btn-secondary" data-filter="wrong">' + I18N.t('filterWrong') + '</button>';
    html += '<button class="btn btn-secondary" data-filter="unanswered">' + I18N.t('filterUnanswered') + '</button>';
    html += '</div>';

    html += '<div id="review-questions">';
    html += _renderReviewQuestions(questions, state, 'all');
    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll('[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filter = btn.getAttribute('data-filter');
        var reviewEl = container.querySelector('#review-questions');
        if (reviewEl) {
          reviewEl.innerHTML = _renderReviewQuestions(questions, state, filter);
        }
        container.querySelectorAll('[data-filter]').forEach(function (b) {
          b.style.borderColor = '';
        });
        btn.style.borderColor = 'var(--accent)';
      });
    });
  }

  function _renderReviewQuestions(questions, state, filter) {
    var html = '';
    var count = 0;

    questions.forEach(function (q, i) {
      var isCorrect = state.answers[i] === q.correct;
      var isUnanswered = state.answers[i] === null;

      if (filter === 'wrong' && (isCorrect || isUnanswered)) return;
      if (filter === 'unanswered' && !isUnanswered) return;

      count++;

      var borderColor = isCorrect ? 'var(--success)' : isUnanswered ? 'var(--text-secondary)' : 'var(--danger)';
      var icon = isCorrect ? '&#10004;' : isUnanswered ? '&#10067;' : '&#10008;';

      html += '<div style="border-left:4px solid ' + borderColor + ';padding:1rem;margin-bottom:1rem;background:var(--bg-secondary);border-radius:0 8px 8px 0">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">';
      html += '<span style="font-weight:bold;color:' + borderColor + '">' + icon + ' ' + I18N.t('questionLabel') + ' ' + (i + 1) + '</span>';
      if (q.domain) html += '<span style="font-size:0.8rem;color:var(--text-secondary)">' + q.domain + '</span>';
      html += '</div>';

      html += '<p style="margin-bottom:0.75rem;font-weight:500">' + q.question + '</p>';

      q.options.forEach(function (opt, idx) {
        var marker = String.fromCharCode(65 + idx);
        var style = 'padding:0.5rem;margin-bottom:0.25rem;border-radius:4px;';

        if (idx === q.correct) {
          style += 'background:rgba(34,197,94,0.15);border:1px solid var(--success);';
        } else if (idx === state.answers[i] && !isCorrect) {
          style += 'background:rgba(239,68,68,0.15);border:1px solid var(--danger);text-decoration:line-through;';
        } else {
          style += 'border:1px solid var(--border);';
        }

        html += '<div style="' + style + '">';
        html += '<strong>' + marker + '.</strong> ' + opt;
        if (idx === q.correct) html += ' &#10004;';
        if (idx === state.answers[i] && !isCorrect) html += ' ' + I18N.t('yourAnswer');
        html += '</div>';
      });

      if (q.explanation) {
        html += '<div style="margin-top:0.75rem;padding:0.75rem;background:var(--bg-primary);border-radius:4px;font-size:0.9rem;color:var(--text-secondary)">';
        html += '<strong>' + I18N.t('explanationLabel') + '</strong> ' + q.explanation;
        html += '</div>';
      }

      html += '</div>';
    });

    if (count === 0) {
      html = '<div class="empty-state"><p>' + I18N.t('noQuestionsCategory') + '</p></div>';
    }

    return html;
  }

  function _formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function _saveResult(pct, score, total, passScore) {
    try {
      var now = new Date();
      var lang = I18N.getLang();
      var dateStr = lang === 'en'
        ? now.toLocaleDateString('en-US') + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      var result = { pct: pct, score: score, total: total, date: dateStr, timestamp: now.getTime(), passScore: passScore || 66 };
      localStorage.setItem('k8s_exam_last_result', JSON.stringify(result));

      var history = [];
      try { history = JSON.parse(localStorage.getItem('k8s_exam_history') || '[]'); } catch (e) {}
      history.unshift(result);
      if (history.length > 20) history = history.slice(0, 20);
      localStorage.setItem('k8s_exam_history', JSON.stringify(history));
    } catch (e) {}
  }

  function _getLastResult() {
    try {
      var result = localStorage.getItem('k8s_exam_last_result');
      return result ? JSON.parse(result) : null;
    } catch (e) { return null; }
  }

  function _getHistory() {
    try {
      return JSON.parse(localStorage.getItem('k8s_exam_history') || '[]');
    } catch (e) { return []; }
  }

  function destroy() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  return {
    render: render,
    renderWeak: renderWeak,
    destroy: destroy
  };
})();
