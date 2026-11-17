module.exports = {
 "id": "i75",
 "title": "The silver key belongs to the second half",
 "idea": "After the clock a silver chain begins; one silver key is free from the start, the other appears only when the clock is gone. Taken early, the free key waits through the whole first chain.",
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
  11,
  0,
  3
 ],
 "target": 6,
 "limit": 18,
 "fixed": {
  "0": "silver",
  "3": "silver",
  "9": "g500",
  "11": "g500",
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
 "locks2": [
  6
 ],
 "keys2": [
  0,
  3
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
  "clock": 11,
  "peek": true,
  "peekNeeded": true,
  "spare": 1,
  "routeTest": "dig",
  "downTiles": [
   53
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
