# Writes the scipy goldens for packages/core/test/stats. Run: uv run --with scipy python scripts/golden.py
import json, math
from scipy import special, stats
out = {}
out["lgamma"] = [[x, float(special.gammaln(x))] for x in [0.5, 1, 1.5, 2, 3.7, 10, 100.25, 1234.5, 1e6]]
out["betainc"] = [[a, b, x, float(special.betainc(a, b, x))] for (a, b, x) in [(1,1,0.3),(2,3,0.4),(0.5,0.5,0.2),(10,20,0.3),(150,24850,0.006),(1,999,0.001),(500,500,0.49),(5000.5,3.25,0.999)]]
out["binomCdf"] = [[k, n, p, float(stats.binom.cdf(k, n, p))] for (k, n, p) in [(0,10,0.1),(3,10,0.5),(140,25000,0.006),(160,25000,0.006),(800,1707,0.5),(10,1000,0.006)]]
def cp(x, n, conf):
    a = 1 - conf
    lo = 0.0 if x == 0 else float(stats.beta.ppf(a/2, x, n-x+1))
    hi = 1.0 if x == n else float(stats.beta.ppf(1-a/2, x+1, n-x))
    return [x, n, conf, lo, hi]
out["clopperPearson"] = [cp(*t) for t in [(0,50,0.95),(5,50,0.95),(50,50,0.95),(150,25000,0.999),(853,1707,0.999),(1,1,0.95)]]
out["normQuantile"] = [[p, float(stats.norm.ppf(p))] for p in [0.5, 0.8, 0.975, 0.9995, 0.999, 1e-6, 0.02425, 0.97575]]
out["binomTwoSided"] = [[x, n, p, float(min(1.0, 2*min(stats.binom.cdf(x,n,p), stats.binom.sf(x-1,n,p))))] for (x,n,p) in [(150,25000,0.006),(100,25000,0.006),(200,25000,0.006),(853,1707,0.5),(760,1707,0.5)]]
json.dump(out, open("packages/core/test/stats/golden.json", "w"), indent=1)
