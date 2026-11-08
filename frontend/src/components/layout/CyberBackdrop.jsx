/**
 * Ambient cyberpunk atmosphere shared by every layout:
 * animated technical grid, scanlines, neon bloom and a top accent rail.
 * Purely decorative — hidden from assistive tech and non-interactive.
 */
export default function CyberBackdrop() {
  return (
    <div className="cyber-backdrop" aria-hidden="true">
      <span className="cyber-backdrop__grid" />
      <span className="cyber-backdrop__scan" />
      <span className="cyber-backdrop__glow cyber-backdrop__glow--cyan" />
      <span className="cyber-backdrop__glow cyber-backdrop__glow--purple" />
      <span className="cyber-backdrop__glow cyber-backdrop__glow--magenta" />
      <span className="cyber-backdrop__beam" />
    </div>
  );
}
