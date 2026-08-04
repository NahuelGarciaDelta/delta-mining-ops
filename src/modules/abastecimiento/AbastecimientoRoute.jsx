import React from "react";

const LazyAbastecimientoModule = React.lazy(() =>
  import("./AbastecimientoModule.jsx").then((module) => ({
    default: module.default || module.AbastecimientoModule,
  })),
);

function AbastecimientoLoading() {
  return (
    <div style={{ minHeight: 240, display: "grid", placeItems: "center", color: "#cbd5e1" }}>
      Cargando Abastecimiento…
    </div>
  );
}

export default function AbastecimientoRoute(props) {
  return (
    <React.Suspense fallback={<AbastecimientoLoading />}>
      <LazyAbastecimientoModule {...props} />
    </React.Suspense>
  );
}
