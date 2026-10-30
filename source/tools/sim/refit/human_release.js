'use strict';
const release=require('./human_release_profiles.json');
Object.values(release.profiles).forEach(Object.freeze);Object.freeze(release.profiles);
module.exports=Object.freeze(release);
