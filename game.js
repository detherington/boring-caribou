// Swine Shredders — a tiny endless-runner where a pig skates through Pork City.
// Vanilla JS + Canvas2D. No build step. Touch + keyboard.

(() => {
  'use strict';

  // ---------- Canvas & DPR ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  // Logical (CSS-pixel) dimensions the game is designed around.
  const VIEW = { w: 800, h: 450 };
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    // Fit VIEW into the window, preserving aspect ratio by letterboxing via scale.
    const scale = Math.min(cssW / VIEW.w, cssH / VIEW.h);
    VIEW.scale = scale;
    VIEW.offsetX = (cssW - VIEW.w * scale) / 2;
    VIEW.offsetY = (cssH - VIEW.h * scale) / 2;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
  }
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', resize, { passive: true });
  resize();

  // ---------- Utilities ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const aabb = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // ---------- Game constants ----------
  const GROUND_Y = 360;          // y of top of the sidewalk (pig stands on this)
  const GRAVITY = 2000;          // px/s^2
  const JUMP_V = 720;            // base jump velocity
  const JUMP_V_MAX = 980;        // max charged jump
  const CHARGE_TIME = 0.28;      // seconds to fully charge
  const BASE_SPEED = 320;        // starting world speed px/s
  const MAX_SPEED = 780;
  const SPEED_RAMP = 6;          // px/s per second of play

  // ---------- State ----------
  const STATE = { MENU: 0, PLAY: 1, PAUSE: 2, OVER: 3 };
  let state = STATE.MENU;

  const game = {
    speed: BASE_SPEED,
    score: 0,
    combo: 1,
    comboTimer: 0,
    truffles: 0,
    time: 0,
    distance: 0,
    spawnCooldown: 1.2,
    best: parseInt(localStorage.getItem('swineBest') || '0', 10) || 0,
    bgScroll: [0, 0, 0, 0],
  };

  const player = {
    x: 120, y: GROUND_Y - 46, w: 60, h: 46,
    vy: 0,
    onGround: true,
    charging: false,
    chargeTime: 0,
    trick: null,        // 'flip' | 'grab' | 'grind' | null
    trickTime: 0,
    rotation: 0,
    dead: false,
    invuln: 0,
  };

  const obstacles = [];
  const truffles = [];
  const particles = [];

  // ---------- DOM refs ----------
  const el = {
    hud: document.getElementById('hud'),
    score: document.getElementById('score'),
    combo: document.getElementById('combo'),
    truffles: document.getElementById('truffles'),
    pauseBtn: document.getElementById('pauseBtn'),
    menu: document.getElementById('menu'),
    playBtn: document.getElementById('playBtn'),
    bestScore: document.getElementById('bestScore'),
    pause: document.getElementById('pause'),
    resumeBtn: document.getElementById('resumeBtn'),
    quitBtn: document.getElementById('quitBtn'),
    over: document.getElementById('gameover'),
    finalScore: document.getElementById('finalScore'),
    finalTruffles: document.getElementById('finalTruffles'),
    finalBest: document.getElementById('finalBest'),
    newBest: document.getElementById('newBest'),
    againBtn: document.getElementById('againBtn'),
    menuBtn: document.getElementById('menuBtn'),
  };
  el.bestScore.textContent = game.best;

  // ---------- Input ----------
  const input = {
    pointerDown: false,
    pointerStart: null,
    pointerLast: null,
    swipedThisPress: false,
  };

  function viewPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / VIEW.scale;
    const y = (e.clientY - rect.top) / VIEW.scale;
    return { x, y };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (state !== STATE.PLAY) return;
    canvas.setPointerCapture?.(e.pointerId);
    input.pointerDown = true;
    input.swipedThisPress = false;
    input.pointerStart = viewPointFromEvent(e);
    input.pointerLast = input.pointerStart;
    if (player.onGround && !player.dead) {
      player.charging = true;
      player.chargeTime = 0;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!input.pointerDown || state !== STATE.PLAY) return;
    const p = viewPointFromEvent(e);
    input.pointerLast = p;
    if (input.swipedThisPress || !input.pointerStart) return;
    const dx = p.x - input.pointerStart.x;
    const dy = p.y - input.pointerStart.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 28) {
      input.swipedThisPress = true;
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) tryTrick('flip');
        else tryTrick(player.onGround ? 'grind' : 'grab');
      }
    }
  });

  function endPointer() {
    if (!input.pointerDown) return;
    input.pointerDown = false;
    if (state !== STATE.PLAY) return;
    if (player.charging && player.onGround && !player.dead && !input.swipedThisPress) {
      doJump();
    }
    player.charging = false;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      if (state === STATE.MENU) startGame();
      else if (state === STATE.PLAY && player.onGround && !player.dead) doJump();
      e.preventDefault();
    } else if (e.code === 'KeyZ') {
      if (state === STATE.PLAY) tryTrick('flip');
    } else if (e.code === 'KeyX') {
      if (state === STATE.PLAY) tryTrick(player.onGround ? 'grind' : 'grab');
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state === STATE.PLAY) setPaused(true);
      else if (state === STATE.PAUSE) setPaused(false);
    }
  });

  function doJump() {
    const t = clamp(player.chargeTime / CHARGE_TIME, 0, 1);
    player.vy = -(JUMP_V + (JUMP_V_MAX - JUMP_V) * t);
    player.onGround = false;
    player.charging = false;
    spawnPuff(player.x + 18, GROUND_Y, 8);
  }

  function tryTrick(kind) {
    if (player.dead) return;
    if (kind === 'grind') {
      if (player.onGround) {
        player.trick = 'grind';
        player.trickTime = 0.5;
        addScore(20, 'GRIND');
        for (let i = 0; i < 3; i++) spawnSpark(player.x + 10 + i * 10, GROUND_Y - 2);
      }
      return;
    }
    if (!player.onGround && player.trick == null) {
      player.trick = kind;
      player.trickTime = 0.45;
      addScore(kind === 'flip' ? 60 : 40, kind === 'flip' ? 'KICKFLIP' : 'GRAB');
    }
  }

  // ---------- Score / combo ----------
  const floatTexts = [];
  function addScore(amount, label) {
    const gained = Math.round(amount * game.combo);
    game.score += gained;
    game.combo = Math.min(8, game.combo + 1);
    game.comboTimer = 2.2;
    floatTexts.push({
      text: `${label || '+' + amount} +${gained}`,
      x: player.x + player.w / 2,
      y: player.y - 10,
      life: 1.0,
      vy: -40,
    });
  }

  // ---------- Spawning ----------
  const OBSTACLE_TYPES = [
    { kind: 'cone',  w: 22, h: 30, groundOffset: 0, color: '#ff7a2e' },
    { kind: 'can',   w: 34, h: 44, groundOffset: 0, color: '#4a4a4a' },
    { kind: 'bench', w: 70, h: 26, groundOffset: 0, color: '#7a4a1a' },
    { kind: 'sign',  w: 44, h: 22, groundOffset: -70, color: '#e0344b' },
  ];

  function spawnObstacle() {
    const t = OBSTACLE_TYPES[randi(0, OBSTACLE_TYPES.length)];
    const y = t.groundOffset < 0 ? GROUND_Y + t.groundOffset - t.h : GROUND_Y - t.h;
    obstacles.push({
      kind: t.kind,
      x: VIEW.w + 40,
      y,
      w: t.w,
      h: t.h,
      color: t.color,
    });
  }

  function spawnTruffleRun() {
    // Arc of truffles tempting an ollie
    const count = randi(3, 7);
    const startX = VIEW.w + 60;
    const arcHeight = rand(40, 110);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const x = startX + i * 38;
      const y = GROUND_Y - 40 - Math.sin(t * Math.PI) * arcHeight;
      truffles.push({ x, y, w: 18, h: 18, collected: false, bob: Math.random() * Math.PI * 2 });
    }
  }

  function spawnPuff(x, y, n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y,
        vx: rand(-40, 40),
        vy: rand(-120, -20),
        life: rand(0.3, 0.6),
        r: rand(2, 5),
        color: 'rgba(255,240,220,0.9)',
        g: 120,
      });
    }
  }
  function spawnSpark(x, y) {
    particles.push({
      x, y,
      vx: rand(-220, -80),
      vy: rand(-220, -60),
      life: rand(0.25, 0.5),
      r: rand(1.5, 3),
      color: '#ffd24d',
      g: 600,
    });
  }

  // ---------- Game lifecycle ----------
  function resetGame() {
    game.speed = BASE_SPEED;
    game.score = 0;
    game.combo = 1;
    game.comboTimer = 0;
    game.truffles = 0;
    game.time = 0;
    game.distance = 0;
    game.spawnCooldown = 1.0;
    obstacles.length = 0;
    truffles.length = 0;
    particles.length = 0;
    floatTexts.length = 0;
    player.x = 120;
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
    player.charging = false;
    player.chargeTime = 0;
    player.trick = null;
    player.trickTime = 0;
    player.rotation = 0;
    player.dead = false;
    player.invuln = 0;
  }

  function startGame() {
    resetGame();
    state = STATE.PLAY;
    el.menu.classList.add('hidden');
    el.pause.classList.add('hidden');
    el.over.classList.add('hidden');
    el.hud.classList.remove('hidden');
  }
  function setPaused(p) {
    if (p && state === STATE.PLAY) {
      state = STATE.PAUSE;
      el.pause.classList.remove('hidden');
    } else if (!p && state === STATE.PAUSE) {
      state = STATE.PLAY;
      el.pause.classList.add('hidden');
    }
  }
  function gameOver() {
    state = STATE.OVER;
    player.dead = true;
    if (game.score > game.best) {
      game.best = game.score;
      localStorage.setItem('swineBest', String(game.best));
      el.newBest.classList.remove('hidden');
    } else {
      el.newBest.classList.add('hidden');
    }
    el.finalScore.textContent = game.score;
    el.finalTruffles.textContent = game.truffles;
    el.finalBest.textContent = game.best;
    el.bestScore.textContent = game.best;
    el.over.classList.remove('hidden');
    el.hud.classList.add('hidden');
  }
  function quitToMenu() {
    state = STATE.MENU;
    el.pause.classList.add('hidden');
    el.over.classList.add('hidden');
    el.hud.classList.add('hidden');
    el.menu.classList.remove('hidden');
  }

  el.playBtn.addEventListener('click', startGame);
  el.pauseBtn.addEventListener('click', () => setPaused(true));
  el.resumeBtn.addEventListener('click', () => setPaused(false));
  el.quitBtn.addEventListener('click', quitToMenu);
  el.againBtn.addEventListener('click', startGame);
  el.menuBtn.addEventListener('click', quitToMenu);

  // ---------- Update ----------
  function update(dt) {
    if (state !== STATE.PLAY) return;

    game.time += dt;
    game.speed = Math.min(MAX_SPEED, BASE_SPEED + game.time * SPEED_RAMP);
    game.distance += game.speed * dt;
    // Passive score from distance
    game.score += Math.floor(game.speed * dt * 0.05);

    // Combo decay
    if (game.comboTimer > 0) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) game.combo = 1;
    }

    // Parallax scroll
    game.bgScroll[0] = (game.bgScroll[0] + game.speed * 0.1 * dt) % 400;
    game.bgScroll[1] = (game.bgScroll[1] + game.speed * 0.3 * dt) % 400;
    game.bgScroll[2] = (game.bgScroll[2] + game.speed * 0.6 * dt) % 200;
    game.bgScroll[3] = (game.bgScroll[3] + game.speed * dt) % 80;

    // Player physics
    if (player.charging) {
      player.chargeTime = Math.min(CHARGE_TIME * 1.2, player.chargeTime + dt);
    }
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y + player.h >= GROUND_Y) {
      player.y = GROUND_Y - player.h;
      if (!player.onGround) {
        spawnPuff(player.x + 18, GROUND_Y, 6);
        // Landing a trick = bonus
        if (player.trick && player.trick !== 'grind') {
          addScore(30, 'LAND');
        }
        player.trick = null;
        player.trickTime = 0;
        player.rotation = 0;
      }
      player.vy = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    // Trick rotation
    if (player.trick === 'flip' && player.trickTime > 0) {
      player.rotation -= dt * 14;
      player.trickTime -= dt;
      if (player.trickTime <= 0) player.rotation = 0;
    } else if (player.trick === 'grab' && player.trickTime > 0) {
      player.trickTime -= dt;
    } else if (player.trick === 'grind' && player.trickTime > 0) {
      player.trickTime -= dt;
      if (Math.random() < 0.5) spawnSpark(player.x + 10, GROUND_Y - 2);
      if (player.trickTime <= 0) player.trick = null;
    }

    if (player.invuln > 0) player.invuln -= dt;

    // Spawning
    game.spawnCooldown -= dt;
    if (game.spawnCooldown <= 0) {
      const roll = Math.random();
      if (roll < 0.55) spawnObstacle();
      else if (roll < 0.85) spawnTruffleRun();
      else { spawnObstacle(); if (Math.random() < 0.6) spawnTruffleRun(); }
      const base = clamp(1.4 - game.time * 0.015, 0.55, 1.4);
      game.spawnCooldown = base + Math.random() * 0.4;
    }

    // Move & cull obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= game.speed * dt;
      if (o.x + o.w < -20) { obstacles.splice(i, 1); continue; }
      // Collision
      if (player.invuln <= 0) {
        const pbox = { x: player.x + 6, y: player.y + 4, w: player.w - 12, h: player.h - 8 };
        if (aabb(pbox, o)) {
          gameOver();
          spawnPuff(player.x + 20, player.y + 20, 18);
          return;
        }
      }
    }

    // Move & collect truffles
    for (let i = truffles.length - 1; i >= 0; i--) {
      const t = truffles[i];
      t.x -= game.speed * dt;
      t.bob += dt * 4;
      if (t.x + t.w < -20) { truffles.splice(i, 1); continue; }
      const pbox = { x: player.x, y: player.y, w: player.w, h: player.h };
      if (!t.collected && aabb(pbox, t)) {
        t.collected = true;
        game.truffles += 1;
        addScore(15, 'TRUFFLE');
        spawnPuff(t.x, t.y, 5);
        truffles.splice(i, 1);
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Float texts
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const f = floatTexts[i];
      f.y += f.vy * dt;
      f.life -= dt;
      if (f.life <= 0) floatTexts.splice(i, 1);
    }

    // HUD
    el.score.textContent = game.score;
    el.combo.textContent = game.combo;
    el.truffles.textContent = game.truffles;
  }

  // ---------- Rendering ----------
  function drawBackground() {
    // Sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, VIEW.h);
    g.addColorStop(0, '#271447');
    g.addColorStop(0.55, '#6b2e7a');
    g.addColorStop(1, '#ff7a59');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);

    // Sun
    ctx.fillStyle = '#ffd24d';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(VIEW.w * 0.78, 140, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Distant mountains (layer 0)
    ctx.fillStyle = '#2b1244';
    const o0 = game.bgScroll[0];
    for (let x = -o0; x < VIEW.w + 100; x += 200) {
      ctx.beginPath();
      ctx.moveTo(x, 260);
      ctx.lineTo(x + 100, 180);
      ctx.lineTo(x + 200, 260);
      ctx.closePath();
      ctx.fill();
    }

    // Mid buildings (layer 1)
    const o1 = game.bgScroll[1];
    for (let x = -o1; x < VIEW.w + 100; x += 80) {
      const h = 70 + ((x * 13) % 60);
      ctx.fillStyle = '#1a0a30';
      ctx.fillRect(x, 280 - h, 60, h);
      // Windows
      ctx.fillStyle = '#ffd24d';
      for (let wy = 290 - h; wy < 270; wy += 12) {
        for (let wx = x + 6; wx < x + 54; wx += 12) {
          if (((wx + wy) * 7) % 5 === 0) ctx.fillRect(wx, wy, 4, 6);
        }
      }
    }

    // Close buildings (layer 2)
    const o2 = game.bgScroll[2];
    ctx.fillStyle = '#0f0420';
    for (let x = -o2; x < VIEW.w + 100; x += 120) {
      const h = 120 + ((x * 17) % 40);
      ctx.fillRect(x, 300 - h, 90, h);
    }

    // Sidewalk / street
    ctx.fillStyle = '#3a2650';
    ctx.fillRect(0, GROUND_Y, VIEW.w, VIEW.h - GROUND_Y);
    ctx.fillStyle = '#52366f';
    ctx.fillRect(0, GROUND_Y, VIEW.w, 6);

    // Ground stripe (layer 3)
    const o3 = game.bgScroll[3];
    ctx.fillStyle = '#ffd24d';
    for (let x = -o3; x < VIEW.w + 40; x += 80) {
      ctx.fillRect(x, GROUND_Y + 28, 40, 4);
    }
  }

  function drawPig(px, py, rot) {
    ctx.save();
    ctx.translate(px + player.w / 2, py + player.h / 2);
    ctx.rotate(rot);
    const x = -player.w / 2;
    const y = -player.h / 2;

    // Skateboard
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(x + 2, y + 40, player.w - 4, 5);
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(x + 10, y + 47, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + player.w - 10, y + 47, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.arc(x + 10, y + 47, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + player.w - 10, y + 47, 1.5, 0, Math.PI * 2); ctx.fill();

    // Body (pink)
    ctx.fillStyle = '#ffb3c9';
    ctx.beginPath();
    ctx.ellipse(x + player.w / 2, y + 22, 26, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    // Snout
    ctx.fillStyle = '#ff8fb1';
    ctx.beginPath();
    ctx.ellipse(x + player.w / 2 + 10, y + 26, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Nostrils
    ctx.fillStyle = '#2a1026';
    ctx.beginPath(); ctx.arc(x + player.w / 2 + 8, y + 26, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + player.w / 2 + 13, y + 26, 1.2, 0, Math.PI * 2); ctx.fill();
    // Ears
    ctx.fillStyle = '#ff8fb1';
    ctx.beginPath();
    ctx.moveTo(x + 14, y + 6); ctx.lineTo(x + 22, y - 2); ctx.lineTo(x + 24, y + 14);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + player.w - 14, y + 6); ctx.lineTo(x + player.w - 22, y - 2); ctx.lineTo(x + player.w - 24, y + 14);
    ctx.closePath(); ctx.fill();
    // Eye
    ctx.fillStyle = '#2a1026';
    ctx.beginPath(); ctx.arc(x + player.w / 2 + 4, y + 16, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + player.w / 2 + 5, y + 15, 1, 0, Math.PI * 2); ctx.fill();

    // Trick visuals
    if (player.trick === 'grab') {
      ctx.strokeStyle = '#2a1026';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + player.w / 2 - 10, y + 34);
      ctx.lineTo(x + player.w / 2 - 18, y + 44);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawObstacle(o) {
    ctx.fillStyle = o.color;
    if (o.kind === 'cone') {
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, o.y);
      ctx.lineTo(o.x + o.w, o.y + o.h);
      ctx.lineTo(o.x, o.y + o.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(o.x + 2, o.y + o.h * 0.55, o.w - 4, 4);
    } else if (o.kind === 'can') {
      ctx.fillRect(o.x, o.y + 4, o.w, o.h - 4);
      ctx.fillStyle = '#6a6a6a';
      ctx.fillRect(o.x - 2, o.y, o.w + 4, 5);
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(o.x + 6, o.y + 12, o.w - 12, 3);
      ctx.fillRect(o.x + 6, o.y + 22, o.w - 12, 3);
    } else if (o.kind === 'bench') {
      ctx.fillRect(o.x, o.y + 8, o.w, 6);
      ctx.fillRect(o.x + 4, o.y + 14, 4, 12);
      ctx.fillRect(o.x + o.w - 8, o.y + 14, 4, 12);
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(o.x, o.y + 14, o.w, 2);
    } else if (o.kind === 'sign') {
      ctx.fillStyle = '#6a6a6a';
      ctx.fillRect(o.x + o.w / 2 - 1, o.y - 20, 2, 20);
      ctx.fillStyle = o.color;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = '#fff';
      ctx.fillRect(o.x + 6, o.y + 9, o.w - 12, 4);
    }
  }

  function drawTruffle(t) {
    const bob = Math.sin(t.bob) * 3;
    ctx.save();
    ctx.translate(t.x + t.w / 2, t.y + t.h / 2 + bob);
    // Glow
    ctx.fillStyle = 'rgba(255,210,77,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    // Truffle body
    ctx.fillStyle = '#6b3a1a';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a4a22';
    ctx.beginPath(); ctx.arc(-2, -2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c38246';
    ctx.beginPath(); ctx.arc(-3, -3, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatTexts() {
    ctx.font = 'bold 14px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const f of floatTexts) {
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.fillStyle = '#2a1026';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = '#ffd24d';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
  }

  function render() {
    // Apply letterboxing & DPR
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      VIEW.scale * dpr, 0,
      0, VIEW.scale * dpr,
      VIEW.offsetX * dpr, VIEW.offsetY * dpr
    );

    drawBackground();

    // Truffles behind player
    for (const t of truffles) drawTruffle(t);

    // Obstacles
    for (const o of obstacles) drawObstacle(o);

    // Player (blink if invuln)
    if (!(player.invuln > 0 && Math.floor(game.time * 20) % 2)) {
      drawPig(player.x, player.y, player.rotation);
    }

    // Charge indicator
    if (player.charging) {
      const t = clamp(player.chargeTime / CHARGE_TIME, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(player.x - 2, player.y - 12, player.w + 4, 6);
      ctx.fillStyle = '#ffd24d';
      ctx.fillRect(player.x, player.y - 10, player.w * t, 2);
    }

    drawParticles();
    drawFloatTexts();

    // Menu state: draw idle pig on screen
    if (state === STATE.MENU) {
      drawPig(VIEW.w / 2 - player.w / 2, GROUND_Y - player.h - Math.sin(performance.now() * 0.004) * 4, 0);
    }
  }

  // ---------- Main loop ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
