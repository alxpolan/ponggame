(() => {
  const $ = (id) => document.getElementById(id);

  Characters.preloadAll();

  const screens = {
    menu: $('screen-menu'),
    lobby: $('screen-lobby'),
    character: $('screen-character'),
    calibrate: $('screen-calibrate'),
    game: $('screen-game'),
    gameover: $('screen-gameover')
  };

  const el = {
    btnHost: $('btn-host'),
    btnJoin: $('btn-join'),
    inputCode: $('input-code'),
    menuError: $('menu-error'),

    lobbyTitle: $('lobby-title'),
    roomCodeBox: $('room-code-box'),
    roomCodeValue: $('room-code-value'),
    btnCopyCode: $('btn-copy-code'),
    btnCancelLobby: $('btn-cancel-lobby'),

    charCards: Array.from(document.querySelectorAll('.char-card')),
    btnCharContinue: $('btn-char-continue'),
    charWaiting: $('char-waiting'),

    camPreview: $('cam-preview'),
    handStatus: $('hand-status'),
    calibrateError: $('calibrate-error'),
    btnReady: $('btn-ready'),
    btnKeyboardFallback: $('btn-keyboard-fallback'),
    calibrateWaiting: $('calibrate-waiting'),

    hudSideLabel: $('hud-side-label'),
    btnLeave: $('btn-leave'),
    gameCanvas: $('game-canvas'),
    miniCam: $('mini-cam'),
    countdownOverlay: $('countdown-overlay'),

    gameoverTitle: $('gameover-title'),
    gameoverText: $('gameover-text'),
    btnRematch: $('btn-rematch'),
    btnToMenu: $('btn-to-menu'),

    webcamVideo: $('webcam-video')
  };

  let localSide = null;   // 'left' (host) or 'right' (guest)
  let remoteSide = null;
  let localReady = false;
  let remoteReady = false;
  let localCharId = null;
  let localCharReady = false;
  let remoteCharId = null;
  let remoteCharReady = false;
  let cameraStream = null;
  let calibrateStatusTimer = null;
  let rafHandle = null;
  let lastFrameTime = 0;
  let lastSendTime = 0;
  let countdownTimer = null;

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function resetMenuState() {
    el.menuError.textContent = '';
    el.inputCode.value = '';
  }

  // ---------- MENU ----------
  el.btnHost.addEventListener('click', () => {
    resetMenuState();
    el.lobbyTitle.textContent = 'Warte auf Gegner…';
    el.roomCodeBox.classList.add('hidden');
    showScreen('lobby');

    Network.host({
      onRoomCreated: (code) => {
        el.roomCodeValue.textContent = code;
        el.roomCodeBox.classList.remove('hidden');
      },
      onConnected: () => startCharacterSelect(),
      onDisconnected: handleDisconnect,
      onError: handleNetworkError,
      onData: routeData
    });
  });

  el.btnJoin.addEventListener('click', () => {
    const code = el.inputCode.value.trim();
    if (code.length < 4) {
      el.menuError.textContent = 'Bitte gültigen Raum-Code eingeben.';
      return;
    }
    resetMenuState();
    el.lobbyTitle.textContent = 'Verbinde…';
    el.roomCodeBox.classList.add('hidden');
    showScreen('lobby');

    Network.join(code, {
      onConnected: () => startCharacterSelect(),
      onDisconnected: handleDisconnect,
      onError: handleNetworkError,
      onData: routeData
    });
  });

  el.btnCopyCode.addEventListener('click', () => {
    navigator.clipboard?.writeText(el.roomCodeValue.textContent).catch(() => {});
  });

  el.btnCancelLobby.addEventListener('click', () => {
    Network.destroy();
    showScreen('menu');
  });

  function handleNetworkError(err) {
    console.error('Network error:', err);
    el.menuError.textContent = 'Verbindungsfehler: ' + (err?.message || err?.type || 'unbekannt');
    Network.destroy();
    showScreen('menu');
  }

  function handleDisconnect() {
    stopGameLoop();
    HandTracking.stop();
    stopCameraStream();
    el.menuError.textContent = 'Gegner hat die Verbindung getrennt.';
    showScreen('menu');
  }

  // ---------- CHARACTER SELECT ----------
  function startCharacterSelect() {
    localSide = Network.isHost() ? 'left' : 'right';
    remoteSide = localSide === 'left' ? 'right' : 'left';
    localCharId = null;
    localCharReady = false;
    remoteCharId = null;
    remoteCharReady = false;

    el.charCards.forEach((c) => c.classList.remove('selected'));
    el.btnCharContinue.disabled = true;
    el.btnCharContinue.textContent = 'Weiter';
    el.charWaiting.classList.add('hidden');
    showScreen('character');
  }

  el.charCards.forEach((card) => {
    card.addEventListener('click', () => {
      if (localCharReady) return;
      el.charCards.forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      localCharId = card.dataset.char;
      el.btnCharContinue.disabled = false;
    });
  });

  el.btnCharContinue.addEventListener('click', () => {
    if (!localCharId) return;
    localCharReady = true;
    el.btnCharContinue.disabled = true;
    el.charWaiting.classList.remove('hidden');
    Network.send({ type: 'character', id: localCharId });
    maybeStartCalibration();
  });

  function maybeStartCalibration() {
    if (localCharReady && remoteCharReady) {
      const leftId = localSide === 'left' ? localCharId : remoteCharId;
      const rightId = localSide === 'left' ? remoteCharId : localCharId;
      Game.setCharacters(leftId, rightId);
      startCalibration();
    }
  }

  // ---------- CALIBRATION ----------
  function startCalibration() {
    localReady = false;
    remoteReady = false;

    el.btnReady.disabled = false;
    el.btnReady.textContent = 'Ich bin bereit';
    el.calibrateWaiting.classList.add('hidden');
    el.calibrateError.textContent = '';
    showScreen('calibrate');

    navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false })
      .then((stream) => {
        cameraStream = stream;
        el.webcamVideo.srcObject = stream;
        return el.webcamVideo.play();
      })
      .then(() => HandTracking.init(el.webcamVideo, el.camPreview))
      .then(() => {
        calibrateStatusTimer = setInterval(updateHandStatusUI, 200);
      })
      .catch((err) => {
        console.warn('Kamera nicht verfügbar:', err);
        el.calibrateError.textContent = 'Kamera nicht verfügbar. Du kannst stattdessen die Tastatur benutzen.';
      });
  }

  function updateHandStatusUI() {
    const ok = HandTracking.isHandDetected();
    el.handStatus.textContent = ok ? 'Hand erkannt' : 'Keine Hand erkannt';
    el.handStatus.classList.toggle('detected', ok);
    el.handStatus.classList.toggle('not-detected', !ok);
  }

  el.btnKeyboardFallback.addEventListener('click', () => {
    HandTracking.enableKeyboardFallback();
    el.calibrateError.textContent = '';
    updateHandStatusUI();
  });

  el.btnReady.addEventListener('click', () => {
    localReady = true;
    el.btnReady.disabled = true;
    el.btnReady.textContent = 'Bereit!';
    el.calibrateWaiting.classList.remove('hidden');
    Network.send({ type: 'ready' });
    maybeStartGame();
  });

  function maybeStartGame() {
    if (localReady && remoteReady) {
      if (calibrateStatusTimer) { clearInterval(calibrateStatusTimer); calibrateStatusTimer = null; }
      beginMatch();
    }
  }

  // ---------- GAME ----------
  function beginMatch() {
    el.hudSideLabel.textContent = localSide === 'left' ? 'links (cyan)' : 'rechts (pink)';
    Game.init(el.gameCanvas);
    Game.reset();
    showScreen('game');
    runCountdown(3, () => startGameLoop());
  }

  function runCountdown(from, onDone) {
    let n = from;
    el.countdownOverlay.classList.remove('hidden');
    el.countdownOverlay.textContent = n;
    countdownTimer = setInterval(() => {
      n--;
      if (n > 0) {
        el.countdownOverlay.textContent = n;
      } else {
        clearInterval(countdownTimer);
        countdownTimer = null;
        el.countdownOverlay.classList.add('hidden');
        onDone();
      }
    }, 800);
  }

  function startGameLoop() {
    lastFrameTime = performance.now();
    lastSendTime = 0;
    loop();
  }

  function stopGameLoop() {
    if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  }

  function loop() {
    rafHandle = requestAnimationFrame(loop);
    const now = performance.now();
    let dt = (now - lastFrameTime) / 1000;
    dt = Math.min(dt, 0.05);
    lastFrameTime = now;

    const normY = HandTracking.getNormY();
    Game.setPaddleNormY(localSide, normY);

    if (Network.isHost()) {
      Game.step(dt);
    }

    if (now - lastSendTime > 50) {
      lastSendTime = now;
      if (Network.isHost()) {
        Network.send({ type: 'state', state: Game.getState() });
      } else {
        Network.send({ type: 'paddle', y: Game.getState()[localSide + 'Y'] });
      }
    }

    drawMiniCam();
    Game.render();

    if (Game.isOver()) {
      stopGameLoop();
      showGameOver();
    }
  }

  function drawMiniCam() {
    const ctx = el.miniCam.getContext('2d');
    if (el.webcamVideo.videoWidth) {
      ctx.drawImage(el.webcamVideo, 0, 0, el.miniCam.width, el.miniCam.height);
    }
  }

  function showGameOver() {
    const iWon = Game.winnerSide() === localSide;
    el.gameoverTitle.textContent = iWon ? 'Du hast gewonnen! 🎉' : 'Du hast verloren';
    const s = Game.getState();
    el.gameoverText.textContent = `Endstand: ${s.scoreLeft} : ${s.scoreRight}`;
    showScreen('gameover');
  }

  el.btnRematch.addEventListener('click', () => {
    if (Network.isHost()) {
      hostStartRematch();
    } else {
      el.gameoverText.textContent = 'Warte auf Host…';
      Network.send({ type: 'rematchRequest' });
    }
  });

  function hostStartRematch() {
    Game.reset();
    Network.send({ type: 'rematchStart' });
    showScreen('game');
    runCountdown(3, () => startGameLoop());
  }

  function guestStartRematch() {
    Game.reset();
    showScreen('game');
    runCountdown(3, () => startGameLoop());
  }

  el.btnToMenu.addEventListener('click', () => leaveMatch());
  el.btnLeave.addEventListener('click', () => leaveMatch());

  function leaveMatch() {
    stopGameLoop();
    HandTracking.stop();
    stopCameraStream();
    Network.destroy();
    localReady = false;
    remoteReady = false;
    showScreen('menu');
  }

  function stopCameraStream() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      cameraStream = null;
    }
  }

  // ---------- Central data handler (routes every incoming peer message) ----------
  function routeData(data) {
    if (!data || !data.type) return;
    switch (data.type) {
      case 'character':
        remoteCharId = data.id;
        remoteCharReady = true;
        maybeStartCalibration();
        break;
      case 'ready':
        remoteReady = true;
        maybeStartGame();
        break;
      case 'state':
        if (!Network.isHost()) {
          Game.applyRemoteState(data.state);
          Game.setPaddleNormY(localSide, HandTracking.getNormY());
        }
        break;
      case 'paddle':
        if (Network.isHost()) {
          Game.setPaddleY(remoteSide, data.y);
        }
        break;
      case 'rematchRequest':
        if (Network.isHost()) hostStartRematch();
        break;
      case 'rematchStart':
        if (!Network.isHost()) guestStartRematch();
        break;
    }
  }
})();
