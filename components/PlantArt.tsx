"use client";

import { useId } from "react";
import type { PlantState } from "@/lib/types";

/**
 * Illustrated plant character — single SVG, varies by state.
 * Designed at 200×200 viewBox, scales cleanly to any size.
 *
 * Each state changes:
 *   - leaf shape & color gradient
 *   - face (eyes, mouth, expression)
 *   - posture / rotation
 *   - decorations (flower, sparkles, etc.)
 */
export default function PlantArt({
  state,
  size = 160,
  className,
}: {
  state: PlantState;
  size?: number;
  className?: string;
}) {
  // React.useId — stable across SSR/CSR, unique per component instance,
  // no hydration mismatch. SVG defs are scoped via this ID suffix.
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <defs>
        {/* Leaf gradients for each state */}
        <radialGradient id={`leaf-healthy-${id}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#a7f3a3" />
          <stop offset="55%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id={`leaf-mature-${id}`} cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="55%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id={`leaf-sapling-${id}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#bef264" />
          <stop offset="60%" stopColor="#84cc16" />
          <stop offset="100%" stopColor="#4d7c0f" />
        </radialGradient>
        <radialGradient id={`leaf-wilting-${id}`} cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#a3a35d" />
          <stop offset="100%" stopColor="#5a5a3c" />
        </radialGradient>
        <radialGradient id={`leaf-ready-${id}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="40%" stopColor="#fbbf24" />
          <stop offset="80%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
        <radialGradient id={`leaf-dying-${id}`} cx="40%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#9ca3af" />
          <stop offset="60%" stopColor="#6b7280" />
          <stop offset="100%" stopColor="#374151" />
        </radialGradient>

        {/* Pot gradient */}
        <linearGradient id={`pot-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#d4a574" />
          <stop offset="40%" stopColor="#b07b4a" />
          <stop offset="100%" stopColor="#8b5a3c" />
        </linearGradient>
        <linearGradient id={`pot-rim-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e8c8a0" />
          <stop offset="100%" stopColor="#b07b4a" />
        </linearGradient>
        <linearGradient id={`soil-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4a2818" />
          <stop offset="100%" stopColor="#2d1810" />
        </linearGradient>

        {/* Flower gradient for mature/ready */}
        <radialGradient id={`flower-${id}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="50%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id={`flower-pink-${id}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fecdd3" />
          <stop offset="50%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#be123c" />
        </radialGradient>

        {/* Cheek blush */}
        <radialGradient id={`cheek-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fb7185" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Pot — same on all */}
      <Pot id={id} state={state} />

      {/* Stem + plant body */}
      {state === "sapling" && <SaplingBody id={id} />}
      {state === "healthy" && <HealthyBody id={id} />}
      {state === "mature" && <MatureBody id={id} />}
      {state === "wilting" && <WiltingBody id={id} />}
      {state === "ready" && <ReadyBody id={id} />}
      {state === "dying" && <DyingBody id={id} />}
    </svg>
  );
}

/* ─────────────────── POT ─────────────────── */

function Pot({ id, state }: { id: string; state: PlantState }) {
  const lifted = state === "ready";
  return (
    <g>
      {/* Drop shadow under pot */}
      <ellipse cx="100" cy="186" rx="44" ry="6" fill="rgba(28,40,38,0.18)" />
      {/* Pot body */}
      <path
        d="M 60 138 L 65 178 Q 65 184 71 184 L 129 184 Q 135 184 135 178 L 140 138 Z"
        fill={`url(#pot-${id})`}
      />
      {/* Pot rim */}
      <ellipse
        cx="100"
        cy="138"
        rx="40"
        ry="7"
        fill={`url(#pot-rim-${id})`}
        stroke="#8b5a3c"
        strokeWidth="1"
      />
      {/* Soil top */}
      <ellipse cx="100" cy="138" rx="36" ry="5" fill={`url(#soil-${id})`} />
      {/* Subtle highlight on pot */}
      <path
        d="M 68 144 Q 68 168 72 178"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {lifted && (
        <ellipse
          cx="100"
          cy="190"
          rx="50"
          ry="3"
          fill="rgba(251,191,36,0.32)"
        />
      )}
    </g>
  );
}

/* ─────────────────── BODIES ─────────────────── */

function SaplingBody({ id }: { id: string }) {
  return (
    <g transform="translate(0, 0)">
      {/* Stem */}
      <path
        d="M 100 138 Q 100 120 98 105"
        stroke="#84cc16"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      {/* Two tiny leaves */}
      <ellipse
        cx="84"
        cy="100"
        rx="14"
        ry="9"
        fill={`url(#leaf-sapling-${id})`}
        transform="rotate(-30 84 100)"
        stroke="#4d7c0f"
        strokeWidth="1"
      />
      <ellipse
        cx="116"
        cy="100"
        rx="14"
        ry="9"
        fill={`url(#leaf-sapling-${id})`}
        transform="rotate(30 116 100)"
        stroke="#4d7c0f"
        strokeWidth="1"
      />

      {/* Tiny face on the stem-tip */}
      <g transform="translate(100, 92)">
        <ellipse cx="-4" cy="0" rx="2" ry="3" fill="#1c2826" className="anim-blink-slow" />
        <ellipse cx="4" cy="0" rx="2" ry="3" fill="#1c2826" className="anim-blink-slow" />
        <circle cx="-3" cy="-1" r="0.6" fill="#fff" />
        <circle cx="5" cy="-1" r="0.6" fill="#fff" />
        <path d="M -3 5 Q 0 7 3 5" stroke="#1c2826" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </g>
    </g>
  );
}

function HealthyBody({ id }: { id: string }) {
  return (
    <g>
      {/* Stem */}
      <path
        d="M 100 138 Q 100 110 100 92"
        stroke="#15803d"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Side leaves */}
      <ellipse
        cx="78"
        cy="118"
        rx="14"
        ry="8"
        fill={`url(#leaf-healthy-${id})`}
        transform="rotate(-40 78 118)"
        stroke="#16a34a"
        strokeWidth="1"
      />
      <ellipse
        cx="122"
        cy="118"
        rx="14"
        ry="8"
        fill={`url(#leaf-healthy-${id})`}
        transform="rotate(40 122 118)"
        stroke="#16a34a"
        strokeWidth="1"
      />

      {/* Main bushy body */}
      <ellipse
        cx="100"
        cy="80"
        rx="42"
        ry="36"
        fill={`url(#leaf-healthy-${id})`}
        stroke="#15803d"
        strokeWidth="1.5"
      />
      {/* Highlight bumps */}
      <ellipse cx="78" cy="68" rx="14" ry="11" fill={`url(#leaf-healthy-${id})`} stroke="#15803d" strokeWidth="1" />
      <ellipse cx="122" cy="68" rx="14" ry="11" fill={`url(#leaf-healthy-${id})`} stroke="#15803d" strokeWidth="1" />
      <ellipse cx="100" cy="58" rx="16" ry="13" fill={`url(#leaf-healthy-${id})`} stroke="#15803d" strokeWidth="1" />
      {/* Inner highlight */}
      <ellipse cx="92" cy="68" rx="10" ry="6" fill="rgba(255,255,255,0.22)" />

      {/* Face */}
      <Face id={id} cx={100} cy={84} mood="happy" />
    </g>
  );
}

function MatureBody({ id }: { id: string }) {
  return (
    <g>
      {/* Tall stem */}
      <path
        d="M 100 138 Q 102 100 100 75"
        stroke="#15803d"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Lower leaves */}
      <ellipse cx="76" cy="124" rx="16" ry="9" fill={`url(#leaf-mature-${id})`} transform="rotate(-35 76 124)" stroke="#166534" strokeWidth="1" />
      <ellipse cx="124" cy="124" rx="16" ry="9" fill={`url(#leaf-mature-${id})`} transform="rotate(35 124 124)" stroke="#166534" strokeWidth="1" />
      <ellipse cx="78" cy="100" rx="14" ry="8" fill={`url(#leaf-mature-${id})`} transform="rotate(-25 78 100)" stroke="#166534" strokeWidth="1" />
      <ellipse cx="122" cy="100" rx="14" ry="8" fill={`url(#leaf-mature-${id})`} transform="rotate(25 122 100)" stroke="#166534" strokeWidth="1" />

      {/* Body */}
      <ellipse cx="100" cy="72" rx="36" ry="32" fill={`url(#leaf-mature-${id})`} stroke="#166534" strokeWidth="1.5" />
      <ellipse cx="84" cy="60" rx="13" ry="11" fill={`url(#leaf-mature-${id})`} stroke="#166534" strokeWidth="1" />
      <ellipse cx="116" cy="60" rx="13" ry="11" fill={`url(#leaf-mature-${id})`} stroke="#166534" strokeWidth="1" />
      <ellipse cx="92" cy="62" rx="9" ry="5" fill="rgba(255,255,255,0.22)" />

      {/* Flower crown — pink */}
      <Flower cx={100} cy={36} r={14} id={`flower-pink-${id}`} />

      {/* Face — content */}
      <Face id={id} cx={100} cy={78} mood="content" />
    </g>
  );
}

function WiltingBody({ id }: { id: string }) {
  return (
    <g>
      {/* Drooping stem */}
      <path
        d="M 100 138 Q 95 115 88 96"
        stroke="#a3a35d"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Drooping leaves — rotated downward */}
      <ellipse
        cx="68"
        cy="128"
        rx="16"
        ry="7"
        fill={`url(#leaf-wilting-${id})`}
        transform="rotate(-65 68 128)"
        stroke="#5a5a3c"
        strokeWidth="1"
      />
      <ellipse
        cx="132"
        cy="128"
        rx="16"
        ry="7"
        fill={`url(#leaf-wilting-${id})`}
        transform="rotate(65 132 128)"
        stroke="#5a5a3c"
        strokeWidth="1"
      />

      {/* Drooped body */}
      <ellipse
        cx="86"
        cy="84"
        rx="32"
        ry="26"
        fill={`url(#leaf-wilting-${id})`}
        transform="rotate(-12 86 84)"
        stroke="#5a5a3c"
        strokeWidth="1.5"
      />
      <ellipse cx="76" cy="76" rx="9" ry="6" fill="rgba(255,255,255,0.16)" />

      {/* Sad face */}
      <Face id={id} cx={86} cy={88} mood="sad" rotation={-12} />

      {/* A drop falling */}
      <path
        d="M 116 110 Q 118 116 116 122 Q 114 116 116 110 Z"
        fill="#7dd3fc"
        opacity="0.85"
      />
    </g>
  );
}

function ReadyBody({ id }: { id: string }) {
  return (
    <g>
      {/* Stem */}
      <path
        d="M 100 138 Q 100 110 100 88"
        stroke="#16a34a"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Side leaves */}
      <ellipse cx="78" cy="118" rx="15" ry="9" fill={`url(#leaf-mature-${id})`} transform="rotate(-40 78 118)" stroke="#15803d" strokeWidth="1" />
      <ellipse cx="122" cy="118" rx="15" ry="9" fill={`url(#leaf-mature-${id})`} transform="rotate(40 122 118)" stroke="#15803d" strokeWidth="1" />

      {/* Sun-like petals around the head */}
      <g>
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const x = 100 + Math.cos(angle) * 38;
          const y = 60 + Math.sin(angle) * 38;
          const rot = (i / 12) * 360;
          return (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx="14"
              ry="9"
              fill={`url(#leaf-ready-${id})`}
              transform={`rotate(${rot} ${x} ${y})`}
              stroke="#b45309"
              strokeWidth="0.8"
            />
          );
        })}
      </g>

      {/* Flower face */}
      <circle cx="100" cy="60" r="22" fill={`url(#flower-${id})`} stroke="#b45309" strokeWidth="1.5" />
      <circle cx="100" cy="60" r="18" fill="#fef3c7" opacity="0.5" />

      {/* Excited face */}
      <Face id={id} cx={100} cy={62} mood="excited" />

      {/* Small leaf accents around stem */}
      <ellipse cx="92" cy="100" rx="6" ry="3" fill="#22c55e" transform="rotate(-30 92 100)" />
      <ellipse cx="108" cy="100" rx="6" ry="3" fill="#22c55e" transform="rotate(30 108 100)" />
    </g>
  );
}

