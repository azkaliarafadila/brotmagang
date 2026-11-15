'use strict';
/* Public feed only. Profile and CV never leave the browser. */
(()=>{
let FEED=null;
const root=document.getElementById('discoveryRoot');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','&quot;':"&quot;","'":'&#39;'}[c]));
const text=(s,n=220)=>String(s||'').slice(0,n);
function render(){
 if(!root)return;
 const search=(document.getElementById('discoverySearch')?.value||'').toLowerCase();
 const data=(FEED?.opportunities||[]).filter(x=>[x.company,x.title,x.location,x.description].join(' ').toLowerCase().includes(search));
 const stamp=FEED?.updated_at?new Date(FEED.updated_at).toLocaleString():'No successful refresh yet';
 document.getElementById('discoveryMeta').textContent=`${data.length} public-feed leads · Last scan: ${stamp}`;
 root.innerHTML=data.length?data.map(j=>`<article class="discovery-card"><div><div class="discovery-top"><strong>${esc(j.company)}</strong><span class="verification">Source-listed · not verified</span></div><h3>${esc(j.title)}</h3><p>${esc(j.location)} · ${esc(j.source)} · Match score ${Number(j.score)||0}/100</p><p>${esc(text(j.description))}</p><p class="discovery-caveat">2027 availability, 4–8 week duration, eligibility and deadline are unconfirmed.</p></div><div class="discovery-actions"><a class="mini-btn" href="${esc(j.url)}" target="_blank" rel="noopener noreferrer">Check source ↗</a><button class="mini-btn strong" data-save-id="${esc(j.id)}">Save to my tracker ＋</button></div></article>`).join(''):`<div class="empty-state"><h3>No matching leads in current public feeds</h3><p>Try clearing the search. Sources may not have suitable internships yet.</p></div>`;
}
async function load(){
 document.getElementById('discoveryMeta').textContent='Loading public feeds…';
 try{
  const res=await fetch('./opportunities.json?ts='+Date.now(),{cache:'no-store'});
  if(!res.ok)throw Error('Feed not published yet');
  FEED=await res.json();render();
  if(FEED.errors?.length){document.getElementById('discoveryWarning').textContent='Some feeds failed: '+FEED.errors.join(', ');}
 }catch(e){
  document.getElementById('discoveryMeta').textContent='Discovery feed not ready';
  root.innerHTML='<div class="empty-state"><h3>First scan is pending</h3><p>Open GitHub Actions → Daily internship discovery → Run workflow to populate the dashboard.</p></div>';
 }
}
document.getElementById('discoverySearch')?.addEventListener('input',render);
document.getElementById('discoveryRefresh')?.addEventListener('click',load);
root?.addEventListener('click',async e=>{
 const button=e.target.closest('[data-save-id]');if(!button)return;
 const j=FEED?.opportunities.find(x=>x.id===button.dataset.saveId);if(!j)return;
 try{
  const already=STATE.jobs.some(x=>x.url===j.url);
  if(already){showToast('This opportunity is already saved.');return;}
  await req('/jobs','POST',{company:j.company,role:j.title,url:j.url,location:j.location,duration:'Unknown — verify 4–8 weeks',arrangement:'Check source',source_status:'UNVERIFIED',notes:`Discovered via ${j.source}; source-listed only. Score ${j.score}/100. Posted: ${j.posted_at||'Unknown'}. Verify 2027 eligibility, duration, location, deadline, and whether applications are open.`});
  await refresh();showToast('Lead saved to your local tracker. No application sent.');
 }catch(err){showToast(err.message||'Could not save',true);}
});
window.loadDiscovery=load;
async function loadBotStatus(){
 try{
  const r=await fetch('./bot_state.json?ts='+Date.now(),{cache:'no-store'});
  if(!r.ok)return;
  const state=await r.json(),decisions=Object.values(state.decisions||{});
  const el=document.getElementById('telegramDecisionStatus');
  if(el)el.textContent='Telegram approvals recorded: '+decisions.filter(x=>x.decision==='YES').length+' YES · '+decisions.filter(x=>x.decision==='NO').length+' NO (public, no application submitted)';
 }catch(e){}
}
document.addEventListener('DOMContentLoaded',()=>{load();loadBotStatus();});
})();
