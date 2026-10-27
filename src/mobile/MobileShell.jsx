import React, {useEffect, useMemo, useRef, useState} from "react";
import {Icon} from "../components/ui/index.jsx";

// Presentación móvil pura: reutiliza las rutas, permisos, filtros y datos de App.
// No crea peticiones de red, suscripciones ni un segundo inicio de sesión.
const accent="#e8001d";
const quiet="#9caabb";
const baseBtn={fontFamily:"Inter,Arial,sans-serif",cursor:"pointer",border:"none",color:"#f7f9fc"};
const norm=value=>String(value||"").toLocaleLowerCase("es-AR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const flatten=items=>(items||[]).flatMap(item=>item.type==="group"?(item.children||[]):[item]);
const preferred=[
  {id:"bienvenida",label:"Inicio",icon:"home"},
  {id:"rop02",label:"Equipos",icon:"truck"},
  {id:"control",label:"Control",icon:"clipboardCheck"},
  {id:"dashboard",label:"Tableros",icon:"dashboard"}
];
const quickLinks=[
  {id:"rop02",label:"Partes de equipos",caption:"ROP02 · Operaciones",icon:"truck",color:"#60a5fa"},
  {id:"rop05",label:"Productividad",caption:"ROP05 · Producción",icon:"prod",color:"#2dd4bf"},
  {id:"atrasoROP02",label:"Equipos atrasados",caption:"Control de cargas",icon:"warn",color:"#fbbf24"},
  {id:"control",label:"Control cruzado",caption:"ROP02 vs ROP05",icon:"clipboardCheck",color:"#fb7185"},
  {id:"listaEquipos",label:"Lista de equipos",caption:"Inventario maestro",icon:"database",color:"#c4b5fd"},
  {id:"rma15CtrlEquipo",label:"Mantenimientos",caption:"RMA15 · Historial",icon:"wrench",color:"#f59e0b"},
  {id:"equipmentProfile",label:"Ficha del equipo",caption:"Consulta integrada",icon:"truck",color:"#93c5fd"},
  {id:"dashboard",label:"Indicadores",caption:"Tablero ejecutivo",icon:"dashboard",color:"#4ade80"}
];

export function MobileShell({
  view,titles={},navItems=[],onNavigate,onRefresh,onOpenProfile,onSignOut,
  onSwitchDesktop,syncing=false,loading=false,lastUpdate,nombreUsuario="Usuario",
  proyectoUsuario="",badgeControl=0
}){
  const [menuOpen,setMenuOpen]=useState(false);
  const [query,setQuery]=useState("");
  const menuSearch=useRef(null);
  const leaves=useMemo(()=>flatten(navItems),[navItems]);
  const allowed=useMemo(()=>new Set(["bienvenida",...leaves.map(x=>x.id)]),[leaves]);
  const bottom=preferred.filter(x=>allowed.has(x.id));
  const activeBottom=bottom.find(x=>x.id===view);
  const go=id=>{setMenuOpen(false);setQuery("");onNavigate(id);};
  useEffect(()=>{setMenuOpen(false);setQuery("");},[view]);
  useEffect(()=>{
    if(!menuOpen)return;
    const esc=e=>{if(e.key==="Escape")setMenuOpen(false);};
    document.addEventListener("keydown",esc);
    const original=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.removeEventListener("keydown",esc);document.body.style.overflow=original;};
  },[menuOpen]);
  useEffect(()=>{if(menuOpen)menuSearch.current?.focus();},[menuOpen]);

  const groups=useMemo(()=>{
    const term=norm(query).trim();
    return (navItems||[]).map(item=>{
      const children=item.type==="group"?(item.children||[]):[item];
      return {id:item.id,label:item.type==="group"?item.label:"Accesos directos",
        children:children.filter(c=>!term||norm(c.label).includes(term))};
    }).filter(g=>g.children.length);
  },[navItems,query]);

  return <>
    <header className="dm-mobile-topbar" aria-label="Cabecera DELTA OPS">
      <button type="button" className="dm-mobile-brand" onClick={()=>go("bienvenida")} aria-label="Ir al inicio">
        <span className="dm-mobile-logo">D</span>
        <span className="dm-mobile-brand-label"><strong>DELTA <em>OPS</em></strong><small>{view==="bienvenida"?"Operaciones en sitio":titles[view]||"Operaciones"}</small></span>
      </button>
      <div className="dm-mobile-top-actions">
        {(syncing||loading)&&<span className="dm-mobile-sync" title="Actualizando datos"><span className="dm-mobile-pulse"/></span>}
        <button type="button" className="dm-mobile-icon-button" onClick={onRefresh} disabled={syncing||loading} aria-label="Actualizar información"><Icon name="refresh" size={19} color="currentColor"/></button>
        <button type="button" className="dm-mobile-icon-button" onClick={()=>setMenuOpen(true)} aria-label="Abrir todos los módulos"><Icon name="menu" size={21} color="currentColor"/></button>
      </div>
    </header>

    <nav className="dm-mobile-bottom-nav" aria-label="Navegación móvil">
      {bottom.map(item=><button key={item.id} type="button" aria-current={view===item.id?"page":undefined}
        className={view===item.id?"dm-mobile-tab is-active":"dm-mobile-tab"}
        onClick={()=>go(item.id)}>
        <span className="dm-mobile-tab-icon"><Icon name={item.icon} size={21} color="currentColor"/>
        {item.id==="control"&&badgeControl>0&&<span className="dm-mobile-tab-badge">{badgeControl>99?"99+":badgeControl}</span>}</span>
        <span>{item.label}</span>
      </button>)}
      <button type="button" className={"dm-mobile-tab"+(!activeBottom&&view!=="bienvenida"?" is-active":"")} onClick={()=>setMenuOpen(true)} aria-label="Ver todos los módulos" aria-expanded={menuOpen}>
        <span className="dm-mobile-tab-icon"><Icon name="menu" size={21} color="currentColor"/></span><span>Más</span>
      </button>
    </nav>

    {menuOpen&&<div className="dm-mobile-menu-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setMenuOpen(false);}}>
      <section className="dm-mobile-drawer" role="dialog" aria-modal="true" aria-label="Todos los módulos">
        <div className="dm-mobile-drawer-handle"/>
        <div className="dm-mobile-drawer-title">
          <div><small>DELTA MINING OPS</small><h2>Explorar módulos</h2></div>
          <button type="button" className="dm-mobile-icon-button" onClick={()=>setMenuOpen(false)} aria-label="Cerrar menú"><Icon name="close" size={20} color="currentColor"/></button>
        </div>
        <div className="dm-mobile-user">
          <span className="dm-mobile-avatar"><Icon name="user" size={18} color="#fff"/></span>
          <div><strong>{nombreUsuario}</strong><small>{proyectoUsuario==="TODO"?"Todos los proyectos":proyectoUsuario}</small></div>
        </div>
        <label className="dm-mobile-menu-search">
          <Icon name="search" size={17} color={quiet}/>
          <input ref={menuSearch} type="search" value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Buscar módulo..." aria-label="Buscar módulo"/>
        </label>
        <div className="dm-mobile-menu-scroll">
          {groups.length===0&&<p className="dm-mobile-empty">No se encontraron módulos.</p>}
          {groups.map(group=><section key={group.id} className="dm-mobile-menu-group">
            <h3>{group.label}</h3>
            {group.children.map(item=><button key={item.id} type="button"
              className={"dm-mobile-menu-link"+(item.id===view?" is-current":"")}
              onClick={()=>go(item.id)}>
              <span className="dm-mobile-menu-link-icon"><Icon name={item.icon||"dashboard"} size={18} color={item.color||"#cbd5e1"}/></span>
              <span>{item.label}</span>
              {item.badge>0&&<b>{item.badge}</b>}
              <Icon name="chevronRight" size={16} color={quiet}/>
            </button>)}
          </section>)}
          <section className="dm-mobile-menu-group">
            <h3>Cuenta y preferencias</h3>
            <button type="button" className="dm-mobile-menu-link" onClick={()=>{setMenuOpen(false);onOpenProfile();}}><Icon name="gear" size={19} color={quiet}/> Mi configuración</button>
            <button type="button" className="dm-mobile-menu-link" onClick={()=>{setMenuOpen(false);onSwitchDesktop();}}><Icon name="dashboard" size={19} color={quiet}/> Usar vista de escritorio</button>
            <button type="button" className="dm-mobile-menu-link" onClick={()=>{setMenuOpen(false);onSignOut();}}><Icon name="close" size={19} color="#fb7185"/> Cerrar sesión</button>
          </section>
          <p className="dm-mobile-footer-note">Los módulos mantienen los permisos, fuentes de datos y controles de tu cuenta.</p>
        </div>
      </section>
    </div>}
  </>;
}

