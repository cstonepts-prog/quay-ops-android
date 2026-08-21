"use strict";
var IK="quay-install-v1",SK="quay-state-v2",MB=1024*1024;
function uid(p){return (p||"id")+"_"+Math.random().toString(36).slice(2,8)}
function installed(){try{var d=JSON.parse(localStorage.getItem(IK)||"null");return !!(d&&d.completedAt)}catch(e){return false}}
function mark(m){localStorage.setItem(IK,JSON.stringify(Object.assign({completedAt:Date.now(),version:2},m||{})))}
function load(){try{return JSON.parse(localStorage.getItem(SK))}catch(e){return null}}
function save(s){try{localStorage.setItem(SK,JSON.stringify(s))}catch(e){}}
function fb(b){if(!isFinite(b)||b<0)return "—";if(b<1024)return Math.round(b)+" B";var u=["KB","MB","GB","TB"],n=b/1024,i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return n.toFixed(n>=100||i===0?0:1)+" "+u[i]}
function fs(b){return (!b||b<1)?"0 B/s":fb(b)+"/s"}
function fe(s){if(s==null||!isFinite(s))return "—";if(s<1)return "<1s";if(s<60)return Math.ceil(s)+"s";var m=Math.floor(s/60);return m<60?(s%60?m+"m "+Math.round(s%60)+"s":m+"m"):Math.floor(m/60)+"h "+(m%60)+"m"}
function fw(ts){if(!ts)return "—";var n=Date.now(),d=ts-n;if(Math.abs(d)<8e3)return "now";if(ts<n){var s=Math.round((n-ts)/1e3);if(s<60)return s+"s ago";var m=Math.round(s/60);return m<60?m+"m ago":Math.round(m/60)+"h ago"}if(d<6e4)return "in <1m";var m=Math.round(d/6e4);return m<60?"in "+m+"m":"in "+Math.round(m/60)+"h"}
function fc(ts){var d=new Date(ts||Date.now());return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2)+":"+("0"+d.getSeconds()).slice(-2)}
function probe(){
  var c=navigator.hardwareConcurrency||4,m=navigator.deviceMemory,co=navigator.connection||navigator.mozConnection,dl=co&&co.downlink,t=(navigator.maxTouchPoints||0)>0;
  var conc=Math.max(1,Math.min(6,Math.round(c/2)));if(m&&m<=4)conc=Math.min(conc,2);if(t)conc=Math.min(conc,3);
  var bw=8;if(typeof dl==="number"&&dl>0)bw=Math.max(1,Math.min(32,Math.round(dl/8)));
  var notes=[c+" CPU threads"];if(m)notes.push("~"+m+" GB memory");if(typeof dl==="number")notes.push("~"+dl+" Mbps");if(t)notes.push("Touch · compact");if(window.__QUAY_ANDROID__)notes.push("Android · background armed");
  return {concurrency:conc,bandwidth:bw,notes:notes};
}
function D(n,ch){return {type:"dir",name:n,children:ch||[]}}
function F(n,s){return {type:"file",name:n,size:s}}
function trees(){
  return {
    local:D("/",[D("exports",[F("weekly-report.xlsx",2.4*MB),F("ledger-q3.csv",890*1024),F("invoice-batch.zip",18*MB),F("manifest.json",24*1024)]),D("media",[F("interview-master.mov",420*MB),F("hero-still.tiff",48*MB),F("podcast-ep12.wav",86*MB)]),D("docs",[F("runbook.md",24*1024),F("sla.pdf",1.1*MB)]),D("logs",[F("app-2026-08-20.log",6.2*MB)])]),
    remotes:{
      s1:D("/",[D("nightly",[F("2026-08-19.tar.gz",1.12*1024*MB)]),D("inbound",[]),D("db",[F("dump-latest.sql.gz",240*MB)])]),
      s2:D("/",[D("masters",[F("interview-master.mov",420*MB)]),D("stills",[F("hero-still.tiff",48*MB),F("contact-sheet.jpg",4.2*MB)]),D("drop",[])]),
      s3:D("/",[D("publish",[F("cutdown-30s.mp4",62*MB)]),D("wip",[F("grade-v3.mov",210*MB)])]),
      s4:D("/",[D("static",[F("app.bundle.js",1.8*MB)]),D("packs",[])])
    }
  };
}
function seedDemo(set){
  var now=Date.now(),t=trees();
  return {sites:[
    {id:"s1",name:"Romford backup",host:"ftp.romford.ops",protocol:"sftp",port:22,username:"ops.backup",connected:true,note:"Nightly vault · 12 TB"},
    {id:"s2",name:"London archive",host:"ftp.archives.london",protocol:"ftps",port:990,username:"media.desk",connected:true,note:"Masters"},
    {id:"s3",name:"Studio prod",host:"assets.studio.prod",protocol:"ftp",port:21,username:"desk",connected:true,note:"Working files"},
    {id:"s4",name:"CDN origin",host:"origin.cdn.eu",protocol:"sftp",port:22,username:"publisher",connected:false,note:"Edge"}
  ],jobs:[
    {id:"j1",fileName:"invoice-batch.zip",status:"transferring",sizeBytes:18*MB,transferred:11.4*MB,speedBps:3.2*MB,siteId:"s1",direction:"upload",priority:2},
    {id:"j2",fileName:"grade-v3.mov",status:"transferring",sizeBytes:210*MB,transferred:42*MB,speedBps:4.1*MB,siteId:"s3",direction:"download",priority:1},
    {id:"j3",fileName:"podcast-ep12.wav",status:"waiting",sizeBytes:86*MB,transferred:0,speedBps:0,siteId:"s2",direction:"upload",priority:2},
    {id:"j4",fileName:"hero-still.tiff",status:"waiting",sizeBytes:48*MB,transferred:0,speedBps:0,siteId:"s2",direction:"upload",priority:2},
    {id:"j5",fileName:"weekly-report.xlsx",status:"waiting",sizeBytes:2.4*MB,transferred:0,speedBps:0,siteId:"s1",direction:"upload",priority:3},
    {id:"j6",fileName:"ledger-q3.csv",status:"completed",sizeBytes:890*1024,transferred:890*1024,speedBps:0,siteId:"s1",direction:"upload",priority:2},
    {id:"j7",fileName:"contact-sheet.jpg",status:"completed",sizeBytes:4.2*MB,transferred:4.2*MB,speedBps:0,siteId:"s2",direction:"download",priority:2},
    {id:"j8",fileName:"app.bundle.js",status:"failed",sizeBytes:1.8*MB,transferred:.4*MB,speedBps:0,siteId:"s4",direction:"upload",priority:1,error:"Connection refused"}
  ],schedules:[
    {id:"sc1",name:"Nightly backup",enabled:true,siteId:"s1",direction:"upload",recurrence:"Daily 02:00",nextRunAt:now+6*36e5},
    {id:"sc2",name:"Log shipper",enabled:true,siteId:"s1",direction:"upload",recurrence:"Every 2 min",nextRunAt:now+12e4},
    {id:"sc3",name:"Sunday archive",enabled:true,siteId:"s2",direction:"upload",recurrence:"Sun 03:00",nextRunAt:now+2*864e5}
  ],logs:[
    {id:uid("l"),at:now-19e4,level:"ok",message:"Completed cutdown-30s.mp4 from Studio prod"},
    {id:uid("l"),at:now-87e3,level:"ok",message:"Completed ledger-q3.csv → Romford"},
    {id:uid("l"),at:now-48e3,level:"err",message:"Connection refused · origin.cdn.eu:22"},
    {id:uid("l"),at:now-4e3,level:"info",message:"Queued invoice-batch.zip → Romford"}
  ],localTree:t.local,remoteTrees:t.remotes,
  settings:Object.assign({concurrency:3,bandwidthMBps:8,autoRetry:true},set||{}),
  view:"board",browseSite:"s1",localPath:"/",remotePath:"/",selLocal:null,selRemote:null};
}
function seedClean(set){var t=trees();return {sites:[],jobs:[],schedules:[],logs:[{id:uid("l"),at:Date.now(),level:"ok",message:"Quay installed · clean workspace"}],localTree:t.local,remoteTrees:{},settings:Object.assign({concurrency:3,bandwidthMBps:8,autoRetry:true},set||{}),view:"board",browseSite:null,localPath:"/",remotePath:"/",selLocal:null,selRemote:null}}
