const ENDPOINT="https://api.open-meteo.com/v1/forecast";
const CACHE_KEY="dm_weather_batidero_v1";
const CACHE_TTL=20*60*1000;

export const BATIDERO_LOCATION=Object.freeze({
  name:"Campamento Batidero",
  detail:"Cerro del Batidero · Iglesia, San Juan",
  latitude:-28.52377,
  longitude:-69.53643,
});

const CURRENT=["temperature_2m","apparent_temperature","relative_humidity_2m","precipitation","rain","snowfall","weather_code","cloud_cover","pressure_msl","surface_pressure","wind_speed_10m","wind_direction_10m","wind_gusts_10m","visibility","is_day"];
const HOURLY=["temperature_2m","apparent_temperature","relative_humidity_2m","precipitation_probability","precipitation","snowfall","weather_code","cloud_cover","visibility","wind_speed_10m","wind_direction_10m","wind_gusts_10m","uv_index"];
const DAILY=["weather_code","temperature_2m_max","temperature_2m_min","apparent_temperature_max","apparent_temperature_min","precipitation_sum","rain_sum","snowfall_sum","precipitation_probability_max","wind_speed_10m_max","wind_gusts_10m_max","uv_index_max","sunrise","sunset"];

function readCache(){
  try{const value=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");return value?.data?value:null;}catch{return null;}
}
function writeCache(data){
  try{localStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:Date.now(),data}));}catch{}
}
function rows(block,fields){
  const times=Array.isArray(block?.time)?block.time:[];
  return times.map((time,index)=>Object.fromEntries([["time",time],...fields.map(field=>[field,block?.[field]?.[index]??null])]));
}
function normalize(json){
  if(!json?.current||!json?.hourly||!json?.daily)throw new Error("Respuesta meteorológica incompleta");
  return {
    location:{...BATIDERO_LOCATION,elevation:json.elevation??null,timezone:json.timezone||""},
    current:{...json.current},
    hourly:rows(json.hourly,HOURLY).slice(0,72),
    daily:rows(json.daily,DAILY),
    units:{current:json.current_units||{},hourly:json.hourly_units||{},daily:json.daily_units||{}},
    fetchedAt:new Date().toISOString(),
  };
}

export async function fetchBatideroWeather({signal,force=false}={}){
  const cached=readCache();
  if(!force&&cached&&Date.now()-cached.savedAt<CACHE_TTL)return{...cached.data,cacheStatus:"fresh"};
  const controller=new globalThis.AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  const abort=()=>controller.abort();
  signal?.addEventListener("abort",abort,{once:true});
  const params=new globalThis.URLSearchParams({
    latitude:String(BATIDERO_LOCATION.latitude),longitude:String(BATIDERO_LOCATION.longitude),
    current:CURRENT.join(","),hourly:HOURLY.join(","),daily:DAILY.join(","),
    timezone:"America/Argentina/San_Juan",forecast_days:"7",wind_speed_unit:"kmh",precipitation_unit:"mm",
  });
  try{
    const response=await fetch(`${ENDPOINT}?${params}`,{signal:controller.signal,cache:"no-store"});
    if(!response.ok)throw new Error(`Open-Meteo respondió HTTP ${response.status}`);
    const data=normalize(await response.json());writeCache(data);return{...data,cacheStatus:"network"};
  }catch(error){
    if(signal?.aborted)throw error;
    if(cached)return{...cached.data,cacheStatus:"stale",fetchError:error?.message||String(error)};
    throw error;
  }finally{clearTimeout(timeout);signal?.removeEventListener("abort",abort);}
}

export function weatherLabel(code){
  if(code===0)return"Despejado";if([1,2].includes(code))return"Parcialmente nublado";if(code===3)return"Cubierto";
  if([45,48].includes(code))return"Niebla";if(code>=51&&code<=67)return"Lluvia";if(code>=71&&code<=77)return"Nieve";
  if(code>=80&&code<=82)return"Chaparrones";if(code>=85&&code<=86)return"Nieve intensa";if(code>=95)return"Tormenta";return"Condición variable";
}
export function windDirection(degrees){const points=["N","NE","E","SE","S","SO","O","NO"];return Number.isFinite(Number(degrees))?points[Math.round(Number(degrees)/45)%8]:"—";}
export function operationalRisk(weather){
  const current=weather?.current||{},daily=weather?.daily?.[0]||{};
  const gust=Number(current.wind_gusts_10m||daily.wind_gusts_10m_max||0),wind=Number(current.wind_speed_10m||0),visibility=Number(current.visibility||999999),snow=Number(current.snowfall||daily.snowfall_sum||0),rain=Number(current.precipitation||daily.precipitation_sum||0),temp=Number(current.temperature_2m);
  const reasons=[];let level=0;
  if(gust>=80){level=3;reasons.push("Ráfagas extremas");}else if(gust>=60){level=Math.max(level,2);reasons.push("Ráfagas fuertes");}else if(gust>=40||wind>=35){level=Math.max(level,1);reasons.push("Viento elevado");}
  if(visibility<1000){level=Math.max(level,3);reasons.push("Visibilidad crítica");}else if(visibility<5000){level=Math.max(level,2);reasons.push("Visibilidad reducida");}
  if(snow>0){level=Math.max(level,snow>=2?3:2);reasons.push("Nieve prevista");}if(rain>=5){level=Math.max(level,rain>=15?3:2);reasons.push("Precipitación relevante");}
  if(Number.isFinite(temp)&&(temp<=-10||temp>=38)){level=Math.max(level,3);reasons.push("Temperatura extrema");}else if(Number.isFinite(temp)&&(temp<=-3||temp>=32)){level=Math.max(level,1);reasons.push("Temperatura exigente");}
  return{...([{label:"Normal",color:"#22c55e"},{label:"Precaución",color:"#eab308"},{label:"Riesgo",color:"#f97316"},{label:"Condición crítica",color:"#ef4444"}][level]),reasons};
}
