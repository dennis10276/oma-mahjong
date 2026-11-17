"""Explain a failed own-level geometry job; bounded, no deal/layout generation."""
import json,sys,z3,time
j=json.load(open(sys.argv[1],encoding='utf-8-sig'));p=[tuple(t) for t in j['sites']];index={t:i for i,t in enumerate(p)}
s=z3.Solver();s.set(timeout=10000);v=[z3.Bool('p'+str(i)) for i in range(len(p))];cells={}
for i,(x,y,z) in enumerate(p):
 for dx in (0,1):
  for dy in (0,1):cells.setdefault((x+dx,y+dy,z),[]).append(i)
for ids in cells.values():s.add(z3.AtMost(*[v[i] for i in ids],1))
for i,(x,y,z) in enumerate(p):
 if not z:continue
 for dx in (0,1):
  for dy in (0,1):s.add(z3.Implies(v[i],z3.Or([v[k] for k in cells.get((x+dx,y+dy,z-1),[])])))
 if (x,y,z-1) in index:s.add(z3.Not(z3.And(v[i],v[index[x,y,z-1]])))
for z,limit in j.get('highLimits',[]):s.add(z3.PbLe([(v[i],1) for i,t in enumerate(p) if t[2]>=z],limit))
labels=[];meaning={}
for k,t in enumerate(j.get('hardFixed',[]) if j.get('softFixed') else j['fixed']):
 a=z3.Bool('fixed'+str(k));labels.append(a);meaning[str(a)]=t;s.add(z3.Implies(a,v[index[tuple(t)]]) if tuple(t) in index else z3.Not(a))
if '--prefix' in sys.argv:
 earlier=set();initial_free_phase=False
 for t in j.get('prefix',[])+sum((['reset']+q for q in j.get('prefixes',[])),[])+[None]+j.get('free',[]):
  if t=='reset':earlier=set();initial_free_phase=False;continue
  if t is None:earlier=set();initial_free_phase=True;continue
  x,y,z=t;key=tuple(t);a=z3.Bool('free'+str(len(labels)));labels.append(a);meaning[str(a)]=['free',t]
  if key not in index:s.add(z3.Not(a));continue
  above=[v[i] for i,q in enumerate(p) if q not in earlier and q[2]>z and abs(q[0]-x)<2 and abs(q[1]-y)<2]
  left=[v[i] for i,q in enumerate(p) if q not in earlier and q[2]==z and q[0]==x-2 and abs(q[1]-y)<2]
  right=[v[i] for i,q in enumerate(p) if q not in earlier and q[2]==z and q[0]==x+2 and abs(q[1]-y)<2]
  s.add(z3.Implies(a,z3.And(v[index[key]],z3.Not(z3.Or(above)),z3.Not(z3.And(z3.Or(left),z3.Or(right))))))
  if not initial_free_phase:earlier.add(key)
if '--count' in sys.argv:s.add(z3.PbEq([(a,1) for a in v],j['count']))
if '--at-most' in sys.argv:s.add(z3.PbLe([(a,1) for a in v],j['count']))
if '--at-least' in sys.argv:s.add(z3.PbGe([(a,1) for a in v],j['count']))
t0=time.time();r=s.check(labels);out={'result':str(r),'ms':round((time.time()-t0)*1000)}
if r==z3.sat:out['tiles']=sum(1 for a in v if z3.is_true(s.model().eval(a)))
if r==z3.unsat:
 core=list(s.unsat_core());s.set(timeout=1000)
 for a in list(core):
  if time.time()-t0>20:break
  other=[b for b in core if str(a)!=str(b)]
  if s.check(other)==z3.unsat:core=other
 out['conflictingRequirements']=[meaning[str(a)] for a in core]
print(json.dumps(out))
