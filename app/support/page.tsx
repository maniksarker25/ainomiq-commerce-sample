export default function Support() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#000",
      color: "#fff",
      fontFamily: "system-ui, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{ maxWidth: 480, width: "100%", padding: 32, textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", marginBottom: 8 }}>
          ainomiq
        </h1>
        <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 24 }}>Support</h2>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
          Need help with your Ainomiq integration? We are here for you.
        </p>
        <div style={{ background: "#111", borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: "#ccc", marginBottom: 4 }}>Email us at</p>
          <a href="mailto:info@ainomiq.com" style={{ fontSize: 18, color: "#fff", textDecoration: "none", fontWeight: 500 }}>
            info@ainomiq.com
          </a>
        </div>
        <p style={{ color: "#555", fontSize: 12 }}>We typically respond within 24 hours.</p>
      </div>
    </div>
  );
}
