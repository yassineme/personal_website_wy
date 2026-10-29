'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {buildPublic}=require('../scripts/build-public.cjs');
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'website-public-build-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}
async function put(root,name,body='sample'){const file=path.join(root,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,body);}
async function exists(root,name){return fs.stat(path.join(root,name)).then(()=>true,()=>false);}
test('the deployed static tree contains public pages and assets, but no credentials, backend source, CV ciphertext or PDFs',async t=>{
 const root=await fixture(t);
 for(const name of ['index.html','script.js','profile.css','typography-proposals.css','assets/vendor/d3.v7.min.js','assets/vendor/topojson-client.min.js','assets/logo.svg','assets/fonts/font.woff2','assets/cv-locked-preview.html','blog/story.html','blog/feed.xml','content/posts.json','content/posts/story.html','data/ai-signals.json'])await put(root,name);
 for(const name of ['.env.local','.secrets/key.json','.git/config','lib/private-cv.cjs','lib/private-cv-content.json','apps-script/Code.gs','tests/test.cjs','scripts/tool.cjs','package.json','data/private.json','assets/resume.pdf','assets/cv.docx','assets/private.html','assets/.hidden/key.json','unknown.js'])await put(root,name,'private-marker');
 const result=await buildPublic(root);assert.equal(result.files,14);
 for(const name of ['index.html','script.js','profile.css','typography-proposals.css','assets/vendor/d3.v7.min.js','assets/vendor/topojson-client.min.js','assets/logo.svg','assets/fonts/font.woff2','assets/cv-locked-preview.html','blog/story.html','content/posts.json','data/ai-signals.json'])assert.ok(await exists(result.output,name));
 for(const name of ['.env.local','.secrets/key.json','.git/config','lib/private-cv.cjs','lib/private-cv-content.json','apps-script/Code.gs','tests/test.cjs','scripts/tool.cjs','package.json','data/private.json','assets/resume.pdf','assets/cv.docx','assets/private.html','assets/.hidden/key.json','unknown.js'])assert.equal(await exists(result.output,name),false,name);
});
test('rebuilding removes stale generated files and preserves server inputs',async t=>{
 const root=await fixture(t);await put(root,'index.html');await put(root,'lib/private-cv-content.json','keep-server-data');
 await buildPublic(root);await put(root,'public/accidental-secret.txt','stale');await put(root,'index.html','updated');await buildPublic(root);
 assert.equal(await exists(root,'public/accidental-secret.txt'),false);assert.equal(await fs.readFile(path.join(root,'public/index.html'),'utf8'),'updated');assert.equal(await fs.readFile(path.join(root,'lib/private-cv-content.json'),'utf8'),'keep-server-data');
});
test('public asset symlinks cannot publish a private file',async t=>{
 const root=await fixture(t);await put(root,'index.html');await put(root,'.env.local','private');await fs.mkdir(path.join(root,'assets'));
 await fs.symlink('../.env.local',path.join(root,'assets/leak.svg'));await assert.rejects(buildPublic(root),/symbolic links/);assert.equal(await exists(root,'public'),false);
});
test('a hand-authored public folder is never deleted by the builder',async t=>{
 const root=await fixture(t);await put(root,'index.html');await put(root,'public/keep.txt','keep');await assert.rejects(buildPublic(root));assert.equal(await fs.readFile(path.join(root,'public/keep.txt'),'utf8'),'keep');
});
