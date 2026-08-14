import React from "react";
import { PageLoadingMotoniveladora } from "../../components/ui/index.jsx";

const LazyAbastecimientoModule = React.lazy(() =>
  import("./AbastecimientoModule.jsx").then((module) => ({
    default: module.default || module.AbastecimientoModule,
  })),
);

export default function AbastecimientoRoute(props) {
  return (
    <React.Suspense fallback={<PageLoadingMotoniveladora label="Cargando Abastecimiento..."/>}>
      <LazyAbastecimientoModule {...props} />
    </React.Suspense>
  );
}
