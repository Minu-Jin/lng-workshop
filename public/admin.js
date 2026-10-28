'use strict';
const $=s=>document.querySelector(s);
let password='',state=null,busy=false,requestEpoch=0;
const menu=v=>v==='brunch'?'라브리끄':v==='pizza'?'브루클린':'미투표';
const participantLink=token=>new URL('/#vote='+encodeURIComponent(token),location.origin).href;
function status(text){$('#adminStatus').textContent=text;}
function setBusy(v){busy=v;for(const b of document.querySelectorAll('button'))b.disabled=v;}
async function request(action,extra={}){
 const r=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+password},body:JSON.stringify({action,...extra}),cache:'no-store',signal:AbortSignal.timeout(12000)});
 let data;try{data=await r.json();}catch(e){throw new Error('진행자 서버를 확인하지 못했습니다. Vercel 배포 주소에서 열어주세요.');}
 if(!r.ok)throw new Error(data.error||'진행자 요청을 처리하지 못했습니다.');return data;
}
function draw(){
 $('#total').textContent=state.total+' / '+state.capacity+'명';$('#brunch').textContent=state.counts.brunch+'표';$('#pizza').textContent=state.counts.pizza+'표';$('#demoNotice').hidden=!state.demo;
 const tbody=$('#participants');tbody.replaceChildren();
 for(const person of state.participants){const tr=document.createElement('tr');for(const t of [String(person.participant_id).padStart(2,'0')+'번',menu(person.choice)]){const td=document.createElement('td');td.textContent=t;tr.append(td);}
  for(const [text,value] of [['링크 복사',participantLink(person.vote_token)],['코드 복사',person.vote_token]]){const td=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='light';button.textContent=text;button.onclick=()=>void copy(value,person.participant_id+'번 '+text+' 완료');td.append(button);tr.append(td);}tbody.append(tr);
 }
 $('#resetAll').disabled=busy||state.total===0;
}
async function copy(value,message){
 try{await navigator.clipboard.writeText(value);status(message);}
 catch(e){const input=document.createElement('textarea');input.value=value;input.setAttribute('readonly','');input.style.position='fixed';input.style.top='0';document.body.append(input);input.select();let done=false;try{done=document.execCommand('copy');}catch(err){}input.remove();status(done?message:'복사하지 못했습니다. 개인 참여 링크 CSV를 저장해서 확인해주세요.');}
}
async function load(){
 if(busy)return;const epoch=requestEpoch;setBusy(true);status('공동 집계를 확인하고 있습니다…');
 try{const data=await request('list');if(epoch!==requestEpoch)return;state=data;$('#loginPanel').hidden=true;$('#dashboard').hidden=false;$('#adminPassword').value='';draw();status('공동 집계 확인 · '+new Date().toLocaleTimeString('ko-KR'));}
 catch(e){status(e.message);}
 finally{if(epoch===requestEpoch){setBusy(false);if(state)draw();}}
}
$('#login').onsubmit=e=>{e.preventDefault();if(busy)return;password=$('#adminPassword').value;if(!/^[\x21-\x7e]{16,128}$/.test(password)){status('진행자 비밀번호는 공백 없이 영문·숫자·기호 16~128자로 설정해주세요.');return;}void load();};
$('#refresh').onclick=()=>void load();
$('#logout').onclick=()=>{requestEpoch++;password='';state=null;$('#participants').replaceChildren();$('#dashboard').hidden=true;$('#loginPanel').hidden=false;$('#adminPassword').value='';status('로그아웃했습니다.');setBusy(false);};
function download(name,rows){const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#exportResults').onclick=()=>{if(!state)return;download('LNG_Workshop_Vote_Results.csv',[['참가 번호','저녁메뉴 투표'],...state.participants.map(p=>[p.participant_id,menu(p.choice)]),[],['메뉴','득표수'],['라브리끄',state.counts.brunch],['브루클린',state.counts.pizza],['조회 시각',state.fetchedAt]]);};
$('#exportInvites').onclick=()=>{if(!state)return;download('LNG_Workshop_Private_Participation_Links.csv',[['참가 번호','개인 참여 링크','참여 코드'],...state.participants.map(p=>[p.participant_id,participantLink(p.vote_token),p.vote_token])]);};
$('#resetAll').onclick=()=>$('#resetDialog').showModal();$('#cancelReset').onclick=()=>$('#resetDialog').close();
$('#confirmReset').onclick=async()=>{if(busy)return;setBusy(true);status('전체 투표를 초기화하고 있습니다…');try{await request('reset',{confirm:'RESET_ALL_VOTES'});$('#resetDialog').close();setBusy(false);await load();}catch(e){status(e.message);}finally{setBusy(false);if(state)draw();}};
