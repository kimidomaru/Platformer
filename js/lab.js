// Lab — renders lab exercises and troubleshooting scenarios with collapsible hints
var Lab = (function () {
  var _timerInterval = null;
  var _timerSeconds = 0;
  var _timerRunning = false;

  function _stopTimer() {
    if (_timerInterval) {
      clearInterval(_timerInterval);
      _timerInterval = null;
    }
    _timerRunning = false;
  }

  function _startTimer(displayEl) {
    _timerRunning = true;
    _timerInterval = setInterval(function () {
      _timerSeconds++;
      var m = Math.floor(_timerSeconds / 60);
      var s = _timerSeconds % 60;
      displayEl.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }, 1000);
  }

  function render(container, labData, options) {
    options = options || {};
    var examMode = options.examMode || false;

    if (!labData || !labData.steps || labData.steps.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128187;</div><p>' + I18N.t('noLab') + '</p></div>';
      return;
    }

    _stopTimer();
    if (!examMode) _timerSeconds = 0;

    var html = '<div class="lab-container">';

    // Toolbar
    html += '<div class="lab-toolbar">';
    if (examMode) {
      html += '<span class="lab-exam-badge">' + I18N.t('examModeBadge') + '</span>';
      html += '<button class="btn btn-secondary lab-exit-exam-btn" style="font-size:0.8rem">' + I18N.t('exitExamMode') + '</button>';
    } else {
      html += '<button class="lab-exam-btn" title="' + I18N.t('examModeTitle') + '">' + I18N.t('examModeLabel') + '</button>';
    }
    html += '<div class="lab-stopwatch">';
    html += '<button class="lab-sw-btn" id="lab-sw-btn">' + I18N.t('stopwatchLabel') + '</button>';
    html += '<span class="lab-sw-display" id="lab-sw-display">00:00</span>';
    html += '</div>';
    html += '</div>';

    // Scenario
    if (labData.scenario) {
      html += '<div class="lab-scenario"><strong>' + I18N.t('scenarioLabel') + '</strong> ' + labData.scenario + '</div>';
    }

    // Objective
    if (labData.objective) {
      html += '<p style="margin-bottom:1rem;color:var(--text-secondary)"><strong>' + I18N.t('objectiveLabel') + '</strong> ' + labData.objective + '</p>';
    }

    // Estimated duration
    if (labData.duration) {
      html += '<p style="margin-bottom:1rem;font-size:0.85rem;color:var(--text-muted)">&#128336; ' + I18N.t('estimatedTime') + ' <strong>' + labData.duration + '</strong></p>';
    }

    // Steps
    html += '<div class="lab-steps">';
    labData.steps.forEach(function (step, idx) {
      html += '<div class="lab-step">';
      html += '<div class="lab-step-header">';
      html += '<span class="step-num">' + (idx + 1) + '</span>';
      html += '<span>' + step.title + '</span>';
      html += '</div>';
      html += '<div class="lab-step-body">';
      html += Markdown.render(step.instruction);

      // Hints — hidden in exam mode
      if (!examMode && step.hints && step.hints.length > 0) {
        step.hints.forEach(function (hint, hIdx) {
          var hintId = 'hint-' + idx + '-' + hIdx;
          html += '<button class="hint-toggle" data-hint="' + hintId + '">' + I18N.t('hintLabel') + ' ' + (hIdx + 1) + '</button>';
          html += '<div class="hint-content" id="' + hintId + '">' + Markdown.render(hint) + '</div>';
        });
      } else if (examMode && step.hints && step.hints.length > 0) {
        html += '<p style="font-size:0.8rem;color:var(--text-muted);font-style:italic">&#128293; ' + step.hints.length + ' ' + I18N.t('hiddenHints') + '</p>';
      }

      // Solution — hidden in exam mode
      if (!examMode && step.solution) {
        var solId = 'sol-' + idx;
        html += '<button class="hint-toggle" data-hint="' + solId + '" style="border-color:var(--success);color:var(--success)">' + I18N.t('viewSolution') + '</button>';
        html += '<div class="hint-content" id="' + solId + '" style="background:var(--success-bg)">' + Markdown.render(step.solution) + '</div>';
      }

      // Verify — always shown
      if (step.verify) {
        var verifyId = 'verify-' + idx;
        html += '<button class="hint-toggle lab-verify-toggle" data-hint="' + verifyId + '">' + I18N.t('verifyLabel') + '</button>';
        html += '<div class="hint-content lab-verify-content" id="' + verifyId + '">' + Markdown.render(step.verify) + '</div>';
      }

      html += '</div></div>';
    });
    html += '</div></div>';

    container.innerHTML = html;

    // Restore timer display if coming back from exam mode
    var swDisplay = container.querySelector('#lab-sw-display');
    if (_timerSeconds > 0 && swDisplay) {
      var m = Math.floor(_timerSeconds / 60);
      var s = _timerSeconds % 60;
      swDisplay.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
      swDisplay.classList.add('visible');
    }

    // Bind hint toggles
    container.querySelectorAll('.hint-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var hintId = btn.getAttribute('data-hint');
        var hintEl = document.getElementById(hintId);
        hintEl.classList.toggle('visible');
        btn.style.opacity = hintEl.classList.contains('visible') ? '0.6' : '1';
      });
    });

    // Stopwatch
    var swBtn = container.querySelector('#lab-sw-btn');
    if (swBtn && swDisplay) {
      swBtn.addEventListener('click', function () {
        if (_timerRunning) {
          _stopTimer();
          swBtn.innerHTML = I18N.t('stopwatchLabel');
          swBtn.classList.remove('running');
        } else {
          swDisplay.classList.add('visible');
          _startTimer(swDisplay);
          swBtn.innerHTML = I18N.t('pauseLabel');
          swBtn.classList.add('running');
        }
      });
    }

    // Exam mode
    var examBtn = container.querySelector('.lab-exam-btn');
    if (examBtn) {
      examBtn.addEventListener('click', function () {
        _timerSeconds = 0;
        render(container, labData, { examMode: true });
        var sw = container.querySelector('#lab-sw-btn');
        var sd = container.querySelector('#lab-sw-display');
        if (sw && sd) {
          sd.classList.add('visible');
          _startTimer(sd);
          sw.innerHTML = I18N.t('pauseLabel');
          sw.classList.add('running');
        }
      });
    }

    var exitBtn = container.querySelector('.lab-exit-exam-btn');
    if (exitBtn) {
      exitBtn.addEventListener('click', function () {
        render(container, labData, { examMode: false });
      });
    }
  }

  function renderTroubleshooting(container, scenarios) {
    if (!scenarios || scenarios.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128295;</div><p>' + I18N.t('noTroubleshooting') + '</p></div>';
      return;
    }

    var html = '<div class="lab-container">';
    scenarios.forEach(function (sc, idx) {
      var diffColor = sc.difficulty === 'hard' ? 'var(--danger)' : sc.difficulty === 'medium' ? 'var(--warning)' : sc.difficulty === 'easy' ? 'var(--success)' : null;

      html += '<div class="lab-step" style="margin-bottom:1rem">';
      html += '<div class="lab-step-header">';
      html += '<span class="step-num">!</span>';
      html += '<span><strong>' + sc.title + '</strong>';
      if (diffColor) {
        html += ' <span style="font-size:0.72rem;font-weight:700;color:' + diffColor + ';text-transform:uppercase;margin-left:0.5rem">[' + sc.difficulty + ']</span>';
      }
      html += '</span>';
      html += '</div>';
      html += '<div class="lab-step-body">';
      html += '<p><strong>' + I18N.t('symptomLabel') + '</strong> ' + sc.symptom + '</p>';

      var diagId = 'diag-' + idx;
      html += '<button class="hint-toggle" data-hint="' + diagId + '">' + I18N.t('diagnosisLabel') + '</button>';
      html += '<div class="hint-content" id="' + diagId + '">' + Markdown.render(sc.diagnosis) + '</div>';

      var fixId = 'fix-' + idx;
      html += '<button class="hint-toggle" data-hint="' + fixId + '" style="border-color:var(--success);color:var(--success)">' + I18N.t('solutionLabel') + '</button>';
      html += '<div class="hint-content" id="' + fixId + '" style="background:var(--success-bg)">' + Markdown.render(sc.solution) + '</div>';

      html += '</div></div>';
    });
    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll('.hint-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var hintId = btn.getAttribute('data-hint');
        var el = document.getElementById(hintId);
        el.classList.toggle('visible');
        btn.style.opacity = el.classList.contains('visible') ? '0.6' : '1';
      });
    });
  }

  return {
    render: render,
    renderTroubleshooting: renderTroubleshooting
  };
})();
