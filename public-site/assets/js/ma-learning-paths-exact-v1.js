/* MA LEARNING PATHS - EXACT ORIGINAL ARTWORK V1 */
(function () {
  'use strict';

  document.addEventListener('click', function (event) {
    var trigger = event.target && event.target.closest
      ? event.target.closest('[data-ma-open-assistant]')
      : null;

    if (!trigger) return;
    event.preventDefault();

    var launcher = document.querySelector(
      '#ma-site-assistant .ma-assistant-launcher, .ma-assistant-launcher'
    );

    if (launcher) {
      launcher.click();
      return;
    }

    window.location.hash = 'contact';
  });
}());
