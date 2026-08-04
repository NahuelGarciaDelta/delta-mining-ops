import React from "react";

const LazyLicitacionesModule = React.lazy(() =>
  import("./LicitacionesModule.jsx").then((module) => ({
    default: module.default || module.LicitacionesModule,
  })),
);

function LicitacionesLoading() {
  return (
    <div style={{ minHeight: 240, display: "grid", placeItems: "center", color: "#cbd5e1" }}>
      Cargando Licitaciones…
    </div>
  );
}

export default function LicitacionesRoute(props) {
  return (
    <React.Suspense fallback={<LicitacionesLoading />}>
      <LazyLicitacionesModule {...props} />
    </React.Suspense>
  );
}
