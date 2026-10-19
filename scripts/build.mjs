import {readFile, mkdir, copyFile, cp, stat} from 'node:fs/promises';
import path from 'node:path';
import {generateCatalog} from './generate-catalog.mjs';
import './check-data.mjs';
import './check-import-data.mjs';
import {generateImportCatalog} from './generate-import-catalog.mjs';
const root=process.cwd();
const html=await readFile('index.html','utf8');
const app=await readFile('app.js','utf8');
const catalog=await generateCatalog();
const importCatalog=await generateImportCatalog();
if(new Set(catalog.map(car=>car.id)).size!==catalog.length)throw Error('Duplicate listing IDs');
for(const car of catalog){if(!car.image || (car.price!==null && !(car.price>0)) || !car.date || !car.priceDate)throw Error('Incomplete listing: '+car.name);}
const resources=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match=>match[1]).filter(value=>!/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(value));
resources.push(...importCatalog.map(car=>car.image));
resources.push(...catalog.flatMap(car=>[car.image,...car.images]));
for(const resource of new Set(resources)){const file=path.resolve(root,resource);if(!file.startsWith(root+path.sep))throw Error('Invalid resource path');await stat(file);}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
if(new Set(ids).size!==ids.length)throw Error('Duplicate HTML IDs');
for(const [,anchor] of html.matchAll(/href="#([^"]+)"/g)){if(!ids.includes(anchor))throw Error('Broken anchor: '+anchor);}
await mkdir('dist',{recursive:true});
for(const file of ['index.html','styles.css','app.js','catalog-data.js','import-catalog-data.js','.nojekyll'])await copyFile(file,'dist/'+file);
await cp('assets','dist/assets',{recursive:true});
await cp('data/vehicles','dist/data/vehicles',{recursive:true});
console.log('Build passed: script syntax, local assets, unique IDs and anchor targets. Output: dist/');

