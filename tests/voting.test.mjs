import {test,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {votesHandler,adminHandler} from '../lib/voting-service.js';
import {makeMockDatabase,MOCK_SECRET,MOCK_PASSWORD,MOCK_URL} from '../scripts/mock-database.mjs';
let db,originalFetch,originalEnv;
beforeEach(()=>{originalFetch=globalThis.fetch;originalEnv={...process.env};db=makeMockDatabase();globalThis.fetch=db.fetchMock;process.env.SUPABASE_URL=MOCK_URL;process.env.SUPABASE_SECRET_KEY=MOCK_SECRET;process.env.WORKSHOP_ADMIN_PASSWORD=MOCK_PASSWORD;});
afterEach(()=>{globalThis.fetch=originalFetch;for(const k of ['SUPABASE_URL','SUPABASE_SECRET_KEY','WORKSHOP_ADMIN_PASSWORD']){if(originalEnv[k]===undefined)delete process.env[k];else process.env[k]=originalEnv[k];}});
async function call(handler,{method='GET',data,headers={},raw}={}){
 const req={method,headers:{host:'workshop.test',...(method==='POST'?{'content-type':'application/json'}:{}),...headers},body:raw===undefined?data:raw};
 const response={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(v){this.body=JSON.parse(v);}};
 await handler(req,response);return response;
}
const vote=(id,choice='brunch')=>call(votesHandler,{method:'POST',data:{action:'vote',token:db.rows[id-1].vote_token,choice}});
const admin=(action,extra={})=>call(adminHandler,{method:'POST',headers:{authorization:'Bearer '+MOCK_PASSWORD},data:{action,...extra}});
test('public result reveals totals only, never codes, IDs or individual choices',async()=>{
 await vote(1,'pizza');const r=await call(votesHandler);assert.equal(r.statusCode,200);assert.equal(r.body.total,1);assert.deepEqual(r.body.counts,{brunch:0,pizza:1});assert.equal(r.body.capacity,11);assert.ok(!JSON.stringify(r.body).includes(db.rows[0].vote_token));assert.ok(!('participants' in r.body));assert.equal(r.headers['cache-control'],'no-store, max-age=0');
});
test('valid token identifies only its owner; spoofing another ID cannot change the other ballot',async()=>{
 const token=db.rows[0].vote_token;const r=await call(votesHandler,{method:'POST',data:{action:'identify',token}});assert.deepEqual(r.body,{participantId:1,choice:null});await call(votesHandler,{method:'POST',data:{action:'vote',token,participant_id:2,choice:'pizza'}});assert.equal(db.rows[0].choice,'pizza');assert.equal(db.rows[1].choice,null);
});
test('11 concurrent participants are counted once; repeats and changes never create a twelfth vote',async()=>{
 await Promise.all(db.rows.map((_,i)=>vote(i+1,i%2?'brunch':'pizza')));let r=await call(votesHandler);assert.equal(r.body.total,11);assert.deepEqual(r.body.counts,{brunch:5,pizza:6});await vote(1,'pizza');await vote(1,'brunch');r=await call(votesHandler);assert.equal(r.body.total,11);assert.deepEqual(r.body.counts,{brunch:6,pizza:5});assert.equal(db.rows.length,11);
});
test('withdraw affects only own row',async()=>{await vote(1);await vote(2,'pizza');const r=await call(votesHandler,{method:'POST',data:{action:'withdraw',token:db.rows[0].vote_token}});assert.equal(r.body.choice,null);assert.equal(db.rows[1].choice,'pizza');assert.equal((await call(votesHandler)).body.total,1);});
test('bad or unknown tokens, invalid choices and unsupported actions cannot mutate votes',async()=>{
 for(const data of [{action:'vote',token:'not-a-code',choice:'pizza'},{action:'vote',token:'11111111-1111-4111-8111-111111111111',choice:'pizza'},{action:'vote',token:db.rows[0].vote_token,choice:'anything'},{action:'reset',token:db.rows[0].vote_token}]){const r=await call(votesHandler,{method:'POST',data});assert.ok([400,401].includes(r.statusCode));}assert.ok(db.rows.every(r=>r.choice===null));
});
test('admin endpoints reject visitors, wrong passwords and reset without explicit confirmation',async()=>{
 await vote(1);assert.equal((await call(adminHandler,{method:'POST',data:{action:'list'}})).statusCode,401);assert.equal((await call(adminHandler,{method:'POST',headers:{authorization:'Bearer wrong'},data:{action:'reset',confirm:'RESET_ALL_VOTES'}})).statusCode,401);assert.equal((await admin('reset')).statusCode,400);assert.equal(db.rows[0].choice,'brunch');
});
test('authorized admin lists codes and resets choices while retaining every invitation',async()=>{
 await vote(1);await vote(2);const oldCodes=db.rows.map(r=>r.vote_token);const list=await admin('list');assert.equal(list.statusCode,200);assert.equal(list.body.participants.length,11);assert.equal(list.body.participants[0].vote_token,oldCodes[0]);const r=await admin('reset',{confirm:'RESET_ALL_VOTES'});assert.equal(r.body.total,0);assert.ok(db.rows.every(r=>r.choice===null));assert.deepEqual(db.rows.map(r=>r.vote_token),oldCodes);
});
test('missing configuration, upstream failures, and wrong DB schema fail closed without leaking secrets',async()=>{
 delete process.env.SUPABASE_SECRET_KEY;assert.equal((await call(votesHandler)).statusCode,503);process.env.SUPABASE_SECRET_KEY=MOCK_SECRET;globalThis.fetch=async()=>new Response(JSON.stringify({message:'secret '+MOCK_SECRET}),{status:403});const r=await call(votesHandler);assert.equal(r.statusCode,503);assert.ok(!JSON.stringify(r).includes(MOCK_SECRET));globalThis.fetch=db.fetchMock;db.rows.pop();assert.equal((await call(votesHandler)).statusCode,503);
});
test('new secret uses apikey header without an invalid Bearer secret',async()=>{await call(votesHandler);assert.equal(db.calls[0].headers.apikey,MOCK_SECRET);assert.ok(!db.calls[0].headers.Authorization);});
test('malformed, oversized, wrong content type, cross-origin and unsupported HTTP requests are rejected',async()=>{
 assert.equal((await call(votesHandler,{method:'POST',raw:'{'})).statusCode,400);assert.equal((await call(votesHandler,{method:'POST',raw:'x'.repeat(2049)})).statusCode,413);assert.equal((await call(votesHandler,{method:'POST',data:{},headers:{'content-type':'text/plain'}})).statusCode,415);assert.equal((await call(votesHandler,{method:'POST',data:{},headers:{origin:'https://another.test'}})).statusCode,403);assert.equal((await call(votesHandler,{method:'DELETE'})).statusCode,405);assert.equal((await call(adminHandler)).statusCode,405);
});
