import { cleanEquipmentCode } from "../modules/equipment/equipmentCode.js";
import { useEffect } from "react";

const normalize=(v)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const isEquipmentHeader=(v)=>{const h=normalize(v);return h.includes("interno")||h.includes("codigo int")||h.includes("codigo de drusila")||h==="equipo interno";};
const codeFromCell=(v)=>{const raw=String(v||"").trim().split(/\s+/)[0]||"";return /^[A-Za-z]{2,8}[- ]?\d{2,6}(?:-JM)?$/i.test(raw)?cleanEquipmentCode(raw.replace(" ","-")):"";};

/** Hace navegables los internos también en tablas HTML legacy que aún no usan <Table/>. */
export function useGlobalEquipmentProfileLinks(){
  useEffect(()=>{
    const onClick=(event)=>{
      if(event.target.closest("button,a,input,select,textarea"))return;
      const td=event.target.closest("td");if(!td)return;
      const table=td.closest("table");if(!table)return;
      const row=td.parentElement;if(!row)return;
      const index=[...row.children].indexOf(td);if(index<0)return;
      const headers=[...table.querySelectorAll("thead tr:first-child th")];
      const header=headers[index];if(!header||!isEquipmentHeader(header.textContent))return;
      const code=codeFromCell(td.textContent);if(!code)return;
      window.dispatchEvent(new CustomEvent("dm-open-equipment-profile",{detail:{code}}));
    };
    document.addEventListener("click",onClick);
    return()=>document.removeEventListener("click",onClick);
  },[]);
}
