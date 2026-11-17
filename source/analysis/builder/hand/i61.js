module.exports = {
 "id": "i61",
 "title": "Don't take the clock: its twin needs the escape",
 "idea": "The clock is free, but its twin lies at the bottom of a dig that fills the tray and needs a face-down escape. Taken first, the clock takes the slot that plan needs.",
 "layout": 1042,
 "block": [
  76,
  71,
  50,
  42,
  62,
  55,
  83,
  67,
  54,
  36,
  80,
  58,
  24,
  46,
  25
 ],
 "target": 26,
 "limit": 16,
 "fixed": {
  "24": "g500",
  "25": "g501",
  "26": "clockTwin",
  "29": "g503",
  "36": "g504",
  "42": "g505",
  "46": "g500",
  "50": "g505",
  "54": "g506",
  "55": "g507",
  "58": "g508",
  "60": "clockTwin",
  "62": "g507",
  "67": "g506",
  "71": "g504",
  "76": "g503",
  "80": "g501",
  "83": "g508"
 },
 "free": [],
 "down": [
  54
 ],
 "ice": {
  "54": 1
 },
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
    60
   ],
   "tray0": [
    "clockTwin"
   ]
  }
 ],
 "hand": {
  "clock": 60,
  "clockN": 18,
  "peek": true,
  "spare": 1,
  "routeTest": "dig",
  "routeSuffix": [
   60
  ],
  "downTiles": [
   54
  ],
  "baits": [
   {
    "at": 1,
    "take": [
     60
    ],
    "why": "take the free clock first"
   }
  ]
 }
};
