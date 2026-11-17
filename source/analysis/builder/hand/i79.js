module.exports = {
 "id": "i79",
 "title": "The escape opens silver, silver opens gold",
 "idea": "The face-down pair at the full tray is the silver key pair; silver frees a gold key further down, and the gold keys open the clock.",
 "layout": 1042,
 "block": [
  76,
  71,
  50,
  42,
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
 "limit": 14,
 "fixed": {
  "24": "p4",
  "25": "p3",
  "26": "p99",
  "29": "p100",
  "36": "p1",
  "42": "p2",
  "46": "p4",
  "50": "p2",
  "54": "p60",
  "58": "p0",
  "67": "p60",
  "71": "p1",
  "76": "p100",
  "80": "p3",
  "83": "p0"
 },
 "free": [],
 "down": [
  54
 ],
 "locks2": [
  46
 ],
 "keys2": [
  67,
  54
 ],
 "locks": [
  26
 ],
 "keys": [
  24,
  46
 ],
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
