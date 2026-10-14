"""Manual/daily read-only diagnostic snapshot. No Edge invokes or data mutations."""
import json
import os
import sys
import urllib.request
import urllib.error

PROJECT = 'jwfocqaxlckuxoklwyxs'
BASE = 'https://api.supabase.com'

def request(path, query=None):
    token = os.environ.get('SUPABASE_ACCESS_TOKEN')
    if not token:
        raise RuntimeError('Configure SUPABASE_ACCESS_TOKEN securely; never put it in CLI arguments.')
    data = json.dumps({'query': query, 'read_only': True}).encode() if query else None
    req = urllib.request.Request(BASE + path, data=data, headers={
        'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'
    }, method='POST' if query else 'GET')
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return {'status': response.status, 'data': json.load(response)}
    except urllib.error.HTTPError as error:
        return {'status': error.code, 'error': 'Access/service error; no credentials exported'}

def collect():
    projects = request('/v1/projects')
    if isinstance(projects.get('data'), list):
        projects['data'] = [{k: p.get(k) for k in ['id', 'name', 'organization_id']} for p in projects['data']]
    functions = request(f'/v1/projects/{PROJECT}/functions')
    if isinstance(functions.get('data'), list):
        functions['data'] = [{k: f.get(k) for k in ['id', 'slug', 'version', 'status']} for f in functions['data']]
    jobs = request(f'/v1/projects/{PROJECT}/database/query',
        "SELECT jobid,jobname,schedule,active,substring(command from '/functions/v1/([A-Za-z0-9_-]+)') AS edge_function FROM cron.job ORDER BY jobid")
    counts = request(f'/v1/projects/{PROJECT}/analytics/endpoints/usage.api-counts?interval=7day')
    return {'kind': 'Real Management API read-only snapshot; NOT billed egress',
            'project': PROJECT, 'projects': projects, 'functions': functions,
            'cronJobsWithoutCommandsOrSecrets': jobs, 'apiCounts7dayWindow': counts,
            'limitation': 'Window can include partial-day buckets. No 30-day billing bytes returned; use Usage export for budget script.'}

if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python3 scripts/collect-supabase-diagnostics.py /private/new-snapshot.json')
    # Exclusive create preserves historical observations and never overwrites user files.
    snapshot = collect()
    with open(sys.argv[1], 'x', encoding='utf8') as output:
        json.dump(snapshot, output, indent=2)
    print('Read-only diagnostic snapshot saved; no functions invoked or data changed.')
