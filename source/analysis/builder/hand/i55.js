module.exports = {
 "id": "i55",
 "title": "Save the escape",
 "idea": "A face-down tile and a free tile beside the way make an easy pair early on. But the face-down tile is the escape you need at the full tray: spend it now and the tile you need later is the 4th.",
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
  0
 ],
 "target": 11,
 "limit": 15,
 "fixed": {
  "0": "p60",
  "4": "p60",
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
 "tests": [
  {
   "name": "dig",
   "expect": "win",
   "peekForced": true
  },
  {
   "name": "spent",
   "expect": "none",
   "gone": [
    53,
    0
   ],
   "tray0": []
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
  "baits": [
   {
    "at": "auto",
    "take": [
     53,
     0
    ],
    "why": "take the easy face-down pair early"
   }
  ]
 }
};