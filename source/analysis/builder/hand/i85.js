module.exports = {
 "id": "i85",
 "title": "The escape is the key pair",
 "idea": "The clock is gold-locked; its keys are the tile you need at the full tray and its face-down twin far away. The pair that saves the tray also opens the clock.",
 "layout": 1012,
 "block": [
  68,
  58,
  70,
  60,
  66,
  54,
  63,
  29,
  62,
  42,
  47,
  36,
  38,
  46,
  6
 ],
 "target": 7,
 "limit": 16,
 "fixed": {
  "6": "g1",
  "16": "g110",
  "29": "g500",
  "36": "g4",
  "38": "g2",
  "42": "g501",
  "46": "g2",
  "47": "g501",
  "54": "g3",
  "58": "g0",
  "60": "g0",
  "62": "g1",
  "63": "g500",
  "66": "g110",
  "68": "g3",
  "70": "g4"
 },
 "free": [],
 "down": [
  47
 ],
 "locks": [
  7
 ],
 "keys": [
  42,
  47
 ],
 "tests": [
  {
   "name": "dig",
   "expect": "win",
   "peekForced": true
  }
 ],
 "hand": {
  "clock": 7,
  "peek": true,
  "peekNeeded": true,
  "spare": 1,
  "routeTest": "dig",
  "downTiles": [
   47
  ],
  "baits": []
 }
};
