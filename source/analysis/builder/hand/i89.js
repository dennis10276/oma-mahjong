module.exports = {
 "id": "i89",
 "title": "Save the escape, which is the key pair",
 "idea": "The clock is gold-locked; its keys are the tile you need at the full tray and its face-down twin far away. The pair that saves the tray also opens the clock.",
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
  "0": "g500",
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
 "locks": [
  11
 ],
 "keys": [
  56,
  53
 ],
 "tests": [
  {
   "name": "dig",
   "expect": "win",
   "peekForced": true
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
  "baits": []
 }
};
