module.exports = {
 "id": "i63",
 "title": "Free clock + gold-locked escape",
 "idea": "The clock is free, but its twin lies at the bottom of a dig that fills the tray and needs a face-down escape. Taken first, the clock takes the slot that plan needs.",
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
  "0": "clockTwin",
  "11": "clockTwin",
  "12": "g501",
  "13": "g502",
  "33": "g503",
  "37": "g504",
  "39": "g505",
  "45": "g505",
  "49": "g504",
  "53": "g506",
  "54": "g507",
  "56": "g506",
  "61": "g501",
  "63": "g502",
  "69": "g503",
  "70": "g507"
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
  },
  {
   "name": "clockFirst",
   "expect": "none",
   "gone": [
    0
   ],
   "tray0": [
    "clockTwin"
   ]
  }
 ],
 "hand": {
  "clock": 0,
  "clockN": 17,
  "peek": true,
  "spare": 1,
  "routeTest": "dig",
  "routeSuffix": [
   0
  ],
  "downTiles": [
   53
  ],
  "baits": [
   {
    "at": 1,
    "take": [
     0
    ],
    "why": "take the free clock first"
   }
  ]
 }
};
