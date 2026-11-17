module.exports = {
 "id": "i90",
 "title": "The escape is the key pair",
 "idea": "The clock is gold-locked; its keys are the tile you need at the full tray and its face-down twin far away. The pair that saves the tray also opens the clock.",
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
  "9": "g501",
  "11": "g501",
  "12": "g502",
  "13": "g503",
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
 "locks": [
  11
 ],
 "keys": [
  56,
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
