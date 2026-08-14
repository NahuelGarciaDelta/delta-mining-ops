import { useEffect } from "react";

export function useGlobalThreeStateTableSort(){
  useEffect(()=>{
    if(typeof document==="undefined")return undefined;

    const styleId="dm-global-table-sort-style";
    if(!document.getElementById(styleId)){
      const style=document.createElement("style");
      style.id=styleId;
      style.textContent=`
        table thead th:not([data-dm-no-sort="true"]){cursor:pointer;user-select:none}
        table thead th[data-dm-sort-dir="asc"]::after{content:" ↑";color:#e8001d;font-weight:900}
        table thead th[data-dm-sort-dir="desc"]::after{content:" ↓";color:#e8001d;font-weight:900}
      `;
      document.head.appendChild(style);
    }

    const originalOrder=new WeakMap();
    const tableState=new WeakMap();

    const normalizeValue=(raw)=>{
      const text=String(raw??"").replace(/\s+/g," ").trim();
      if(!text)return{kind:"empty",value:""};

      const dmy=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s|$)/);
      if(dmy){
        const year=Number(dmy[3].length===2?`20${dmy[3]}`:dmy[3]);
        const value=new Date(year,Number(dmy[2])-1,Number(dmy[1])).getTime();
        if(Number.isFinite(value))return{kind:"number",value};
      }
      const iso=text.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s|$)/);
      if(iso){
        const value=new Date(Number(iso[1]),Number(iso[2])-1,Number(iso[3])).getTime();
        if(Number.isFinite(value))return{kind:"number",value};
      }

      let numeric=text.replace(/^(?:ARS|USD|U\$S)\s*/i,"").replace(/[a-zA-ZáéíóúÁÉÍÓÚ²³\/]+.*$/g,"").replace(/[$%\s]/g,"").trim();
      if(/^-?[\d.,]+$/.test(numeric)){
        if(numeric.includes(","))numeric=numeric.replace(/\./g,"").replace(",",".");
        else numeric=numeric.replace(/,/g,"");
        const value=Number(numeric);
        if(Number.isFinite(value))return{kind:"number",value};
      }
      return{kind:"text",value:text.toLocaleLowerCase("es-AR")};
    };

    const getGroups=(tbody)=>{
      const rows=Array.from(tbody.children).filter(el=>el.tagName==="TR");
      const groups=[];
      for(let i=0;i<rows.length;i++){
        const row=rows[i];
        const group=[row];
        while(i+1<rows.length){
          const next=rows[i+1];
          const first=next.cells&&next.cells[0];
          const isDetail=next.cells?.length===1&&Number(first?.colSpan||1)>1;
          if(!isDetail)break;
          group.push(next);i++;
        }
        groups.push(group);
      }
      return groups;
    };

    const clearIndicators=(table)=>table.querySelectorAll("thead th[data-dm-sort-dir]").forEach(th=>th.removeAttribute("data-dm-sort-dir"));

    const onClick=(event)=>{
      const th=event.target.closest?.("th");
      if(!th||th.dataset.dmManagedSort==="true"||th.dataset.dmNoSort==="true")return;
      const table=th.closest("table");
      if(!table||!table.tHead||!table.tBodies.length)return;
      const headerRow=th.parentElement;
      if(!headerRow||headerRow.parentElement?.tagName!=="THEAD")return;
      const colIndex=Array.from(headerRow.cells).indexOf(th);
      if(colIndex<0)return;

      const previous=tableState.get(table)||{col:-1,dir:"original"};
      let dir="asc";
      if(previous.col===colIndex&&previous.dir==="asc")dir="desc";
      else if(previous.col===colIndex&&previous.dir==="desc")dir="original";

      clearIndicators(table);
      if(dir!=="original")th.dataset.dmSortDir=dir;
      tableState.set(table,{col:colIndex,dir});

      Array.from(table.tBodies).forEach(tbody=>{
        const groups=getGroups(tbody);
        groups.forEach((group,index)=>{const anchor=group[0];if(!originalOrder.has(anchor))originalOrder.set(anchor,index);});
        const ordered=[...groups];
        if(dir==="original")ordered.sort((a,b)=>(originalOrder.get(a[0])??0)-(originalOrder.get(b[0])??0));
        else ordered.sort((a,b)=>{
          const av=normalizeValue(a[0].cells?.[colIndex]?.innerText||"");
          const bv=normalizeValue(b[0].cells?.[colIndex]?.innerText||"");
          if(av.kind==="empty"&&bv.kind!=="empty")return 1;
          if(bv.kind==="empty"&&av.kind!=="empty")return -1;
          let cmp=0;
          if(av.kind==="number"&&bv.kind==="number")cmp=av.value-bv.value;
          else cmp=String(av.value).localeCompare(String(bv.value),"es-AR",{numeric:true,sensitivity:"base"});
          return dir==="asc"?cmp:-cmp;
        });
        ordered.forEach(group=>group.forEach(row=>tbody.appendChild(row)));
      });
    };

    document.addEventListener("click",onClick);
    return()=>document.removeEventListener("click",onClick);
  },[]);
}
