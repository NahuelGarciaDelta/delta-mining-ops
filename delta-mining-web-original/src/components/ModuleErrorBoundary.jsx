import React from "react";
import { C, Icon } from "./ui/index.jsx";

export default class ModuleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, retryKey: 0 };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error(`[Delta Mining OPS] Error en ${this.props.name || "módulo"}`, error, info);
  }
  retry = () => {
    this.setState((s) => ({ error: null, retryKey: s.retryKey + 1 }));
    try { this.props.onRetry?.(); } catch (_) {}
  };
  render() {
    if (!this.state.error) return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
    return (
      <div style={{margin:12,padding:18,borderRadius:12,border:`1px solid ${C.red}66`,background:"rgba(28,12,14,.94)",color:C.text}}>
        <div style={{display:"flex",alignItems:"center",gap:9,fontSize:15,fontWeight:900,color:C.red}}>
          <Icon name="warn" size={17} color={C.red}/>
          No se pudo cargar {this.props.name || "este módulo"}
        </div>
        <div style={{marginTop:8,fontSize:12,color:C.textSub,lineHeight:1.5}}>{String(this.state.error?.message || "Error inesperado")}</div>
        <button type="button" onClick={this.retry} style={{marginTop:12,padding:"8px 13px",borderRadius:8,border:`1px solid ${C.accent}66`,background:C.accentDim,color:C.accent,fontWeight:800,cursor:"pointer"}}>Reintentar</button>
      </div>
    );
  }
}
