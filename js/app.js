// App — initializes all modules in correct order
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    // I18N must init before anything that renders text
    I18N.init();
    Theme.init();
    Sidebar.init();
    Search.init();
    Router.init();

    // Spaced-repetition due badge in the sidebar — refresh on load and navigation
    function refreshReviewBadge() {
      var badge = document.getElementById('review-due-badge');
      if (!badge || typeof SRS === 'undefined') return;
      var due = SRS.getDueCount();
      if (due > 0) {
        badge.textContent = due > 99 ? '99+' : due;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
    refreshReviewBadge();
    window.addEventListener('hashchange', refreshReviewBadge);

    // Language toggle button
    var langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
      langBtn.addEventListener('click', function () {
        var current = I18N.getLang();
        I18N.setLang(current === 'pt' ? 'en' : 'pt');
        Sidebar.init(); // re-render sidebar with translated labels
      });
    }
  });
})();
