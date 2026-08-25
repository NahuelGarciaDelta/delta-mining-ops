import json
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime
import requests

BASE_URL = "https://script.google.com/macros/s/AKfycbxU-ihsxXTNn2wa5EO1OkSM5FjJ43MwxSx8dY0RjbnJRFBKF0BiNNq7QsuohWxmmeOhog/exec"


def norm_text(v):
    s = str(v or "").strip().upper()
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"[^A-Z0-9]+", " ", s).strip()


def norm_code(v):
    return re.sub(r"[^A-Z0-9]+", "", norm_text(v))


def pick_exact(row, names):
    normalized = {norm_text(k): k for k in row.keys()}
    for name in names:
        k = normalized.get(norm_text(name))
        if k is not None:
            return row.get(k)
    return ""


def pick(row, names):
    value = pick_exact(row, names)
    if value not in (None, ""):
        return value
    keys = list(row.keys())
    for name in names:
        wanted = norm_text(name)
        for k in keys:
            nk = norm_text(k)
            if wanted and nk and (wanted in nk or nk in wanted):
                return row.get(k)
    return ""


def to_num(v):
    if v in (None, ""):
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(" ", "")
    if not s:
        return 0.0
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    else:
        parts = s.split(".")
        if len(parts) > 1 and all(len(p) == 3 for p in parts[1:]):
            s = "".join(parts)
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_date(v):
    s = str(v or "").strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%d-%m-%y"):
        try:
            return datetime.strptime(s[:24] if "T" in fmt else s, fmt)
        except ValueError:
            pass
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})", s)
    if m:
        y = int(m.group(3)); y = y + 2000 if y < 100 else y
        return datetime(y, int(m.group(2)), int(m.group(1)))
    return None


def fmt_date(v):
    d = parse_date(v)
    return d.strftime("%d/%m/%y") if d else str(v or "").strip()


def project(v):
    t = norm_text(v)
    compact = t.replace(" ", "")
    if "JOSE MARIA" in t or "JOSEMARIA" in compact or re.search(r"\bJM\b", t):
        return "JOSE MARIA"
    if "FILO DEL SOL" in t or "FILODELSOL" in compact or re.search(r"\b(FS|FDS)\b", t):
        return "FILO DEL SOL"
    if "FILO SUR" in t or "FILOSUR" in compact:
        return "FILO SUR"
    if "EL ZORRO" in t or "ELZORRO" in compact:
        return "EL ZORRO"
    if "OFICINA" in t or "DEPOSITO" in t or "ADMIN" in t:
        return "OFICINA"
    return t


def get_json(params):
    r = requests.get(BASE_URL, params=params, timeout=120, allow_redirects=True)
    r.raise_for_status()
    data = r.json()
    if not data.get("ok"):
        raise RuntimeError(data)
    return data.get("data") or []


def post_json(payload):
    r = requests.post(BASE_URL, data={"payload": json.dumps(payload, ensure_ascii=False)}, timeout=180, allow_redirects=True)
    r.raise_for_status()
    data = r.json()
    if not data.get("ok"):
        raise RuntimeError(data)
    return data


def load_remitos(flat_rows):
    grouped = {}
    for row in flat_rows:
        rid = str(pick(row, ["ID_REMITO", "idRemito", "id"]) or "").strip()
        code = str(pick(row, ["CODIGO_ARTICULO", "codigoArticulo", "codigo"]) or "").strip()
        qty = to_num(pick(row, ["CANTIDAD_ENVIADA", "cantidadEnviada", "cantidad"]))
        if not rid or not code or qty <= 0:
            continue
        if rid not in grouped:
            obs = str(pick(row, ["OBSERVACIONES", "observaciones"]) or "").strip()
            dest = str(pick(row, ["DESTINO", "destino"]) or "").strip()
            orig = str(pick(row, ["ORIGEN", "origen"]) or "").strip()
            prj_raw = pick(row, ["PROYECTO", "proyecto"]) or obs or dest or orig
            grouped[rid] = {
                "id": rid,
                "numero": str(pick(row, ["N_REMITO", "nRemito", "comprobante"]) or "S/N").strip(),
                "fecha": str(pick(row, ["FECHA_REMITO", "fechaRemito", "fecha"]) or "").strip(),
                "proyecto": project(prj_raw),
                "items": [],
            }
        grouped[rid]["items"].append({"code": norm_code(code), "qty": qty})
    return list(grouped.values())


def normalize_requests(raw_rows):
    out = []
    for idx, row in enumerate(raw_rows):
        code = str(pick(row, ["Código de articulo", "Código de artículo", "Codigo de articulo", "Codigo de artículo", "Código artículo", "Codigo articulo", "Código", "Codigo"]) or "").strip()
        qty = to_num(pick(row, ["Cant. Solicitada", "Cantidad solicitada", "Cant Solicitada", "Cantidad"]))
        pedido = str(pick_exact(row, ["N° de pedido", "Nº de pedido", "N de pedido", "Numero de pedido", "Número de pedido"]) or "").strip()
        solicitud_legacy = str(pick_exact(row, ["N° de solicitud", "Nº de solicitud", "N de solicitud", "Numero de solicitud", "Número de solicitud", "Solicitud"]) or "").strip()
        nsol = pedido or solicitud_legacy
        fecha = str(pick(row, ["Fecha de solicitud", "Fecha solicitud", "F. Sol."]) or "").strip()
        prj = project(pick(row, ["Centro de Costo", "Centro de costo", "Proyecto", "CC"]))
        if not code or not nsol or qty <= 0:
            continue
        out.append({
            "idx": idx,
            "nSolicitud": nsol,
            "code": norm_code(code),
            "proyecto": prj,
            "fecha": fecha,
            "fecha_dt": parse_date(fecha),
            "solicitada": qty,
            "enviada": 0.0,
            "matches": [],
            "raw": row,
        })
    return out


