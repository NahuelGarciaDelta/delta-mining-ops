const ALLOWED_STYLE_PROPS = new Set([
  "color", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "border", "borderTop", "borderRight", "borderBottom", "borderLeft",
  "borderCollapse", "borderRadius", "fontSize", "fontWeight", "fontStyle",
  "fontFamily", "lineHeight", "letterSpacing", "textAlign", "textTransform",
  "minWidth", "maxWidth", "width", "display", "gap", "alignItems",
  "justifyContent", "whiteSpace"
]);

function cssNameToReact(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export function sanitizeTooltipStyle(styleText) {
  const safe = {};
  String(styleText || "")
    .split(";")
    .forEach((declaration) => {
      const idx = declaration.indexOf(":");
      if (idx <= 0) return;
      const prop = cssNameToReact(declaration.slice(0, idx));
      const value = declaration.slice(idx + 1).trim();
      if (!ALLOWED_STYLE_PROPS.has(prop) || !value) return;
      if (/url\s*\(|expression\s*\(|javascript\s*:|\\/i.test(value)) return;
      safe[prop] = value;
    });
  return safe;
}

export function escapeTooltipText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
