module.exports = {
 "id": "i30",
 "title": "Melt the escape first",
 "idea": "At the full tray a face-down twin is the way on, but it is frozen, and melting it is a pair that needs a free slot. Melt it before the tray fills.",
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
  25,
  62,
  55
 ],
 "target": 26,
 "limit": 16,
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
  "55": "melt",
  "58": "p0",
  "62": "melt",
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
