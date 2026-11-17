"""Reshape the supplied board only. No layout catalogue and no picture dealing."""
import json, sys, os, warnings
os.environ['OMP_NUM_THREADS']='1'
os.environ['OPENBLAS_NUM_THREADS']='1'
import numpy as np
from scipy.optimize import milp, LinearConstraint, Bounds
from scipy.sparse import coo_matrix

job=json.load(open(sys.argv[1],encoding='utf-8-sig'))
sites=[tuple(p) for p in job['sites']]; index={p:i for i,p in enumerate(sites)}; n=len(sites)
rr=[];cc=[];vv=[];lower=[];upper=[]
def row(vals,lo=-np.inf,hi=np.inf):
 r=len(lower);lower.append(lo);upper.append(hi)
 for c,v in vals.items():
  if v:rr.append(r);cc.append(c);vv.append(v)
row({i:1 for i in range(n)},job['count'],job['count'])
cells={}
for i,(x,y,z) in enumerate(sites):
 for dx in (0,1):
  for dy in (0,1): cells.setdefault((x+dx,y+dy,z),[]).append(i)
for ids in cells.values():row({i:1 for i in ids},hi=1)
for i,(x,y,z) in enumerate(sites):
 if z:
  for dx in (0,1):
   for dy in (0,1):
    v={i:1}
    for j in cells.get((x+dx,y+dy,z-1),[]):v[j]=v.get(j,0)-1
    row(v,hi=0)
  below=index.get((x,y,z-1))
  if below is not None:row({i:1,below:1},hi=1)
for z,limit in job['highLimits']:
 row({i:1 for i,p in enumerate(sites) if p[2]>=z},hi=limit)
lb=np.zeros(n);ub=np.ones(n)
for p in job.get('hardFixed',[]):
 if tuple(p) not in index:
  json.dump({'ok':False,'why':'hard fixed position excluded','position':p},open(sys.argv[2],'w'));sys.exit()
 lb[index[tuple(p)]]=1
for p in job['fixed']:
 if tuple(p) not in index:
  if job.get('softFixed',False):continue
  json.dump({'ok':False,'why':'fixed position excluded','position':p},open(sys.argv[2],'w'));sys.exit()
 if not job.get('softFixed',False):lb[index[tuple(p)]]=1
old={tuple(p) for p in job['original']}
cost=np.array([-4 if p in old else 1+min(sum(abs(p[k]-q[k])*(1 if k<2 else 2) for k in range(3)) for q in old)*.01 for p in sites],dtype=float)
if job.get('softFixed',False):
 for p in job['fixed']:
  if tuple(p) in index:cost[index[tuple(p)]]-=1000
cost+=np.array([((i*17+job.get('seed',0)*13)%29)*.0001 for i in range(n)])
earlier=set();initial_free_phase=False
actions=job.get('prefix',[])+sum((['reset']+q for q in job.get('prefixes',[])),[])+[None]+job.get('free',[])
for p0 in actions:
 if p0=='reset':earlier=set();initial_free_phase=False;continue
 if p0 is None:earlier=set();initial_free_phase=True;continue
 p=tuple(p0)
 if p not in index:
  json.dump({'ok':False,'why':'prefix position excluded','position':p0},open(sys.argv[2],'w'));sys.exit()
 lb[index[p]]=1
 x,y,z=p
 above=[i for i,q in enumerate(sites) if q not in earlier and q[2]>z and abs(q[0]-x)<2 and abs(q[1]-y)<2]
 if above:row({i:1 for i in above},hi=0)
 left=[i for i,q in enumerate(sites) if q not in earlier and q[2]==z and q[0]==x-2 and abs(q[1]-y)<2]
 right=[i for i,q in enumerate(sites) if q not in earlier and q[2]==z and q[0]==x+2 and abs(q[1]-y)<2]
 if left and right:
  b=len(cost);cost=np.append(cost,0);lb=np.append(lb,0);ub=np.append(ub,1)
  v={i:1 for i in left};v[b]=-len(left);row(v,hi=0)
  v={i:1 for i in right};v[b]=len(right);row(v,hi=len(right))
 if not initial_free_phase:earlier.add(p)
A=coo_matrix((vv,(rr,cc)),shape=(len(lower),len(cost))).tocsc()
with warnings.catch_warnings():
 warnings.simplefilter('ignore',RuntimeWarning)
 result=milp(cost,integrality=np.ones(len(cost)),bounds=Bounds(lb,ub),constraints=LinearConstraint(A,lower,upper),options={'time_limit':job.get('seconds',45),'node_limit':100000,'threads':1,'mip_rel_gap':.05})
out={'ok':result.x is not None,'status':int(result.status),'message':result.message,'variables':n,'constraints':len(lower)}
if result.x is not None:out.update(tiles=[list(sites[i]) for i,x in enumerate(result.x[:n]) if x>.5],objective=float(result.fun))
json.dump(out,open(sys.argv[2],'w'))
