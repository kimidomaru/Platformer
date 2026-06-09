// Review — global spaced-repetition session over all due cards (SM-2)
var Review = (function () {
  var _container = null;
  var _queue = [];      // session queue of card records (from SRS store)
  var _flipped = false;
  var _reviewed = 0;    // distinct grades given this session

  function render(container) {
    _container = container;
    _queue = SRS.getDueCards();
    _reviewed = 0;
    _flipped = false;

    if (_queue.length === 0) {
      _renderEmpty();
      return;
    }
    _renderCard();
  }

  function _renderEmpty() {
    var tracked = SRS.getTrackedCount();
    var html = '<div class="topic-header"><h1>' + I18N.t('reviewTitle') + '</h1></div>';
    html += '<div class="review-empty">';
    html += '<div class="empty-icon">&#9989;</div>';
    if (tracked === 0) {
      html += '<p>' + I18N.t('reviewNoCards') + '</p>';
    } else {
      html += '<p>' + I18N.t('reviewAllDone') + '</p>';
      html += '<p class="review-empty-sub">' + tracked + ' ' + I18N.t('reviewTrackedSuffix') + '</p>';
    }
    html += '<button class="btn btn-primary" data-action="dashboard">' + I18N.t('btnDashboard') + '</button>';
    html += '</div>';
    _container.innerHTML = html;
    var btn = _container.querySelector('[data-action="dashboard"]');
    if (btn) btn.addEventListener('click', function () { window.location.hash = '#dashboard'; });
  }

  function _formatBack(text) {
    // Reuse the same structured-back parser as Flashcard by delegating.
    return Flashcard._formatBack ? Flashcard._formatBack(text) : _escape(text);
  }

  function _escape(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _renderCard() {
    var total = _reviewed + _queue.length;
    var done = _reviewed;
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    var card = _queue[0];

    var html = '<div class="topic-header"><h1>' + I18N.t('reviewTitle') + '</h1></div>';

    html += '<div class="review-bar">';
    html += '<div class="review-progress"><div class="review-progress-fill" style="width:' + pct + '%"></div></div>';
    html += '<span class="review-count">' + _queue.length + ' ' + I18N.t('reviewRemaining') + '</span>';
    html += '</div>';

    html += '<div class="review-stage">';
    html += '<div class="review-card' + (_flipped ? ' flipped' : '') + '" data-action="flip">';
    if (card.topicName) {
      html += '<div class="review-card-topic">' + _escape(card.topicName) + '</div>';
    }
    html += '<div class="review-card-front"><span>' + _escape(card.front) + '</span>';
    if (!_flipped) html += '<div class="review-hint">' + I18N.t('reviewFlipHint') + '</div>';
    html += '</div>';
    if (_flipped) {
      html += '<div class="review-card-back">' + _formatBack(card.back) + '</div>';
    }
    html += '</div>';

    if (_flipped) {
      html += '<div class="review-grades">';
      html += '<button class="fc-grade fc-again" data-grade="again"><kbd>1</kbd> ' + I18N.t('srsAgain') + '</button>';
      html += '<button class="fc-grade fc-hard" data-grade="hard"><kbd>2</kbd> ' + I18N.t('srsHard') + '</button>';
      html += '<button class="fc-grade fc-good" data-grade="good"><kbd>3</kbd> ' + I18N.t('srsGood') + '</button>';
      html += '<button class="fc-grade fc-easy" data-grade="easy"><kbd>4</kbd> ' + I18N.t('srsEasy') + '</button>';
      html += '</div>';
    } else {
      html += '<div class="review-grades"><button class="btn btn-primary" data-action="flip"><kbd>' + I18N.t('keySpace') + '</kbd> ' + I18N.t('reviewShowAnswer') + '</button></div>';
    }
    html += '</div>';

    _container.innerHTML = html;

    _container.querySelectorAll('[data-action="flip"]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        if (ev.target.closest('.review-grades') && ev.target.closest('.fc-grade')) return;
        _flipped = true;
        _renderCard();
      });
    });

    _container.querySelectorAll('.fc-grade').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        _grade(btn.getAttribute('data-grade'));
      });
    });
  }

  function _grade(gradeKey) {
    var card = _queue.shift();
    var updated = SRS.grade({
      topicPath: card.topicPath,
      topicName: card.topicName,
      front: card.front,
      back: card.back
    }, gradeKey);

    _reviewed++;
    _flipped = false;

    // "again" keeps the card due now — requeue at the end of this session.
    if (gradeKey === 'again') {
      _queue.push(updated);
    }

    if (_queue.length === 0) {
      _renderDone();
    } else {
      _renderCard();
    }
  }

  function _renderDone() {
    var html = '<div class="topic-header"><h1>' + I18N.t('reviewTitle') + '</h1></div>';
    html += '<div class="review-empty">';
    html += '<div class="empty-icon">&#127881;</div>';
    html += '<p>' + I18N.t('reviewSessionDone') + '</p>';
    html += '<p class="review-empty-sub">' + _reviewed + ' ' + I18N.t('reviewCardsReviewed') + '</p>';
    html += '<button class="btn btn-primary" data-action="dashboard">' + I18N.t('btnDashboard') + '</button>';
    html += '</div>';
    _container.innerHTML = html;
    var btn = _container.querySelector('[data-action="dashboard"]');
    if (btn) btn.addEventListener('click', function () { window.location.hash = '#dashboard'; });
  }

  // Keyboard shortcuts for the daily review loop: Space/Enter flips the card,
  // 1–4 grade it once flipped. Bound once; gated to the active review view.
  function _onKey(e) {
    if (!_container || !_container.isConnected) return;
    if ((location.hash || '').indexOf('review') === -1) return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    if (_queue.length === 0) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (!_flipped) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); _flipped = true; _renderCard(); }
      return;
    }
    var map = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
    if (map[e.key]) { e.preventDefault(); _grade(map[e.key]); }
  }

  document.addEventListener('keydown', _onKey);

  return { render: render };
})();
