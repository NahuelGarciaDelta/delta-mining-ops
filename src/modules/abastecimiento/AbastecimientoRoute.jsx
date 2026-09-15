import React, { useState } from "react";
import { PageLoadingMotoniveladora } from "../../components/ui/index.jsx";
import DeleteSolicitudByNumber from "./DeleteSolicitudByNumber.jsx";

const LazyAbastecimientoModule = React.lazy(() =>
  import("./AbastecimientoModule.jsx").then((module) => ({
    default: module.default || module.AbastecimientoModule,
  })),
);

export default function AbastecimientoRoute(props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const showDeleteSolicitud = !props.readOnly && props.initialTab === "solicitudes";

  return (
    <React.Suspense fallback={<PageLoadingMotoniveladora label="Cargando Abastecimiento..."/>}>
      {showDeleteSolicitud && (
        <DeleteSolicitudByNumber
          deps={props.deps}
          onDeleted={() => setRefreshKey((value) => value + 1)}
        />
      )}
      <LazyAbastecimientoModule key={refreshKey} {...props} />
    </React.Suspense>
  );
}
