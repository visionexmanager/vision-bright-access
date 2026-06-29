import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
}

const COLORS = [
  "#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1",
  "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#76D7C4", "#F1948A",
];

function createParticle(canvas: HTMLCanvasElement): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 3 + Math.random() * 5;
  return {
    x: canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.6,
    y: -10,
    vx: Math.cos(angle) * speed * 0.4,
    vy: speed,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.2,
    life: 0,
    maxLife: 90 + Math.random() * 60,
  };
}

interface Props {
  active: boolean;
  /** duration in ms (default 3000) */
  duration?: number;
}

export function GameWinCelebration({ active, duration = 3000 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number | null>(null);
  const stopAt    = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const particles: Particle[] = [];
    const start = performance.now();
    stopAt.current = start + duration;

    const spawnInterval = setInterval(() => {
      if (performance.now() >= stopAt.current) {
        clearInterval(spawnInterval);
        return;
      }
      for (let i = 0; i < 6; i++) particles.push(createParticle(canvas));
    }, 80);

    function tick() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.15; // gravity
        p.vx *= 0.99; // drag
        p.rotation += p.rotationSpeed;
        p.life++;

        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (alpha <= 0 || p.y > canvas!.height + 20) {
          particles.splice(i, 1);
          continue;
        }

        ctx!.save();
        ctx!.globalAlpha = alpha;
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rotation);
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx!.restore();
      }

      if (particles.length > 0 || performance.now() < stopAt.current) {
        animRef.current = requestAnimationFrame(tick);
      }
    }

    animRef.current = requestAnimationFrame(tick);

    return () => {
      clearInterval(spawnInterval);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active, duration]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 w-full h-full"
      aria-hidden="true"
    />
  );
}
