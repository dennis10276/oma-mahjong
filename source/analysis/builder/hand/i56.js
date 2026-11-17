module.exports = {
 "id": "i56",
 "title": "The escape is gold-locked",
 "idea": "At the full tray a face-down twin is the way on, but it is gold-locked; its keys are two tiles of the dig - take them as a pair before the tray fills.",
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
  12
 ],
 "target": 11,
 "limit": 15,
 "fixed": {
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
 "locks": [
  53
 ],
 "keys": [
  13,
  63
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
