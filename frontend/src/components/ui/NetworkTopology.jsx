import { useId } from 'react';
import { cn } from '../../lib/utils';

/**
 * Stylised sensor-mesh topology. Decorative and illustrative only —
 * positions and labels are seeded demo values, not live telemetry.
 */

const NODES = [
  { id: 'eu', x: 96, y: 78, label: 'EU-WEST-1', meta: '185.220.101.4', status: 'safe' },
  { id: 'us', x: 520, y: 68, label: 'US-EAST-2', meta: '45.133.1.88', status: 'safe' },
  { id: 'ap', x: 556, y: 240, label: 'AP-SOUTH-1', meta: '103.21.58.9', status: 'safe' },
  { id: 'uk', x: 104, y: 262, label: 'LON-EDGE-1', meta: '51.140.2.17', status: 'safe' },
  { id: 'hostile', x: 226, y: 306, label: 'ASN 64500', meta: 'hostile cluster', status: 'critical' },
  { id: 'cdn', x: 434, y: 300, label: 'EDGE-CDN', meta: 'anycast', status: 'warn' },
  { id: 'mobile', x: 250, y: 54, label: 'MOBILE MESH', meta: '4,218 agents', status: 'safe' },
];

const CORE = { x: 326, y: 178 };
const STROKE = { safe: 'var(--neon)', warn: 'var(--medium)', critical: 'var(--critical)' };

function curve(from) {
  const midX = (from.x + CORE.x) / 2;
  const midY = (from.y + CORE.y) / 2 - 16;
  return `M ${from.x} ${from.y} Q ${midX} ${midY} ${CORE.x} ${CORE.y}`;
}

