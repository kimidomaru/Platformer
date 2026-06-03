// Flashcard — flip cards with SM-2 spaced-repetition grading
var Flashcard = (function () {

  // Parse "Label: value. Label: value." into structured bullet HTML.
  // Splits on ". " that precedes a capitalised word or a word followed by ":"
  // so mid-sentence dots (e.g. "e.g.", numbers, "<1s") are preserved.
  function _formatBack(text) {
    if (!text) return '';

    var parts = text
      .replace(/\.\s+(?=[A-ZÀ-Ü])/g, '\n')   // ". Uppercase"
      .replace(/\.\s+(?=\w[\w\s]*:)/g, '\n')   // ". word(s):"
      .split('\n')
      .map(function (s) { return s.replace(/\.$/, '').trim(); })
      .filter(function (s) { return s.length > 0; });

    if (parts.length < 2) {
      return '<span class="fc-plain">' + _escape(text) + '</span>';
    }

    var items = parts.map(function (part) {
      var colonIdx = part.indexOf(': ');
      if (colonIdx > 0 && colonIdx < 35) {
        var key = part.slice(0, colonIdx);
        var val = part.slice(colonIdx + 2);
        return '<li><span class="fc-key">' + _escape(key) + ':</span>'
             + '<span class="fc-val">' + _escape(val) + '</span></li>';
      }
      return '<li><span class="fc-val">' + _escape(part) + '</span></li>';
    });

    return '<ul class="fc-list">' + items.join('') + '</ul>';
  }

  function _escape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _gradeButtonsHtml() {
    return '<div class="fc-grades">'
      + '<button class="fc-grade fc-again" data-grade="again">' + I18N.t('srsAgain') + '</button>'
      + '<button class="fc-grade fc-hard" data-grade="hard">' + I18N.t('srsHard') + '</button>'
      + '<button class="fc-grade fc-good" data-grade="good">' + I18N.t('srsGood') + '</button>'
      + '<button class="fc-grade fc-easy" data-grade="easy">' + I18N.t('srsEasy') + '</button>'
      + '</div>';
  }

  function render(container, cards, topicPath, topicName) {
    if (!cards || cards.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#127183;</div><p>' + I18N.t('noFlashcards') + '</p></div>';
      return;
    }

    var html = '<div class="flashcard-controls" style="margin-bottom:1rem">';
    html += '<button class="btn btn-secondary" data-action="shuffle">' + I18N.t('shuffle') + '</button>';
    html += '<span style="color:var(--text-muted);font-size:0.85rem">' + cards.length + ' ' + I18N.t('flashcardClickHint') + '</span>';
    html += '</div>';
    html += '<div class="flashcard-grid">';

    cards.forEach(function (card, idx) {
      var backHtml = _formatBack(card.back);
      var tracked = topicPath ? State.getSrsCard(SRS.cardId(topicPath, card.front)) : null;
      var dueBadge = '';
      if (tracked) {
        var lbl = SRS.nextLabel(tracked, I18N.getLang());
        dueBadge = '<span class="fc-due-badge" title="' + I18N.t('srsScheduled') + '">&#9201; ' + lbl + '</span>';
      }
      html += '<div class="flashcard" data-idx="' + idx + '">';
      html += '<div class="flashcard-inner">';
      html += '<div class="flashcard-front">' + dueBadge + '<span class="fc-front-text">' + _escape(card.front) + '</span></div>';
      html += '<div class="flashcard-back"><div class="fc-back-body">' + backHtml + '</div>'
            + (topicPath ? _gradeButtonsHtml() : '') + '</div>';
      html += '</div></div>';
    });

    html += '</div>';
    container.innerHTML = html;

    // Equalise height — absolute children don't grow the parent naturally.
    // Use setTimeout to let the browser finish rendering before measuring.
    function _setCardHeight(card) {
      var front = card.querySelector('.flashcard-front');
      var back  = card.querySelector('.flashcard-back');
      var inner = card.querySelector('.flashcard-inner');
      // Temporarily remove minHeight so we get true scrollHeight
      front.style.minHeight = '';
      back.style.minHeight  = '';
      inner.style.minHeight = '';
      card.style.minHeight  = '';
      var h = Math.max(front.scrollHeight, back.scrollHeight, 160);
      card.style.minHeight  = h + 'px';
      inner.style.minHeight = h + 'px';
      front.style.minHeight = h + 'px';
      back.style.minHeight  = h + 'px';
    }

    // Double RAF ensures layout is complete before measuring
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        container.querySelectorAll('.flashcard').forEach(_setCardHeight);
      });
    });

    // Flip on click (ignore clicks on grade buttons)
    container.querySelectorAll('.flashcard').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        if (ev.target.closest('.fc-grades')) return;
        el.classList.toggle('flipped');
        // Re-measure after flip in case back is taller than front
        requestAnimationFrame(function () { _setCardHeight(el); });
      });
    });

    // Grade buttons — schedule via SM-2
    container.querySelectorAll('.fc-grade').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var cardEl = btn.closest('.flashcard');
        var idx = parseInt(cardEl.getAttribute('data-idx'), 10);
        var card = cards[idx];
        var updated = SRS.grade({
          topicPath: topicPath,
          topicName: topicName || '',
          front: card.front,
          back: card.back
        }, btn.getAttribute('data-grade'));

        // Feedback: update/insert the due badge and flip back
        var lbl = SRS.nextLabel(updated, I18N.getLang());
        var front = cardEl.querySelector('.flashcard-front');
        var existing = front.querySelector('.fc-due-badge');
        var badgeHtml = '&#9201; ' + lbl;
        if (existing) {
          existing.innerHTML = badgeHtml;
        } else {
          var span = document.createElement('span');
          span.className = 'fc-due-badge';
          span.innerHTML = badgeHtml;
          front.insertBefore(span, front.firstChild);
        }
        cardEl.classList.add('fc-just-graded');
        setTimeout(function () { cardEl.classList.remove('fc-just-graded'); }, 600);
        cardEl.classList.remove('flipped');
      });
    });

    // Shuffle
    container.querySelector('[data-action="shuffle"]').addEventListener('click', function () {
      var shuffled = cards.slice().sort(function () { return Math.random() - 0.5; });
      render(container, shuffled, topicPath, topicName);
    });
  }

  return { render: render, _formatBack: _formatBack };
})();
