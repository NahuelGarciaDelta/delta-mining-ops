// DELTA OPS V9 INDEPENDIENTE — bloquea toda ruta heredada de V8.1.
// No se realizan solicitudes externas ni lecturas/escrituras de producción.
export default function handler(_req,res){
  res.setHeader("Cache-Control","no-store, max-age=0");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.status(410).json({ok:false,error:"V9_LEGACY_ROUTE_PERMANENTLY_DISABLED"});
}
