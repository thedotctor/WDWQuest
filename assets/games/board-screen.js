// Shared-screen display mode. Game controls remain live on the phone controllers.
(() => {
  const root = document.documentElement;
  let active = false, nativeActive = false, stage = null, returnFocus = null;
  let oldScroll = 0;
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  function fitViewport() {
    if (active && stage) stage.style.setProperty('--board-screen-height', (window.visualViewport?.height || window.innerHeight) + 'px');
  }

  function finish() {
    active = false; nativeActive = false;
    root.classList.remove('board-screen-active');
    const photo = document.getElementById('snackPhoto');
    if (photo) {
      const snack = SNACK_BREAKS.find(s => s.file === photo.dataset.snackFile);
      if (snack) positionSnackNameMask(snack, photo);
    }
    stage?.querySelector('[data-exit-board-screen]')?.remove();
    stage?.style.removeProperty('--board-screen-height');
    window.scrollTo({top:oldScroll, behavior:'instant'});
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    stage = null; returnFocus = null;
    window.dispatchEvent(new Event('resize'));
  }
  async function exit() {
    if (!active) return;
    if (fullscreenElement() === stage) {
      const leave = document.exitFullscreen || document.webkitExitFullscreen;
      try {await leave?.call(document);} catch (_) {}
    }
    finish();
  }
  function enter(button) {
    if (active || !document.body.classList.contains('phone-room-playing')) return;
    stage = document.querySelector('#board3dHost .board3d-stage');
    if (!stage) return;
    const classic = document.querySelector('.game-layout.classic-board');
    if (classic) classic.querySelector('[data-camera="flat"]')?.click();
    active = true; returnFocus = button; oldScroll = window.scrollY;
    root.classList.add('board-screen-active');
    fitViewport();
    const leave = document.createElement('button');
    leave.type = 'button'; leave.dataset.exitBoardScreen = '';
    leave.className = 'board-screen-exit'; leave.textContent = 'Exit fullscreen';
    leave.addEventListener('click', exit); stage.append(leave);
    stage.querySelector('canvas')?.focus({preventScroll:true});
    // Request native fullscreen directly in the user's click gesture. Devices
    // without this API (including older iPads) retain the viewport-filling view.
    const request = stage.requestFullscreen || stage.webkitRequestFullscreen;
    const target = stage;
    try {
      request?.call(target)?.then?.(() => {
        if ((!active || stage !== target) && fullscreenElement() === target) {
          (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
        }
      })?.catch?.(() => {});
    } catch (_) {}
    window.dispatchEvent(new Event('resize'));
  }
  function changed() {
    if (fullscreenElement() === stage && active) nativeActive = true;
    else if (nativeActive) finish();
  }
  document.addEventListener('fullscreenchange', changed);
  document.addEventListener('webkitfullscreenchange', changed);
  window.addEventListener('resize', fitViewport);
  window.visualViewport?.addEventListener('resize', fitViewport);
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-board-screen]');
    if (button) enter(button);
  });
  document.addEventListener('keydown', event => {
    if (active && event.key === 'Escape') {event.preventDefault(); exit();}
  });
  // End Room restores the ordinary view; it does not interrupt the game engine.
  new MutationObserver(() => {
    if (active && (!document.body.classList.contains('phone-room-playing') || !stage?.isConnected)) exit();
  }).observe(document.body, {attributes:true, attributeFilter:['class'], childList:true, subtree:true});
})();
