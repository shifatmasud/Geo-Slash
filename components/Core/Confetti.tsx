/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../Theme.tsx';

interface ConfettiProps {
  trigger: number;
}

interface Particle {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  color: string;
  tilt: number;
  tiltAngle: number;
  tiltAngleIncrement: number;
  life: number;      // Remaining life in frames
  maxLife: number;   // Total life for fade calculations
}

const Confetti: React.FC<ConfettiProps> = ({ trigger }) => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const isAnimatingRef = useRef(false);

  // Theme-aware colors
  const getColors = () => [
    theme.Color.Signal.Content[1],
    theme.Color.Focus.Content[1], 
    theme.Color.Warning.Content[1], 
    theme.Color.Success.Content[1],
    theme.Color.Error.Content[1],
    '#ffffff'
  ];

  // Animation Loop
  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Filter active particles (alive and on screen)
    const nextParticles: Particle[] = [];

    particlesRef.current.forEach((p) => {
      // Physics Updates
      p.tiltAngle += p.tiltAngleIncrement;
      p.y += p.vy;
      p.x += Math.sin(p.tiltAngle) * 2; // Wobble
      p.tilt = Math.sin(p.tiltAngle) * 15;
      p.life--; // Decrease life

      // Draw active particles
      if (p.life > 0 && p.y < canvas.height + 50) {
         
         ctx.beginPath();
         ctx.lineWidth = p.w;
         ctx.strokeStyle = p.color;
         
         // Fade out logic: Start fading when life is < 50 frames
         const alpha = Math.min(1, p.life / 50);
         ctx.globalAlpha = alpha;
         
         ctx.moveTo(p.x + p.tilt + (p.w / 2), p.y);
         ctx.lineTo(p.x + p.tilt, p.y + p.tilt + (p.h));
         ctx.stroke();
         
         ctx.globalAlpha = 1.0; // Reset opacity
         
         nextParticles.push(p);
      }
    });

    particlesRef.current = nextParticles;

    if (particlesRef.current.length > 0) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      isAnimatingRef.current = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Resize Handler
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Trigger Logic
  useEffect(() => {
    if (trigger === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ensure canvas size is correct before drawing
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particleCount = 40; // Reduced count per hit for cleaner look, but still plenty
    const colors = getColors();

    // Add new batch of particles
    for (let i = 0; i < particleCount; i++) {
      const life = 150 + Math.random() * 100;
      
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -100 - 20, 
        w: 8 + Math.random() * 8,
        h: 8 + Math.random() * 8,
        vx: (Math.random() - 0.5) * 4, 
        vy: 4 + Math.random() * 6,     
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10,
        tiltAngle: 0,
        tiltAngleIncrement: 0.05 + Math.random() * 0.05,
        life: life,
        maxLife: life
      });
    }

    // Restart animation if it stopped
    if (!isAnimatingRef.current) {
        isAnimatingRef.current = true;
        animate();
    }
  }, [trigger]);

  return createPortal(
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none', 
        zIndex: 9999, 
      }}
    />,
    document.body
  );
};

export default Confetti;