function DyingBody({ id }: { id: string }) {
  return (
    <g>
      {/* Bare twig */}
      <path
        d="M 100 138 Q 99 115 97 95 Q 96 88 92 82"
        stroke="#6b7280"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 100 120 L 110 110"
        stroke="#6b7280"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 100 100 L 86 95"
        stroke="#6b7280"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* One sad leaf */}
      <ellipse
        cx="90"
        cy="80"
        rx="14"
        ry="7"
        fill={`url(#leaf-dying-${id})`}
        transform="rotate(-30 90 80)"
        stroke="#374151"
        strokeWidth="0.8"
        opacity="0.8"
      />

      {/* Sad / closed-eye face on the leaf */}
      <Face id={id} cx={90} cy={82} mood="dying" rotation={-30} />
    </g>
  );
}

/* ─────────────────── FACE ─────────────────── */

function Face({
  id,
  cx,
  cy,
  mood,
  rotation = 0,
}: {
  id: string;
  cx: number;
  cy: number;
  mood: "happy" | "content" | "sad" | "excited" | "dying";
  rotation?: number;
}) {
  const base = `translate(${cx}, ${cy}) rotate(${rotation})`;

  // Shared cheek blush
  const cheeks = (
    <>
      <ellipse cx="-9" cy="3" rx="4" ry="2.5" fill={`url(#cheek-${id})`} />
      <ellipse cx="9" cy="3" rx="4" ry="2.5" fill={`url(#cheek-${id})`} />
    </>
  );

  if (mood === "happy") {
    return (
      <g transform={base}>
        {cheeks}
        <Eye x={-7} side="left" />
        <Eye x={7} side="right" />
        <path
          d="M -5 5 Q 0 9 5 5"
          stroke="#1c2826"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (mood === "content") {
    return (
      <g transform={base}>
        {cheeks}
        {/* Squinty closed-arc eyes */}
        <path d="M -10 -1 Q -7 -3 -4 -1" stroke="#1c2826" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M 4 -1 Q 7 -3 10 -1" stroke="#1c2826" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path
          d="M -4 5 Q 0 8 4 5"
          stroke="#1c2826"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (mood === "sad") {
    return (
      <g transform={base}>
        <Eye x={-7} side="left" droopy />
        <Eye x={7} side="right" droopy />
        <path
          d="M -5 7 Q 0 4 5 7"
          stroke="#1c2826"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
        {/* Tear */}
        <path d="M -10 5 Q -10 8 -9 11" stroke="#7dd3fc" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </g>
    );
  }

  if (mood === "excited") {
    return (
      <g transform={base}>
        {cheeks}
        {/* Star eyes */}
        <StarEye x={-8} />
        <StarEye x={8} />
        {/* Big open smile */}
        <path
          d="M -7 5 Q 0 12 7 5 Q 0 9 -7 5 Z"
          fill="#1c2826"
        />
        <path d="M -4 8 Q 0 11 4 8" stroke="#fb7185" strokeWidth="1.2" fill="#f43f5e" />
      </g>
    );
  }

  // dying
  return (
    <g transform={base}>
      <line x1={-9} y1={-3} x2={-4} y2={2} stroke="#374151" strokeWidth="1.6" strokeLinecap="round" />
      <line x1={-9} y1={2} x2={-4} y2={-3} stroke="#374151" strokeWidth="1.6" strokeLinecap="round" />
      <line x1={4} y1={-3} x2={9} y2={2} stroke="#374151" strokeWidth="1.6" strokeLinecap="round" />
      <line x1={4} y1={2} x2={9} y2={-3} stroke="#374151" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M -4 6 Q 0 4 4 6"
        stroke="#374151"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

function Eye({
  x,
  side,
  droopy,
}: {
  x: number;
  side: "left" | "right";
  droopy?: boolean;
}) {
  return (
    <g transform={`translate(${x}, ${droopy ? 1 : 0})`}>
      <ellipse cx={0} cy={0} rx={2.6} ry={3.4} fill="#1c2826" className="anim-blink" style={{ animationDelay: side === "right" ? "0.05s" : "0s" }} />
      <circle cx={-0.6} cy={-1} r={0.9} fill="#fff" />
    </g>
  );
}

function StarEye({ x }: { x: number }) {
  return (
    <g transform={`translate(${x}, 0)`}>
      <path
        d="M 0 -3.4 L 0.9 -1 L 3.2 -1 L 1.4 0.5 L 2 3 L 0 1.6 L -2 3 L -1.4 0.5 L -3.2 -1 L -0.9 -1 Z"
        fill="#fbbf24"
        stroke="#b45309"
        strokeWidth="0.4"
      />
    </g>
  );
}

function Flower({ cx, cy, r, id }: { cx: number; cy: number; r: number; id: string }) {
  return (
    <g>
      {/* Petals */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const px = cx + Math.cos(angle) * r * 0.85;
        const py = cy + Math.sin(angle) * r * 0.85;
        return (
          <ellipse
            key={i}
            cx={px}
            cy={py}
            rx={r * 0.55}
            ry={r * 0.4}
            fill={`url(#${id})`}
            transform={`rotate(${(i / 6) * 360} ${px} ${py})`}
            stroke="#9d174d"
            strokeWidth="0.5"
          />
        );
      })}
      {/* Center */}
      <circle cx={cx} cy={cy} r={r * 0.45} fill="#fde68a" stroke="#d97706" strokeWidth="0.8" />
      <circle cx={cx - 1} cy={cy - 1} r={r * 0.2} fill="#fffbeb" />
    </g>
  );
}
