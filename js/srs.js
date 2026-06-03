// SRS — spaced repetition engine (SM-2 algorithm)
// Card scheduling is stored in State (localStorage). Each graded card keeps its
// own text (front/back) so the global Review view never needs to load topic files.
var SRS = (function () {

  var DAY = 86400000; // ms in a day

  // Grade buttons map to SM-2 quality scores.
  // again=0 (lapse), hard=3, good=4, easy=5
  var QUALITY = { again: 0, hard: 3, good: 4, easy: 5 };

  // Stable id from topic path + front text (front text is unique within a topic).
  function cardId(topicPath, front) {
    return topicPath + '::' + front;
  }

  function _startOfDay(ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function _todayEnd() {
    var d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  // Apply SM-2 to a card and persist. Returns the updated record.
  // `meta` = { topicPath, topicName, front, back } so a brand-new card can be created.
  function grade(meta, gradeKey) {
    var quality = QUALITY[gradeKey];
    if (quality === undefined) quality = 4;

    var id = cardId(meta.topicPath, meta.front);
    var card = State.getSrsCard(id);
    if (!card) {
      card = {
        id: id,
        topicPath: meta.topicPath,
        topicName: meta.topicName || '',
        front: meta.front,
        back: meta.back,
        ease: 2.5,
        interval: 0,
        reps: 0,
        due: Date.now(),
        last: 0
      };
    }
    // Refresh text/meta in case content changed
    card.front = meta.front;
    card.back = meta.back;
    if (meta.topicName) card.topicName = meta.topicName;

    var now = Date.now();

    if (quality < 3) {
      // Lapse — reset reps, see again in the current session
      card.reps = 0;
      card.interval = 0;
      card.due = now; // stays due now
    } else {
      // SM-2 interval progression
      if (card.reps === 0) {
        card.interval = 1;
      } else if (card.reps === 1) {
        card.interval = 6;
      } else {
        card.interval = Math.round(card.interval * card.ease);
      }
      // Easy bonus
      if (quality === 5) card.interval = Math.round(card.interval * 1.3);
      if (card.interval < 1) card.interval = 1;

      card.reps += 1;
      card.due = _startOfDay(now) + card.interval * DAY;
    }

    // Update ease factor (SM-2 formula)
    card.ease = card.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (card.ease < 1.3) card.ease = 1.3;

    card.last = now;
    State.setSrsCard(id, card);
    return card;
  }

  function isDue(card) {
    return card && card.due <= _todayEnd();
  }

  // All cards due today or overdue, sorted by due date (oldest first).
  function getDueCards() {
    var all = State.getAllSrs();
    var out = [];
    Object.keys(all).forEach(function (k) {
      if (isDue(all[k])) out.push(all[k]);
    });
    out.sort(function (a, b) { return a.due - b.due; });
    return out;
  }

  function getDueCount() {
    return getDueCards().length;
  }

  // Total tracked (scheduled) cards
  function getTrackedCount() {
    return Object.keys(State.getAllSrs()).length;
  }

  // Human-friendly "next review" label for feedback after grading.
  function nextLabel(card, lang) {
    var isEn = lang === 'en';
    if (!card || card.due <= Date.now()) {
      return isEn ? 'today' : 'hoje';
    }
    var days = Math.round((_startOfDay(card.due) - _startOfDay(Date.now())) / DAY);
    if (days <= 0) return isEn ? 'today' : 'hoje';
    if (days === 1) return isEn ? '1 day' : '1 dia';
    if (days < 30) return days + (isEn ? ' days' : ' dias');
    var months = Math.round(days / 30);
    if (months === 1) return isEn ? '1 month' : '1 mes';
    return months + (isEn ? ' months' : ' meses');
  }

  return {
    cardId: cardId,
    grade: grade,
    isDue: isDue,
    getDueCards: getDueCards,
    getDueCount: getDueCount,
    getTrackedCount: getTrackedCount,
    nextLabel: nextLabel,
    QUALITY: QUALITY
  };
})();
