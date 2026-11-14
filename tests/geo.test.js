const vm=require('vm'),fs=require('fs'),assert=require('assert');
const dir=process.argv[2]||__dirname+'/..';
const ctx=vm.createContext({console,navigator:{},window:{},Date,Math});
vm.runInContext(fs.readFileSync(dir+'/config.js','utf8'),ctx);
vm.runInContext(fs.readFileSync(dir+'/geo.js','utf8')+'\n;this.G={haversineDistance,createPositionFilter,fuseSamples,analyzeSamples,evaluateLocation,gpsToleranceBonus,isInsideWorkArea,parseMapsInput,samplePosition,CONFIG};',ctx);
const G=ctx.G;let n=0;const t=(name,f)=>{f();n++;console.log('ok -',name)};
const off={lat:-6.456874,lon:106.729983};
const mv=(m,bearingN=true)=>({lat:off.lat+(m/111320),lon:off.lon});
t('haversine 100m',()=>assert(Math.abs(G.haversineDistance(0,0,0.0009,0)-100.07)<0.2));
// evaluateLocation
const E=(d,a)=>G.evaluateLocation(d,a);
t('inside',()=>assert.equal(E(10,8).status,'inside'));
t('tolerance (35m, acc 20 → bonus 10 → 40)',()=>{const e=E(35,20);assert.equal(e.status,'tolerance');assert.equal(e.allowed,true)});
t('outside (45m, acc 20)',()=>assert.equal(E(45,20).status,'outside'));
t('bonus capped at 20',()=>assert.equal(G.gpsToleranceBonus(500),20));
t('max accepted = radius+cap (50m, acc 45)',()=>assert.equal(E(50,45).status,'tolerance'));
t('51m,acc45 outside',()=>assert.equal(E(51,45).status,'outside'));
t('poor accuracy blocks even when close',()=>assert.equal(E(5,80).status,'poor-accuracy'));
t('far + poor = outside',()=>assert.equal(E(254.6,20).status,'outside'));
t('quality labels',()=>{assert.equal(E(5,10).quality,'good');assert.equal(E(5,35).quality,'fair');assert.equal(E(5,80).quality,'poor')});
t('work-area tolerance',()=>{assert(G.isInsideWorkArea(68,20));assert(!G.isInsideWorkArea(75,20))});
// fuse: noisy samples around office, one outlier 200 m away
const rnd=(()=>{let s=7;return()=>{s=(s*16807)%2147483647;return s/2147483647-0.5}})();
const raw=[];for(let i=0;i<10;i++){const p={lat:off.lat+rnd()*0.00018,lon:off.lon+rnd()*0.00018,acc:8+Math.abs(rnd())*20,t:1000+i*1000};raw.push(p)}
raw.push({lat:off.lat+0.0018,lon:off.lon,acc:12,t:12000});
const f=G.fuseSamples(raw);
t('fuse rejects 200m outlier',()=>{assert(f.rejected>=1);assert(G.haversineDistance(off.lat,off.lon,f.lat,f.lon)<15,'dist '+G.haversineDistance(off.lat,off.lon,f.lat,f.lon))});
t('fused accuracy conservative (>=0.7*best)',()=>assert(f.accuracy>=0.7*f.best));
// kalman
const kf=G.createPositionFilter();let last;for(let i=0;i<30;i++){last=kf.update(off.lat+rnd()*0.0003,off.lon+rnd()*0.0003,15,i*1000)}
t('kalman smooths jitter (<12m from truth after 30 fixes)',()=>assert(G.haversineDistance(off.lat,off.lon,last.lat,last.lon)<12));
const kj=G.createPositionFilter();kj.update(off.lat,off.lon,40,0);const r=kj.update(off.lat+0.01,off.lon,5,1000);
t('kalman resets on accurate jump',()=>assert(G.haversineDistance(off.lat+0.01,off.lon,r.lat,r.lon)<1));
// analyze
t('flags teleport',()=>{const a=G.analyzeSamples([{lat:off.lat,lon:off.lon,acc:5,t:0},{lat:off.lat+0.01,lon:off.lon,acc:5,t:1000}],{used:2,rejected:0});assert(a.flags.includes('lompatan-lokasi'));assert(a.trust<=60)});
t('flags frozen',()=>{const s=[0,1,2,3].map(i=>({lat:off.lat,lon:off.lon,acc:10,t:i*1000}));assert(G.analyzeSamples(s,{used:4,rejected:0}).flags.includes('pembacaan-beku'))});
t('flags accuracy zero',()=>assert(G.analyzeSamples([{lat:1,lon:1,acc:0,t:0}],{used:1,rejected:0}).flags.includes('akurasi-nol')));
t('clean samples trust 100',()=>assert.equal(G.analyzeSamples(raw.slice(0,10),G.fuseSamples(raw.slice(0,10))).trust,100));
// parse maps
const P=G.parseMapsInput;
t('parse plain',()=>{const x=P('-6.456874, 106.729983');assert.equal(x.lat,-6.456874);assert.equal(x.lon,106.729983)});
t('parse @ url',()=>{const x=P('https://www.google.com/maps/place/X/@-6.4569,106.7300,17z/data=!4m2');assert.equal(x.source,'view');assert.equal(x.lat,-6.4569)});
t('parse !3d!4d beats @',()=>{const x=P('https://www.google.com/maps/place/X/@-6.5,106.8,17z/data=!3d-6.4568741!4d106.7299832');assert.equal(x.source,'pin');assert.equal(x.lat,-6.4568741)});
t('parse q=',()=>assert.equal(P('https://www.google.com/maps?q=-6.45,106.72').lon,106.72));
t('short link → helpful error',()=>assert(/pendek/.test(P('https://maps.app.goo.gl/bFGZ2NDZJim2ZTxY6').error)));
t('garbage/empty/0,0 rejected',()=>{assert(P('hello').error);assert(P('').error);assert(P('0, 0').error);assert(P('95, 10').error)});
// samplePosition end-to-end with fake geolocation
function fake(positions,errCode){let id=0,watchers={};ctx.navigator.geolocation={watchPosition(ok,err){const i=++id;let k=0;watchers[i]=setInterval(()=>{if(k>=positions.length){return}const p=positions[k++];ok({coords:{latitude:p.lat,longitude:p.lon,accuracy:p.acc},timestamp:Date.now()})},20);return i},clearWatch(i){clearInterval(watchers[i])}}}
ctx.setTimeout=setTimeout;ctx.clearTimeout=clearTimeout;
(async()=>{
 fake([0,1,2,3,4].map(i=>({lat:off.lat+rnd()*0.00004,lon:off.lon+rnd()*0.00004,acc:9})));
 // override 1500ms min elapsed: wait it out
 const res=await G.samplePosition({maxWaitMs:5000});
 t('samplePosition resolves early with good fix',()=>{assert(res.samples>=3);assert(res.accuracy<=15);assert(G.haversineDistance(off.lat,off.lon,res.lat,res.lon)<10);assert.equal(res.trustLevel,'tinggi')});
 fake([]);
 let rejected=false;try{await G.samplePosition({maxWaitMs:300})}catch(e){rejected=/Lokasi|GPS/.test(e.message)}
 t('no fix → rejects (never fake success)',()=>assert(rejected));
 console.log(`\n${n} tests passed`);
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
