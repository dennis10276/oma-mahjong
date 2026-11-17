module.exports = {
 "id": "i87",
 "title": "The escape is the key pair",
 "idea": "The clock is gold-locked; its keys are the tile you need at the full tray and its face-down twin far away. The pair that saves the tray also opens the clock.",
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
 "locks": [
  26
 ],
 "keys": [
  67,
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
  "baits": []
 }
};
