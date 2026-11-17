module.exports = {
 "id": "i82",
 "title": "The silver key belongs to the second half",
 "idea": "After the clock a silver chain begins; one silver key is free from the start, the other appears only when the clock is gone. Taken early, the free key waits through the whole first chain.",
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
  25,
  26,
  60,
  3
 ],
 "target": 4,
 "limit": 19,
 "fixed": {
  "3": "silver",
  "11": "g502",
  "24": "g500",
  "25": "g501",
  "26": "g502",
  "29": "g503",
  "36": "g504",
  "42": "g505",
  "46": "g500",
  "50": "g505",
  "54": "g506",
  "55": "g507",
  "58": "g508",
  "60": "silver",
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
 "locks2": [
  4
 ],
 "keys2": [
  60,
  3
 ],
 "ice": {
  "54": 1
 },
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
    60
   ],
   "tray0": [
    "silver"
   ]
  }
 ],
 "hand": {
  "clock": 26,
  "peek": true,
  "peekNeeded": true,
  "spare": 1,
  "routeTest": "dig",
  "downTiles": [
   54
  ],
  "secondChain": true,
  "baits": [
   {
    "at": 1,
    "take": [
     60
    ],
    "why": "take the free silver key now"
   }
  ]
 }
};
