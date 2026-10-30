/** Guard 4F: el espejo B:AK no trae los campos AL:AN del ROP02 original. */
function dmV9Task3UnmirroredV1_(taskNumber, originalEntry){
  if(taskNumber!==3||!originalEntry||!Array.isArray(originalEntry.legacyColumns))return false;
  return [36,37,38].some(function(i){
    var x=originalEntry.legacyColumns[i];
    return x!==null&&x!==undefined&&String(x).trim()!=='';
  });
}
/**
 * DELTA OPS V9 — CANDIDATO de generador ROP05 no destructivo, fase 4B.
 * NUEVO módulo para el CLON, no sustituye el Apps Script en producción.
 * POR DEFECTO: solo generarROP05NuevoV9Previsualizar (read-only).
 * generarROP05NuevoV9Aplicar BLOQUEADA por ScriptProperties.
 * IMPORTANTE: no garantiza atomicidad entre diferentes proyectos Apps Script.
 * Nunca ejecutar Aplicar mientras V8.1 tenga triggers activos.
 * No contiene tokens. Se debe ROTAR el token expuesto en el script original.
 * IDENTIDAD (4B+4C): usa IDs AppSheet ya existentes en origen original ROP02.
 * Este script REQUIERE DM_UNIFIED_PHASE4C_ROP02_ID_BRIDGE_V1.gs.
 * Conserva salida ROP05 A:O y la lógica de productividad y deduplicación heredadas.
 * En este candidato, identidad queda solo EN MEMORIA y en resumen; NO se envía como ACK.
 * Fase de corte permanece BLOQUEADA hasta que se resuelvan IDs conflictivos,
 * excepciones del legado y atomicidad del sincronizador definitivo.
 */
