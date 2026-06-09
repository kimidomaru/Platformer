// Renderer — renders a topic page with tabs (Theory, Quiz, Flashcards, Lab, Troubleshooting)
var Renderer = (function () {

  function renderTopic(container, topicPath, content) {
    var registry = window.K8S_REGISTRY;
    var topicMeta = _findTopic(registry, topicPath);
    var domainMeta = _findDomain(registry, topicPath);

    if (!topicMeta || !content) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128533;</div><p>' + I18N.t('topicNotFound') + '</p></div>';
      return;
    }

    // Detect if we're showing PT fallback in EN mode
    var lang = I18N.getLang();
    var isEnFallback = lang === 'en' && !Loader.hasEnContent(topicPath);

    // Track as recent
    State.addRecent(topicPath, topicMeta.name);

    // Auto-mark as in-progress if not started
    if (State.getProgress(topicPath) === 'not-started') {
      State.setProgress(topicPath, 'in-progress');
      Sidebar.refreshStatus();
    }

    var status = State.getProgress(topicPath);
    var html = '';

    // EN fallback banner
    if (isEnFallback) {
      html += '<div class="lang-fallback-banner">' + I18N.t('ptOnlyBanner') + '</div>';
    }

    // Topic header
    html += '<div class="topic-header">';
    html += '<h1>' + topicMeta.name;
    html += ' <span class="badge badge-' + topicMeta.difficulty + '">' + topicMeta.difficulty + '</span>';
    html += '</h1>';
    html += '<div class="topic-meta">';
    html += '<span>' + domainMeta.icon + ' ' + domainMeta.name + '</span>';
    html += '<span>&bull;</span>';
    html += '<button class="progress-toggle" data-topic="' + topicPath + '">';
    html += '<span class="status-dot ' + status + '" style="display:inline-block"></span> ';
    html += _statusLabel(status);
    html += '</button>';

    var quizScore = State.getQuizScore(topicPath);
    if (quizScore) {
      html += '<span>&bull;</span>';
      html += '<span>Quiz: ' + Math.round((quizScore.score / quizScore.total) * 100) + '%</span>';
    }

    html += '</div></div>';

    // Build available tabs
    var tabs = [];
    if (content.theory) tabs.push({ id: 'theory', label: I18N.t('theory') });
    if (content.quiz && content.quiz.length) tabs.push({ id: 'quiz', label: I18N.t('quiz') + ' (' + content.quiz.length + ')' });
    if (content.flashcards && content.flashcards.length) tabs.push({ id: 'flashcards', label: I18N.t('flashcards') });
    if (content.lab) tabs.push({ id: 'lab', label: I18N.t('lab') });
    if (content.troubleshooting && content.troubleshooting.length) tabs.push({ id: 'troubleshooting', label: I18N.t('troubleshooting') });

    // Tabs navigation
    html += '<div class="tabs" role="tablist" aria-label="' + I18N.t('theory') + '">';
    tabs.forEach(function (tab, idx) {
      html += '<button class="tab-btn' + (idx === 0 ? ' active' : '') + '"'
        + ' role="tab" id="tab-' + tab.id + '" aria-controls="panel-' + tab.id + '"'
        + ' aria-selected="' + (idx === 0 ? 'true' : 'false') + '"'
        + ' tabindex="' + (idx === 0 ? '0' : '-1') + '"'
        + ' data-tab="' + tab.id + '">' + tab.label + '</button>';
    });
    html += '</div>';

    // Tab panels
    tabs.forEach(function (tab, idx) {
      html += '<div class="tab-panel' + (idx === 0 ? ' active' : '') + '" id="panel-' + tab.id + '"'
        + ' role="tabpanel" aria-labelledby="tab-' + tab.id + '"' + (idx === 0 ? '' : ' hidden') + '></div>';
    });

    container.innerHTML = html;

    // Render first tab content
    if (tabs.length > 0) {
      _renderPanel(tabs[0].id, content, topicPath);
    }

    // Tab switching (click + roving-tabindex keyboard nav per WAI-ARIA)
    var tabBtns = Array.prototype.slice.call(container.querySelectorAll('.tab-btn'));

    function _activateTab(btn, focus) {
      tabBtns.forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
        b.setAttribute('tabindex', '-1');
      });
      container.querySelectorAll('.tab-panel').forEach(function (p) {
        p.classList.remove('active');
        p.setAttribute('hidden', '');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      btn.setAttribute('tabindex', '0');
      var tabId = btn.getAttribute('data-tab');
      var panel = document.getElementById('panel-' + tabId);
      panel.classList.add('active');
      panel.removeAttribute('hidden');
      if (focus) btn.focus();
      _renderPanel(tabId, content, topicPath);
    }

    tabBtns.forEach(function (btn, idx) {
      btn.addEventListener('click', function () { _activateTab(btn, false); });
      btn.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabBtns[(idx + 1) % tabBtns.length];
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabBtns[(idx - 1 + tabBtns.length) % tabBtns.length];
        else if (e.key === 'Home') next = tabBtns[0];
        else if (e.key === 'End') next = tabBtns[tabBtns.length - 1];
        if (next) { e.preventDefault(); _activateTab(next, true); }
      });
    });

    // Progress toggle
    var progressBtn = container.querySelector('.progress-toggle');
    if (progressBtn) {
      progressBtn.addEventListener('click', function () {
        var newStatus = State.cycleProgress(topicPath);
        var dot = progressBtn.querySelector('.status-dot');
        dot.className = 'status-dot ' + newStatus;
        dot.style.display = 'inline-block';
        progressBtn.childNodes[1].textContent = ' ' + _statusLabel(newStatus);
        Sidebar.refreshStatus();
      });
    }
  }

  function _renderPanel(tabId, content, topicPath) {
    var panel = document.getElementById('panel-' + tabId);
    if (!panel || panel.dataset.rendered) return;
    panel.dataset.rendered = 'true';

    switch (tabId) {
      case 'theory':
        panel.innerHTML = '<div class="theory-content">' + Markdown.render(content.theory) + '</div>' + _renderNotesWidget(topicPath);
        _bindNotesWidget(panel, topicPath);
        break;
      case 'quiz':
        Quiz.render(panel, content.quiz, topicPath);
        break;
      case 'flashcards':
        var topicMeta = _findTopic(window.K8S_REGISTRY, topicPath);
        Flashcard.render(panel, content.flashcards, topicPath, topicMeta ? topicMeta.name : '');
        break;
      case 'lab':
        Lab.render(panel, content.lab);
        break;
      case 'troubleshooting':
        Lab.renderTroubleshooting(panel, content.troubleshooting);
        break;
    }
  }

  function _renderNotesWidget(topicPath) {
    var note = State.getNote(topicPath);
    var html = '<div class="notes-widget" id="notes-widget-' + topicPath.replace(/\//g, '-') + '">';
    html += '<div class="notes-widget__header">';
    html += '<span class="notes-widget__title">' + I18N.t('notesTitle') + '</span>';
    html += '<div class="notes-widget__actions">';
    html += '<span class="notes-saved-indicator hidden" id="notes-saved-' + topicPath.replace(/\//g, '-') + '">' + I18N.t('notesSaved') + '</span>';
    html += '<button class="notes-clear-btn" data-topic="' + topicPath + '">' + I18N.t('notesClear') + '</button>';
    html += '</div>';
    html += '</div>';
    html += '<textarea class="notes-textarea" data-topic="' + topicPath + '" placeholder="' + I18N.t('notesPlaceholder') + '">' + _escapeHtml(note) + '</textarea>';
    html += '</div>';
    return html;
  }

  function _bindNotesWidget(panel, topicPath) {
    var textarea = panel.querySelector('.notes-textarea[data-topic="' + topicPath + '"]');
    var clearBtn = panel.querySelector('.notes-clear-btn[data-topic="' + topicPath + '"]');
    var savedIndicator = panel.querySelector('#notes-saved-' + topicPath.replace(/\//g, '-'));
    var saveTimer = null;

    if (textarea) {
      textarea.addEventListener('input', function () {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
          State.setNote(topicPath, textarea.value);
          if (savedIndicator) {
            savedIndicator.classList.remove('hidden');
            setTimeout(function () { savedIndicator.classList.add('hidden'); }, 1500);
          }
        }, 600);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (!textarea || !textarea.value) return;
        if (confirm(I18N.t('notesClearConfirm'))) {
          textarea.value = '';
          State.setNote(topicPath, '');
          if (savedIndicator) {
            savedIndicator.classList.remove('hidden');
            setTimeout(function () { savedIndicator.classList.add('hidden'); }, 1500);
          }
        }
      });
    }
  }

  function _escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _statusLabel(status) {
    return I18N.t(status) || status;
  }

  function _findTopic(registry, path) {
    for (var i = 0; i < registry.domains.length; i++) {
      for (var j = 0; j < registry.domains[i].topics.length; j++) {
        if (registry.domains[i].topics[j].path === path) return registry.domains[i].topics[j];
      }
    }
    return null;
  }

  function _findDomain(registry, path) {
    var domainId = path.split('/')[0];
    for (var i = 0; i < registry.domains.length; i++) {
      if (registry.domains[i].id === domainId) return registry.domains[i];
    }
    return null;
  }

  return { renderTopic: renderTopic };
})();
