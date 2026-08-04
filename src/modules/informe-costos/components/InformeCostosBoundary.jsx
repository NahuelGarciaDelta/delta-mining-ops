import React from "react";

export class InformeCostosBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Informe de Costos:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, borderRadius: 12, background: "#24191a", color: "#ffd7d7" }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
            No se pudo abrir Informe de Costos
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 14 }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              border: 0,
              borderRadius: 8,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function InformeCostosLoading() {
  return (
    <div
      style={{
        minHeight: 240,
        display: "grid",
        placeItems: "center",
        borderRadius: 12,
        background: "rgba(28,28,28,.72)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <img src="/loader.gif" alt="Cargando" style={{ width: 74, height: "auto" }} />
        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800, color: "#ddd" }}>
          Preparando Informe de Costos…
        </div>
      </div>
    </div>
  );
}
