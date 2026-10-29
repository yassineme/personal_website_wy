'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const MARKER='.generated-by-website-build';
const ROOT_FILES=[
  'index.html','privacy.html','blog.html','signals.html','mydigital-resume.html',
  'photospot-atlas.html','case-study-airbus-digitalization.html','brief-genai-operating-model.html',
  'script.js','site-config.js','site-ui.js','profile.js','booking.js','privacy.js','privacy-core.js',
  'ai-signals.js','ai-markets.js','signals-core.js','signals-archive.js','signals-reader.js',
  'journal.js','photospot-atlas.js','photospots-data.js',
  'styles.css','profile.css','typography-proposals.css','site-ui.css','privacy.css','ai-signals.css','ai-markets.css','signals-archive.css',
  'photospot-atlas.css','journal.css','tailwind.css','typography-fonts.css',
  'robots.txt','sitemap.xml','site.webmanifest','favicon.ico'
];
const DATA_FILES=['ai-signals.json','ai-perspective.json','ai-signals-snapshot.js'];
const ASSET_EXTENSIONS=new Set(['.png','.jpg','.jpeg','.webp','.avif','.svg','.ico','.woff','.woff2','.ttf','.otf','.json']);
async function buildPublic(root=path.resolve(__dirname,'..')) {
  const output=path.join(root,'public'),temporary=path.join(root,'.public-build-'+randomUUID());
  // Never replace a hand-authored public folder or follow a link to another location.
  let existing;
  try {existing=await fs.lstat(output);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(existing){
    const marker=await fs.readFile(path.join(output,MARKER),'utf8').catch(()=>null);
    if(!existing.isDirectory()||existing.isSymbolicLink()||marker!=='generated\n')throw Error('Refusing to replace an unowned public directory');
  }
  await fs.mkdir(temporary);
  let count=0;
  async function copy(relative,required=false) {
    const source=path.join(root,relative);let stat;
    const components=relative.split('/');
    for(let i=1;i<components.length;i++){const parent=await fs.lstat(path.join(root,...components.slice(0,i))).catch(error=>{if(error.code==='ENOENT'&&!required)return null;throw error;});if(!parent)return;if(parent.isSymbolicLink()||!parent.isDirectory())throw Error('Public tree must not contain symbolic links: '+relative);}
    try{stat=await fs.lstat(source);}catch(error){if(error.code==='ENOENT'&&!required)return;throw error;}
    if(stat.isSymbolicLink()||!stat.isFile())throw Error('Public asset must be a regular file: '+relative);
    const destination=path.join(temporary,relative);
    await fs.mkdir(path.dirname(destination),{recursive:true});await fs.copyFile(source,destination);count++;
  }
  async function walk(relative,accept) {
    let entries;
    try{const stat=await fs.lstat(path.join(root,relative));if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('Public tree must not contain symbolic links: '+relative);entries=await fs.readdir(path.join(root,relative),{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
    for(const entry of entries){
      if(entry.name.startsWith('.'))continue;
      const name=path.posix.join(relative,entry.name);
      if(entry.isSymbolicLink())throw Error('Public tree must not contain symbolic links: '+name);
      if(entry.isDirectory())await walk(name,accept);
      else if(entry.isFile()&&accept(name))await copy(name);
    }
  }
  try {
    for(const name of ROOT_FILES)await copy(name,name==='index.html');
    for(const name of DATA_FILES)await copy('data/'+name);
    await walk('assets',name=>ASSET_EXTENSIONS.has(path.extname(name).toLowerCase()) || name==='assets/cv-locked-preview.html' || ['assets/vendor/d3.v7.min.js','assets/vendor/topojson-client.min.js','assets/vendor/d3.LICENSE','assets/vendor/topojson-client.LICENSE','assets/map-data/world-atlas.LICENSE'].includes(name) || name.startsWith('assets/fonts/LICENSE-')&&name.endsWith('.txt'));
    await walk('blog',name=>['.html','.xml'].includes(path.extname(name).toLowerCase()));
    await copy('content/posts.json');
    await walk('content/posts',name=>path.extname(name).toLowerCase()==='.html');
    await fs.writeFile(path.join(temporary,MARKER),'generated\n');
    await fs.rm(output,{recursive:true,force:true});await fs.rename(temporary,output);
    return {output,files:count};
  } catch(error) {await fs.rm(temporary,{recursive:true,force:true});throw error;}
}
if(require.main===module)buildPublic().then(result=>console.log('Public build: '+result.files+' files. Server code, credentials and private documents excluded.')).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={buildPublic,ROOT_FILES};
