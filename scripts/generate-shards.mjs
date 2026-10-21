import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

export const shardCount = 64;
export const getShardKey = id => (String(id).split('').reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,0) % shardCount).toString(16).padStart(2,'0');

export async function generateShards(catalogData = null) {
  const data = catalogData || JSON.parse(await readFile('order-catalog.json', 'utf8'));
  const shards = {};
  for (let i = 0; i < shardCount; i++) {
    shards[i.toString(16).padStart(2, '0')] = {};
  }
  for (const car of data.listings) {
    if (car && car.id) {
      const key = getShardKey(car.id);
      shards[key][car.id] = car;
    }
  }
  await mkdir('data/records', {recursive: true});
  for (const [key, map] of Object.entries(shards)) {
    await writeFile(path.join('data/records', `shard-${key}.json`), JSON.stringify(map));
  }
  console.log(`Generated ${shardCount} vehicle lookup shards in data/records/`);
}
