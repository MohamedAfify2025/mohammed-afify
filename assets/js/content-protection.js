(function () {
    "use strict";

    function isEditable(target) {
        return target && target.closest &&
            target.closest(
                "input, textarea, select, button, iframe, " +
                "[contenteditable=true], [role=textbox], .allow-context-menu"
            );
    }

    // Disable right-click context menu, except in interactive controls.
    document.addEventListener("contextmenu", function (event) {
        if (isEditable(event.target)) return;
        event.preventDefault();
    }, true);

    // Discourage dragging images and media out of the page.
    document.addEventListener("dragstart", function (event) {
        if (!event.target || !event.target.closest) return;
        if (event.target.closest("img, picture, video, audio, .protected-media")) {
            event.preventDefault();
        }
    }, true);

    // Discourage common save, print, source and developer-tool shortcuts.
    // Copy/paste/select-all are intentionally not blocked.
    document.addEventListener("keydown", function (event) {
        if (isEditable(event.target)) return;

        var key = (event.key || "").toLowerCase();
        var modified = event.ctrlKey || event.metaKey;
        var block = event.key === "F12";

        if (modified && !event.altKey &&
            ["s", "p", "u"].indexOf(key) !== -1) {
            block = true;
        }

        if (modified && event.shiftKey &&
            ["i", "j", "c"].indexOf(key) !== -1) {
            block = true;
        }

        if (block) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);
})();