export default function NetworkTopology({ className, showLabels = true, compact = false }) {
  const uid = useId().replace(/:/g, '');
  const gridId = `${uid}-grid`;
  const coreGlow = `${uid}-core`;

  return (
    <svg
      viewBox="0 0 640 350"
      className={cn('h-auto w-full', className)}
      role="img"
      aria-label="Illustrative sensor network topology with one hostile cluster under observation"
    >
      <defs>
        <pattern id={gridId} width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="var(--grid-line)" strokeWidth="1" />
        </pattern>
        <radialGradient id={coreGlow}>
          <stop offset="0%" stopColor="var(--neon)" stopOpacity="0.2" />
          <stop offset="55%" stopColor="var(--neon)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--neon)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="640" height="350" fill="var(--surface)" />
      <rect width="640" height="350" fill={`url(#${gridId})`} opacity="0.7" />

      {/* Recon rings around the core */}
      {[52, 84, 122].map((r) => (
        <circle key={r} cx={CORE.x} cy={CORE.y} r={r} fill="none" stroke="var(--line)" strokeWidth="0.7" strokeDasharray={r === 84 ? '2 7' : undefined} />
      ))}
      <circle cx={CORE.x} cy={CORE.y} r="150" fill={`url(#${coreGlow})`} />
      <line x1={CORE.x - 168} y1={CORE.y} x2={CORE.x + 168} y2={CORE.y} stroke="var(--line)" strokeWidth="0.5" strokeDasharray="3 8" />
      <line x1={CORE.x} y1={CORE.y - 150} x2={CORE.x} y2={CORE.y + 150} stroke="var(--line)" strokeWidth="0.5" strokeDasharray="3 8" />

      {/* Connections */}
      {NODES.map((node) => {
        const hostile = node.status === 'critical';
        return (
          <g key={`line-${node.id}`}>
            <path
              d={curve(node)}
              fill="none"
              stroke={STROKE[node.status] || STROKE.safe}
              strokeWidth={hostile ? 1.4 : 0.9}
              strokeOpacity={hostile ? 0.8 : 0.32}
            />
            <path
              d={curve(node)}
              fill="none"
              stroke={STROKE[node.status] || STROKE.safe}
              strokeWidth={hostile ? 2 : 1.4}
              strokeOpacity={hostile ? 0.9 : 0.55}
              strokeDasharray="3 14"
              strokeLinecap="round"
              className="anim-dash"
              style={{ animationDelay: `${(node.x % 5) * 140}ms` }}
            />
          </g>
        );
      })}

      {/* Node markers and labels */}
      {NODES.map((node) => {
        const color = STROKE[node.status] || STROKE.safe;
        return (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r="14" fill={color} opacity="0.08" />
            <circle cx={node.x} cy={node.y} r="8" fill="var(--surface-2)" stroke={color} strokeWidth="1" />
            <circle cx={node.x} cy={node.y} r="4" fill={color} className={node.status === 'critical' ? 'anim-node-pulse' : undefined} />
            {node.status === 'critical' ? (
              <circle cx={node.x} cy={node.y} r="15" fill="none" stroke={color} strokeWidth="0.8" strokeDasharray="2 3" className="anim-spin-slow" style={{ transformOrigin: `${node.x}px ${node.y}px` }} />
            ) : null}
            {showLabels && !compact ? (
              <g fontFamily="JetBrains Mono, monospace">
                <text x={node.x} y={node.y + 26} textAnchor="middle" fontSize="8" fill="var(--ink-2)" letterSpacing="0.08em">
                  {node.label}
                </text>
                <text x={node.x} y={node.y + 37} textAnchor="middle" fontSize="7" fill={color} opacity="0.85">
                  {node.meta}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {/* Core node */}
      <g>
        <circle cx={CORE.x} cy={CORE.y} r="30" fill="var(--surface-2)" stroke="var(--neon)" strokeWidth="1.1" />
        <circle cx={CORE.x} cy={CORE.y} r="30" fill="none" stroke="var(--neon)" strokeWidth="0.7" strokeDasharray="1 5" className="anim-spin-slow" style={{ transformOrigin: `${CORE.x}px ${CORE.y}px` }} />
        <circle cx={CORE.x} cy={CORE.y} r="20" fill="none" stroke="var(--line-strong)" strokeWidth="0.8" />
        <circle cx={CORE.x} cy={CORE.y} r="9" fill="var(--neon)" opacity="0.14" />
        <circle cx={CORE.x} cy={CORE.y} r="4" fill="var(--neon)" className="anim-alert-pulse" />
        <path
          d={`M ${CORE.x} ${CORE.y - 12} L ${CORE.x + 9} ${CORE.y - 7.5} V ${CORE.y + 1} C ${CORE.x + 9} ${CORE.y + 7} ${CORE.x + 4} ${CORE.y + 11} ${CORE.x} ${CORE.y + 13} C ${CORE.x - 4} ${CORE.y + 11} ${CORE.x - 9} ${CORE.y + 7} ${CORE.x - 9} ${CORE.y + 1} V ${CORE.y - 7.5} Z`}
          fill="none"
          stroke="var(--neon)"
          strokeWidth="1.2"
          strokeLinejoin="round"
          opacity="0.85"
        />
        {!compact ? (
          <g fontFamily="JetBrains Mono, monospace">
            <text x={CORE.x} y={CORE.y + 50} textAnchor="middle" fontSize="8.5" fill="var(--ink)" letterSpacing="0.14em">
              SOC CORE
            </text>
            <text x={CORE.x} y={CORE.y + 61} textAnchor="middle" fontSize="7" fill="var(--ink-3)" letterSpacing="0.1em">
              13 SENSORS · ONLINE
            </text>
          </g>
        ) : null}
      </g>

      {/* Corner telemetry */}
      {!compact ? (
        <g fontFamily="JetBrains Mono, monospace" fontSize="7" fill="var(--ink-3)" letterSpacing="0.12em">
          <text x="18" y="24">SENSOR MESH // GLOBAL</text>
          <text x="18" y="336">LAT 51.5072 N · LON 0.1276 W</text>
          <text x="622" y="24" textAnchor="end">TLS 1.3 · AEAD</text>
          <text x="622" y="336" textAnchor="end" fill="var(--critical)" opacity="0.85">1 HOSTILE CLUSTER TRACKED</text>
        </g>
      ) : null}
    </svg>
  );
}
