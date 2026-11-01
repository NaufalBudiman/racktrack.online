// Fixed decorative background: warm orbs, rings, stripes, dots. `dim` keeps the dashboard readable.
export function Backdrop({ dim = false }: { dim?: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#07090D]"
      style={dim ? { opacity: 0.55 } : undefined}
    >
      <div
        className="orb orb-main"
        style={{
          width: 760,
          height: 760,
          left: "50%",
          top: -300,
          marginLeft: -380,
          filter: "blur(6px)",
          background:
            "radial-gradient(circle at 40% 40%, #FFC86B 0%, #F59A2F 35%, #C2560F 62%, rgba(120,40,0,0) 72%)",
        }}
      />
      <div className="halo" style={{ width: 980, height: 980, left: "50%", top: -410, marginLeft: -490 }} />
      <div
        className="halo"
        style={{ width: 1240, height: 1240, left: "50%", top: -540, marginLeft: -620, borderColor: "rgba(255,190,110,.14)" }}
      />
      <div
        className="orb"
        style={{
          width: 440,
          height: 440,
          right: -140,
          top: "55%",
          filter: "blur(10px)",
          animationDirection: "alternate-reverse",
          background: "radial-gradient(circle at 35% 35%, #FFB347, #E0661A 55%, rgba(0,0,0,0) 72%)",
        }}
      />
      <div
        className="orb"
        style={{
          width: 420,
          height: 420,
          left: -160,
          bottom: -120,
          filter: "blur(12px)",
          opacity: 0.8,
          background: "radial-gradient(circle at 60% 40%, #F7A541, #B9470C 58%, rgba(0,0,0,0) 72%)",
        }}
      />
      <div className="stripes" style={{ left: "5%", top: "38%", width: 220, height: 380 }} />
      <div className="dots" style={{ right: "5%", top: 110, width: 260, height: 280 }} />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(7,9,13,.6) 85%)" }}
      />
    </div>
  );
}
