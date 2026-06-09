// State — localStorage wrapper for progress, recent topics, preferences and language
var State = (function () {
  var KEYS = {
    progress: 'k8s_progress',
    recent: 'k8s_recent',
    theme: 'k8s_theme',
    quizScores: 'k8s_quiz_scores',
    lang: 'k8s_lang',
    srs: 'k8s_srs',
    quizErrors: 'k8s_quiz_errors',
    notes: 'k8s_notes'
  };

  // Stable id from a string (djb2) — used for per-question identity
  function _hash(str) {
    var h = 5381;
    str = String(str);
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return 'q' + (h >>> 0).toString(36);
  }

  function _get(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* quota exceeded — silently fail */ }
  }

  // Progress: { "domain/topic": "not-started" | "in-progress" | "completed" }
  function getProgress(topicId) {
    var all = _get(KEYS.progress, {});
    return all[topicId] || 'not-started';
  }

  function setProgress(topicId, status) {
    var all = _get(KEYS.progress, {});
    all[topicId] = status;
    _set(KEYS.progress, all);
  }

  function getAllProgress() {
    return _get(KEYS.progress, {});
  }

  // Cycles: not-started -> in-progress -> completed -> not-started
  function cycleProgress(topicId) {
    var order = ['not-started', 'in-progress', 'completed'];
    var current = getProgress(topicId);
    var idx = order.indexOf(current);
    var next = order[(idx + 1) % order.length];
    setProgress(topicId, next);
    return next;
  }

  // Recent topics: array of { id, name, timestamp }
  function addRecent(topicId, topicName) {
    var recent = _get(KEYS.recent, []);
    recent = recent.filter(function (r) { return r.id !== topicId; });
    recent.unshift({ id: topicId, name: topicName, timestamp: Date.now() });
    if (recent.length > 10) recent = recent.slice(0, 10);
    _set(KEYS.recent, recent);
  }

  function getRecent() {
    return _get(KEYS.recent, []);
  }

  // Theme
  function getTheme() {
    return _get(KEYS.theme, 'light');
  }

  function setTheme(theme) {
    _set(KEYS.theme, theme);
  }

  // Language
  function getLang() {
    try {
      var raw = localStorage.getItem(KEYS.lang);
      return raw === 'en' ? 'en' : 'pt';
    } catch (e) { return 'pt'; }
  }

  function setLang(lang) {
    try { localStorage.setItem(KEYS.lang, lang); } catch (e) {}
  }

  // Quiz scores: { "domain/topic": { score, total, date } }
  function saveQuizScore(topicId, score, total) {
    var scores = _get(KEYS.quizScores, {});
    scores[topicId] = { score: score, total: total, date: Date.now() };
    _set(KEYS.quizScores, scores);
  }

  function getQuizScore(topicId) {
    var scores = _get(KEYS.quizScores, {});
    return scores[topicId] || null;
  }

  function getAllQuizScores() {
    return _get(KEYS.quizScores, {});
  }

  // SRS (spaced repetition) — { "<cardId>": { id, topicPath, topicName, front, back, ease, interval, reps, due, last } }
  function getAllSrs() {
    return _get(KEYS.srs, {});
  }

  function getSrsCard(cardId) {
    var all = _get(KEYS.srs, {});
    return all[cardId] || null;
  }

  function setSrsCard(cardId, data) {
    var all = _get(KEYS.srs, {});
    all[cardId] = data;
    _set(KEYS.srs, all);
  }

  function removeSrsCard(cardId) {
    var all = _get(KEYS.srs, {});
    delete all[cardId];
    _set(KEYS.srs, all);
  }

  // ── Quiz error analytics ──
  // Stored per question: { qId, topicPath, topicName, domain, question, options,
  //   correct, explanation, reference, wrongCount, seenCount, lastWrong, mastered }
  function quizQuestionId(meta) {
    return _hash((meta.topicPath || '') + '|' + meta.question);
  }

  // Record one answered question. `meta` carries the full question so the
  // Weak-Spot review can rebuild it without loading topic files.
  function recordQuizAnswer(meta, wasCorrect) {
    var all = _get(KEYS.quizErrors, {});
    var id = quizQuestionId(meta);
    var rec = all[id] || {
      qId: id, topicPath: meta.topicPath || '', topicName: meta.topicName || '',
      domain: meta.domain || '', question: meta.question, options: meta.options,
      correct: meta.correct, explanation: meta.explanation || '', reference: meta.reference || '',
      wrongCount: 0, seenCount: 0, lastWrong: 0, mastered: false
    };
    // refresh question payload in case content changed
    rec.options = meta.options; rec.correct = meta.correct;
    rec.explanation = meta.explanation || ''; rec.reference = meta.reference || '';
    if (meta.domain) rec.domain = meta.domain;
    if (meta.topicName) rec.topicName = meta.topicName;
    rec.seenCount += 1;
    if (wasCorrect) {
      rec.mastered = true;        // leaves the weak pool, stats preserved
    } else {
      rec.wrongCount += 1;
      rec.lastWrong = Date.now();
      rec.mastered = false;
    }
    all[id] = rec;
    _set(KEYS.quizErrors, all);
    return rec;
  }

  function getAllQuizErrors() {
    return _get(KEYS.quizErrors, {});
  }

  // Questions answered wrong and not yet re-mastered, newest mistakes first.
  function getWeakQuestions() {
    var all = _get(KEYS.quizErrors, {});
    var out = [];
    Object.keys(all).forEach(function (k) {
      var r = all[k];
      if (r.wrongCount > 0 && !r.mastered) out.push(r);
    });
    out.sort(function (a, b) { return b.lastWrong - a.lastWrong; });
    return out;
  }

  function getWeakCount() {
    return getWeakQuestions().length;
  }

  // Weak question counts grouped by topicPath (for the dashboard widget)
  function getWeakByTopic() {
    var weak = getWeakQuestions();
    var map = {};
    weak.forEach(function (r) {
      var key = r.topicPath || r.domain || 'other';
      if (!map[key]) map[key] = { topicPath: r.topicPath, topicName: r.topicName, domain: r.domain, count: 0 };
      map[key].count++;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  // Topic notes: { "domain/topic": "text" }
  function getNote(topicId) {
    var all = _get(KEYS.notes, {});
    return all[topicId] || '';
  }

  function setNote(topicId, text) {
    var all = _get(KEYS.notes, {});
    if (text && text.trim()) {
      all[topicId] = text;
    } else {
      delete all[topicId];
    }
    _set(KEYS.notes, all);
  }

  function getAllNotes() {
    return _get(KEYS.notes, {});
  }

  // ── Backup: export / import all platform state ──
  // Bundles every k8s_* key into a portable object (download) and restores it.
  function exportData() {
    var data = {};
    Object.keys(KEYS).forEach(function (name) {
      var raw = null;
      try { raw = localStorage.getItem(KEYS[name]); } catch (e) {}
      if (raw !== null) {
        try { data[KEYS[name]] = JSON.parse(raw); } catch (e) { data[KEYS[name]] = raw; }
      }
    });
    return { app: 'platformer', version: 1, exportedAt: new Date().toISOString(), data: data };
  }

  // Restore from a parsed export bundle. Only known k8s_* keys are written.
  // Returns the number of keys restored, or -1 if the payload is invalid.
  function importData(payload) {
    if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
      return -1;
    }
    var known = {};
    Object.keys(KEYS).forEach(function (name) { known[KEYS[name]] = true; });
    var restored = 0;
    Object.keys(payload.data).forEach(function (key) {
      if (!known[key]) return; // ignore unknown keys
      try {
        localStorage.setItem(key, JSON.stringify(payload.data[key]));
        restored++;
      } catch (e) { /* quota — skip */ }
    });
    return restored;
  }

  return {
    getProgress: getProgress,
    setProgress: setProgress,
    getAllProgress: getAllProgress,
    cycleProgress: cycleProgress,
    addRecent: addRecent,
    getRecent: getRecent,
    getTheme: getTheme,
    setTheme: setTheme,
    getLang: getLang,
    setLang: setLang,
    saveQuizScore: saveQuizScore,
    getQuizScore: getQuizScore,
    getAllQuizScores: getAllQuizScores,
    getAllSrs: getAllSrs,
    getSrsCard: getSrsCard,
    setSrsCard: setSrsCard,
    removeSrsCard: removeSrsCard,
    quizQuestionId: quizQuestionId,
    recordQuizAnswer: recordQuizAnswer,
    getAllQuizErrors: getAllQuizErrors,
    getWeakQuestions: getWeakQuestions,
    getWeakCount: getWeakCount,
    getWeakByTopic: getWeakByTopic,
    getNote: getNote,
    setNote: setNote,
    getAllNotes: getAllNotes,
    exportData: exportData,
    importData: importData
  };
})();
