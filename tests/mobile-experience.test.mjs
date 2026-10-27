import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const mobile=readFileSync(new URL("../src/mobile/MobileShell.jsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/mobile/mobileStyles.js",import.meta.url),"utf8");
const table=readFileSync(new URL("../src/components/ui/index.jsx",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");

test("vista móvil se activa automáticamente por ancho, tiene opción escritorio y preserva modo",()=>{
  assert.match(app,/matchMedia\("\(max-width: 780px\)"\)/);
  assert.match(app,/const mobileExperience=mobilePreference==="mobile"\|\|\(mobilePreference==="auto"&&narrowViewport\)/);
  assert.match(app,/localStorage\.setItem\("dm_ui_mode_v1",mobilePreference\)/);
  assert.match(app,/onSwitchDesktop=\{\(\)=>setMobilePreference\("desktop"\)\}/);
  assert.match(app,/Modo móvil/);
});
test("mobile navega sobre la misma sesión y las mismas rutas sin nuevos accesos a datos",()=>{
  assert.match(app,/<MobileShell[\s\S]*navItems=\{mobileNavItems\}/);
  assert.match(app,/onNavigate=\{navigateToView\}/);
  assert.match(app,/onSignOut=\{cambiarUsuario\}/);
  assert.match(app,/<MobileHome[\s\S]*onNavigate=\{navigateToView\}/);
  assert.doesNotMatch(mobile,/fetch\(|axios\.|supabase\.|getRop02\(|getRop05\(|setInterval\(/);
  assert.match(app,/const mobileNavItems=useMemo\(/);
  assert.match(mobile,/flatten\(navItems\)/);
  assert.match(mobile,/const bottom=preferred\.filter\(x=>allowed\.has\(x\.id\)\)/);
});
test("escritorio conserva su sidebar y barra superior, móvil tiene menú y navegación inferior",()=>{
  assert.match(app,/showSidebar&&!mobileExperience&&\(/);
  assert.match(app,/showSidebar&&!mobileExperience&&sidebarTooltip/);
  assert.match(app,/showSidebar&&!mobileExperience&&\(<div style=\{\{height:50/);
  assert.match(mobile,/className="dm-mobile-topbar"/);
  assert.match(mobile,/className="dm-mobile-bottom-nav"/);
  assert.match(mobile,/role="dialog" aria-modal="true"/);
  assert.match(mobile,/onOpenProfile/);
  assert.match(css,/\.dm-mobile-bottom-nav\{/);
  assert.match(css,/safe-area-inset-bottom/);
});
test("las tablas compartidas ofrecen tarjetas móviles, acciones y paginado acotado",()=>{
  assert.match(table,/className="dm-mobile-table-cards"/);
  assert.match(table,/className="dm-mobile-record"/);
  assert.match(table,/sortedRows\.slice\(0,mobileCardsCount\)/);
  assert.match(table,/setMobileCardsCount\(n=>Math\.min\(sortedRows\.length,n\+30\)\)/);
  assert.match(table,/c\.render\?c\.render\(raw,r\)/);
  assert.match(table,/dm-open-equipment-profile/);
  assert.match(table,/className="dm-table-scroll"/);
  assert.match(table,/exportFiltered/);
  assert.match(css,/\.dm-mobile \.dm-app-content \.dm-table-scroll\{display:none!important\}/);
});
test("mantiene viewport de teléfono y la pantalla grande sin estilos globales móviles",()=>{
  assert.match(html,/viewport-fit=cover/);
  assert.match(app,/<style>\{STYLES\}<\/style>/);
  assert.match(app,/<style>\{MOBILE_STYLES\}<\/style>/);
  assert.match(css,/\.dm-mobile-home-hero\{/);
  assert.match(css,/\.dm-mobile-drawer\{/);
  assert.doesNotMatch(css,/\bfetch\(/);
});
