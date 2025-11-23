import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  volume: number; // 0 to 1
}

export const Visualizer: React.FC<VisualizerProps> = ({ isActive, volume }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationId: number;
    let currentHeight = 0;
    
    const draw = () => {
      // Smooth decay/attack
      // Adjusted scale for smaller height (h-24 is approx 96px)
      const targetHeight = isActive ? Math.max(5, volume * 30) : 2;
      currentHeight += (targetHeight - currentHeight) * 0.2;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(centerX, centerY) - 5;
      
      // Draw glowing orb
      const gradient = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, maxRadius);
      
      if (isActive) {
          gradient.addColorStop(0, 'rgba(99, 102, 241, 0.9)'); // Indigo 500
          gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.5)'); // Purple 500
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
          gradient.addColorStop(0, 'rgba(71, 85, 105, 0.5)'); // Slate
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      const radius = 15 + currentHeight; // Base size reduced to 15
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = isActive ? 'rgba(192, 132, 252, 0.4)' : 'rgba(71, 85, 105, 0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

      animationId = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => cancelAnimationFrame(animationId);
  }, [isActive, volume]);

  return (
    <div className="w-full h-24 flex items-center justify-center">
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={100}
        className="w-full h-full object-contain"
      />
    </div>
  );
};