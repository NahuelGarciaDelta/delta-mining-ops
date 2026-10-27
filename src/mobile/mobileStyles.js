// Scoped mobile design system. Desktop layout and stored datasets remain unchanged.
export const MOBILE_STYLES = \`
.dm-mobile{--mobile-bg:#0c121b;--mobile-panel:#19212c;--mobile-edge:rgba(201,215,236,.12);--mobile-muted:#99a9bb;font-family:Inter,Arial,sans-serif}
.dm-mobile,.dm-mobile button,.dm-mobile input,.dm-mobile select{font-family:Inter,Arial,sans-serif}
.dm-mobile button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.dm-mobile-topbar{position:fixed;top:0;left:0;right:0;z-index:1500;height:calc(64px + env(safe-area-inset-top,0px));padding:env(safe-area-inset-top,0px) 15px 0;display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(11,17,26,.97);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);border-bottom:1px solid rgba(255,255,255,.10)}
.dm-mobile-brand{display:flex;min-width:0;align-items:center;gap:11px;background:none;max-width:calc(100% - 110px);text-align:left}
.dm-mobile-logo{height:39px;width:39px;flex-shrink:0;border-radius:11px;display:grid;place-items:center;font-weight:1000;font-size:24px;color:white;background:linear-gradient(140deg,#f22f42,#ae0018);box-shadow:0 4px 14px rgba(232,0,29,.18)}
.dm-mobile-brand-label{display:flex;flex-direction:column;min-width:0;line-height:1.22}
.dm-mobile-brand-label strong{font-size:14px;letter-spacing:.045em;white-space:nowrap;color:#f8fafc}
.dm-mobile-brand-label em{font-style:normal;color:#fb4758}
.dm-mobile-brand-label small{font-size:11px;color:var(--mobile-muted);max-width:52vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;margin-top:3px}
.dm-mobile-top-actions{display:flex;align-items:center;gap:7px}
.dm-mobile-icon-button{width:40px;height:40px;min-width:40px;display:grid;place-items:center;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid var(--mobile-edge)!important;color:#ecf2fa}
.dm-mobile-icon-button:disabled{opacity:.45}
.dm-mobile-sync{width:8px;height:8px;display:flex;align-items:center}
.dm-mobile-pulse,.dm-mobile-status-dot{height:8px;width:8px;border-radius:50%;background:#24d290;box-shadow:0 0 0 4px rgba(36,210,144,.12)}
.dm-mobile-bottom-nav{position:fixed;bottom:0;left:0;right:0;z-index:1500;display:flex;align-items:stretch;justify-content:space-around;height:calc(69px + env(safe-area-inset-bottom,0px));padding:5px 5px env(safe-area-inset-bottom,0px);background:rgba(11,17,26,.97);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);border-top:1px solid rgba(255,255,255,.12)}
.dm-mobile-tab{display:flex;flex:1;min-width:0;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:11px;background:transparent;color:#9aaabd;white-space:nowrap;font-size:10px;font-weight:750;letter-spacing:.005em;position:relative}
.dm-mobile-tab.is-active{color:#fff;background:rgba(232,0,29,.12)}
.dm-mobile-tab-icon{position:relative;display:flex;justify-content:center;align-items:center;height:24px}
.dm-mobile-tab-badge{position:absolute;top:-7px;left:13px;min-width:17px;height:17px;border-radius:10px;display:grid;place-items:center;padding:0 4px;font-size:9px;background:#e8001d;color:#fff;border:2px solid #131b26}
.dm-mobile-menu-overlay{position:fixed;inset:0;z-index:1800;background:rgba(2,5,10,.73);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
.dm-mobile-drawer{width:100%;max-width:680px;max-height:91dvh;min-height:360px;background:linear-gradient(#222d39,#101923);border:1px solid rgba(255,255,255,.14);border-bottom:0;border-radius:22px 22px 0 0;display:flex;flex-direction:column;overflow:hidden;padding-bottom:env(safe-area-inset-bottom,0px);box-shadow:0 -26px 80px rgba(0,0,0,.42)}
.dm-mobile-drawer-handle{margin:10px auto 6px;width:40px;height:4px;border-radius:8px;background:#596778;flex-shrink:0}
.dm-mobile-drawer-title{display:flex;justify-content:space-between;align-items:center;padding:14px 19px 10px}
.dm-mobile-drawer-title small{font-size:10px;font-weight:850;color:#fe6676;letter-spacing:.14em}
.dm-mobile-drawer-title h2{font-size:22px;font-weight:900;color:#fff;margin-top:4px}
.dm-mobile-user{margin:5px 17px 13px;padding:11px;border-radius:12px;display:flex;gap:10px;align-items:center;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.07)}
.dm-mobile-avatar{height:36px;width:36px;border-radius:50%;background:#e8001d;display:grid;place-items:center}
.dm-mobile-user>div{display:flex;flex-direction:column;gap:2px;min-width:0}
.dm-mobile-user strong{font-size:12px;overflow:hidden;text-overflow:ellipsis}
.dm-mobile-user small{font-size:10px;color:var(--mobile-muted)}
.dm-mobile-menu-search{display:flex;align-items:center;gap:10px;margin:0 17px 12px;background:#101720;border:1px solid rgba(255,255,255,.16);border-radius:11px;padding:0 12px;min-height:45px}
.dm-mobile-menu-search input{border:0!important;background:none!important;color:white;outline:none!important;min-width:0;width:100%;height:43px;font-size:14px}
.dm-mobile-menu-scroll{overflow:auto;padding:0 16px 24px;overscroll-behavior:contain}
.dm-mobile-menu-group{margin-bottom:19px}
.dm-mobile-menu-group h3{font-size:11px;color:#91a3b6;text-transform:uppercase;letter-spacing:.11em;margin:8px 3px 9px}
.dm-mobile-menu-link{width:100%;display:flex;align-items:center;gap:11px;text-align:left;min-height:47px;padding:9px 10px;background:transparent;border-bottom:1px solid rgba(255,255,255,.055)!important;font-size:13px;font-weight:700;color:#f0f3f9}
.dm-mobile-menu-link.is-current{background:rgba(232,0,29,.12);color:#ff7181}
.dm-mobile-menu-link>span:nth-child(2){flex:1}
.dm-mobile-menu-link-icon{width:28px;display:flex;justify-content:center;flex-shrink:0}
.dm-mobile-menu-link b{font-size:10px;background:#e8001d;border-radius:20px;padding:2px 6px}
.dm-mobile-empty,.dm-mobile-footer-note{color:#91a3b6;font-size:11px;line-height:1.5;padding:12px 6px}
.dm-mobile .dm-app-sidebar{display:none!important}
.dm-mobile .dm-app-content{min-height:0;min-width:0;overflow:hidden}
.dm-mobile .dm-main-scroll{padding:calc(75px + env(safe-area-inset-top,0px)) 12px calc(90px + env(safe-area-inset-bottom,0px))!important;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch}
.dm-mobile .dm-app-content>*{max-width:100%;min-width:0}
.dm-mobile .dm-app-content [style*="gridTemplateColumns:"]{max-width:100%}
.dm-mobile .dm-main-scroll>div{max-width:100%}
.dm-mobile .dm-app-content button,.dm-mobile .dm-app-content select,.dm-mobile .dm-app-content input{min-height:40px}
.dm-mobile .dm-app-content input,.dm-mobile .dm-app-content select,.dm-mobile .dm-app-content textarea{font-size:16px!important}
.dm-mobile .dm-app-content [style*="minWidth:"]{max-width:100%}
.dm-mobile .dm-app-content .dm-home{background:transparent!important;min-height:0!important}
.dm-mobile .dm-home>aside{display:none!important}
.dm-mobile .dm-home{display:block!important;padding-bottom:0!important}
.dm-mobile .dm-home>main{position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;display:block!important;width:100%!important;min-height:0!important;padding:10px!important}
.dm-mobile .dm-home-hero{display:block!important}
.dm-mobile .dm-home-hero-copy{margin:0!important;padding:10px 0!important}
.dm-mobile .dm-home-hero-copy div{overflow-wrap:anywhere}
.dm-mobile .dm-home-summary{position:relative!important;top:auto!important;right:auto!important;left:auto!important;transform:none!important;width:100%!important}
.dm-mobile .dm-home-quick,.dm-mobile .dm-home-quick-seven{grid-template-columns:repeat(2,minmax(0,1fr))!important}
.dm-mobile .dm-home-quick-seven>*{grid-column:auto!important;grid-row:auto!important}
.dm-mobile .dm-home-quick>*{min-height:130px}
.dm-mobile .dm-panel-shell{padding:14px!important}
.dm-mobile .dm-app-content [style*="grid-template-columns:2fr 3fr"],.dm-mobile .dm-app-content [style*="grid-template-columns: 2fr 3fr"],.dm-mobile .dm-app-content [style*="grid-template-columns:1fr 1fr 1fr"]{grid-template-columns:minmax(0,1fr)!important}
.dm-mobile .dm-app-content [style*="minmax(240px"],.dm-mobile .dm-app-content [style*="minmax(260px"]{grid-template-columns:minmax(0,1fr)!important}
.dm-mobile .dm-app-content [role="dialog"]{max-width:100vw}
.dm-mobile .dm-app-content .dm-table-scroll{display:none!important}
.dm-mobile .dm-mobile-table-cards{display:block!important}
.dm-mobile-table-cards{display:none}
.dm-mobile-table-sort{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:9px 0}
.dm-mobile-table-sort select{flex:1;min-width:120px;padding:9px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:#17212c;color:#f8fafc}
.dm-mobile-table-sort button{padding:8px 12px;border:1px solid rgba(255,255,255,.15);border-radius:9px;background:#202b37;color:#fff}
.dm-mobile-column-filters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.dm-mobile-column-filters label{font-size:10px;color:#b6c4d4;display:flex;flex-direction:column;gap:4px}
.dm-mobile-column-filters input{width:100%;min-width:0;padding:9px;background:#131b25;border:1px solid rgba(255,255,255,.13);border-radius:8px;color:white}
.dm-mobile-record{border:1px solid rgba(187,205,224,.16);border-radius:13px;background:rgba(17,25,35,.92);margin:0 0 9px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.11)}
.dm-mobile-record summary{min-height:70px;cursor:pointer;display:flex;align-items:center;gap:12px;padding:13px;list-style:none}
.dm-mobile-record summary::-webkit-details-marker{display:none}
.dm-mobile-record-number{height:32px;min-width:32px;padding:0 4px;border-radius:9px;background:rgba(232,0,29,.14);color:#ff8491;display:grid;place-items:center;font-weight:850;font-size:11px}
.dm-mobile-record-head{display:flex;flex-direction:column;min-width:0;flex:1;gap:4px}
.dm-mobile-record-head strong{font-size:14px;color:#fff;overflow-wrap:anywhere;line-height:1.3}
.dm-mobile-record-head small{font-size:11px;color:#9aacbe;line-height:1.4;overflow-wrap:anywhere}
.dm-mobile-record-details{border-top:1px solid rgba(255,255,255,.09);padding:7px 13px 13px}
.dm-mobile-record-field{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:10px 1px;border-bottom:1px solid rgba(255,255,255,.055);font-size:12px}
.dm-mobile-record-field>span:first-child{color:#9cacc0;max-width:40%;flex:0 0 40%;overflow-wrap:anywhere}
.dm-mobile-record-field>div:last-child{min-width:0;flex:1;text-align:right;color:#e9f1fa;overflow-wrap:anywhere;word-break:break-word}
.dm-mobile-record-field button{min-height:38px}
.dm-mobile-more-rows{width:100%;padding:13px;border-radius:10px;border:1px solid #556579!important;background:#202c39;color:#f4f8ff;font-size:12px;font-weight:800;margin:8px 0}
.dm-mobile-table-count{padding:8px 0 11px;color:#a0b3c6;font-size:11px}
.dm-mobile-home{padding:2px 1px 14px;max-width:760px;margin:auto}
.dm-mobile-home-hero{position:relative;padding:23px 22px 19px;min-height:228px;border-radius:22px;background:radial-gradient(circle at 100% 0%,rgba(232,0,29,.22),transparent 53%),linear-gradient(150deg,#253343,#121b27 73%);border:1px solid rgba(198,213,234,.16);box-shadow:0 12px 33px rgba(0,0,0,.18);overflow:hidden}
.dm-mobile-home-kicker{display:flex;align-items:center;gap:8px;font-size:10px;font-weight:900;letter-spacing:.13em;color:#ff9ca6}
.dm-mobile-home-kicker>span{height:7px;width:7px;border-radius:50%;background:#ff5368}
.dm-mobile-home-day{text-transform:capitalize;margin-top:20px;color:#a9b8c7;font-size:12px}
.dm-mobile-home h1{font-size:clamp(27px,7vw,38px);font-weight:650;letter-spacing:-.045em;line-height:1.15;margin:8px 0;color:#fafcff;overflow-wrap:break-word}
.dm-mobile-home h1 strong{font-weight:900}
.dm-mobile-home h1 span{color:#fb475b}
.dm-mobile-home-hero>p:last-of-type{font-size:13px;color:#b5c2cf}
.dm-mobile-home-status{margin-top:21px;display:flex;align-items:center;gap:9px;border-top:1px solid rgba(255,255,255,.09);padding-top:13px;color:#b7c8da;font-size:11px}
.dm-mobile-home-status>span:nth-child(2){flex:1;min-width:0;overflow-wrap:anywhere}
.dm-mobile-home-status button{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.09);display:grid;place-items:center}
.dm-mobile-home-links{margin-top:28px}
.dm-mobile-section-heading small{font-size:10px;color:#fb6876;font-weight:850;letter-spacing:.14em}
.dm-mobile-section-heading h2{font-size:20px;font-weight:900;color:#fafcff;margin:7px 0 14px}
.dm-mobile-shortcuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dm-mobile-shortcut{position:relative;display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-height:155px;min-width:0;padding:15px 12px 14px;border-radius:16px;border:1px solid rgba(198,211,231,.14)!important;background:rgba(22,31,42,.92);box-shadow:0 5px 20px rgba(0,0,0,.10)}
.dm-mobile-shortcut-icon{height:43px;width:43px;display:grid;place-items:center;border-radius:12px;margin-bottom:13px}
.dm-mobile-shortcut strong{font-size:13px;line-height:1.3;font-weight:850;color:#fff;overflow-wrap:anywhere;padding-right:8px}
.dm-mobile-shortcut small{font-size:10px;color:#95a9bd;margin-top:5px;line-height:1.35}
.dm-mobile-shortcut>svg:last-child{position:absolute;top:16px;right:12px}
.dm-mobile-shortcut-alert{font-size:10px;color:#ff8290;font-weight:800;margin-top:6px}
.dm-mobile-home-info{display:flex;align-items:flex-start;gap:9px;background:rgba(58,103,148,.13);border:1px solid rgba(100,164,215,.15);border-radius:12px;padding:14px;margin-top:23px;font-size:11px;line-height:1.5;color:#b6c7d8}
.dm-mobile-home-project{font-size:11px;color:#8fa3b7;text-align:center;margin:18px 0}
.dm-mobile-home-project strong{color:#e4eef8}
@media(max-width:460px){
  .dm-mobile .dm-app-content [style*="grid-template-columns:repeat(3"],.dm-mobile .dm-app-content [style*="grid-template-columns:repeat(4"],.dm-mobile .dm-app-content [style*="grid-template-columns:2fr"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .dm-mobile .dm-app-content [style*="grid-template-columns:2fr 3fr"]{grid-template-columns:minmax(0,1fr)!important}
}
@media(max-width:350px){.dm-mobile-shortcuts{grid-template-columns:1fr}.dm-mobile-brand-label small{max-width:130px}}
\`;