"""Proposal only: fixed-budget, family-adjusted precision screen; not protected approval."""
import math

def outcomes(campaigns):
    if not isinstance(campaigns,list) or len(campaigns)<2:
        raise ValueError('At least two campaigns required')
    result=[]
    for c in campaigns:
        if not isinstance(c,dict) or 'wonOn' not in c:
            raise ValueError('Missing outcome')
        w=c['wonOn']
        if w is not None and (type(w) is not int or not 1<=w<=8):
            raise ValueError('Invalid attempt')
        if c.get('status')=='unresolved' or any(h.get('status')=='unresolved' for h in c.get('history',[])):
            raise ValueError('Numerical censoring is not noClear')
        result.append(9 if w is None else w)
    return result

def compute_half_split_w1(campaigns):
    values=outcomes(campaigns); half=len(values)//2
    a,b=values[:half],values[half:]
    return sum(abs(sum(v<=k for v in a)/len(a)-sum(v<=k for v in b)/len(b)) for k in range(1,9))

def score(p,a):
    a=min(a,8)
    return int((p>=8 and a>=8) or abs(p-a)<=(0 if a<=3 else 1 if a<=5 else 2))

def best(values):
    return max(range(1,9),key=lambda p:(sum(score(p,a) for a in values),-p))

def precision_report(campaigns, planned_count, epsilon=.05, delta=.05, family_size=96):
    values=outcomes(campaigns)
    if type(planned_count) is not int or planned_count<2 or len(values)!=planned_count:
        raise ValueError('Use all campaigns from a fixed preregistered budget; adaptive stopping unsupported')
    if not 0<epsilon<1 or not 0<delta<1 or type(family_size) is not int or family_size<1:
        raise ValueError('Invalid precision protocol')
    bound=math.sqrt(math.log(2*8*family_size/delta)/(2*len(values)))
    h=len(values)//2
    consistent=best(values[:h])==best(values[h:])
    return {'campaigns':len(values),'scoreErrorBound':bound,'epsilon':epsilon,'familyDelta':delta,
        'requiredFixedCampaigns':math.ceil(math.log(2*8*family_size/delta)/(2*epsilon**2)),
        'halfSplitW1':compute_half_split_w1(campaigns),'halfDecisionsAgree':consistent,
        'precisionSatisfied':bound<=epsilon and consistent,
        'protectedApproval':False,'limitation':'Requires independent reproducible seed/variability and preregistration audit; this is not prospective human accuracy.'}
