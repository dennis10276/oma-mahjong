module.exports = {
 "id": "i31",
 "title": "Unlock the escape first",
 "idea": "At the full tray a face-down twin is the way on, but it is silver-locked; the silver keys are a pair that needs a free slot. Open it before the tray fills.",
 "layout": 1022,
 "block": [
  63,
  45,
  61,
  39,
  49,
  13,
  70,
  56,
  53,
  37,
  69,
  54,
  33,
  12,
  0,
  1
 ],
 "target": 11,
 "limit": 17,
 "fixed": {
  "0": "silver",
  "1": "silver",
  "11": "p99",
  "12": "p5",
  "13": "p2",
  "33": "p1",
  "37": "p4",
  "39": "p3",
  "45": "p3",
  "49": "p4",
  "53": "p60",
  "54": "p0",
  "56": "p60",
  "61": "p5",
  "63": "p2",
  "69": "p1",
  "70": "p0"
 },
 "free": [],
 "down": [
  53
 ],
 "locks2": [
  53
 ],
 "keys2": [
  0,
  1
 ],
 "tests": [
  {
   "name": "dig",
   "expect": "win",
   "peekForced": true
  }
 ],
 "hand": {
  "clock": 11,
  "peek": true,
  "peekNeeded": true,
  "spare": 1,
  "routeTest": "dig",
  "downTiles": [
   53
  ],
  "baits": []
 }
};
