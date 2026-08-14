import React from "react";
import { sanitizeTooltipStyle } from "./safeTooltipSecurity.js";

const ALLOWED_TAGS = new Set([
  "div", "span", "table", "thead", "tbody", "tr", "th", "td",
  "strong", "b", "em", "i", "br", "p", "small"
]);

function safePropsForElement(element, key) {
  const props = { key };
  const style = sanitizeTooltipStyle(element.getAttribute("style"));
  if (Object.keys(style).length) props.style = style;

  const colSpan = Number(element.getAttribute("colspan"));
  if (Number.isFinite(colSpan) && colSpan > 0 && colSpan <= 20) props.colSpan = colSpan;
  const rowSpan = Number(element.getAttribute("rowspan"));
  if (Number.isFinite(rowSpan) && rowSpan > 0 && rowSpan <= 20) props.rowSpan = rowSpan;
  return props;
}

function domNodeToReact(node, key) {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return null;

  const tag = String(node.tagName || "").toLowerCase();
  const children = Array.from(node.childNodes || [])
    .map((child, index) => domNodeToReact(child, `${key}-${index}`))
    .filter((child) => child !== null && child !== undefined);

  // Unknown/dangerous elements are discarded while preserving only their text children.
  if (!ALLOWED_TAGS.has(tag)) return <React.Fragment key={key}>{children}</React.Fragment>;
  return React.createElement(tag, safePropsForElement(node, key), ...children);
}

export function SafeTooltipHtml({ html }) {
  if (!html) return null;
  if (typeof DOMParser === "undefined") return <>{String(html).replace(/<[^>]*>/g, "")}</>;

  const documentFragment = new DOMParser().parseFromString(`<body>${String(html)}</body>`, "text/html");
  return <>{Array.from(documentFragment.body.childNodes).map((node, index) => domNodeToReact(node, `tip-${index}`))}</>;
}
