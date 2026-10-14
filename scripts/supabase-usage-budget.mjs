// Offline monitoring: export DAILY increments from Usage; no DB/network requests.
import fs from 'node:fs';
export function usageBudget(input){
 const day=86400000,start=Date.parse(input.cycleStart+'T00:00:00Z'),end=Date.parse(input.cycleEndExclusive+'T00:00:00Z'),asOf=Date.parse(input.lastCompleteDay+'T00:00:00Z');
 const days=(asOf-start)/day+1,cycleDays=(end-start)/day;
 if(!Number.isInteger(days)||days<1||!Number.isInteger(cycleDays)||asOf>=end)throw Error('Invalid cycle/complete day');
 if(!Number.isFinite(input.uncachedLimitBytes)||input.uncachedLimitBytes<=0||!input.projects?.length)throw Error('Dashboard limit and ALL organization projects are required');
 const refs=new Set();let total=0,cached=0;
 for(const project of input.projects){if(!project.ref||refs.has(project.ref))throw Error('Duplicate/missing project');refs.add(project.ref);const entries=new Map();for(const x of project.daily){if(entries.has(x.date))throw Error('Duplicate daily increment');entries.set(x.date,x)}
  for(let i=0;i<days;i++){const date=new Date(start+i*day).toISOString().slice(0,10),x=entries.get(date);if(!x)throw Error('Missing daily usage '+project.ref+' '+date);for(const key of ['uncachedEgressBytes','cachedEgressBytes'])if(!Number.isFinite(x[key])||x[key]<0)throw Error('Invalid daily bytes');total+=x.uncachedEgressBytes;cached+=x.cachedEgressBytes;}}
 const average=total/days,projected=average*cycleDays,target=input.targetBytes??3600000000,growth=input.growthFactor??1.2;
 if(!Number.isFinite(target)||target<=0||!Number.isFinite(growth)||growth<1)throw Error('Invalid target/growth');
 return{source:'User supplied dashboard exports; no API billing verification',observedDays:days,cycleDays,organizationProjects:refs.size,accumulatedUncachedBytes:total,accumulatedCachedBytes:cached,dailyAverageUncachedBytes:average,projectedUncachedBytes:projected,growthAdjustedProjectionBytes:projected*growth,remainingUncachedBytes:input.uncachedLimitBytes-total,remainingDailyBudgetBytes:cycleDays>days?(Math.min(target,input.uncachedLimitBytes)-total)/(cycleDays-days):null,projectedWithinLimit:projected<=input.uncachedLimitBytes,growthAdjustedWithinLimit:projected*growth<=input.uncachedLimitBytes,targetMet:projected<=target,otherQuotas:input.otherQuotas??[],limitation:'Egress projection only. Other quotas require independent values from Usage; MAU/gauges must not be summed across daily snapshots.'};
}
if(process.argv[1]?.endsWith('supabase-usage-budget.mjs')){if(!process.argv[2])throw Error('Usage: node scripts/supabase-usage-budget.mjs /private/usage.json');console.log(JSON.stringify(usageBudget(JSON.parse(fs.readFileSync(process.argv[2]))),null,2))}
