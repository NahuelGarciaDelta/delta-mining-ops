import React from "react";
import { InformeCostosBoundary, InformeCostosLoading } from "./components/InformeCostosBoundary.jsx";

const LazyInformeCostosView = React.lazy(() =>
  import("./InformeCostosView.jsx").then((module) => ({ default: module.MemoViewCostosMant })),
);

/**
 * Informe de Costos is intentionally isolated from every other view.
 *
 * The report captures one complete snapshot of the hydrated application sources
 * when it mounts. That snapshot is never replaced by later background hydration,
 * Mantenimiento filters, historical pagination or any other global state update.
 * The report is remounted when the user leaves and enters again, so a new visit
 * can capture the latest complete application data without allowing values to
 * change silently while the report is open.
 */
function cloneRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    if (!row || typeof row !== "object") return row;
    const copy = { ...row };
    if (Array.isArray(row.insumos)) {
      copy.insumos = row.insumos.map((item) =>
        item && typeof item === "object" ? { ...item } : item,
      );
    }
    return copy;
  });
}

function cloneRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return {};
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      value && typeof value === "object" && !Array.isArray(value) ? { ...value } : value,
    ]),
  );
}

function buildReportSnapshot(props) {
  return {
    rma15: cloneRows(props.rma15),
    rop02: cloneRows(props.rop02),
    listaEquipos: cloneRows(props.listaEquipos),
    insumos: cloneRecord(props.insumos),
  };
}

function hasCompleteReportSources(props) {
  return (
    Array.isArray(props.rma15) &&
    props.rma15.length > 0 &&
    Array.isArray(props.listaEquipos) &&
    props.listaEquipos.length > 0 &&
    props.insumos &&
    typeof props.insumos === "object" &&
    Object.keys(props.insumos).length > 0
  );
}

function InformeCostosRoute(props) {
  const snapshotRef = React.useRef(null);

  // IMPORTANT: capture ONCE. Do not use useMemo([props.rma15]) here: the global
  // app can replace rma15/rop02 references after background synchronization and
  // that used to make the report jump from the complete total to a partial one.
  if (!snapshotRef.current && hasCompleteReportSources(props)) {
    snapshotRef.current = buildReportSnapshot(props);
  }

  const snapshot = snapshotRef.current;
  const ready = Boolean(snapshot);

  const viewProps = React.useMemo(() => {
    if (!snapshot) return null;
    return {
      ...props,
      rma15: snapshot.rma15,
      rop02: snapshot.rop02,
      listaEquipos: snapshot.listaEquipos,
      insumos: snapshot.insumos,
      equipmentUniverse: null,
    };
    // The source collections intentionally are NOT dependencies. Once captured,
    // background source replacements must not alter the open report.
  }, [snapshot, props.readOnly, props.usdRate, props.deps]);

  return (
    <InformeCostosBoundary>
      {!ready || !viewProps ? (
        <InformeCostosLoading />
      ) : (
        <React.Suspense fallback={<InformeCostosLoading />}>
          <LazyInformeCostosView {...viewProps} />
        </React.Suspense>
      )}
    </InformeCostosBoundary>
  );
}

export default InformeCostosRoute;
