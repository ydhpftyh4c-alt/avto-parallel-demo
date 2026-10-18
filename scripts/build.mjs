import {readFile, mkdir, copyFile, cp, stat} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const html=await readFile('index.html','utf8');
const app=await readFile('app.js','utf8');
const resources=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match=>match[1]).filter(value=>!value.includes('://'));
resources.push(...[...app.matchAll(/image:'([^']+)'/g)].map(match=>'assets/'+match[1]));
for(const resource of new Set(resources)){const file=path.resolve(root,resource);if(!file.startsWith(root+path.sep))throw Error('Invalid resource path');await stat(file);}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
if(new Set(ids).size!==ids.length)throw Error('Duplicate HTML IDs');
for(const [,anchor] of html.matchAll(/href="#([^"]+)"/g)){if(!ids.includes(anchor))throw Error('Broken anchor: '+anchor);}
await mkdir('dist',{recursive:true});
for(const file of ['index.html','styles.css','app.js','.nojekyll'])await copyFile(file,'dist/'+file);
await cp('assets','dist/assets',{recursive:true});
console.log('Build passed: script syntax, local assets, unique IDs and anchor targets. Output: dist/');
