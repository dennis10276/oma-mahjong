module.exports = {
 "id": "i77",
 "title": "The escape is the key pair",
 "idea": "The clock is gold-locked; its keys are the tile you need at the full tray and its face-down twin far away. The pair that saves the tray also opens the clock.",
 "layout": 1000,
 "block": [
  70,
  68,
  55,
  27,
  65,
  51,
  60,
  45,
  5,
  26,
  58,
  39,
  47
 ],
 "target": 25,
 "limit": 14,
 "fixed": {
  "5": "p60",
  "25": "p99",
  "26": "p4",
  "27": "p1",
  "39": "p2",
  "45": "p60",
  "47": "p0",
  "48": "p100",
  "51": "p3",
  "55": "p4",
  "58": "p0",
  "60": "p100",
  "65": "p3",
  "68": "p2",
  "70": "p1"
 },
 "free": [],
 "down": [
  5
 ],
 "locks": [
  25
 ],
 "keys": [
  45,
  5
 ],
 "tests": [
  {
   "name": "dig",
   "expect": "win",
   "peekForced": true
  }
 ],
 "hand": {
  "clock": 25,
  "peek": true,
  "peekNeeded": true,
  "spare": 1,
  "routeTest": "dig",
  "downTiles": [
   5
  ],
  "baits": []
 }
};
