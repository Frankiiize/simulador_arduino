import { useEffect, useRef } from 'react';

const CHICKEN_COLORS = ['#f5dba8', '#f5c842', '#f0b428', '#f5d066', '#e8c838'];

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function IndustrialScene({ telemetry, resources, connected }) {
  const canvasRef = useRef(null);
  const chickensRef = useRef([]);
  const eggsRef = useRef([]);
  const fanAngleRef = useRef(0);
  const particlesRef = useRef([]);
  const latestRef = useRef({ telemetry, resources, connected });

  useEffect(() => {
    latestRef.current = { telemetry, resources, connected };
  }, [telemetry, resources, connected]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      initChickens(width, height);
      initEggs(width, height);
    };

    const initChickens = (w, h) => {
      chickensRef.current = Array.from({ length: 16 }, () => ({
        x: 80 + Math.random() * Math.max(160, w - 160),
        y: h * 0.62 + Math.random() * (h * 0.22),
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.15,
        color: CHICKEN_COLORS[Math.floor(Math.random() * CHICKEN_COLORS.length)],
        size: 16 + Math.random() * 6,
        bob: Math.random() * Math.PI * 2,
        walk: Math.random() * Math.PI * 2
      }));
    };

    const initEggs = (w, h) => {
      eggsRef.current = Array.from({ length: 6 }, () => ({
        x: 120 + Math.random() * (w * 0.6),
        y: h * 0.72 + Math.random() * (h * 0.1)
      }));
    };

    const draw = () => {
      const { telemetry, resources, connected } = latestRef.current;
      const temp = telemetry.temperature;
      const fanOn = connected && telemetry.fanOn;
      const heatOn = connected && telemetry.heatOn;
      const fanSpeed = fanOn ? clampNumber(telemetry.fanSpeed, 0, 100) : 0;
      const fanRatio = fanSpeed / 100;
      const lightOn = connected && telemetry.lightOn;
      const luxRatio = Math.max(0.05, Math.min(1, resources.lux / 1000));

      ctx.clearRect(0, 0, width, height);
      drawThermalOverlay(ctx, width, height, temp);
      drawStructure(ctx, width, height);
      drawLights(ctx, width, lightOn, luxRatio);
      drawNestBoxes(ctx, height, heatOn);
      drawSilos(ctx, width, height, resources.silos);
      drawFeeders(ctx, width, height, telemetry.servoOpen);
      drawWaterLine(ctx, width, height, resources.water);
      updateChickens(ctx, width, height, connected);
      drawEggs(ctx, eggsRef.current);
      if (connected) drawParticles(ctx);
      drawAirflow(ctx, width, height, fanOn, fanSpeed);
      drawFan(ctx, width, height, fanOn, fanSpeed);

      if (connected && fanOn && fanSpeed > 0) {
        fanAngleRef.current += 0.035 + fanRatio * 0.36;
      }
      animationId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    resize();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas ref={canvasRef} className="scene-canvas" />;

  function updateChickens(ctx, width, height, connected) {
    for (const chicken of chickensRef.current) {
      if (connected) {
        chicken.bob += 0.05;
        chicken.walk += 0.08;
        chicken.x += chicken.vx;
        chicken.y += chicken.vy;
        if (chicken.x < 40 || chicken.x > width - 40) chicken.vx *= -1;
        if (chicken.y < height * 0.65 || chicken.y > height * 0.86) chicken.vy *= -1;
      }
      drawChicken(ctx, chicken);
    }
  }

  function drawFan(ctx, width, height, fanOn, fanSpeed) {
    const fx = width - 64;
    const fy = height * 0.3;
    const radius = 38;
    const speedRatio = clampNumber(fanSpeed, 0, 100) / 100;
    const bladeAlpha = fanOn ? 0.35 + speedRatio * 0.65 : 0.35;

    if (fanOn && speedRatio > 0) {
      const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, radius + 28);
      glow.addColorStop(0, `rgba(121,192,255,${0.12 + speedRatio * 0.18})`);
      glow.addColorStop(0.55, `rgba(88,166,255,${0.08 + speedRatio * 0.12})`);
      glow.addColorStop(1, 'rgba(88,166,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(fx, fy, radius + 28, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#1c2330';
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fx, fy, radius + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(fx, fy);

    if (fanOn && speedRatio > 0.55) {
      ctx.strokeStyle = `rgba(121,192,255,${0.16 + speedRatio * 0.18})`;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.rotate(fanAngleRef.current);
    for (let i = 0; i < 5; i += 1) {
      ctx.save();
      ctx.rotate((i / 5) * Math.PI * 2);
      ctx.fillStyle = fanOn ? `rgba(121,192,255,${bladeAlpha})` : '#555';
      ctx.beginPath();
      ctx.ellipse(6, -radius * 0.55, 10, radius * 0.35, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = fanOn ? '#58a6ff' : '#444';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = fanOn ? '#79c0ff' : '#8b949e';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(fanOn ? `${Math.round(fanSpeed)}%` : 'OFF', fx, fy + radius + 20);
  }

  function drawAirflow(ctx, width, height, fanOn, fanSpeed) {
    if (!fanOn || fanSpeed <= 0) return;
    const speedRatio = clampNumber(fanSpeed, 0, 100) / 100;
    const fx = width - 105;
    const fy = height * 0.3;
    const spread = 30 + speedRatio * 26;
    const length = 110 + speedRatio * 150;
    const phase = fanAngleRef.current * (0.5 + speedRatio);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 1 + speedRatio * 2;
    for (let i = 0; i < 5; i += 1) {
      const lane = i - 2;
      const y = fy + lane * (spread / 2);
      const offset = (phase * 18 + i * 22) % 42;
      const alpha = 0.12 + speedRatio * 0.34 - Math.abs(lane) * 0.03;
      ctx.strokeStyle = `rgba(121,192,255,${Math.max(0.08, alpha)})`;
      ctx.beginPath();
      ctx.moveTo(fx - offset, y);
      ctx.bezierCurveTo(
        fx - length * 0.32 - offset,
        y + Math.sin(phase + i) * 8,
        fx - length * 0.68 - offset,
        y + Math.cos(phase + i) * 11,
        fx - length - offset,
        y + Math.sin(phase + i * 1.5) * 7
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles(ctx) {
    particlesRef.current = particlesRef.current.filter(particle => particle.alpha > 0);
    for (const particle of particlesRef.current) {
      ctx.fillStyle = `rgba(196,168,56,${particle.alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fill();
      particle.y += particle.vy;
      particle.x += particle.vx;
      particle.alpha -= 0.015;
    }
  }
}

function drawStructure(ctx, width, height) {
  ctx.fillStyle = '#1c2330';
  ctx.fillRect(0, 0, width, height * 0.68);
  ctx.fillStyle = '#1a1008';
  ctx.fillRect(0, height * 0.68, width, height * 0.32);
  ctx.strokeStyle = '#ffffff08';
  for (let y = height * 0.68; y < height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  const cols = Math.max(2, Math.floor(width / 120));
  for (let i = 0; i <= cols; i += 1) {
    const x = i * (width / cols);
    const grad = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
    grad.addColorStop(0, '#0d1117');
    grad.addColorStop(0.5, '#2d3748');
    grad.addColorStop(1, '#0d1117');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 8, 0, 16, height * 0.68);
  }
  ctx.fillStyle = '#30363d';
  ctx.fillRect(0, height * 0.675, width, 3);
}

function drawLights(ctx, width, lightOn, brightness) {
  if (!lightOn) return;
  const count = Math.max(3, Math.floor(width / 80));
  for (let i = 0; i < count; i += 1) {
    const lx = 40 + i * 80;
    const ly = 28;
    ctx.fillStyle = `rgba(255,210,80,${0.4 + brightness * 0.6})`;
    ctx.beginPath();
    ctx.arc(lx, ly, 7, 0, Math.PI * 2);
    ctx.fill();
    const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 180);
    glow.addColorStop(0, `rgba(255,200,60,${brightness * 0.28})`);
    glow.addColorStop(1, 'rgba(255,160,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lx, ly, 180, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNestBoxes(ctx, height, heatOn) {
  const startX = 20;
  const startY = height * 0.2;
  const bw = 38;
  const bh = 30;
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const x = startX + c * 42;
      const y = startY + r * 34;
      ctx.fillStyle = heatOn ? '#7b1e1e' : '#2d3748';
      roundRect(ctx, x, y, bw, bh, 3);
      ctx.fill();
      ctx.fillStyle = heatOn ? '#3d0f0f' : '#1a1f2e';
      roundRect(ctx, x + 4, y + 4, bw - 8, bh - 8, 2);
      ctx.fill();
    }
  }
}

function drawSilos(ctx, width, height, silos) {
  const x = width - 30;
  silos.forEach((silo, index) => {
    const y = height * (0.24 + index * 0.18);
    ctx.fillStyle = ['#c4a838', '#f85149', '#58a6ff'][index] || '#c4a838';
    ctx.fillRect(x - 7, y, 14, 28);
    ctx.fillStyle = '#8b949e';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${silo.level}%`, x, y + 40);
  });
}

function drawFeeders(ctx, width, height, servoOpen) {
  const count = Math.max(2, Math.floor(width / 130));
  for (let i = 0; i < count; i += 1) {
    const cx = 65 + i * ((width - 100) / Math.max(1, count - 1));
    const cy = height * 0.69;
    ctx.fillStyle = '#2d3748';
    roundRect(ctx, cx - 28, cy, 56, 14, 4);
    ctx.fill();
    ctx.fillStyle = servoOpen ? '#e8d060' : '#c4a838';
    roundRect(ctx, cx - 24, cy + 3, 48, 8, 3);
    ctx.fill();
    if (servoOpen) {
      ctx.fillStyle = '#e8d060aa';
      ctx.beginPath();
      ctx.arc(cx, height * 0.58, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawWaterLine(ctx, width, height, level) {
  const y = height * 0.64;
  ctx.fillStyle = level < 25 ? '#7b1e1e' : '#1e3a5f';
  ctx.fillRect(20, y, width - 40, 8);
  ctx.fillStyle = '#58a6ffaa';
  for (let x = 40; x < width - 20; x += 60) {
    ctx.beginPath();
    ctx.arc(x, y + 16, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawChicken(ctx, chicken) {
  const bob = Math.sin(chicken.bob) * 2;
  const x = chicken.x;
  const y = chicken.y + bob;
  const s = chicken.size;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.55, s * 0.7, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = chicken.color;
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.7, s * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + s * 0.55, y - s * 0.28, s * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0a030';
  ctx.beginPath();
  ctx.moveTo(x + s * 0.85, y - s * 0.28);
  ctx.lineTo(x + s * 1.05, y - s * 0.22);
  ctx.lineTo(x + s * 0.85, y - s * 0.18);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x + s * 0.65, y - s * 0.33, s * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

function drawEggs(ctx, eggs) {
  ctx.fillStyle = '#f8f0e0';
  for (const egg of eggs) {
    ctx.beginPath();
    ctx.ellipse(egg.x, egg.y, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawThermalOverlay(ctx, width, height, temp) {
  if (temp <= 26 && temp >= 10) return;
  const hot = temp > 26;
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.6);
  gradient.addColorStop(0, hot ? 'rgba(248,81,73,0.10)' : 'rgba(88,166,255,0.10)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
