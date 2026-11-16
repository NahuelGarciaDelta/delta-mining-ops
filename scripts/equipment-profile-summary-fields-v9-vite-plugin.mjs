const TARGET = "/src/modules/equipment/EquipmentProfileView.jsx";

export function equipmentProfileSummaryFieldsV9VitePlugin() {
  return {
    name: "delta-v9-equipment-profile-summary-fields",
    enforce: "pre",
    transform(code, id) {
      if (!String(id || "").replace(/\\/g, "/").endsWith(TARGET)) return null;
      let out = code;

      out = out.replace(
        '  const detailCode=selectedOption?.value||cleanEquipmentCode(selected);',
        `  const detailCode=selectedOption?.value||cleanEquipmentCode(selected);
  const profileLastProject=String(summary.lastOp?.proyecto||summary.lastOp?.lugar||project||"—").trim()||"—";
  const profileCurrentPlace=String(pick(master||{},["Lugar de alquiler","Lugar alquiler","Ubicación de alquiler","Ubicacion de alquiler"])||summary.lastOp?.lugar||profileLastProject||"—").trim()||"—";
  const profileLastRop02Date=(()=>{const raw=String(summary.lastOp?.fecha||"").trim();if(!raw)return"Sin registros";const iso=raw.slice(0,10);return /^\\d{4}-\\d{2}-\\d{2}$/.test(iso)?iso.split("-").reverse().join("/"):iso})();`
      );

      const anchor = `          </div>}
        </div>
        <div className="dm-equipment-filter-panel"`;
      if (!out.includes(anchor)) {
        throw new Error("[delta-v9-equipment-profile-summary-fields] No se encontró el encabezado de Ficha Única");
      }
      out = out.replace(
        anchor,
        `          </div>}
          {detailCode&&<div className="dm-v9-profile-last-rop02" style={{marginTop:7,color:C.textSub,fontSize:11,fontWeight:700}}>Último registro ROP02: <span style={{color:C.text}}>{profileLastRop02Date}</span></div>}
          {detailCode&&<div className="dm-v9-profile-location-lines" style={{marginTop:7,display:"flex",flexDirection:"column",gap:3,fontSize:11,fontWeight:700,color:C.textSub}}>
            <div><span style={{color:C.textMuted}}>Último proyecto:</span> <span style={{color:C.blue}}>{profileLastProject}</span></div>
            <div><span style={{color:C.textMuted}}>Lugar actual:</span> <span style={{color:C.text}}>{profileCurrentPlace}</span></div>
          </div>}
        </div>
        <div className="dm-equipment-filter-panel"`
      );

      return out === code ? null : { code: out, map: null };
    },
  };
}
