const fs=require('node:fs/promises');
const path=require('node:path');
const {createArchiveService}=require('../lib/signals-service.cjs');
(async()=>{
 const root=path.join(__dirname,'..');
 const previous=JSON.parse(await fs.readFile(path.join(root,'data/ai-signals.json'),'utf8'));
 const data=await createArchiveService({seed:previous})({force:true});
 if(data.status==='stale' || !data.items.length) throw Error('No verified articles fetched; snapshot kept unchanged.');
 await fs.mkdir(path.join(root,'data'),{recursive:true});
 await fs.writeFile(path.join(root,'data/ai-signals.json'),JSON.stringify(data,null,2)+'\n');
 await fs.writeFile(path.join(root,'data/ai-signals-snapshot.js'),'window.YWM_AI_SIGNALS_BOOTSTRAP = '+JSON.stringify(data).replace(/</g,'\\u003c')+';\n');
 console.log(JSON.stringify({items:data.items.length,sources:data.sources},null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
