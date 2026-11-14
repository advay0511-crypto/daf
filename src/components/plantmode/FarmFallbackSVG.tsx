import React from 'react';
import { PlantHotspot } from '../../types';

interface FarmFallbackSVGProps {
  hotspots: PlantHotspot[];
  selectedHotspotId: string | null;
  showAll: boolean;
  onSelect: (hotspot: PlantHotspot) => void;
}

export const FarmFallbackSVG: React.FC<FarmFallbackSVGProps> = ({
  hotspots,
  selectedHotspotId,
  showAll,
  onSelect,
}) => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-b from-[#9ED3F0] via-[#DDF0D8] to-[#6DAE4B]">
      {/* Illustrated Golden-Hour Valley SVG */}
      <svg
        viewBox="0 0 1200 720"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="svgSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6BB4E6" />
            <stop offset="55%" stopColor="#CBE8F7" />
            <stop offset="100%" stopColor="#FBE5B2" />
          </linearGradient>
          <linearGradient id="svgHillBack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F8A4D" />
            <stop offset="100%" stopColor="#3B6E3B" />
          </linearGradient>
          <linearGradient id="svgMeadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7DC257" />
            <stop offset="100%" stopColor="#58973C" />
          </linearGradient>
        </defs>

        {/* Sky & Sun */}
        <rect width="1200" height="720" fill="url(#svgSky)" />
        <circle cx="940" cy="140" r="56" fill="#FFE694" opacity="0.9" />
        <circle cx="940" cy="140" r="88" fill="#FFE694" opacity="0.25" />

        {/* Forested hills */}
        <path
          d="M0 290 Q 220 200 480 265 T 960 235 T 1200 280 L 1200 450 L 0 450 Z"
          fill="url(#svgHillBack)"
        />
        <path
          d="M0 330 Q 280 270 590 320 T 1200 315 L 1200 720 L 0 720 Z"
          fill="url(#svgMeadow)"
        />

        {/* Winding dirt path */}
        <path
          d="M540 720 C 560 580, 650 510, 610 420 C 570 340, 640 310, 670 295"
          fill="none"
          stroke="#C59D72"
          strokeWidth="44"
          strokeLinecap="round"
        />

        {/* Pond */}
        <ellipse cx="755" cy="368" rx="90" ry="38" fill="#4BAEC8" stroke="#A68D6A" strokeWidth="7" />

        {/* Stone Farmhouse & Red Barn */}
        <g transform="translate(215, 290)">
          <rect x="0" y="34" width="96" height="62" rx="4" fill="#CFC6B4" stroke="#8F8572" strokeWidth="2" />
          <polygon points="-8,36 48,-2 104,36" fill="#B84232" />
          <rect x="38" y="60" width="20" height="36" fill="#7A4E2D" />
          {/* Solar panel */}
          <polygon points="32,8 78,8 84,26 38,26" fill="#1D4073" stroke="#E2E8F0" strokeWidth="2" />
        </g>

        {/* Big Oak */}
        <g transform="translate(95, 230)">
          <rect x="44" y="88" width="20" height="72" fill="#6D4C34" />
          <circle cx="54" cy="64" r="54" fill="#3E8E41" />
          <circle cx="24" cy="78" r="34" fill="#4FA64F" />
          <circle cx="84" cy="76" r="36" fill="#357A38" />
        </g>

        {/* Crop soil beds */}
        <rect x="105" y="425" width="120" height="58" rx="8" fill="#7A5233" opacity="0.85" />
        <rect x="275" y="425" width="130" height="58" rx="8" fill="#7A5233" opacity="0.85" />
        <rect x="880" y="405" width="165" height="68" rx="8" fill="#7A5233" opacity="0.85" />
        <rect x="860" y="510" width="175" height="82" rx="8" fill="#7A5233" opacity="0.85" />
      </svg>

      {/* Interactive Accessible Plant Pins */}
      <div className="absolute inset-0">
        {hotspots.map((h) => {
          const active = selectedHotspotId === h.id;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onSelect(h)}
              style={{
                left: `${Math.min(92, Math.max(8, h.x + h.w / 2))}%`,
                top: `${Math.min(90, Math.max(12, h.y + h.h / 2))}%`,
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium shadow-lg border transition-transform hover:scale-105 cursor-pointer ${
                active
                  ? 'bg-[#2E9E4F] text-white border-white ring-2 ring-[#2E9E4F]'
                  : showAll
                  ? 'bg-white text-[#1F2E1A] border-[#2E9E4F] animate-pulse ring-2 ring-[#4CC26E]'
                  : 'bg-white/92 text-[#1F2E1A] border-[#CFE3C0]'
              }`}
            >
              <span aria-hidden="true">{h.emoji}</span>
              <span className="hidden md:inline">{h.label.split(' (')[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
