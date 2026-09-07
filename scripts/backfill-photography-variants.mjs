// Dry-run by default. --upload is an explicit, separate publishing action.
import fs from 'node:fs';
import dotenv from 'dotenv';
import sharp from 'sharp';
import {S3Client,PutObjectCommand} from '@aws-sdk/client-s3';
import {buildCatalog} from '../src/lib/photography/catalog.mjs';
const inventory=JSON.parse(fs.readFileSync('/tmp/photography-audit/inventory.json'));
const originals=new Map(inventory.map(x=>[x.key,x]));
const photos=buildCatalog(inventory);
const jobs=photos.map(photo=>({photo,sizes:[...(photo.small===photo.original?[800]:[]),...(!photo.large.includes('/1600/')?[1600]:[])]})).filter(x=>x.sizes.length);
console.log(JSON.stringify({originals:jobs.length,files:jobs.reduce((n,j)=>n+j.sizes.length,0),upload:process.argv.includes('--upload')}));
if(!process.argv.includes('--upload'))process.exit(0);
const env={...process.env,...dotenv.parse(fs.readFileSync('.env')),...(fs.existsSync('.env.local')?dotenv.parse(fs.readFileSync('.env.local')):{})};
const client=new S3Client({region:'auto',forcePathStyle:true,endpoint:`https://${env.R2_ACCOUNT_ID.match(/[a-f0-9]{32}/i)[0]}.r2.cloudflarestorage.com`,credentials:{accessKeyId:env.R2_ACCESS_KEY_ID,secretAccessKey:env.R2_SECRET_ACCESS_KEY}});
let cursor=0,done=0;const failed=[];
await Promise.all(Array.from({length:4},async()=>{while(cursor<jobs.length){const {photo,sizes}=jobs[cursor++];try{const response=await fetch(photo.original,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const source=Buffer.from(await response.arrayBuffer());const original=originals.get(photo.key);const relative=photo.key.slice('photos/originals/'.length);const slash=relative.lastIndexOf('/');const stem=relative.slice(slash+1).replace(/\.[^.]+$/,'');for(const size of sizes){const key=`photos/variants/${relative.slice(0,slash)}/${size}/${stem}-${original.etag.slice(0,10)}.webp`;const output=await sharp(source).rotate().resize({width:size,withoutEnlargement:true}).webp({quality:82}).toBuffer();await client.send(new PutObjectCommand({Bucket:'assets',Key:key,Body:output,ContentType:'image/webp',CacheControl:'public, max-age=31536000, immutable',IfNoneMatch:'*'}));}done++;if(done%25===0)console.log(`Prepared ${done}/${jobs.length}`);}catch(error){failed.push({key:photo.key,error:error.message});}}}));
client.destroy();fs.writeFileSync('/tmp/photography-audit/backfill-result.json',JSON.stringify({done,failed},null,2));console.log({done,failed});if(failed.length)process.exitCode=1;
