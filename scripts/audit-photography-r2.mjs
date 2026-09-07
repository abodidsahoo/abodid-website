import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(process.cwd()+'/package.json');
const dotenv=require('dotenv');const {S3Client,ListObjectsV2Command}=require('@aws-sdk/client-s3');
const env={...process.env,...dotenv.parse(fs.readFileSync('.env')),...(fs.existsSync('.env.local')?dotenv.parse(fs.readFileSync('.env.local')):{})};
const client=new S3Client({region:'auto',forcePathStyle:true,endpoint:`https://${env.R2_ACCOUNT_ID.match(/[a-f0-9]{32}/i)[0]}.r2.cloudflarestorage.com`,credentials:{accessKeyId:env.R2_ACCESS_KEY_ID,secretAccessKey:env.R2_SECRET_ACCESS_KEY}});
let token,objects=[];do{const r=await client.send(new ListObjectsV2Command({Bucket:'assets',Prefix:'photos/',ContinuationToken:token}));objects.push(...(r.Contents||[]).map(x=>({key:x.Key,etag:x.ETag?.replaceAll('"','')})));token=r.IsTruncated?r.NextContinuationToken:undefined;}while(token);
fs.writeFileSync('/tmp/photography-audit/inventory.json',JSON.stringify(objects));
const {buildCatalog}=await import(process.cwd()+'/src/lib/photography/catalog.mjs');const photos=buildCatalog(objects);const counts={};for(const p of photos){const f=p.key.split('/')[2];const c=counts[f]??={total:0,small:0,large:0};c.total++;if(p.small.includes('/variants/'))c.small++;if(p.large.includes('/variants/'))c.large++;}console.log(JSON.stringify(counts,null,2));console.log('Sample variants:',objects.filter(x=>x.key.includes('/variants/outernet-london-2024/')).slice(0,5));
