module.exports = {
 "id": "i80",
 "title": "The silver key belongs to the second half",
 "idea": "After the clock a silver chain begins; one silver key is free from the start, the other appears only when the clock is gone. Taken early, the free key waits through the whole first chain.",
 "layout": 1000,
 "block": [
  70,
  68,
  55,
  27,
  65,
  51,
  60,
  45,
  5,
  26,
  58,
  39,
  47,
  25,
  0,
  21
 ],
 "target": 33,
 "limit": 17,
 "fixed": {
  "0": "silver",
  "4": "g501",
  "5": "g500",
  "21": "silver",
  "25": "g501",
  "26": "g502",
  "27": "g503",
  "39": "g504",
  "45": "g500",
  "47": "g505",
  "48": "g506",
  "51": "g507",
  "55": "g502",
  "58": "g505",
  "60": "g506",
  "65": "g507",
  "68": "g504",
  "70": "g503"
 },
 "free": [],
 "down": [
  5
 ],
 "locks2": [
  33
 ],
 "keys2": [
  0,
  21
 ],
 "locks": [
  25
 ],
 "keys": [
  45,
  5
 ],
 "tests": [
  {
   "name": "dig",
   "expect": "win",
   "peekForced": false
  },
  {
   "name": "silverFirst",
   "expect": "none",
   "gone": [
    0
   ],
   "tray0": [
    "silver"
   ]
  }
 ],
 "hand": {
  "clock": 25,
  "peek": true,
  "peekNeeded": true,
  "spare": 1,
  "routeTest": "dig",
  "downTiles": [
   5
  ],
  "secondChain": true,
  "baits": [
   {
    "at": 1,
    "take": [
     0
    ],
    "why": "take the free silver key now"
   }
  ]
 }
};
