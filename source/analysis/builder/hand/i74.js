module.exports = {
 "id": "i74",
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
  0,
  1,
  70,
  56,
  53,
  37,
  69,
  54,
  33,
  12,
  11,
  30,
  3
 ],
 "target": 6,
 "limit": 20,
 "fixed": {
  "0": "g500",
  "1": "g500",
  "3": "silver",
  "9": "g501",
  "11": "g501",
  "12": "g502",
  "13": "g503",
  "30": "silver",
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
  6
 ],
 "keys2": [
  30,
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
    30
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
     30
    ],
    "why": "take the free silver key now"
   }
  ]
 }
};
