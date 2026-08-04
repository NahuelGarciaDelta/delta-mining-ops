import React from "react";
import { InformeCostosBoundary, InformeCostosLoading } from "./components/InformeCostosBoundary.jsx";

const LazyInformeCostosView = React.lazy(() =>
  import("./InformeCostosView.jsx").then((module) => ({ default: module.MemoViewCostosMant })),
);

function InformeCostosRoute(props) {
  return (
    <InformeCostosBoundary>
      <React.Suspense fallback={<InformeCostosLoading />}>
        <LazyInformeCostosView {...props} />
      </React.Suspense>
    </InformeCostosBoundary>
  );
}

export default InformeCostosRoute;