def allocate(requests_rows, remitos):
    queues = defaultdict(list)
    for req in requests_rows:
        if req["code"] and req["proyecto"]:
            queues[(req["code"], req["proyecto"])].append(req)
    for q in queues.values():
        q.sort(key=lambda x: (x["fecha_dt"] or datetime.min, x["idx"]))

    shipments = []
    for rix, rem in enumerate(remitos):
        d = parse_date(rem["fecha"])
        for iix, item in enumerate(rem["items"]):
            shipments.append({
                "code": item["code"], "proyecto": rem["proyecto"], "qty": item["qty"],
                "fecha": rem["fecha"], "fecha_dt": d, "numero": rem["numero"],
                "rix": rix, "iix": iix,
            })
    shipments.sort(key=lambda s: (s["fecha_dt"] or datetime.min, s["rix"], s["iix"]))

    unmatched = 0.0
    for sh in shipments:
        remaining = sh["qty"]
        q = queues.get((sh["code"], sh["proyecto"]), [])
        for req in q:
            if remaining <= 1e-9:
                break
            if req["fecha_dt"] and sh["fecha_dt"] and req["fecha_dt"] > sh["fecha_dt"]:
                continue
            pending = max(0.0, req["solicitada"] - req["enviada"])
            if pending <= 1e-9:
                continue
            applied = min(pending, remaining)
            req["enviada"] += applied
            req["matches"].append({"numero": sh["numero"], "fecha": fmt_date(sh["fecha"]), "cantidad": applied})
            remaining -= applied
        unmatched += max(0.0, remaining)
    return unmatched


def payload_from_requests(reqs):
    rows = []
    for r in reqs:
        nums = []
        dates = []
        for m in r["matches"]:
            if m["numero"] and m["numero"] not in nums:
                nums.append(m["numero"])
            if m["fecha"] and m["fecha"] not in dates:
                dates.append(m["fecha"])
        rows.append({
            "nSolicitud": r["nSolicitud"],
            "cantidadEnviada": round(r["enviada"], 6),
            "numeroRemito": " / ".join(nums),
            "fechaSalida": " / ".join(dates),
            "cantidad": round(sum(m["cantidad"] for m in r["matches"]), 6),
        })
    return rows


def main():
    print("Leyendo RABA03 y remitos...", flush=True)
    raw_raba = get_json({"action": "raba03", "limit": "all", "force": "1", "_": int(datetime.now().timestamp())})
    raw_rem = get_json({"action": "remitos_cargados", "limit": "all", "force": "1", "_": int(datetime.now().timestamp())})
    reqs = normalize_requests(raw_raba)
    remitos = load_remitos(raw_rem)
    print(f"RABA03 raw={len(raw_raba)} solicitudes válidas={len(reqs)} remitos={len(remitos)}", flush=True)

    before = {r["nSolicitud"]: to_num(pick(r["raw"], ["Cant. enviada", "Cantidad enviada", "Cant enviada"])) for r in reqs}
    unmatched = allocate(reqs, remitos)
    payload_rows = payload_from_requests(reqs)
    changed = [r for r in reqs if abs(before.get(r["nSolicitud"], 0)-r["enviada"]) > 1e-6]
    reopened = [r for r in changed if before.get(r["nSolicitud"], 0) > 0 and r["enviada"] == 0]
    print(f"Filas a corregir={len(changed)}; vuelven a 0 enviada={len(reopened)}; envío sin solicitud restante={unmatched:.2f}", flush=True)

    result = post_json({"action": "save_raba03_cant_enviada", "rows": payload_rows})
    print("Respuesta guardado:", json.dumps(result, ensure_ascii=False)[:2000], flush=True)

    # Verificación contra la base física después de guardar.
    raw_after = get_json({"action": "raba03", "limit": "all", "force": "1", "_": int(datetime.now().timestamp()) + 1})
    after_map = {}
    for row in raw_after:
        pedido = str(pick_exact(row, ["N° de pedido", "Nº de pedido", "N de pedido", "Numero de pedido", "Número de pedido"]) or "").strip()
        legacy = str(pick_exact(row, ["N° de solicitud", "Nº de solicitud", "N de solicitud", "Numero de solicitud", "Número de solicitud", "Solicitud"]) or "").strip()
        nsol = pedido or legacy
        if nsol:
            after_map[nsol] = to_num(pick(row, ["Cant. enviada", "Cantidad enviada", "Cant enviada"]))
    mismatches = []
    for row in payload_rows:
        got = after_map.get(row["nSolicitud"], 0.0)
        if abs(got - row["cantidadEnviada"]) > 1e-6:
            mismatches.append((row["nSolicitud"], row["cantidadEnviada"], got))
    print(f"Verificación: {len(payload_rows)-len(mismatches)}/{len(payload_rows)} filas coinciden.", flush=True)
    if mismatches:
        print("Primeras diferencias:", mismatches[:20], flush=True)
        sys.exit(2)
    print("CORRECCIÓN HISTÓRICA COMPLETADA Y VERIFICADA", flush=True)


if __name__ == "__main__":
    main()
