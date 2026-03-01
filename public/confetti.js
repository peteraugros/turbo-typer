/* ══════════════════════════════════════════════════════════════
   confetti.js — lightweight canvas confetti burst
══════════════════════════════════════════════════════════════ */
(function() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx    = canvas.getContext('2d');
  let particles = [];
  let animId    = null;

  const COLORS = ['#f7e142','#ff3c3c','#3dffb0','#38d9ff','#b46fff','#ff8c42','#ffffff'];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function Particle(x, y) {
    this.x  = x;
    this.y  = y;
    this.vx = (Math.random() - .5) * 14;
    this.vy = (Math.random() * -12) - 4;
    this.rot    = Math.random() * Math.PI * 2;
    this.rotV   = (Math.random() - .5) * .25;
    this.w  = Math.random() * 10 + 5;
    this.h  = Math.random() * 6  + 3;
    this.color  = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.life   = 1;
    this.decay  = Math.random() * .012 + .008;
  }

  Particle.prototype.update = function() {
    this.vy += .35;      // gravity
    this.vx *= .98;      // air drag
    this.x  += this.vx;
    this.y  += this.vy;
    this.rot += this.rotV;
    this.life -= this.decay;
  };

  Particle.prototype.draw = function() {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    ctx.restore();
  };

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => { p.update(); p.draw(); });
    if (particles.length > 0) animId = requestAnimationFrame(loop);
    else animId = null;
  }

  function burst(x, y, count = 80) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
    if (!animId) animId = requestAnimationFrame(loop);
  }

  function celebration() {
    // Multi-origin burst across the top
    const w = canvas.width;
    const h = canvas.height;
    burst(w * .2, h * .3, 60);
    setTimeout(() => burst(w * .5, h * .2, 80), 150);
    setTimeout(() => burst(w * .8, h * .3, 60), 300);
    setTimeout(() => burst(w * .35, h * .1, 50), 500);
    setTimeout(() => burst(w * .65, h * .1, 50), 650);
  }

  window.Confetti = { burst, celebration };
})();
