export const DEFAULT_APPEARANCE=Object.freeze({
  accent:"red",
  background:"operations",
  backgroundCustom:"",
  backgroundDim:48,
  backgroundBlur:0,
  panelOpacity:55,
  density:"normal",
  scale:"normal",
  sidebar:"remember",
  reducedMotion:false,
});

export const APPEARANCE_ACCENTS=Object.freeze([
  {id:"red",label:"Rojo Delta",hex:"#e8001d"},
  {id:"blue",label:"Azul",hex:"#3b82f6"},
  {id:"cyan",label:"Celeste",hex:"#06b6d4"},
  {id:"green",label:"Verde",hex:"#22c55e"},
  {id:"orange",label:"Naranja",hex:"#f59e0b"},
  {id:"purple",label:"Violeta",hex:"#a855f7"},
]);

export const APPEARANCE_BACKGROUNDS=Object.freeze([
  {id:"operations",label:"Operaciones",src:"/img/embedded/ui-background-b80067ac.jpg"},
  {id:"login",label:"Cordillera",src:"/img/login-fondo.webp"},
  {id:"none",label:"Sin imagen",src:""},
]);

const storageKey=email=>`dm_appearance_v1:${String(email||"anonymous").trim().toLowerCase()}`;

export function normalizeAppearance(value={}){
  const base={...DEFAULT_APPEARANCE,...(value||{})};
  if(!APPEARANCE_ACCENTS.some(x=>x.id===base.accent))base.accent=DEFAULT_APPEARANCE.accent;
  if(!APPEARANCE_BACKGROUNDS.some(x=>x.id===base.background)&&base.background!=="custom")base.background=DEFAULT_APPEARANCE.background;
  base.backgroundDim=Math.max(0,Math.min(85,Number(base.backgroundDim??48)));
  base.backgroundBlur=Math.max(0,Math.min(16,Number(base.backgroundBlur??0)));
  base.panelOpacity=Math.max(35,Math.min(100,Number(base.panelOpacity??55)));
  if(!["compact","normal","comfortable"].includes(base.density))base.density="normal";
  if(!["small","normal","large"].includes(base.scale))base.scale="normal";
  if(!["remember","expanded","compact"].includes(base.sidebar))base.sidebar="remember";
  base.reducedMotion=Boolean(base.reducedMotion);
  base.backgroundCustom=String(base.backgroundCustom||"");
  return base;
}

export function readLocalAppearance(email){try{return normalizeAppearance(JSON.parse(localStorage.getItem(storageKey(email))||"{}"));}catch(_){return normalizeAppearance();}}
export function writeLocalAppearance(email,prefs){const normalized=normalizeAppearance(prefs);try{localStorage.setItem(storageKey(email),JSON.stringify(normalized));}catch(_){}return normalized;}

function hexToRgba(hex,alpha){const raw=String(hex||"").replace("#","");const full=raw.length===3?raw.split("").map(x=>x+x).join(""):raw;const n=parseInt(full,16);return`rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;}
function cssUrl(value){return String(value||"").replace(/\\/g,"\\\\").replace(/"/g,"\\\"").replace(/[\r\n]/g,"");}

export function applyAppearance(prefs,C){
  if(typeof document==="undefined")return normalizeAppearance(prefs);
  const p=normalizeAppearance(prefs);
  const accent=APPEARANCE_ACCENTS.find(x=>x.id===p.accent)?.hex||"#e8001d";
  C.accent=accent;C.accentDim=hexToRgba(accent,.12);
  const preset=APPEARANCE_BACKGROUNDS.find(x=>x.id===p.background);
  const background=p.background==="custom"?p.backgroundCustom:(preset?.src||"");
  const root=document.documentElement;
  root.style.setProperty("--dm-accent",accent);
  root.style.setProperty("--dm-accent-dim",hexToRgba(accent,.12));
  root.style.setProperty("--dm-panel-opacity",String(p.panelOpacity/100));
  root.style.setProperty("--dm-bg-dim",String(p.backgroundDim/100));
  root.style.setProperty("--dm-bg-blur",`${p.backgroundBlur}px`);
  root.style.setProperty("--dm-bg-image",background?`url("${cssUrl(background)}")`:"none");
  root.dataset.dmDensity=p.density;root.dataset.dmScale=p.scale;root.dataset.dmReducedMotion=p.reducedMotion?"1":"0";
  return p;
}

export async function loadCentralAppearance(APPS_SCRIPT_URL,email){const url=new URL(APPS_SCRIPT_URL);url.searchParams.set("action","user_preferences");url.searchParams.set("email",String(email||""));url.searchParams.set("_t",String(Date.now()));const res=await fetch(url.toString(),{cache:"no-store",redirect:"follow"});if(!res.ok)throw new Error(`HTTP ${res.status}`);const json=await res.json();if(!json?.ok)throw new Error(json?.error?.message||"Preferencias centrales no disponibles");return normalizeAppearance(json.appearance||json.preferences||{});}
export async function saveCentralAppearance(APPS_SCRIPT_URL,email,prefs){const normalized=normalizeAppearance(prefs);const payload={action:"save_user_preferences",email:String(email||""),appearance:normalized};const res=await fetch(APPS_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:new URLSearchParams({payload:JSON.stringify(payload)}),redirect:"follow"});if(!res.ok)throw new Error(`HTTP ${res.status}`);const json=await res.json();if(!json?.ok)throw new Error(json?.error?.message||"No se pudieron guardar las preferencias centrales");return normalizeAppearance(json.appearance||normalized);}

export async function fileToBackgroundDataUrl(file){if(!file)return"";if(!String(file.type||"").startsWith("image/"))throw new Error("Seleccioná una imagen válida.");if(file.size>8*1024*1024)throw new Error("La imagen no puede superar 8 MB.");const bitmap=await createImageBitmap(file);const maxW=1600,maxH=900,scale=Math.min(1,maxW/bitmap.width,maxH/bitmap.height);const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext("2d");ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();return canvas.toDataURL("image/jpeg",.62);}
