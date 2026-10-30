// Independent V9 must never dispatch to legacy API endpoints.
export default function handler(_req,res){
  res.setHeader("Cache-Control","no-store");
  res.status(403).json({ok:false,error:"V9_LEGACY_ENDPOINT_DISABLED"});
}
