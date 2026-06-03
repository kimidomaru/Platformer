// Theme — dark/light mode toggle
var Theme = (function () {

  function init() {
    var saved = State.getTheme();
    _apply(saved);

    document.getElementById('theme-toggle').addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      _apply(next);
      State.setTheme(next);
    });
  }

  function _apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var icon = document.querySelector('#theme-toggle .theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀' : '☽';
  }

  return { init: init };
})();
