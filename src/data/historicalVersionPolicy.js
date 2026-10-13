// Las consultas históricas deben invalidarse sólo cuando cambie SU dataset.
// Comparar el manifiesto completo provoca descargas por cambios ajenos
// (por ejemplo ROP05 vuelve a bajar por un cambio en insumos).
const SOURCES=Object.freeze({
  rop02:["rop02_jm","rop02_fs","rop02_filosur","rop02_zorro"],
  rop05:["rop05"],
  rma15:["rma15_jm","rma15_fs"]
});

export function historicalVersionsForDataset(dataset,manifest){
  if(!manifest?.ok||!manifest?.versions||typeof manifest.versions!=="object")return null;
  const name=String(dataset||"").trim().toLowerCase();
  const keys=SOURCES[name]||[name];
  const selected={};
  for(const key of keys){
    const value=Number(manifest.versions[key]);
    if(!Number.isFinite(value)||value<=0)return null;
    selected[key]=value;
  }
  return selected;
}

export function historicalSnapshotMatchesManifest(dataset,cached,manifest){
  if(!cached?.ok||!Array.isArray(cached.data))return false;
  const remote=historicalVersionsForDataset(dataset,manifest);
  const local=cached.versions||{};
  if(!remote)return false;
  return Object.entries(remote).every(([key,version])=>Number(local[key])===version);
}
