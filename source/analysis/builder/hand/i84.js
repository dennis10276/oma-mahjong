module.exports = {
 "id": "i84",
 "title": "Both face-down keys",
 "idea": "The clock is gold-locked; its keys are the tile you need at the full tray and its face-down twin far away. The pair that saves the tray also opens the clock.",
 "layout": 1000,
 "block": [
  71,
  69,
  65,
  54,
  22,
  50,
  61,
  44,
  66,
  23,
  58,
  38,
  46
 ],
 "target": 24,
 "limit": 14,
 "fixed": {
  "20": "p100",
  "22": "p4",
  "23": "p2",
  "24": "p99",
  "38": "p3",
  "44": "p60",
  "46": "p0",
  "50": "p4",
  "54": "p3",
  "58": "p0",
  "61": "p100",
  "65": "p1",
  "66": "p60",
  "69": "p2",
  "71": "p1"
 },
 "free": [],
 "down": [
  66,
  44
 ],
 "locks": [
  24
 ],
 "keys": [
  66,
  44
 ],
 "tests": [
  {
   "name": "dig",
   "expect": "win",
   "peekForced": true
  }
 ],
 "hand": {
  "clock": 24,
  "peek": true,
  "peekNeeded": true,
  "spare": 1,
  "routeTest": "dig",
  "downTiles": [
   66,
   44
  ],
  "baits": []
 }
};
