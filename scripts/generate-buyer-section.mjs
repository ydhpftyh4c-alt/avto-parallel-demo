import {readFile,writeFile} from 'node:fs/promises';
export async function generateBuyerSection(){
 const html=await readFile('index.html','utf8'),section=await readFile('catalog-section.html','utf8');
 const start='<!-- BUYER_CATALOG_START -->',end='<!-- BUYER_CATALOG_END -->';
 const a=html.indexOf(start),b=html.indexOf(end);if(a<0||b<a)throw Error('Buyer catalog insertion markers are missing');
 await writeFile('index.html',html.slice(0,a+start.length)+'\n'+section+'\n'+html.slice(b));
}
