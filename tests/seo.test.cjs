'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const {buildSeo,inventory,SITE}=require('../scripts/build-seo.cjs');
const {buildPublic}=require('../scripts/build-public.cjs');
const root=path.resolve(__dirname,'..');
const posts=require('../content/posts.json');
const pages=inventory(posts);
async function fixture(t){
 const target=await fs.mkdtemp(path.join(os.tmpdir(),'wyassine-seo-test-'));
 t.after(()=>fs.rm(target,{recursive:true,force:true}));
 for(const item of ['scripts','content',...pages.filter(p=>!['about.html','ai-strategy.html'].includes(p.file)).map(p=>p.file),'sitemap.xml']){
  await fs.mkdir(path.dirname(path.join(target,item)),{recursive:true});
  await fs.cp(path.join(root,item),path.join(target,item),{recursive:true});
 }
 return target;
}
function jsonld(html){return JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);}
test('canonical public inventory excludes PIN gates, forms and noindex pages',async()=>{
 const xml=await fs.readFile(path.join(root,'sitemap.xml'),'utf8');
 const urls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
 assert.deepEqual(urls,pages.map(p=>SITE+p.route));
 assert.equal(new Set(urls).size,urls.length);
 for(const forbidden of ['/digital-cv','/contact','/privacy','/photospot-atlas'])assert.ok(!urls.some(u=>u===SITE+forbidden));
 for(const url of urls)assert.ok(!url.endsWith('.html'));
});
test('every indexable page has unique metadata, a single H1 and consistent public identity',async()=>{
 const titles=new Set(),descriptions=new Set();
 for(const page of pages){
  const html=await fs.readFile(path.join(root,page.file),'utf8');
  assert.equal((html.match(/<h1\b/g)||[]).length,1,page.file);
  assert.equal((html.match(/rel="canonical"/g)||[]).length,1,page.file);
  assert.ok(html.includes('href="'+SITE+page.route+'"'),page.file);
  assert.equal((html.match(/name="description"/g)||[]).length,1,page.file);
  assert.equal((html.match(/name="robots"/g)||[]).length,1,page.file);
  assert.match(html,/name="robots" content="index,follow,max-image-preview:large"/);
  assert.ok(!titles.has(page.title));titles.add(page.title);
  assert.ok(!descriptions.has(page.description));descriptions.add(page.description);
  const graph=jsonld(html)['@graph'];
  const person=graph.find(n=>n['@type']==='Person');
  assert.equal(person['@id'],SITE+'/#person');assert.equal(person.url,SITE+'/about');
  assert.ok(graph.some(n=>n['@type']==='WebSite'));
  const webpage=graph.find(n=>n['@id']===SITE+page.route+'#webpage');assert.equal(webpage.inLanguage,'en');
  for(const article of graph.filter(n=>n['@type']==='BlogPosting'))assert.equal(article.author['@id'],person['@id']);
 }
});
test('homepage discovery paths and article authors lead to accessible public pages',async()=>{
 const home=await fs.readFile(path.join(root,'index.html'),'utf8');
 for(const route of ['/about','/ai-strategy'])assert.ok(home.includes('href="'+route+'"'));
 for(const post of posts){
  const html=await fs.readFile(path.join(root,post.url+'.html'),'utf8');
  assert.match(html,/href="\/about" rel="author"/);
  assert.match(html,/href="\/contact">Start a conversation/);
 }
 const about=await fs.readFile(path.join(root,'about.html'),'utf8');
 for(const route of ['/digital-cv?request=pin','/digital-cv?request=pdf'])assert.ok(about.includes('href="'+route+'"'));
 assert.ok(jsonld(about)['@graph'].some(n=>n['@type']==='ProfilePage'));
});
test('SEO generation is repeatable and the public build includes both landing pages',async t=>{
 const target=await fixture(t);
 await buildSeo(target);
 const before=await Promise.all(pages.map(p=>fs.readFile(path.join(target,p.file),'utf8')));
 await buildSeo(target);
 const after=await Promise.all(pages.map(p=>fs.readFile(path.join(target,p.file),'utf8')));
 for(let i=0;i<pages.length;i++)assert.ok(after[i]===before[i],pages[i].file+' generation must be repeatable');
 await buildPublic(target);
 for(const name of ['about.html','ai-strategy.html'])assert.equal(await fs.readFile(path.join(target,'public',name),'utf8'),await fs.readFile(path.join(target,name),'utf8'));
 await assert.rejects(fs.stat(path.join(target,'public/scripts/build-seo.cjs')),{code:'ENOENT'});
});
test('blog generator retains public authors, valid metadata and a sitemap without the CV gate',async t=>{
 const target=await fixture(t);
 execFileSync('python3',[path.join(target,'scripts/build_blog.py')],{cwd:target,stdio:'pipe'});
 for(const post of posts){
  const html=await fs.readFile(path.join(target,post.url+'.html'),'utf8');
  assert.match(html,/href="\/about" rel="author"/);
  assert.match(html,/href="\/contact">Start a conversation/);
  assert.equal(jsonld(html)['@graph'].find(n=>n['@type']==='Person').url,SITE+'/about');
 }
 assert.ok(!(await fs.readFile(path.join(target,'sitemap.xml'),'utf8')).includes('/digital-cv'));
});

test('public build contains no employer case study or work disclosures',async t=>{
 const target=await fixture(t);await buildSeo(target);await buildPublic(target);
 const files=[];async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else files.push(file);}}
 await walk(path.join(target,'public'));
 for(const file of files){assert.ok(!/case-study-airbus/i.test(file),'employer case-study file must not be published');if(/\.(html|xml|json|js|svg|txt)$/.test(file)){const text=await fs.readFile(file,'utf8');assert.ok(!/airbus|20\+ use cases|digital ambassadors|young voices|quality-improvement projects/i.test(text),path.relative(target,file)+' contains employer content');}}
});
