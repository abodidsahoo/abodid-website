import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import seeds from '../../src/data/feedbackForms.seed.json';
import {createReceipt,readReceipt,followUpToken,NIFT_SLUG}from'../../src/lib/feedback/receipt';
const mocks=vi.hoisted(()=>({feedbackClient:vi.fn(),getFeedbackForm:vi.fn(),sendResourceEmail:vi.fn(),loadIdentity:vi.fn(),updateIdentity:vi.fn(),identityCookie:vi.fn(()=>'mock-cookie')}));
vi.mock('../../src/lib/feedback/server',()=>mocks);
vi.mock('../../src/lib/feedback/resource-email',()=>({sendResourceEmail:mocks.sendResourceEmail}));
vi.mock('../../src/lib/feedback/identity',()=>({loadIdentity:mocks.loadIdentity,updateIdentity:mocks.updateIdentity,identityCookie:mocks.identityCookie}));
import {POST}from'../../src/pages/nift-workshop-resources/email';
let cookie:string,token:string;
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('FEEDBACK_RECEIPT_SECRET','mail-test-secret');cookie=createReceipt(NIFT_SLUG,'a7b0b28e-398b-46b0-a1e6-1fed1241a11b');token=followUpToken(readReceipt(cookie,NIFT_SLUG)!);
 const chain:any={};for(const method of ['select','eq'])chain[method]=()=>chain;chain.maybeSingle=async()=>({data:{id:'source-id',metadata:{}},error:null});
 mocks.feedbackClient.mockReturnValue({from:()=>chain});mocks.getFeedbackForm.mockResolvedValue({...seeds[1],id:'nift'});mocks.loadIdentity.mockResolvedValue({name:'Asha'});mocks.sendResourceEmail.mockResolvedValue({status:'sent'});
});
afterEach(()=>vi.unstubAllEnvs());
const send=(fields={},proof=cookie)=>POST({request:new Request('https://abodid.com/nift-workshop-resources/email',{method:'POST',headers:{Origin:'https://abodid.com',Accept:'application/json',Cookie:'nift_lecture_receipt='+proof},body:new URLSearchParams({email:'asha@example.com',submission_key:'65c2283c-2cbf-4c7e-a3c0-600b5ad34173',follow_up_token:token,...fields})})}as any);
it('sends server-selected links with the saved participant name',async()=>{
 expect(await(await send()).json()).toEqual({ok:true,status:'sent'});expect(mocks.sendResourceEmail).toHaveBeenCalledWith(expect.objectContaining({name:'Asha',email:'asha@example.com',responseId:'source-id',form:expect.objectContaining({id:'nift'})}));
});
it('requires a saved receipt, CSRF proof and valid email',async()=>{
 expect((await send({},'')).status).toBe(403);expect((await send({follow_up_token:'bad'})).status).toBe(403);expect((await send({email:'bad'})).status).toBe(400);expect(mocks.sendResourceEmail).not.toHaveBeenCalled();
});
it('reports a failed send without claiming success',async()=>{
 mocks.sendResourceEmail.mockResolvedValue({status:'failed'});expect((await send()).status).toBe(503);
});
