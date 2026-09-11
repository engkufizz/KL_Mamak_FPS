/**
 * Cross-browser Fullscreen Utility
 * Handles standard and vendor-prefixed Fullscreen API with screen orientation locking.
 */

export function isFullScreen() {
  const doc = window.document;
  return !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

export function supportsFullScreen() {
  const doc = window.document;
  const docEl = doc.documentElement;
  return !!(
    docEl.requestFullscreen ||
    docEl.webkitRequestFullscreen ||
    docEl.webkitRequestFullScreen ||
    docEl.mozRequestFullScreen ||
    docEl.msRequestFullscreen
  );
}

export function requestFullScreen(targetElement) {
  const el = targetElement || document.documentElement;
  const rfs =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.webkitRequestFullScreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen;

  if (rfs) {
    try {
      const p = rfs.call(el);
      if (p && typeof p.then === 'function') {
        p.then(() => {
          // Attempt to lock landscape orientation if supported (Android Chrome)
          if (screen.orientation && typeof screen.orientation.lock === 'function') {
            screen.orientation.lock('landscape').catch(() => {});
          }
        }).catch(() => {});
      }
    } catch (e) {
      // Ignore security/gesture restriction rejections
    }
  }
}

export function exitFullScreen() {
  const doc = window.document;
  const efs =
    doc.exitFullscreen ||
    doc.webkitExitFullscreen ||
    doc.webkitCancelFullScreen ||
    doc.mozCancelFullScreen ||
    doc.msExitFullscreen;

  if (efs && isFullScreen()) {
    try {
      const p = efs.call(doc);
      if (p && typeof p.then === 'function') {
        p.catch(() => {});
      }
    } catch (e) {
      // Ignore
    }
  }
}

export function toggleFullScreen(targetElement) {
  if (isFullScreen()) {
    exitFullScreen();
  } else {
    requestFullScreen(targetElement);
  }
}

export function onFullScreenChange(callback) {
  const events = [
    'fullscreenchange',
    'webkitfullscreenchange',
    'mozfullscreenchange',
    'MSFullscreenChange'
  ];
  events.forEach((evt) => {
    document.addEventListener(evt, () => {
      callback(isFullScreen());
    });
  });
}
