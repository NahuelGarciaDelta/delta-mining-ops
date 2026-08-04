import React from "react";

/**
 * Aísla el subárbol visual de cada tabla. Al cambiar estados ajenos a una tabla,
 * React conserva el subárbol si `active` y `version` no cambiaron.
 */
function CostosTabPanelBase({ active, children }) {
  if (!active) return null;
  return children;
}

const CostosTabPanel = React.memo(
  CostosTabPanelBase,
  (prev, next) => prev.active === next.active && prev.version === next.version && prev.children === next.children,
);

export default CostosTabPanel;
