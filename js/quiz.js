// Quiz — interactive quiz engine with scoring and explanations
var Quiz = (function () {

  function render(container, questions, topicPath) {
    if (!questions || questions.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128221;</div><p>' + I18N.t('noQuestions') + '</p></div>';
      return;
    }

    var state = {
      current: 0,
      answers: new Array(questions.length).fill(null),
      revealed: new Array(questions.length).fill(false)
    };

    _renderQuestion(container, questions, state, topicPath);
  }

  function _renderQuestion(container, questions, state, topicPath) {
    var q = questions[state.current];
    var i = state.current;
    var total = questions.length;

    var html = '<div class="quiz-container">';

    // Progress bar
    html += '<div class="quiz-progress-bar">';
    html += '<span>' + (i + 1) + '/' + total + '</span>';
    html += '<div class="bar"><div class="bar-fill" style="width:' + ((i + 1) / total * 100) + '%"></div></div>';
    html += '</div>';

    // Question
    html += '<div class="quiz-question">';
    html += '<h3>' + (i + 1) + '. ' + q.question + '</h3>';
    html += '<div class="quiz-options">';

    q.options.forEach(function (opt, idx) {
      var marker = String.fromCharCode(65 + idx);
      var cls = 'quiz-option';
      if (state.revealed[i]) {
        if (idx === q.correct) cls += ' correct';
        else if (idx === state.answers[i]) cls += ' wrong';
      } else if (state.answers[i] === idx) {
        cls += ' selected';
      }

      html += '<button class="' + cls + '" data-idx="' + idx + '">';
      html += '<span class="option-marker">' + marker + '</span>';
      html += '<span>' + opt + '</span>';
      html += '</button>';
    });

    html += '</div>';

    // Explanation
    if (state.revealed[i] && q.explanation) {
      html += '<div class="quiz-explanation">' + q.explanation + '</div>';
    }

    // Study reference
    if (state.revealed[i] && q.reference) {
      html += '<div class="quiz-reference">&#128218; <strong>' + I18N.t('studyMore') + '</strong> ' + q.reference + '</div>';
    }

    html += '</div>';

    // Navigation
    html += '<div class="quiz-nav">';
    if (i > 0) {
      html += '<button class="btn btn-secondary" data-action="prev">' + I18N.t('prevQuestion') + '</button>';
    }

    if (!state.revealed[i]) {
      html += '<button class="btn btn-primary" data-action="check"'
        + (state.answers[i] === null ? ' disabled style="opacity:0.5;pointer-events:none"' : '')
        + '>' + I18N.t('checkAnswer') + '</button>';
    } else if (i < total - 1) {
      html += '<button class="btn btn-primary" data-action="next">' + I18N.t('nextQuestion') + '</button>';
    } else {
      html += '<button class="btn btn-success" data-action="finish">' + I18N.t('viewResults') + '</button>';
    }
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    // Bind option clicks
    container.querySelectorAll('.quiz-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.revealed[i]) return;
        state.answers[i] = parseInt(btn.getAttribute('data-idx'));
        _renderQuestion(container, questions, state, topicPath);
      });
    });

    // Bind nav
    container.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-action');
        if (action === 'prev') {
          state.current--;
          _renderQuestion(container, questions, state, topicPath);
        } else if (action === 'next') {
          state.current++;
          _renderQuestion(container, questions, state, topicPath);
        } else if (action === 'check') {
          state.revealed[i] = true;
          _renderQuestion(container, questions, state, topicPath);
        } else if (action === 'finish') {
          _showResults(container, questions, state, topicPath);
        }
      });
    });
  }

  function _topicMeta(topicPath) {
    var reg = window.K8S_REGISTRY;
    if (!reg) return { name: '', domain: '' };
    for (var i = 0; i < reg.domains.length; i++) {
      for (var j = 0; j < reg.domains[i].topics.length; j++) {
        if (reg.domains[i].topics[j].path === topicPath) {
          return { name: reg.domains[i].topics[j].name, domain: reg.domains[i].name };
        }
      }
    }
    return { name: '', domain: '' };
  }

  function _showResults(container, questions, state, topicPath) {
    var score = 0;
    questions.forEach(function (q, i) {
      if (state.answers[i] === q.correct) score++;
    });

    var pct = Math.round((score / questions.length) * 100);
    State.saveQuizScore(topicPath, score, questions.length);

    // Record per-question analytics (powers Weak-Spot review + dashboard)
    var meta = _topicMeta(topicPath);
    questions.forEach(function (q, i) {
      State.recordQuizAnswer({
        topicPath: topicPath, topicName: meta.name, domain: meta.domain,
        question: q.question, options: q.options, correct: q.correct,
        explanation: q.explanation, reference: q.reference
      }, state.answers[i] === q.correct);
    });

    // Auto-progress: a strong quiz (>=80%) marks the topic completed
    var autoCompleted = false;
    if (pct >= 80 && State.getProgress(topicPath) !== 'completed') {
      State.setProgress(topicPath, 'completed');
      if (typeof Sidebar !== 'undefined') Sidebar.refreshStatus();
      autoCompleted = true;
    }

    var html = '<div class="quiz-results">';
    html += '<div class="score">' + pct + '%</div>';
    html += '<div class="score-label">' + score + ' ' + I18N.t('correctOf') + ' ' + questions.length + ' ' + I18N.t('corrects') + '</div>';
    if (autoCompleted) {
      html += '<p class="quiz-auto-complete">&#10004; ' + I18N.t('autoCompleted') + '</p>';
    }

    if (pct >= 80) {
      html += '<p style="color:var(--success);font-weight:600;margin-bottom:1rem">' + I18N.t('excellentResult') + '</p>';
    } else if (pct >= 60) {
      html += '<p style="color:var(--warning);font-weight:600;margin-bottom:1rem">' + I18N.t('goodResult') + '</p>';
    } else {
      html += '<p style="color:var(--danger);font-weight:600;margin-bottom:1rem">' + I18N.t('poorResult') + '</p>';
    }

    html += '<button class="btn btn-primary" data-action="retry">' + I18N.t('tryAgain') + '</button>';
    html += '</div>';

    container.innerHTML = html;

    container.querySelector('[data-action="retry"]').addEventListener('click', function () {
      var newState = { current: 0, answers: new Array(questions.length).fill(null), revealed: new Array(questions.length).fill(false) };
      _renderQuestion(container, questions, newState, topicPath);
    });
  }

  return { render: render };
})();
