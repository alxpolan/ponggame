// Wraps MediaPipe Hands: tracks one hand and exposes a smoothed vertical
// position (0 = top of frame, 1 = bottom) that the game maps to a paddle.
const HandTracking = (() => {
  const SMOOTHING = 0.25;
  const LOST_TIMEOUT_MS = 800;

  let hands = null;
  let camera = null;
  let videoEl = null;
  let previewCanvas = null;
  let previewCtx = null;

  let smoothedY = 0.5;
  let detected = false;
  let lastSeenAt = 0;
  let keyboardMode = false;
  let keyboardY = 0.5;

  function init(videoElement, previewCanvasEl) {
    videoEl = videoElement;
    previewCanvas = previewCanvasEl;
    previewCtx = previewCanvas.getContext('2d');

    hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5
    });
    hands.onResults(onResults);

    camera = new Camera(videoEl, {
      onFrame: async () => {
        try { await hands.send({ image: videoEl }); }
        catch (e) { /* ignore transient frame errors */ }
      },
      width: 320,
      height: 240
    });

    return camera.start().then(() => true);
  }

  function onResults(results) {
    drawPreview(results);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const lm = results.multiHandLandmarks[0];
      const palmY = (lm[0].y + lm[9].y) / 2; // wrist + middle-finger MCP
      smoothedY = smoothedY + (palmY - smoothedY) * SMOOTHING;
      detected = true;
      lastSeenAt = performance.now();
    } else if (performance.now() - lastSeenAt > LOST_TIMEOUT_MS) {
      detected = false;
    }
  }

  function drawPreview(results) {
    if (!previewCtx || !videoEl.videoWidth) return;
    previewCtx.save();
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.drawImage(videoEl, 0, 0, previewCanvas.width, previewCanvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const lm = results.multiHandLandmarks[0];
      if (window.drawConnectors && window.HAND_CONNECTIONS) {
        drawConnectors(previewCtx, lm, HAND_CONNECTIONS, { color: '#5ee6ff', lineWidth: 2 });
      }
      if (window.drawLandmarks) {
        drawLandmarks(previewCtx, lm, { color: '#ff5ea8', lineWidth: 1, radius: 3 });
      }
    }
    previewCtx.restore();
  }

  function enableKeyboardFallback() {
    keyboardMode = true;
    detected = true;
    window.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    const step = 0.06;
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
      keyboardY = Math.max(0, keyboardY - step);
    } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
      keyboardY = Math.min(1, keyboardY + step);
    }
  }

  function getNormY() {
    return keyboardMode ? keyboardY : smoothedY;
  }

  function isHandDetected() {
    return keyboardMode ? true : detected;
  }

  function stop() {
    if (camera) { try { camera.stop(); } catch (e) {} }
    window.removeEventListener('keydown', onKey);
  }

  return { init, getNormY, isHandDetected, enableKeyboardFallback, stop };
})();
