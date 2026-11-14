// Pong simulation + rendering. The host runs step()/physics as the single
// source of truth and broadcasts the resulting state; the guest only
// renders whatever state it receives (plus its own locally-tracked paddle
// for zero-latency feedback).
const Game = (() => {
  const WIDTH = 960, HEIGHT = 540;
  const PADDLE_W = 14, PADDLE_H = 190, BALL_R = 8;
  const CHAR_DISPLAY_H = PADDLE_H; // character sprite height == hitbox height
  // Large enough that the ~142px-wide character sprite (190px tall at the
  // image's 450:600 aspect ratio) fits fully on-screen instead of being
  // clipped by the canvas edge.
  const WALL_INSET = 150;
  const WIN_SCORE = 7;
  const LEFT_EDGE = WALL_INSET + PADDLE_W;   // right face of left paddle
  const RIGHT_EDGE = WIDTH - WALL_INSET - PADDLE_W; // left face of right paddle

  let ctx = null;
  let state = null;
  let leftCharId = null;
  let rightCharId = null;

  const bgImage = new Image();
  bgImage.src = 'assets/backgrounds/forest.webp';

  function setCharacters(leftId, rightId) {
    leftCharId = leftId;
    rightCharId = rightId;
  }

  function init(canvas) {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    ctx = canvas.getContext('2d');
    reset();
  }

  function reset() {
    state = {
      leftY: HEIGHT / 2,
      rightY: HEIGHT / 2,
      ball: { x: WIDTH / 2, y: HEIGHT / 2, vx: 260, vy: 120 },
      scoreLeft: 0,
      scoreRight: 0,
      running: true
    };
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function setPaddleNormY(side, normY) {
    const y = clamp(normY * HEIGHT, PADDLE_H / 2, HEIGHT - PADDLE_H / 2);
    if (side === 'left') state.leftY = y; else state.rightY = y;
  }

  function setPaddleY(side, y) {
    if (side === 'left') state.leftY = clamp(y, PADDLE_H / 2, HEIGHT - PADDLE_H / 2);
    else state.rightY = clamp(y, PADDLE_H / 2, HEIGHT - PADDLE_H / 2);
  }

  function bounce(ball, paddleY, dir) {
    const rel = clamp((ball.y - paddleY) / (PADDLE_H / 2), -1, 1);
    const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.07, 900);
    const angle = rel * (Math.PI / 3); // max 60 degrees
    ball.vx = dir * Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
  }

  function scorePoint(side) {
    if (side === 'left') state.scoreLeft++; else state.scoreRight++;

    if (state.scoreLeft >= WIN_SCORE || state.scoreRight >= WIN_SCORE) {
      state.running = false;
      return;
    }
    state.ball = {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      vx: (side === 'left' ? -1 : 1) * 260,
      vy: (Math.random() - 0.5) * 220
    };
  }

  // Host-only authoritative physics tick.
  function step(dt) {
    if (!state.running) return;
    const b = state.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.y - BALL_R < 0) { b.y = BALL_R; b.vy = Math.abs(b.vy); }
    if (b.y + BALL_R > HEIGHT) { b.y = HEIGHT - BALL_R; b.vy = -Math.abs(b.vy); }

    if (b.vx < 0 && b.x - BALL_R <= LEFT_EDGE && b.x - BALL_R >= LEFT_EDGE - 24) {
      if (Math.abs(b.y - state.leftY) < PADDLE_H / 2 + BALL_R) {
        b.x = LEFT_EDGE + BALL_R;
        bounce(b, state.leftY, 1);
      }
    }
    if (b.vx > 0 && b.x + BALL_R >= RIGHT_EDGE && b.x + BALL_R <= RIGHT_EDGE + 24) {
      if (Math.abs(b.y - state.rightY) < PADDLE_H / 2 + BALL_R) {
        b.x = RIGHT_EDGE - BALL_R;
        bounce(b, state.rightY, -1);
      }
    }

    if (b.x < -40) scorePoint('right');
    if (b.x > WIDTH + 40) scorePoint('left');
  }

  function getState() { return state; }
  function applyRemoteState(s) { state = s; }

  function drawPaddle(side, y, charId) {
    const img = charId ? Characters.getSideImage(charId) : null;

    if (!img || !img.complete || img.naturalWidth === 0) {
      ctx.fillStyle = side === 'left' ? '#5ee6ff' : '#ff5ea8';
      const x = side === 'left' ? WALL_INSET : WIDTH - WALL_INSET - PADDLE_W;
      ctx.fillRect(x, y - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      return;
    }

    const displayW = CHAR_DISPLAY_H * (img.naturalWidth / img.naturalHeight);

    if (side === 'left') {
      ctx.drawImage(img, LEFT_EDGE - displayW, y - CHAR_DISPLAY_H / 2, displayW, CHAR_DISPLAY_H);
    } else {
      ctx.save();
      ctx.translate(RIGHT_EDGE + displayW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, y - CHAR_DISPLAY_H / 2, displayW, CHAR_DISPLAY_H);
      ctx.restore();
    }
  }

  function drawBackground() {
    if (!bgImage.complete || bgImage.naturalWidth === 0) {
      ctx.fillStyle = '#080b14';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      return;
    }
    const canvasRatio = WIDTH / HEIGHT;
    const imgRatio = bgImage.naturalWidth / bgImage.naturalHeight;
    let sx, sy, sw, sh;
    if (imgRatio > canvasRatio) {
      sh = bgImage.naturalHeight;
      sw = sh * canvasRatio;
      sx = (bgImage.naturalWidth - sw) / 2;
      sy = 0;
    } else {
      sw = bgImage.naturalWidth;
      sh = sw / canvasRatio;
      sx = 0;
      sy = (bgImage.naturalHeight - sh) / 2;
    }
    ctx.drawImage(bgImage, sx, sy, sw, sh, 0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = 'rgba(8,11,20,0.35)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function render() {
    drawBackground();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, 0);
    ctx.lineTo(WIDTH / 2, HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    drawPaddle('left', state.leftY, leftCharId);
    drawPaddle('right', state.rightY, rightCharId);

    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(state.scoreLeft, WIDTH / 2 - 90 + 2, 62);
    ctx.fillText(state.scoreRight, WIDTH / 2 + 90 + 2, 62);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(state.scoreLeft, WIDTH / 2 - 90, 60);
    ctx.fillText(state.scoreRight, WIDTH / 2 + 90, 60);
  }

  function isOver() { return state && !state.running; }
  function winnerSide() { return state.scoreLeft > state.scoreRight ? 'left' : 'right'; }

  return {
    WIDTH, HEIGHT, WIN_SCORE,
    init, reset, setPaddleNormY, setPaddleY, setCharacters,
    step, getState, applyRemoteState, render,
    isOver, winnerSide
  };
})();
