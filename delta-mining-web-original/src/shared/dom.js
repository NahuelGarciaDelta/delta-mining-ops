/** Posiciona un tooltip flotante sin sacarlo del viewport. */
export function positionTip(tip, mouseX, mouseY) {
  if (!tip || typeof window === "undefined" || typeof document === "undefined") return;
  const margin = 12;
  const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;

  tip.style.visibility = "hidden";
  tip.style.top = "-9999px";
  tip.style.left = "-9999px";
  if (!tip.isConnected) document.body.appendChild(tip);

  const tipWidth = tip.offsetWidth;
  const tipHeight = tip.offsetHeight;
  let left = Number(mouseX) + margin;
  if (left + tipWidth > viewportWidth - margin) left = Number(mouseX) - tipWidth - margin;
  left = Math.max(margin, left);

  let top = Number(mouseY) - tipHeight;
  if (top < margin) top = Number(mouseY) + margin;
  if (top + tipHeight > viewportHeight - margin) top = viewportHeight - tipHeight - margin;
  top = Math.max(margin, top);

  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  tip.style.visibility = "visible";
}
