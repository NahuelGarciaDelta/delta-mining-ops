import React from "react";
import { PageLoadingMotoniveladora } from "../../components/ui/index.jsx";

const LazyLicitacionesModule = React.lazy(() =>
  import("./LicitacionesModule.jsx").then((module) => ({
    default: module.default || module.LicitacionesModule,
  })),
);

export default function LicitacionesRoute(props) {
  return (
    <React.Suspense fallback={<PageLoadingMotoniveladora label="Cargando Licitaciones..."/>}>
      <LazyLicitacionesModule {...props} />
    </React.Suspense>
  );
}
