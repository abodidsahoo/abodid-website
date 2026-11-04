import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({authorizeAdminRequest:vi.fn()}));
vi.mock('../../src/lib/admin/serverAuth',async original=>({...await original<any>(),authorizeAdminRequest:mocks.authorizeAdminRequest}));
import { GET } from '../../src/pages/api/admin/feedback/[slug]';
let client:any;let results:any[];let chain:any;
beforeEach(()=>{
 vi.clearAllMocks();results=[];chain={};for(const method of ['select','eq','in','single','order','range'])chain[method]=vi.fn(()=>chain);
 chain.then=(resolve:any,reject:any)=>Promise.resolve(results.shift()).then(resolve,reject);client={from:vi.fn(()=>chain)};
 mocks.authorizeAdminRequest.mockResolvedValue({ok:true,supabase:client});
});
const get=(slug='photography-album-thoughts')=>GET({request:new Request('https://abodid.com/api/admin/feedback/'+slug),params:{slug}}as any);
describe('private response collection authorization',()=>{
 it('never queries private responses for a signed-out or non-admin visitor',async()=>{
  for(const status of [401,403]){mocks.authorizeAdminRequest.mockResolvedValue({ok:false,response:Response.json({error:'Denied'},{status})});expect((await get()).status).toBe(status);}
  expect(client.from).not.toHaveBeenCalled();
 });
 it('only exposes the two intended collections to authenticated admins',async()=>{
  expect((await get('not-a-private-collection')).status).toBe(404);expect(client.from).not.toHaveBeenCalled();
 });
 it('shows current shared name/email while keeping the collections distinct',async()=>{
  const id='a7b0b28e-398b-46b0-a1e6-1fed1241a11b';
  results=[{data:{id:'album-form',event_title:'Album'},error:null},{data:[{id:'album-response',created_at:'2026-11-04',participant_name:'Old',participant_email:'old@example.com',answers:{album_thoughts:'Private album note'},metadata:{participant_id:id}}],count:1,error:null},{data:[{id,participant_name:'Original',participant_email:'original@example.com',metadata:{private_identity:{name:'Current',email:'current@example.com'}}}],error:null}];
  const response=await get();const payload=await response.json();expect(response.status).toBe(200);expect(payload.rows[0]).toMatchObject({name:'Current',email:'current@example.com',response:'Private album note',participant_id:id});
  expect(payload.rows[0]).not.toHaveProperty('metadata');expect(chain.eq).toHaveBeenCalledWith('form_id','album-form');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
 });
});
