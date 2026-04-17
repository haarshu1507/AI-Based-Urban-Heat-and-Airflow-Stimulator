import React, { useMemo } from 'react';

const WEATHER_EFFECT_VIEWS = new Set(['2D', 'weather', '3D']);

const WeatherOverlay = ({ weather, windDirection, viewMode, mapPickerOpen }) => {
  if (mapPickerOpen) return null;
  if (!WEATHER_EFFECT_VIEWS.has(viewMode)) return null;

  const drops = useMemo(() => {
    if (weather !== 'rainy') return [];
    return Array.from({ length: 60 }).map((_, i) => ({
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      duration: `${0.8 + Math.random() * 0.5}s`,
      opacity: 0.4 + Math.random() * 0.4,
    }));
  }, [weather]);

  const windLines = useMemo(() => {
    if (weather !== 'windy') return [];
    return Array.from({ length: 25 }).map((_, i) => ({
      pos: `${Math.random() * 100}%`,
      delay: `${Math.random() * 3}s`,
      duration: `${1 + Math.random()}s`,
    }));
  }, [weather]);

  return (
    <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
      
      {/* RAINY */}
      {weather === 'rainy' && (
        <div className="absolute inset-0 bg-blue-900/10">
          {drops.map((drop, i) => (
            <div
              key={i}
              className="absolute top-0 w-[2px] h-[30px] rounded-full bg-blue-200"
              style={{
                left: drop.left,
                opacity: drop.opacity,
                animation: `rain-fall ${drop.duration} linear ${drop.delay} infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* SUNNY */}
      {weather === 'sunny' && (
        <div className="absolute inset-0 bg-yellow-500/5 mix-blend-overlay">
          <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(ellipse_at_center,_rgba(253,224,71,0.2)_0%,_transparent_70%)] animate-[sun-ray_20s_linear_infinite]" />
          <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,_transparent_0deg,_rgba(253,224,71,0.1)_30deg,_transparent_60deg,_rgba(253,224,71,0.1)_120deg,_transparent_150deg,_rgba(253,224,71,0.1)_240deg,_transparent_270deg)] animate-[sun-ray_30s_linear_infinite_reverse]" />
        </div>
      )}

      {/* WINDY */}
      {weather === 'windy' && (
        <div className="absolute inset-0 bg-slate-400/5">
          {windLines.map((line, i) => {
            const isHorizontal = windDirection === 'left' || windDirection === 'right';
            const style = isHorizontal 
              ? { top: line.pos, left: 0, width: '100px', height: '2px', animation: `wind-sweep-${windDirection} ${line.duration} linear ${line.delay} infinite` }
              : { left: line.pos, top: 0, width: '2px', height: '100px', animation: `wind-sweep-${windDirection} ${line.duration} linear ${line.delay} infinite` };
            
            return (
              <div
                key={i}
                className="absolute bg-white/40 blur-[1px] rounded-full"
                style={style}
              />
            );
          })}
        </div>
      )}

    </div>
  );
};

export default WeatherOverlay;
