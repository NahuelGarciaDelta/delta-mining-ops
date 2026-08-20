import React from "react";
import { InformeCostosBoundary, InformeCostosLoading } from "./components/InformeCostosBoundary.jsx";

const LazyInformeCostosView = React.lazy(() =>
  import("./InformeCostosView.jsx").then((module) => ({ default: module.MemoViewCostosMant })),
);

/**
 * Informe de Costos must never share mutable collections with the rest of the app.
 *
 * The old route mixed the already-hydrated application datasets with a second pair
 * of asynchronous historical requests. Those late requests were driven by the
 * report's localStorage filters and were merged into the global datasets after the
 * first render. As a consequence the report calculated once with the application
 * universe and a second time with a different/partial universe; aliases could also
 * survive as separate rows during the merge. That is the race that made totals
 * change a few seconds after opening the report.
 *
 * The application already mounts this route only after its data hydration is
 * complete. Therefore the report now takes one coherent snapshot of those hydrated
 * sources and derives every sub-table from that same snapshot. No report filter
 * starts a fetch and no report state can replace or mutate the datasets used by
 * RMA15, Ficha Unica, Control por Equipo, ROP02 or any other view.
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

function InformeCostosRoute(props) {
  // These memos are the data boundary of the module. They only change when the
  // actual hydrated source changes (for example after an explicit/global refresh),
  // never because a filter or sub-tab inside Informe de Costos changed.
  const reportRma15 = React.useMemo(() => cloneRows(props.rma15), [props.rma15]);
  const reportRop02 = React.useMemo(() => cloneRows(props.rop02), [props.rop02]);
  const reportListaEquipos = React.useMemo(() => cloneRows(props.listaEquipos), [props.listaEquipos]);
  const reportInsumos = React.useMemo(() => cloneRecord(props.insumos), [props.insumos]);

  const ready = reportRma15.length > 0 && reportListaEquipos.length > 0 && Object.keys(reportInsumos).length > 0;

  const viewProps = React.useMemo(
    () => ({
      ...props,
      rma15: reportRma15,
      rop02: reportRop02,
      listaEquipos: reportListaEquipos,
      insumos: reportInsumos,
      // The visible equipment universe is derived exclusively from the report's
      // consolidated RMA15 snapshot. A partial endpoint response is never allowed
      // to shrink it after the first calculation.
      equipmentUniverse: null,
    }),
    [props, reportRma15, reportRop02, reportListaEquipos, reportInsumos],
  );

  return (
    <InformeCostosBoundary>
      {!ready ? (
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
