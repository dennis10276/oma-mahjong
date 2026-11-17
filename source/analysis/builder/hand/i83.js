module.exports = {
 "id": "i83",
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
  1,
  3
 ],
 "target": 6,
 "limit": 18,
 "fixed": {
  "0": "g500",
  "1": "silver",
  "3": "silver",
  "4": "g500",
  "11": "g501",
  "12": "g502",
  "13": "g503",
  "14": "g501",
  "33": "g504",
  "37": "g505",
  "39": "g506",
  "45": "g506",
  "49": "g505",
  "53": "g500",
  "54": "g507",
  "56": "g500",
  "61": "g502",
  "63": "g503",
  "69": "g504",
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
  1,
  3
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
    1
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
     1
    ],
    "why": "take the free silver key now"
   }
  ]
 }
};
