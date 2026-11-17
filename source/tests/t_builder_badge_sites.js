'use strict';
const assert=require('assert/strict'),P=require('../tools/builder/bank/finish_all_sources'),B=require('../tools/builder/bank/gate2_badge_sites');
for(let level=301;level<=349;level++){const before=P.original(level),d=before.design,allow=B.guard(before,d,d.tiles.map((_,i)=>i));assert.ok(d.tiles.every(allow),'Original readable badges rejected at '+level);}
const before=P.original(308),d=structuredClone(before.design),allow=B.guard(before,d,d.tiles.map((_,i)=>i));
assert.equal(allow([1,2,1]),false,'The tile side covers more than 35% of the key badge');
assert.equal(allow([3,2,1]),true,'A tile beside the badge should remain available');
console.log('Badge packing retains source visibility and excludes the reported side occlusion.');