function dmV9GenerarROP05Core_(aplicar, collectManifest) {
  const ss = SpreadsheetApp.openById(dmV9U4eProductionIds_()[0]);
  if (aplicar) dmV9GuardAplicar_();
  const FILA_INICIO_DESTINO = 4431;
  const FECHA_CORTE = new Date(2026, 5, 26); // 26/06/2026

  const EQUIPOS_SIN_PRODUCTIVIDAD = [
    "CAMION REGADOR",
    "CAMION VOLCADOR",
    "CAMIONETA"
  ];

  const hojasOrigen = [
    {nombre:"Datos de ROP02 JM",dataset:"rop02_jm"},
    {nombre:"Datos de ROP02 FS",dataset:"rop02_fs"}
  ];
  if (typeof dmU4cLeerFuenteOriginalV1_ !== 'function') {
    throw new Error('INSTALAR 4C: falta dmU4cLeerFuenteOriginalV1_ para identificar partes originales');
  }

  const destino = ss.getSheetByName("ROP05 nuevo");
  if (!destino) throw new Error('ROP05 nuevo no existe, sin escrituras');

  function normalizarTexto(v) {
    return String(v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function excluirProductividad(equipo) {
    const eq = normalizarTexto(equipo);
    return EQUIPOS_SIN_PRODUCTIVIDAD.some(nombre => eq.includes(nombre));
  }

  function obtenerMesAnio(fecha) {
    if (fecha instanceof Date) {
      return "'" + Utilities.formatDate(fecha, Session.getScriptTimeZone(), "MM/yyyy");
    }
    return "";
  }

  function obtenerColumna(encabezados, posiblesNombres) {
    const encabezadosNorm = encabezados.map(e => normalizarTexto(e));
    for (const nombre of posiblesNombres) {
      const idx = encabezadosNorm.indexOf(normalizarTexto(nombre));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  function buscarFilaEncabezado(datos) {
    for (let i = 0; i < Math.min(10, datos.length); i++) {
      const filaNorm = datos[i].map(e => normalizarTexto(e));
      if (
        filaNorm.some(e => e === "TAREA 1") &&
        filaNorm.some(e => e === "EQUIPO") &&
        filaNorm.some(e => e === "SUPERVISOR DELTA")
      ) {
        return i;
      }
    }
    return 0;
  }

  function estaVacio(valor) {
    return valor === "" || valor === null || valor === undefined;
  }

  function obtenerNumero(valor) {
    if (estaVacio(valor)) return 0;
    const n = Number(String(valor).replace(",", ".").trim());
    return isNaN(n) ? 0 : n;
  }

  function valorColumna(fila, idx) {
    if (idx === -1 || idx === null || idx === undefined) return "";
    return fila[idx];
  }

  function fechaValidaDesdeCorte(fecha) {
    if (!(fecha instanceof Date)) return false;
    const f = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const c = new Date(FECHA_CORTE.getFullYear(), FECHA_CORTE.getMonth(), FECHA_CORTE.getDate());
    return f >= c;
  }

  function obtenerProduccionHS(fila, tareaNumero) {
    if (tareaNumero === 1) return fila[19]; // Columna T
    if (tareaNumero === 2) return fila[26]; // Columna AA
    if (tareaNumero === 3) return fila[34]; // Columna AI
    return "";
  }

  let salida = [];
  let clavesAgregadas = new Set();
  let clavesDuplicadasDescartadas = 0;
  const metadataPorRegistro = new Map();
  const identity = {sources:[], rowsChecked:0, mirrorUnmatched:0, mirrorFirstMismatches:[],
    outputReady:0, outputBlocked:0, outputBlockedFirst:[], suppressedLegacyRows:0,
    task3UnmirroredBlocked:0, rop02HoursNoTaskYet:0, taskWithoutProductiveHoursYet:0,
    outputAwaitingProductivity:0, outputAwaitingMeasure:0, outputAwaitingUnit:0};

  const lecturasOrigen = [];
  hojasOrigen.forEach(source => {
    const nombreHoja = source.nombre;
    const origen = ss.getSheetByName(nombreHoja);
    if (!origen) throw new Error('Hoja origen no existe: '+nombreHoja+'; sin escrituras');

    const datos = origen.getDataRange().getValues();
    if (datos.length < 2) return;
    lecturasOrigen.push({nombre:nombreHoja,filas:origen.getLastRow()});
    // Puente 4C: el original trae ID en A, mientras la vista IMPORTRANGE
    // de ROP05 trae B:AK y NO incluye el ID. Comparamos campos antes de asociar.
    const puente = dmU4cLeerFuenteOriginalV1_(source.dataset);
    const originalPorFila = new Map(puente.entries.map(e => [e.sourceRow,e]));
    identity.sources.push({dataset:source.dataset,
      sourceLastRow:puente.summary.lastRowOnRead,
      mirrorLastRow:datos.length,
      identityReadySourceRows:puente.summary.identityReadyRows,
      blockedSourceRows:puente.summary.blockedIdentityRows,
      missingIdRows:puente.summary.missingIdRows.slice(0,10),
      duplicateSourceIdRows:puente.summary.duplicateIdRows.map(x=>x.row).slice(0,10)});

    const filaEncabezado = buscarFilaEncabezado(datos);
    const encabezados = datos[filaEncabezado];

    function col(nombre) {
      return obtenerColumna(encabezados, [nombre]);
    }

    const colFecha = obtenerColumna(encabezados, [
      "Fecha",
      "Fecha del Parte Diario",
      "Fecha Parte Diario",
      "Fecha del parte diario",
      "Fecha del parte"
    ]);

    if (colFecha === -1) {
      throw new Error("No se encontró la columna de fecha en: " + nombreHoja);
    }

    for (let i = filaEncabezado + 1; i < datos.length; i++) {
      const fila = datos[i];
      const fisica=i+1;
      const original=originalPorFila.get(fisica);
      // Verificar posición con el mismo conjunto de 36 columnas que expone
      // el IMPORTRANGE B:AK. La diferencia impide activar cualquier escritor,
      // pero no detiene la vista previa: queda cuantificada como revisión.
      let mirrorOk=!!original;
      if (mirrorOk) {
        for(let n=0;n<36;n++) {
          if(dmV9Serializar_(fila[n])!==dmV9Serializar_(original.legacyColumns[n])) {
            mirrorOk=false; break;
          }
        }
      }
      identity.rowsChecked++;
      if(!mirrorOk) {
        identity.mirrorUnmatched++;
        if(identity.mirrorFirstMismatches.length<12)identity.mirrorFirstMismatches.push({dataset:source.dataset,row:fisica});
      }
      const fecha = fila[colFecha];
      if (!fechaValidaDesdeCorte(fecha)) continue;

      const mes = obtenerMesAnio(fecha);
      const equipo = valorColumna(fila, col("Equipo"));
      const sinProductividad = excluirProductividad(equipo);
      // Un parte ROP02 puede tener horas operativas sin que aún se hayan cargado
      // tareas de productividad. No genera ROP05 y NO equivale a DELETE.
      const anyTaskFilled = [1,2,3].some(function(t){
        var taskCol=col('Tarea '+t);
        return taskCol!==-1 && String(fila[taskCol]||'').trim()!=='';
      });
      if(obtenerNumero(valorColumna(fila,col('Cant. Hs.')))>0 && !anyTaskFilled)
        identity.rop02HoursNoTaskYet++;

      for (let t = 1; t <= 3; t++) {
        const colTarea = col(`Tarea ${t}`);
        if (colTarea === -1) continue;

        const tarea = valorColumna(fila, colTarea);
        if (!tarea) continue;

        const tareaNorm = normalizarTexto(tarea);
        const valorLargo = valorColumna(fila, col(`Largo ${t}`));
        const valorAncho = valorColumna(fila, col(`Ancho ${t}`));
        const valorProfundidad = valorColumna(fila, col(`Profundidad ${t}`));
        const valorTotal = valorColumna(fila, col(`Total ${t}`));

        const largo = obtenerNumero(valorLargo);
        const ancho = obtenerNumero(valorAncho);
        const profundidad = obtenerNumero(valorProfundidad);
        const total = obtenerNumero(valorTotal);

        const unidadOriginal = valorColumna(fila, col(`Unidad ${t}`));
        const unidad = normalizarTexto(unidadOriginal);
        const hsProductivas = valorColumna(fila, col(`Hs ${t}`));

        // Horas del parte ROP02 != horas productivas de la tarea. Si la tarea
        // se carga después, el mismo ID+t aparecerá recién cuando esté lista.
        if (obtenerNumero(hsProductivas) <= 0) {
          identity.taskWithoutProductiveHoursYet++;
          continue;
        }

        // Distinguimos un valor no ingresado de un 0 explícito. Los equipos
        // exentos y las unidades HS tienen su regla propia de productividad.
        // IMPORTANTE: no cambia el cálculo legado ni las 15 columnas ROP05.
        const rawMeasureEntered = [valorLargo, valorAncho, valorProfundidad, valorTotal]
          .some(function(v){return !estaVacio(v);});
        const productivityState = sinProductividad || unidad==='HS'
          ? 'READY'
          : !unidad ? 'WAITING_UNIT'
          : !rawMeasureEntered ? 'WAITING_MEASURE'
          : 'READY';
        const produccionHS = obtenerProduccionHS(fila, t);

        const dimensionesEnBlanco =
          estaVacio(valorLargo) &&
          estaVacio(valorAncho) &&
          estaVacio(valorProfundidad);

        let produccion = "";

        if (!sinProductividad) {
          if (unidad === "HS") {
            produccion = obtenerNumero(produccionHS);
          } else if (dimensionesEnBlanco) {
            produccion = total;
          } else if (
            tareaNorm.includes("CARGA") &&
            tareaNorm.includes("DESCARGA") &&
            tareaNorm.includes("CAMION")
          ) {
            produccion = total;
          } else if (largo !== 0 && ancho !== 0 && profundidad !== 0) {
            produccion = largo * ancho * profundidad;
          } else if (largo !== 0 && ancho !== 0) {
            produccion = largo * ancho;
          } else if (largo !== 0) {
            produccion = largo;
          } else if (total !== 0) {
            produccion = total;
          }
        }

        const supervisor = valorColumna(fila, col("Supervisor Delta"));
        const proyecto = valorColumna(fila, col("Proyecto"));
        const interno = valorColumna(fila, col("Interno"));
        const parte = valorColumna(fila, col("N° Parte"));
        const observaciones = valorColumna(fila, col("Observaciones"));

        const clave = [
          fecha.getTime(),
          proyecto,
          interno,
          parte,
          equipo,
          tarea,
          hsProductivas,
          largo,
          ancho,
          profundidad,
          produccion,
          unidadOriginal
        ].join("|");

        if (clavesAgregadas.has(clave)) {
          clavesDuplicadasDescartadas++;
          identity.suppressedLegacyRows++;
          continue;
        }
        clavesAgregadas.add(clave);

        const registroROP05 = [
          fecha,
          supervisor,
          proyecto,
          interno,
          parte,
          equipo,
          tarea,
          hsProductivas,
          largo,
          ancho,
          profundidad,
          produccion,
          unidadOriginal,
          observaciones,
          mes
        ];
        salida.push(registroROP05);
        const task3MissingInMirror=dmV9Task3UnmirroredV1_(t,original);
        if(task3MissingInMirror)identity.task3UnmirroredBlocked++;
        const status=mirrorOk&&original&&original.status==='IDENTITY_READY'&&!task3MissingInMirror
          ? 'IDENTITY_READY' : 'REVIEW_REQUIRED';
        if(productivityState!=='READY'){
          identity.outputAwaitingProductivity++;
          if(productivityState==='WAITING_UNIT')identity.outputAwaitingUnit++;
          else identity.outputAwaitingMeasure++;
        }
        metadataPorRegistro.set(registroROP05,{dataset:source.dataset,
          sourceRow:fisica,sourceId:original?original.sourceId:null,
          taskNumber:t,taskId:status==='IDENTITY_READY'
            ? source.dataset+':'+original.sourceId+':t'+t : null,
          status:status,productivityState:productivityState,
          blockedReason:task3MissingInMirror?'TASK3_EXTRA_COLUMNS_NOT_MIRRORED':'SOURCE_ID_OR_MIRROR'});
      }
    }
  });

  const ultimaFila = destino.getLastRow();
  const datosAntesSync = ultimaFila >= FILA_INICIO_DESTINO
    ? destino.getRange(FILA_INICIO_DESTINO, 1, ultimaFila - FILA_INICIO_DESTINO + 1, 15).getValues()
    : [];
  const datosViejos = datosAntesSync.filter(fila =>
    fila[0] instanceof Date && !fechaValidaDesdeCorte(fila[0])
  );
  const datosFinales = datosViejos.concat(salida);
  datosFinales.sort((a, b) => {
    const fechaA = a[0] instanceof Date ? a[0].getTime() : 0;
    const fechaB = b[0] instanceof Date ? b[0].getTime() : 0;
    if (fechaA !== fechaB) return fechaA - fechaB;
    const proyectoA = String(a[2] || "");
    const proyectoB = String(b[2] || "");
    if (proyectoA !== proyectoB) return proyectoA.localeCompare(proyectoB);
    const supervisorA = String(a[1] || "");
    const supervisorB = String(b[1] || "");
    if (supervisorA !== supervisorB) return supervisorA.localeCompare(supervisorB);
    return String(a[3] || "").localeCompare(String(b[3] || ""));
  });
  const plan = dmV9PlanificarTramos_(datosAntesSync, datosFinales, FILA_INICIO_DESTINO);
  // Asignación por referencia de ARRAY: sort() reordena las mismas instancias,
  // por lo que el vínculo con el ID original no depende de source_row de ROP05.
  datosFinales.forEach((row,idx)=>{
    const meta=metadataPorRegistro.get(row);
    if(!meta)return; // datos anteriores al corte, preservados tal como estaban
    if(meta.status==='IDENTITY_READY')identity.outputReady++;
    else {
      identity.outputBlocked++;
      if(identity.outputBlockedFirst.length<12)
        identity.outputBlockedFirst.push({dataset:meta.dataset,sourceRow:meta.sourceRow,task:meta.taskNumber,reason:meta.blockedReason});
    }
  });
  const resumen = {
    ok:true, mode:aplicar?'APPLY_CONTROLLED':'DRY_RUN_NO_WRITES',
    sourceRows:lecturasOrigen, currentLastRow:ultimaFila,
    historicalPreserved:datosViejos.length,
    candidateOutputRows:datosFinales.length,
    changedRows:plan.changedRowCount,
    contiguousWriteRanges:plan.ranges.length,
    trailingRowsToClear:plan.trailingClearCount,
    duplicateContentKeysSuppressedByLegacyLogic:clavesDuplicadasDescartadas,
    firstRanges:plan.ranges.slice(0,5).map(x=>({firstRow:x.firstRow,rows:x.values.length})),
    productionWrites:0,
    identity:identity,
    notes:'ID AppSheet original enlazado en memoria a cada tarea, sin alterar 15 columnas; NO es ACK ni autoriza escrituras.'
  };
  if (!aplicar) {
    // 4E: el manifest solo sale al invocador EXPLÍCITO del outbox de pruebas.
    // La previsualización habitual sigue mostrando solamente el resumen.
    if (collectManifest === true) {
      if (identity.mirrorUnmatched !== 0) throw new Error('4E BLOQUEADA: la vista IMPORTRANGE difiere de la fuente original');
      identity.sources.forEach(function(src){
        if(src.sourceLastRow !== src.mirrorLastRow)
          throw new Error('4E BLOQUEADA: source/mirror incompletos '+src.dataset);
      });
      const manifest=[];
      const unique=new Set();
      datosFinales.forEach(function(row){
        const m=metadataPorRegistro.get(row);
        if (!m || m.status !== 'IDENTITY_READY') return;
        if(!m.sourceId || !m.taskId || !Number.isInteger(m.taskNumber) || m.taskNumber<1 || m.taskNumber>3)
          throw new Error('4E BLOQUEADA: identidad inválida');
        if(unique.has(m.taskId))throw new Error('4E BLOQUEADA: clave de tarea repetida: '+m.dataset);
        unique.add(m.taskId);
        const canonical=JSON.stringify(row.slice(0,15).map(dmV9Serializar_));
        manifest.push({dataset:m.dataset,sourceId:String(m.sourceId),taskId:m.taskId,
          task:m.taskNumber,sourceRow:m.sourceRow,digest:dmV9U4eSha256_(canonical),
          productivityState:m.productivityState||'READY',payloadCanonical:canonical});
      });
      if(manifest.length!==identity.outputReady)throw new Error('4E BLOQUEADA: conteo de identidad inconsistente');
      Logger.log('4B+4C + 4E: manifiesto listo; '+manifest.length+' identidades, sin escrituras productivas.');
      return {summary:resumen,manifest:manifest};
    }
    Logger.log(JSON.stringify(resumen,null,2));
    return resumen;
  }
  // El escritor V9 requiere nueva implementación transaccional + ACK con IDs.
  // La autorización manual de 4B antigua NO basta para usar un nuevo puente.
  throw new Error('ESCRITURAS BLOQUEADAS: faltan identidad sin excepciones, ACK y plan de corte; solo previsualizar.');
  // Revalidar antes de tocar Sheets: el productor original puede actualizar por lotes.
  lecturasOrigen.forEach(s=>{
    const sh=ss.getSheetByName(s.nombre);
    if (!sh || sh.getLastRow()!==s.filas) throw new Error('FUENTE CAMBIO DURANTE PLANIFICACION: '+s.nombre);
  });
  if (destino.getLastRow()!==ultimaFila) throw new Error('DESTINO CAMBIO DURANTE PLANIFICACION: no escribir');
  const relectura = datosAntesSync.length
    ? destino.getRange(FILA_INICIO_DESTINO,1,datosAntesSync.length,15).getValues() : [];
  if (!dmV9ArraysIguales_(relectura,datosAntesSync))
    throw new Error('CONTENIDO DESTINO CAMBIO DURANTE PLANIFICACION: no escribir');
  const ultimoNecesario=FILA_INICIO_DESTINO+datosFinales.length-1;
  if (ultimoNecesario>destino.getMaxRows())
    destino.insertRowsAfter(destino.getMaxRows(),ultimoNecesario-destino.getMaxRows());
  plan.ranges.forEach(r=>destino.getRange(r.firstRow,1,r.values.length,15).setValues(r.values));
  if (plan.trailingClearCount>0) {
    destino.getRange(FILA_INICIO_DESTINO+datosFinales.length,1,plan.trailingClearCount,15).clearContent();
  }
  if (plan.ranges.length>0) {
    // Respetar formato original solo en las nuevas ventanas, no reformatear 5.000 filas.
    plan.ranges.forEach(r=>{
      destino.getRange(r.firstRow,1,r.values.length,1).setNumberFormat('dd/mm/yyyy');
      destino.getRange(r.firstRow,15,r.values.length,1).setNumberFormat('@');
    });
  }
  SpreadsheetApp.flush();
  const longitud=Math.max(datosAntesSync.length,datosFinales.length);
  const datosDespues=longitud>0
    ? destino.getRange(FILA_INICIO_DESTINO,1,longitud,15).getValues() : [];
  const planDelta=dmV9CalcularCambios_(datosAntesSync,datosDespues,FILA_INICIO_DESTINO);
  // Conservamos el contrato del endpoint legado V7.7.1. NO es aún el protocolo ACK de V9.
  const sync=dmV9EnviarCambios_(ss.getId(),destino.getSheetId(),planDelta,'generarROP05NuevoV9');
  resumen.productionWrites=plan.ranges.length+(plan.trailingClearCount?1:0);
  resumen.deltaUpserts=planDelta.upserts.length;
  resumen.deltaDeletes=planDelta.deleteSourceRows.length;
  resumen.syncOk=sync.ok===true;
  resumen.syncPending=sync.pending===true;
  resumen.externalAckV9=false;
  Logger.log(JSON.stringify(resumen,null,2));
  return resumen;
}

/** Nunca crea triggers. Deja la producción completamente intacta. */
function generarROP05NuevoV9Previsualizar() {
  return dmV9GenerarROP05Core_(false);
}

/** Bloqueada de fábrica. NO ejecutar antes de un corte planificado con un único escritor. */
function generarROP05NuevoV9Aplicar() {
  const lock=LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Otro proceso de V9 utiliza el mismo ScriptLock');
  try {return dmV9GenerarROP05Core_(true);} finally {lock.releaseLock();}
}

function dmV9GuardAplicar_() {
  if (PropertiesService.getScriptProperties().getProperty('DM_ROP05_V9_WRITE_GATE')!=='CUTOVER_APPROVED_WITH_ROLLBACK') {
    throw new Error('BLOQUEADO: fase 4B habilitada solo para vista previa, sin escrituras');
  }
  if (!PropertiesService.getScriptProperties().getProperty('DM_ROP05_WEBHOOK_TOKEN')) {
    throw new Error('Falta DM_ROP05_WEBHOOK_TOKEN en ScriptProperties; nunca pegar secretos al codigo');
  }
}

function dmV9Serializar_(v) {
  if (v instanceof Date && !isNaN(v.getTime()))
    return [v.getFullYear(),String(v.getMonth()+1).padStart(2,'0'),String(v.getDate()).padStart(2,'0')].join('-');
  if (v===null||v===undefined)return '';
  let s=String(v).trim();
  if (/^'\d{2}\/\d{4}$/.test(s))s=s.slice(1);
  return s;
}
function dmV9Iguales_(a,b) {
  for(let i=0;i<15;i++) if(dmV9Serializar_((a||[])[i])!==dmV9Serializar_((b||[])[i]))return false;
  return true;
}
function dmV9ArraysIguales_(a,b) {
  return a.length===b.length && a.every((x,i)=>dmV9Iguales_(x,b[i]));
}
function dmV9TieneDatos_(fila) {
  return (fila||[]).some(v=>v!==''&&v!==null&&v!==undefined);
}
function dmV9PlanificarTramos_(antes,despues,filaInicio) {
  antes=Array.isArray(antes)?antes:[];
  despues=Array.isArray(despues)?despues:[];
  let ranges=[],current=null,changedRowCount=0;
  for(let i=0;i<despues.length;i++){
    if(dmV9Iguales_(antes[i],despues[i])) {current=null;continue;}
    changedRowCount++;
    if(!current||current.values.length>=100){current={firstRow:filaInicio+i,values:[]};ranges.push(current);}
    current.values.push(despues[i].slice(0,15));
  }
  return {ranges,changedRowCount,trailingClearCount:Math.max(0,antes.length-despues.length)};
}
function dmV9CalcularCambios_(antes,despues,filaInicio) {
  const upserts=[],deleteSourceRows=[];
  for(let i=0;i<Math.max(antes.length,despues.length);i++) {
    const a=antes[i]||[],b=despues[i]||[],source_row=filaInicio+i;
    if(dmV9TieneDatos_(b)) {
      if(!dmV9TieneDatos_(a)||!dmV9Iguales_(a,b))
        upserts.push({source_row,values:b.slice(0,15).map(dmV9Serializar_)});
    }else if(dmV9TieneDatos_(a))deleteSourceRows.push(source_row);
  }
  return {upserts,deleteSourceRows};
}

function dmV9ParseJsonResponse_(response) {
  var code = response.getResponseCode();
  var body = String(response.getContentText() || "");
  var parsed;

  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new Error(
      "Respuesta no JSON (HTTP " +
      code +
      "): " +
      body.slice(0, 500)
    );
  }

  if (
    code >= 200 &&
    code < 300 &&
    parsed &&
    parsed.ok === true
  ) {
    return parsed;
  }

  var message =
    parsed && parsed.error
      ? (
          parsed.error.message ||
          parsed.error.code ||
          JSON.stringify(parsed.error)
        )
      : (body || ("HTTP " + code));

  throw new Error("HTTP " + code + ": " + message);
}


/**
 * Envía únicamente el delta.
 * Si no hay cambios, retorna NOOP local sin llamar a Supabase.
 */
function dmV9EnviarCambios_(
  spreadsheetId,
  gid,
  plan,
  source
) {
  plan = plan || {};

  var upserts = Array.isArray(plan.upserts)
    ? plan.upserts
    : [];

  var deleteSourceRows = Array.isArray(plan.deleteSourceRows)
    ? plan.deleteSourceRows
    : [];

  if (
    upserts.length === 0 &&
    deleteSourceRows.length === 0
  ) {
    return {
      ok: true,
      immediate: true,
      incremental: true,
      noop: true,
      dataset: "rop05",
      upserts: 0,
      deletes: 0,
      message: "Sin cambios reales; no se llamó a Supabase."
    };
  }

  var payload = {
    action: "delta",
    dataset: "rop05",
    spreadsheetId: String(spreadsheetId || ""),
    gid: Number(gid),
    source: String(source || "generarROP05Nuevo"),
    upserts: upserts,
    deleteSourceRows: deleteSourceRows
  };

  var body = JSON.stringify(payload);
  var lastError = null;

  for (var intento = 1; intento <= 3; intento++) {
    try {
      var response = UrlFetchApp.fetch(
        String(PropertiesService.getScriptProperties().getProperty('DM_V9_SYNC_ENDPOINT_URL')||''),
        {
          method: "post",
          contentType: "application/json",
          headers: {
            "X-Delta-Sync-Token": PropertiesService.getScriptProperties().getProperty('DM_ROP05_WEBHOOK_TOKEN')
          },
          payload: body,
          muteHttpExceptions: true,
          followRedirects: true
        }
      );

      return dmV9ParseJsonResponse_(response);

    } catch (err) {
      lastError = err;

      if (intento < 3) {
        Utilities.sleep(intento * 750);
      }
    }
  }

  console.error(
    "ROP05 se actualizó correctamente en Sheets, pero el sync incremental " +
    "con Supabase quedó PENDIENTE. La reconciliación autoritativa lo " +
    "recuperará. " +
    (lastError ? lastError.message : "")
  );

  return {
    ok: false,
    pending: true,
    incremental: true,
    dataset: "rop05",
    upserts: upserts.length,
    deletes: deleteSourceRows.length,
    error: lastError ? lastError.message : "desconocido"
  };
}




/**
 * DELTA OPS V9 / 4E - Outbox SOMBRA PERSISTENTE de ROP05.
 * - SOLO al ejecutar dmV9OutboxSombraV1Ejecutar crea/actualiza UN LIBRO NUEVO de pruebas.
 * - Nunca modifica ROP02, ROP05, Supabase (sandbox o producción) ni triggers.
 * - No transmite ni guarda datos completos de los partes: únicamente tarea (ID de AppSheet),
 *   versión, SHA-256 de las 15 columnas canónicas, posición orientativa y estado SIN ACK.
 * - Nunca marca ACK. No usa HTTP. No es un escritor productivo.
 * - El historial es append-only. Ante caída parcial, siguiente corrida vuelve a leer
 *   las versiones persistidas y solo agrega las que falten.
 * - NO convertir automáticamente en DELETE un parte que falta en una lectura transitoria.
 */
var DM_V9_4E_PROP_ID_='DM_U4E_SHADOW_OUTBOX_SPREADSHEET_ID';
var DM_V9_4E_MAGIC_='DELTA_OPS_V9_OUTBOX_SHADOW_V1';
var DM_V9_4E_OUTBOX_='VERSIONES_SOMBRA';
function dmV9U4eProductionIds_(){
 var names=["DM_V9_ROP05_BOOK_ID","DM_V9_ROP02_JM_BOOK_ID","DM_V9_ROP02_FS_BOOK_ID","DM_V9_PRODUCTION_GUARD_4_ID","DM_V9_PRODUCTION_GUARD_5_ID"];
 var props=PropertiesService.getScriptProperties();
 var ids=names.map(function(key){return String(props.getProperty(key)||'').trim();});
 if(ids.some(function(id){return !/^[A-Za-z0-9_-]{30,}$/.test(id);})||new Set(ids).size!==ids.length)
   throw new Error('V9 BLOQUEADO: configurar IDs productivos y guardas 4E en ScriptProperties');
 return ids;
}
var DM_V9_4E_PRODUCTION_IDS_={
 includes:function(id){return dmV9U4eProductionIds_().includes(id);},
 indexOf:function(id){return dmV9U4eProductionIds_().indexOf(id);}
}
var DM_V9_4E_HEADER_=['dataset','task_key','revision','payload_sha256','state','source_row_hint','observed_at_utc','record_kind'];
function dmV9U4eGuard_(condition,message){if(!condition)throw new Error('FASE 4E BLOQUEADA: '+message);}
function dmV9U4eSha256_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8)
 .map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');}
function dmV9U4eGetOrCreateBook_(props){
 var id=props.getProperty(DM_V9_4E_PROP_ID_);
 var ss;
 if(!id){
   ss=SpreadsheetApp.create('DELTA OPS V9 - OUTBOX SOMBRA 4E - PRUEBAS');
   dmV9U4eGuard_(DM_V9_4E_PRODUCTION_IDS_.indexOf(ss.getId())===-1,'libro no es de pruebas');
   var sheet=ss.getSheets()[0];sheet.setName(DM_V9_4E_OUTBOX_);
   sheet.getRange(1,1,1,DM_V9_4E_HEADER_.length).setValues([DM_V9_4E_HEADER_]);
   var meta=ss.insertSheet('__META_V9');
   meta.getRange(1,1,2,2).setValues([['marker',DM_V9_4E_MAGIC_],['created_at',new Date().toISOString()]]);
   SpreadsheetApp.flush();
   props.setProperty(DM_V9_4E_PROP_ID_,ss.getId());
 } else {
   dmV9U4eGuard_(!DM_V9_4E_PRODUCTION_IDS_.includes(id),'propiedad referencia un libro productivo');
   ss=SpreadsheetApp.openById(id);
 }
 dmV9U4eGuard_(!!ss && !DM_V9_4E_PRODUCTION_IDS_.includes(ss.getId()),'destino inseguro');
 var versions=ss.getSheetByName(DM_V9_4E_OUTBOX_);
 var meta=ss.getSheetByName('__META_V9');
 dmV9U4eGuard_(!!versions && !!meta && meta.getRange(1,2).getValue()===DM_V9_4E_MAGIC_,
   'no coincide marca del libro de pruebas');
 var header=versions.getRange(1,1,1,DM_V9_4E_HEADER_.length).getValues()[0];
 dmV9U4eGuard_(header.every(function(x,i){return x===DM_V9_4E_HEADER_[i];}),'encabezados outbox alterados');
 return {spreadsheet:ss,sheet:versions};
}
/** Construye revisiones SIN efectos externos; se usa también en tests. */
function dmV9U4ePlan_(stored,manifest,now){
 dmV9U4eGuard_(Array.isArray(stored)&&Array.isArray(manifest),'colecciones inválidas');
 var previous=new Map(),seenRevisions=new Set();
 stored.forEach(function(r){
   var key=String(r[1]||''),rev=Number(r[2]),digest=String(r[3]||'');
   dmV9U4eGuard_(/^(rop02_jm|rop02_fs):[^:]+:t[123]$/.test(key),'clave persistida inválida');
   dmV9U4eGuard_(Number.isSafeInteger(rev)&&rev>=1&&rev<=100000,'revisión persistida inválida');
   dmV9U4eGuard_(/^[a-f0-9]{64}$/.test(digest),'digest persistido inválido');
   var pair=key+'#'+rev;dmV9U4eGuard_(!seenRevisions.has(pair),'versión duplicada en libro');
   seenRevisions.add(pair);
   var old=previous.get(key);if(!old||rev>old.rev)previous.set(key,{rev:rev,digest:digest,rowHint:Number(r[5])});
 });
 var seen=new Set(),append=[],created=0,changed=0,unchanged=0,shifted=0;
 manifest.forEach(function(m){
   dmV9U4eGuard_(m&&['rop02_jm','rop02_fs'].includes(m.dataset),'dataset inválido');
   dmV9U4eGuard_(typeof m.sourceId==='string'&&/^[A-Za-z0-9_-]{4,90}$/.test(m.sourceId),'ID original inválido');
   dmV9U4eGuard_(Number.isInteger(m.task)&&m.task>=1&&m.task<=3,'tarea inválida');
   var key=m.dataset+':'+m.sourceId+':t'+m.task;
   dmV9U4eGuard_(key===m.taskId,'clave incoherente');
   dmV9U4eGuard_(/^[a-f0-9]{64}$/.test(m.digest),'SHA-256 inválido');
   dmV9U4eGuard_(!seen.has(key),'tarea duplicada en lote');seen.add(key);
   var prev=previous.get(key);
   if(prev&&prev.digest===m.digest){unchanged++;if(prev.rowHint!==Number(m.sourceRow))shifted++;return;}
   var rev=prev?prev.rev+1:1;
   dmV9U4eGuard_(rev<=100000,'demasiadas revisiones');
   append.push([m.dataset,key,rev,m.digest,prev?'SHADOW_REVISION_NO_ACK':'SHADOW_BASELINE_NO_ACK',
       Number(m.sourceRow),now,'ROP05_TASK']);
   if(prev)changed++;else created++;
 });
 var missing=0;previous.forEach(function(_,key){if(!seen.has(key))missing++;});
 return {append:append,created:created,changed:changed,unchanged:unchanged,shifted:shifted,
   previouslySeenNotInThisSnapshot:missing,totalUniqueTasks:seen.size};
}
/** UNICA funcion que crea el LIBRO de pruebas y persiste hashes versionados. */
function dmV9OutboxSombraV1Ejecutar(){
 var lock=LockService.getScriptLock();
 dmV9U4eGuard_(lock.tryLock(10000),'otra ejecución en el clon');
 try {
   var snapshot=dmV9GenerarROP05Core_(false,true);
   var summary=snapshot.summary,manifest=snapshot.manifest;
   dmV9U4eGuard_(summary.ok===true&&summary.mode==='DRY_RUN_NO_WRITES','generador fuera de modo lectura');
   dmV9U4eGuard_(summary.productionWrites===0,'el generador informó escrituras');
   dmV9U4eGuard_(summary.identity.mirrorUnmatched===0,'espejo no coincide con fuentes');
   dmV9U4eGuard_(manifest.length===summary.identity.outputReady,'salida inconsistente');
   var props=PropertiesService.getScriptProperties();
   var target=dmV9U4eGetOrCreateBook_(props),sheet=target.sheet;
   var end=sheet.getLastRow();
   var rows=end>1?sheet.getRange(2,1,end-1,DM_V9_4E_HEADER_.length).getValues():[];
   var plan=dmV9U4ePlan_(rows,manifest,new Date().toISOString());
   // SOLO a la planilla de pruebas, nunca a archivos de operación.
   for(var i=0;i<plan.append.length;i+=1000){
     var chunk=plan.append.slice(i,i+1000);
     var needed=sheet.getLastRow()+chunk.length;
     if(needed>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),needed-sheet.getMaxRows());
     sheet.getRange(sheet.getLastRow()+1,1,chunk.length,DM_V9_4E_HEADER_.length).setValues(chunk);
   }
   SpreadsheetApp.flush();
   var rowsAfter=sheet.getLastRow();
   dmV9U4eGuard_(rowsAfter===end+plan.append.length,'escritura outbox incompleta: revisar, no borrar');
   var out={ok:true,mode:'PERSISTENT_SHADOW_OUTBOX_ONLY',outboxUrl:target.spreadsheet.getUrl(),
     taskIdentities:plan.totalUniqueTasks,newVersions:plan.append.length,
     baselineNew:plan.created,changedVersion:plan.changed,unchanged:plan.unchanged,
     rowShiftWithoutRevision:plan.shifted,
     previouslySeenNotInThisSnapshot:plan.previouslySeenNotInThisSnapshot,
     excludedAmbiguousTasks:summary.identity.outputBlocked-(summary.identity.task3UnmirroredBlocked||0),
     excludedTask3Unmirrored:summary.identity.task3UnmirroredBlocked||0,
     suppressedByLegacyContentDedup:summary.identity.suppressedLegacyRows,
     ledgerRowsAfter:rowsAfter-1,
     productionWrites:0,supabaseWrites:0,remoteAckCount:0,
     warning:'SOLO OUTBOX SOMBRA: ni envío ni ACK real, no habilita cutover. Ausencias NO son borrados.'};
   Logger.log(JSON.stringify(out,null,2));return out;
 } finally {lock.releaseLock();}
}
/** Diagnóstico pasivo: no crea hojas ni escribe propiedades. */
function dmV9OutboxSombraV1Estado(){
 var id=PropertiesService.getScriptProperties().getProperty(DM_V9_4E_PROP_ID_);
 if(!id)return {ok:true,created:false,productionWrites:0};
 dmV9U4eGuard_(!DM_V9_4E_PRODUCTION_IDS_.includes(id),'propiedad insegura');
 var ss=SpreadsheetApp.openById(id),sh=ss.getSheetByName(DM_V9_4E_OUTBOX_),meta=ss.getSheetByName('__META_V9');
 dmV9U4eGuard_(!!sh&&!!meta&&meta.getRange(1,2).getValue()===DM_V9_4E_MAGIC_,'outbox no verificable');
 var out={ok:true,created:true,url:ss.getUrl(),ledgerRows:sh.getLastRow()-1,productionWrites:0,supabaseWrites:0,remoteAckCount:0};
 Logger.log(JSON.stringify(out,null,2));return out;
}


/**
 * V9 4F / Entregas PREPARADAS en el MISMO libro de outbox sombra 4E.
 * No HTTP, NO ACK, NO Supabase, NO nuevas planillas, NO triggers, NO producción.
 * - Persiste JSON canónico inmutable para poder reproducir revisiones.
 * - No convierte ausencia en borrado.
 * - Deriva UUID estable de (dataset,task_key,revision,digest) para reintentos.
 * - Revisa que la cadena de revisiones tenga su snapshot completo antes de marcar PREPARED_NO_SEND.
 * - Fallo entre escritura en VERSIONES_SOMBRA y ENTREGAS_PREPARADAS recuperable con reejecución.
 * Precaución: ENTREGAS_PREPARADAS contiene datos operativos del parte. No compartir el libro.
 */
var DM_V9_4F_TAB_='ENTREGAS_PREPARADAS';
var DM_V9_4F_HEADER_=['dataset','task_key','revision','payload_sha256','request_id',
  'payload_canonical_json','delivery_state','created_at_utc','last_attempt_at_utc','ack_receipt',
  'last_error_code','source_row_hint'];
var DM_V9_4F_STATES_=['PREPARED_NO_SEND','HISTORY_GAP_NO_SEND','WAITING_PRODUCTIVITY_NO_SEND'];
function dmV9U4fAssert_(cond,message){if(!cond)throw new Error('FASE 4F BLOQUEADA: '+message);}
function dmV9U4fRequestId_(dataset,key,revision,digest){
  var hex=dmV9U4eSha256_('delta-ops-v9/4f/request/v1|'+dataset+'|'+key+'|'+revision+'|'+digest);
  // UUIDv8 estable (formato personalizado SHA-256) para futuros reintentos.
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-8'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20,32);
}
function dmV9U4fLeerEstado_(row){
  dmV9U4fAssert_(Array.isArray(row),'fila de entrega inválida');
  var dataset=String(row[0]||''),key=String(row[1]||''),rev=Number(row[2]),digest=String(row[3]||'');
  var requestId=String(row[4]||''),payload=String(row[5]||''),status=String(row[6]||'');
  dmV9U4fAssert_(dataset==='rop02_jm'||dataset==='rop02_fs','dataset almacenado inválido');
  dmV9U4fAssert_(key.indexOf(dataset+':')===0 && /:t[123]$/.test(key),'clave almacenada inválida');
  dmV9U4fAssert_(Number.isSafeInteger(rev)&&rev>=1,'revisión almacenada inválida');
  dmV9U4fAssert_(/^[a-f0-9]{64}$/.test(digest),'digest almacenado inválido');
  dmV9U4fAssert_(requestId===dmV9U4fRequestId_(dataset,key,rev,digest),'request_id almacenado inconsistente');
  dmV9U4fAssert_(payload.length>1 && payload.length<30000 && dmV9U4eSha256_(payload)===digest,
    'payload persistido no coincide con digest');
  var parsed;
  try {parsed=JSON.parse(payload);}catch(e){throw new Error('FASE 4F BLOQUEADA: JSON persistido inválido');}
  dmV9U4fAssert_(Array.isArray(parsed)&&parsed.length===15&&parsed.every(function(x){return typeof x==='string';}),
    'payload no tiene 15 campos canónicos');
  dmV9U4fAssert_(DM_V9_4F_STATES_.indexOf(status)>=0,'estado inesperado (no modificar manualmente)');
  dmV9U4fAssert_(!row[8]&&!row[9]&&!row[10],'outbox sombra nunca debe contener intentos/ACK');
  return {dataset:dataset,key:key,rev:rev,digest:digest,payload:payload,status:status};
}
function dmV9U4fPlan_(ledger,stored,manifest,now){
  dmV9U4fAssert_(Array.isArray(ledger)&&Array.isArray(stored)&&Array.isArray(manifest),'listas inválidas');
  var byTask=new Map(),knownVersions=new Map(),seenLedger=new Set();
  ledger.forEach(function(r){
    var ds=String(r[0]||''),key=String(r[1]||''),rev=Number(r[2]),digest=String(r[3]||'');
    dmV9U4fAssert_(key.indexOf(ds+':')===0 && /:t[123]$/.test(key),'clave del ledger inválida');
    dmV9U4fAssert_(Number.isSafeInteger(rev)&&rev>=1&&/^[a-f0-9]{64}$/.test(digest),'versión del ledger inválida');
    var pair=key+'#'+rev;
    dmV9U4fAssert_(!seenLedger.has(pair),'ledger con versiones duplicadas');seenLedger.add(pair);
    if(!byTask.has(key))byTask.set(key,[]);
    byTask.get(key).push({rev:rev,digest:digest,dataset:ds});
  });
  byTask.forEach(function(xs,key){
    xs.sort(function(a,b){return a.rev-b.rev;});
    xs.forEach(function(x,i){dmV9U4fAssert_(x.rev===i+1,'salto de revisión en ledger '+key);});
  });
  stored.forEach(function(r,i){
    var parsed=dmV9U4fLeerEstado_(r),pair=parsed.key+'#'+parsed.rev;
    parsed.sheetRow=i+2;
    dmV9U4fAssert_(!knownVersions.has(pair),'entrega duplicada en cola');
    var version=(byTask.get(parsed.key)||[]).find(function(x){return x.rev===parsed.rev;});
    dmV9U4fAssert_(!!version&&version.digest===parsed.digest,'entrega no coincide con ledger');
    knownVersions.set(pair,parsed);
  });
  var append=[],stateUpdates=[],existing=0,gaps=0,awaitingProductivity=0,unrecoverableHistory=0,used=new Set();
  manifest.forEach(function(m){
    dmV9U4fAssert_(m && (m.dataset==='rop02_jm'||m.dataset==='rop02_fs'),'dataset manifiesto inválido');
    var key=String(m.taskId||''),digest=String(m.digest||''),payload=String(m.payloadCanonical||'');
    var productivityState=String(m.productivityState||'READY');
    dmV9U4fAssert_(['READY','WAITING_UNIT','WAITING_MEASURE'].includes(productivityState),
      'estado de productividad inválido');
    dmV9U4fAssert_(key===m.dataset+':'+m.sourceId+':t'+m.task,'clave manifiesto inválida');
    dmV9U4fAssert_(!used.has(key),'identidad repetida en snapshot');used.add(key);
    dmV9U4fAssert_(payload.length>1&&payload.length<30000,'payload demasiado largo o vacío');
    dmV9U4fAssert_(dmV9U4eSha256_(payload)===digest,'digest distinto del payload actual');
    var p;
    try{p=JSON.parse(payload);}catch(e){throw new Error('FASE 4F BLOQUEADA: payload actual sin JSON');}
    dmV9U4fAssert_(Array.isArray(p)&&p.length===15&&p.every(function(x){return typeof x==='string';}),
      'payload actual no tiene 15 columnas');
    var history=byTask.get(key)||[];
    dmV9U4fAssert_(history.length>0,'tarea no registrada en VERSIONES_SOMBRA');
    var current=history[history.length-1],rev=current.rev;
    dmV9U4fAssert_(current.digest===digest,'versión sombra difiere del snapshot actual; ejecutar 4E');
    var pair=key+'#'+rev,existingRow=knownVersions.get(pair);
    // Las revisiones 4E son BORRADORES; una revisión anterior pendiente pero
    // con JSON persistido NO es un hueco histórico. Sin embargo, las entregas
    // remotas necesitarán una secuencia de revisiones propia antes del cutover.
    var complete=true;
    for(var n=1;n<rev;n++){
      var earlier=knownVersions.get(key+'#'+n);
      if(!earlier || earlier.status==='HISTORY_GAP_NO_SEND'){
        complete=false;unrecoverableHistory++;
      }
    }
    var status=!complete?'HISTORY_GAP_NO_SEND'
      : productivityState==='READY'?'PREPARED_NO_SEND':'WAITING_PRODUCTIVITY_NO_SEND';
    if(!complete)gaps++;
    if(productivityState!=='READY')awaitingProductivity++;
    if(existingRow){
      dmV9U4fAssert_(existingRow.digest===digest&&existingRow.payload===payload,'entrega ya persistida difiere');
      if(existingRow.status!==status){
        // Cambió el ESTADO, no el contenido; NO crear revisión falsa, tampoco ACK.
        stateUpdates.push({sheetRow:existingRow.sheetRow,from:existingRow.status,to:status});
      }
      existing++;return;
    }
    append.push([m.dataset,key,rev,digest,dmV9U4fRequestId_(m.dataset,key,rev,digest),payload,
      status,now,'','','',Number(m.sourceRow)]);
  });
  return {append:append,stateUpdates:stateUpdates,alreadyPrepared:existing,historyGaps:gaps,awaitingProductivity:awaitingProductivity,missingHistoricalPayloads:unrecoverableHistory,
    identitiesChecked:used.size,stored:knownVersions.size};
}
function dmV9Outbox4fPrepararEntregasV1(){
  var lock=LockService.getScriptLock();
  dmV9U4fAssert_(lock.tryLock(10000),'otra ejecución en curso');
  try{
    var props=PropertiesService.getScriptProperties();
    var configured=props.getProperty(DM_V9_4E_PROP_ID_);
    dmV9U4fAssert_(!!configured,'outbox 4E aún no existe; no crear otra planilla');
    dmV9U4fAssert_(DM_V9_4E_PRODUCTION_IDS_.indexOf(configured)===-1,'destino productivo prohibido');
    var snapshot=dmV9GenerarROP05Core_(false,true);
    dmV9U4fAssert_(snapshot&&snapshot.summary&&snapshot.summary.ok===true&&
      snapshot.summary.mode==='DRY_RUN_NO_WRITES'&&snapshot.summary.productionWrites===0,
      'generador no está en lectura');
    dmV9U4fAssert_(snapshot.summary.identity.mirrorUnmatched===0,'fuentes y espejos no coinciden');
    dmV9U4fAssert_(snapshot.manifest.length===snapshot.summary.identity.outputReady,'conteo identidad incoherente');
    var book=dmV9U4eGetOrCreateBook_(props);
    dmV9U4fAssert_(book.spreadsheet.getId()===configured,'libro sombra inesperado');
    var ledger=book.sheet,ledgerLast=ledger.getLastRow(),now=new Date().toISOString();
    var prior=ledgerLast>1?ledger.getRange(2,1,ledgerLast-1,DM_V9_4E_HEADER_.length).getValues():[];
    var updates=dmV9U4ePlan_(prior,snapshot.manifest,now);
    // Registrar versiones nuevas ANTES de preparar payload. Si falla la segunda escritura,
    // una ejecución posterior completa las entregas que aún falten.
    dmV9U4fAppend_(ledger,updates.append,DM_V9_4E_HEADER_.length,750);
    SpreadsheetApp.flush();
    var ledgerAfter=ledger.getLastRow();
    dmV9U4fAssert_(ledgerAfter===ledgerLast+updates.append.length,'ledger incompleto');
    var fullLedger=prior.concat(updates.append);
    var queue=book.spreadsheet.getSheetByName(DM_V9_4F_TAB_);
    if(!queue){
      queue=book.spreadsheet.insertSheet(DM_V9_4F_TAB_);
      queue.getRange(1,1,1,DM_V9_4F_HEADER_.length).setValues([DM_V9_4F_HEADER_]);
    }
    var header=queue.getRange(1,1,1,DM_V9_4F_HEADER_.length).getValues()[0];
    dmV9U4fAssert_(header.every(function(x,i){return x===DM_V9_4F_HEADER_[i];}), 'encabezados de entregas modificados');
    var before=queue.getLastRow();
    var pending=before>1?queue.getRange(2,1,before-1,DM_V9_4F_HEADER_.length).getValues():[];
    var plan=dmV9U4fPlan_(fullLedger,pending,snapshot.manifest,now);
    dmV9U4fAppend_(queue,plan.append,DM_V9_4F_HEADER_.length,350);
    SpreadsheetApp.flush();
    dmV9U4fAssert_(queue.getLastRow()===before+plan.append.length,'entregas parcialmente grabadas; reejecutar mismo método');
    // Permite completar productividad DIAS DESPUES aunque el payload canónico
    // y su SHA no cambien (celda vacía -> cero explícito). Solo se actualiza el
    // estado en columna G del libro privado; jamás se modifica JSON o digest.
    dmV9U4fActualizarEstados_(queue,plan.stateUpdates);
    SpreadsheetApp.flush();
    var out={ok:true,mode:'LOCAL_DELIVERY_PREPARED_NO_SEND',outboxUrl:book.spreadsheet.getUrl(),
      identitiesSnapshot:plan.identitiesChecked,preparedNew:plan.append.length,
      alreadyPrepared:plan.alreadyPrepared,stateTransitions:plan.stateUpdates.length,
      ledgerNewVersions:updates.append.length,
      ledgerTotalVersions:ledgerAfter-1,deliveryRows:queue.getLastRow()-1,
      historyGaps:plan.historyGaps,missingHistoricalPayloads:plan.missingHistoricalPayloads,
      awaitingProductivity:plan.awaitingProductivity,
      rop02HoursNoTaskYet:snapshot.summary.identity.rop02HoursNoTaskYet,
      taskWithoutProductiveHoursYet:snapshot.summary.identity.taskWithoutProductiveHoursYet,
      excludedAmbiguousTasks:snapshot.summary.identity.outputBlocked-(snapshot.summary.identity.task3UnmirroredBlocked||0),
      excludedTask3Unmirrored:snapshot.summary.identity.task3UnmirroredBlocked||0,
      suppressedByLegacyContentDedup:snapshot.summary.identity.suppressedLegacyRows,
      productionWrites:0,supabaseWrites:0,realAckCount:0,
      warning:'SOLO COLA LOCAL con payload de 15 columnas. NO SE ENVIO NINGUN PARTE. NO habilita cutover.'};
    Logger.log(JSON.stringify(out,null,2));return out;
  } finally{lock.releaseLock();}
}
/** Estado mutable, payload/hash/revision INMUTABLES; es reanudable. */
function dmV9U4fActualizarEstados_(sheet,updates){
  if(!updates || updates.length===0)return;
  var expected={},rows=updates.map(function(x){return x.sheetRow;});
  var last=sheet.getLastRow();
  dmV9U4fAssert_(rows.every(function(r){return Number.isInteger(r)&&r>=2&&r<=last;}),'fila de estado inválida');
  updates.forEach(function(x){
    dmV9U4fAssert_(DM_V9_4F_STATES_.indexOf(x.from)>=0&&DM_V9_4F_STATES_.indexOf(x.to)>=0,'transición inválida');
    dmV9U4fAssert_(expected[x.sheetRow]===undefined,'fila repetida en transiciones');
    expected[x.sheetRow]=x.from;
  });
  var current=sheet.getRange(2,7,last-1,1).getValues();
  updates.forEach(function(x){
    // Idempotencia tras crash entre escrituras: el estado destino también es válido.
    var state=current[x.sheetRow-2][0];
    dmV9U4fAssert_(state===x.from||state===x.to,'estado cambió externamente');
  });
  // Grabar solo estados G de filas afectadas. No alterar comprobantes ni datos.
  updates.forEach(function(x){
    if(current[x.sheetRow-2][0]!==x.to)sheet.getRange(x.sheetRow,7,1,1).setValues([[x.to]]);
  });
}
function dmV9U4fAppend_(sheet,rows,columns,batchSize){
  for(var i=0;i<rows.length;i+=batchSize){
    var block=rows.slice(i,i+batchSize),last=sheet.getLastRow(),needed=last+block.length;
    if(needed>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),needed-sheet.getMaxRows());
    sheet.getRange(last+1,1,block.length,columns).setValues(block);
  }
}
/** SOLO LECTURA: reporta estructura y cantidades, no crea archivos. */
function dmV9Outbox4fEstadoV1(){
  var props=PropertiesService.getScriptProperties(),id=props.getProperty(DM_V9_4E_PROP_ID_);
  dmV9U4fAssert_(!!id&&!DM_V9_4E_PRODUCTION_IDS_.includes(id),'libro 4E inválido');
  var book=dmV9U4eGetOrCreateBook_(props);
  var sh=book.spreadsheet.getSheetByName(DM_V9_4F_TAB_);
  var result={ok:true,bookUrl:book.spreadsheet.getUrl(),prepared:!!sh,
    deliveryRows:sh?sh.getLastRow()-1:0,productionWrites:0,supabaseWrites:0,remoteAckCount:0};
  Logger.log(JSON.stringify(result));return result;
}