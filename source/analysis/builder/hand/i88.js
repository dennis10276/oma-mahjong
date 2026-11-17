module.exports = {
 "id": "i88",
 "title": "Uncover the escape, then the key chain",
 "idea": "The face-down pair at the full tray is the silver key pair; silver frees a gold key further down, and the gold keys open the clock.",
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
 "locks2": [
  46
 ],
 "keys2": [
  42,
  47
 ],
 "locks": [
  7
 ],
 "keys": [
  38,
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