export function MobileHome({nombreUsuario="Usuario",proyectoUsuario="TODO",navItems=[],onNavigate,
  syncing=false,lastUpdate,badgeControl=0,onRefresh}){
  const available=useMemo(()=>new Set(flatten(navItems).map(x=>x.id)),[navItems]);
  const shortcuts=quickLinks.filter(link=>available.has(link.id));
  const name=String(nombreUsuario||"").trim().split(/\s+/)[0]||"equipo";
  const date=new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
  return <div className="dm-mobile-home">
    <section className="dm-mobile-home-hero">
      <div className="dm-mobile-home-kicker"><span/> CENTRO DE OPERACIONES</div>
      <p className="dm-mobile-home-day">{date}</p>
      <h1>Hola, <strong>{name}</strong><span>.</span></h1>
      <p>Tu operación, en cualquier lugar.</p>
      <div className="dm-mobile-home-status">
        <span className="dm-mobile-status-dot"/>
        <span>{syncing?"Sincronizando información":lastUpdate?"Datos actualizados · "+lastUpdate.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}):"Consultá tus módulos operativos"}</span>
        <button type="button" onClick={onRefresh} aria-label="Actualizar datos"><Icon name="refresh" size={16} color="#fff"/></button>
      </div>
    </section>
    <section className="dm-mobile-home-links" aria-label="Accesos rápidos">
      <div className="dm-mobile-section-heading"><div><small>ACCESOS RÁPIDOS</small><h2>¿Qué necesitás consultar?</h2></div></div>
      <div className="dm-mobile-shortcuts">
        {shortcuts.map(link=><button key={link.id} type="button" className="dm-mobile-shortcut" onClick={()=>onNavigate(link.id)}>
          <span className="dm-mobile-shortcut-icon" style={{background:link.color+"1a",color:link.color}}><Icon name={link.icon} size={23} color="currentColor"/></span>
          <strong>{link.label}</strong><small>{link.caption}</small>
          {link.id==="control"&&badgeControl>0&&<span className="dm-mobile-shortcut-alert">{badgeControl} alertas</span>}
          <Icon name="chevronRight" size={16} color={quiet}/>
        </button>)}
      </div>
    </section>
    <div className="dm-mobile-home-info"><Icon name="database" size={17} color="#93c5fd"/><span>Un solo sistema para escritorio y celular. Sin duplicar partes ni sincronizaciones.</span></div>
    {proyectoUsuario!=="TODO"&&<div className="dm-mobile-home-project">Proyecto asignado: <strong>{proyectoUsuario}</strong></div>}
  </div>;
}
