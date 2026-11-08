/**
 * Ambient security-operations atmosphere shared by every layout:
 * technical grid, scanlines, restrained signal bloom, a slow vertical
 * sweep and a top telemetry rail. Purely decorative — hidden from
 * assistive technology and non-interactive.
 */
export default function CyberBackdrop() {
  return (
    <div className="cyber-backdrop" aria-hidden="true">
      <span className="cyber-backdrop__grid" />
      <span className="cyber-backdrop__scan" />
      <span className="cyber-backdrop__glow cyber-backdrop__glow--cyan" />
      <span className="cyber-backdrop__glow cyber-backdrop__glow--purple" />
      <span className="cyber-backdrop__glow cyber-backdrop__glow--magenta" />
      <span className="cyber-backdrop__sweep" />
      <span className="cyber-backdrop__beam" />
    </div>
  );
}
