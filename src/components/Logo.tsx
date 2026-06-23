import React from 'react';

const logoBig = '/logo-big.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export default function Logo({ className = '', size = 'md', onClick }: LogoProps) {
  // Height classes for our brand logo image
  const heights = {
    sm: 'h-10 sm:h-12',
    md: 'h-18 sm:h-20',
    lg: 'h-28 sm:h-32'
  };

  const activeHeight = heights[size];

  return (
    <div 
      className={`flex items-center select-none ${onClick ? 'cursor-pointer hover:opacity-90 active:scale-98 transition-all' : ''} ${className}`} 
      onClick={onClick}
      id="potenciar-logo-container"
    >
      <img
        src={logoBig}
        alt="Potenciar Consultores Associados"
        referrerPolicy="no-referrer"
        className={`${activeHeight} w-auto object-contain`}
        id="potenciar-logo-img"
      />
    </div>
  );
}

