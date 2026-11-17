"""Assign original tile identities to their reshaped spots; pictures never change."""
import json, sys, os, warnings
os.environ['OMP_NUM_THREADS']='1'
os.environ['OPENBLAS_NUM_THREADS']='1'
import numpy as np
from scipy.optimize import milp, LinearConstraint, Bounds
from scipy.sparse import coo_matrix
j=json.load(open(sys.argv[1],encoding='utf-8-sig')); ids=j['ids']; sites=j['tiles']; n=len(ids)
fixed={int(i):p for i,p in j['fixed']};var={};cost=[];lb=[];ub=[]
down=set(j['down']);free=set(j['free']);oldfree=set(j['oldFree']);pairs=[]
for i,id in enumerate(ids):
 for p,t in enumerate(sites):
  if str(id) in j.get('allowedSites',{}) and p not in j['allowedSites'][str(id)]:continue
  if id in fixed and fixed[id]!=p:continue
  if id not in fixed and p in fixed.values():continue
  if t[2]>2 and t[2]>j['original'][i][2]:continue
  if id in down and p in free and id not in oldfree and not j.get('allowDownFree',False):continue
  var[i,p]=len(cost);pairs.append((i,p))
  orig=j['original'][i]
  c=sum(abs(orig[k]-t[k])*(1 if k<2 else 2) for k in range(3))*.1
  c+=8*((id in oldfree)!=(p in free))
  c+=abs(j['oldDepth'][i]-len(j['above'][p]))*.3
  cost.append(c+((i*7+p*3+j.get('seed',0))%17)*.0001);lb.append(0);ub.append(1)
rr=[];cc=[];vv=[];lo=[];hi=[]
def row(v,l=-np.inf,h=np.inf):
 r=len(lo);lo.append(l);hi.append(h)
 for k,x in v.items():
  if x:rr.append(r);cc.append(k);vv.append(x)
for i in range(n):row({v:1 for (ii,p),v in var.items() if ii==i},1,1)
for p in range(n):row({v:1 for (i,pp),v in var.items() if pp==p},1,1)
def ranks(q,p):return {v:q[ids[i]] for (i,pp),v in var.items() if pp==p}
def subtract(a,b):
 v=dict(a)
 for k,x in b.items():v[k]=v.get(k,0)-x
 return v
for qi,q in enumerate(j['ranks']):
 R=[ranks(q,p) for p in range(n)]
 limit=(j.get('prefixLimits') or [None]*len(j['ranks']))[qi]
 if qi==0:
  for tile,need,neighbors in j.get('iceOrders',[]):
   if limit is None or q[tile]<limit:
    row({v:1 for (i,p),v in var.items() if p in neighbors and q[ids[i]]<q[tile]},need)
 P=[{v:n+1 for (i,pp),v in var.items() if pp==p and q[ids[i]]<limit} for p in range(n)] if limit is not None else None
 def activate(v,p):
  if P is not None:
   for k,x in P[p].items():v[k]=v.get(k,0)+x
  return v
 for p in range(n):
  for a in j['above'][p]:row(activate(subtract(R[a],R[p]),p),h=n if P is not None else -1)
  left,right=j['left'][p],j['right'][p]
  if left and right:
   b=len(cost);cost.append(0);lb.append(0);ub.append(1)
   for a in left:
    v=subtract(R[a],R[p]);v[b]=-n-1;row(activate(v,p),h=n if P is not None else -1)
   for a in right:
    v=subtract(R[a],R[p]);v[b]=n+1;row(activate(v,p),h=2*n+1 if P is not None else n)
groups={}
for i,f in enumerate(j['faces']):groups.setdefault(f,[]).append(i)
for p,q in j['closeVisible']:
 for group in groups.values():
  v={var[i,t]:1 for i in group if ids[i] not in down for t in (p,q) if (i,t) in var}
  if len(v)>1:row(v,h=1)
A=coo_matrix((vv,(rr,cc)),shape=(len(lo),len(cost))).tocsc()
with warnings.catch_warnings():
 warnings.simplefilter('ignore',RuntimeWarning)
 r=milp(np.array(cost),integrality=np.ones(len(cost)),bounds=Bounds(lb,ub),constraints=LinearConstraint(A,lo,hi),options={'time_limit':j.get('seconds',45),'threads':1,'node_limit':100000,'mip_rel_gap':.02})
out={'ok':r.x is not None,'status':int(r.status),'message':r.message,'variables':len(cost),'constraints':len(lo)}
if r.x is not None:out['assignment']=[[ids[i],p] for (i,p),v in var.items() if r.x[v]>.5]
json.dump(out,open(sys.argv[2],'w'))
