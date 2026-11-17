module.exports = {
 "id": "i70",
 "title": "The silver key belongs to the second half",
 "idea": "After the clock a silver chain begins; one silver key is free from the start, the other appears only when the clock is gone. Taken early, the free key waits through the whole first chain.",
 "layout": 1006,
 "block": [
  71,
  47,
  11,
  69,
  63,
  70,
  41,
  10,
  61,
  64,
  38,
  9,
  28,
  37
 ],
 "target": 46,
 "limit": 15,
 "fixed": {
  "9": "ck",
  "10": "p3",
  "11": "p2",
  "24": "p4",
  "28": "silver",
  "37": "silver",
  "38": "p1",
  "41": "pk",
  "47": "p3",
  "61": "p0",
  "63": "p1",
  "64": "p0",
  "69": "p2",
  "70": "pk",
  "71": "p4"
 },
 "free": [],
 "down": [
  70
 ],
 "locks2": [
  46
 ],
 "keys2": [
  28,
  37
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
    28
   ],
   "tray0": [
    "silver"
   ]
  }
 ],
 "hand": {
  "clock": 9,
  "peek": true,
  "peekNeeded": true,
  "spare": 1,
  "routeTest": "dig",
  "downTiles": [
   70
  ],
  "secondChain": true,
  "baits": [
   {
    "at": 1,
    "take": [
     28
    ],
    "why": "take the free silver key now"
   }
  ]
 }
};
