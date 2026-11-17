module.exports = {
 "id": "i62",
 "title": "Free clock + silver-locked escape",
 "idea": "The clock is free, but its twin lies at the bottom of a dig that fills the tray and needs a face-down escape. Taken first, the clock takes the slot that plan needs.",
 "layout": 1022,
 "block": [
  63,
  45,
  61,
  39,
  49,
  13,
  0,
  1,
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
 "limit": 17,
 "fixed": {
  "0": "g500",
  "1": "g500",
  "11": "clockTwin",
  "12": "g502",
  "13": "g503",
  "30": "clockTwin",
  "33": "g504",
  "37": "g505",
  "39": "g506",
  "45": "g506",
  "49": "g505",
  "53": "g507",
  "54": "g508",
  "56": "g507",
  "61": "g502",
  "63": "g503",
  "69": "g504",
  "70": "g508"
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
  },
  {
   "name": "clockFirst",
   "expect": "none",
   "gone": [
    30
   ],
   "tray0": [
    "clockTwin"
   ]
  }
 ],
 "hand": {
  "clock": 30,
  "clockN": 19,
  "peek": true,
  "spare": 1,
  "routeTest": "dig",
  "routeSuffix": [
   30
  ],
  "downTiles": [
   53
  ],
  "baits": [
   {
    "at": 1,
    "take": [
     30
    ],
    "why": "take the free clock first"
   }
  ]
 }
};
