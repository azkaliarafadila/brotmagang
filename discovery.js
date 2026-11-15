'use strict';
/* Public feed only. Profile and CV never leave the browser. */
(()=>{
let FEED=null;
const DECISION_KEY='brotmagang-discovery-decisions-v1';
let decisions={};try{decisions=JSON.parse(localStorage.getItem(DECISION_KEY))||{};}catch{}
const root=document.getElementById('discoveryRoot');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','&quot;':"&quot;","'":'&#39;'}[c]));
const text=(s,n=220)=>String(s||'').slice(0,n);
function render(){
 if(!root)return;
 const search=(document.getElementById('discoverySearch')?.value||'').toLowerCase();
 const data=(FEED?.opportunities||[]).filter(x=>[x.company,x.title,x.location,x.description].join(' ').toLowerCase().includes(search)&&decisions[x.id]!=='NO');
 const stamp=FEED?.updated_at?new Date(FEED.updated_at).toLocaleString():'No successful refresh yet';
 document.getElementById('discoveryMeta').textContent=`${data.length} public-feed leads · Last scan: ${stamp}`;
 root.innerHTML=data.length?data.map(j=>`<article class="discovery-card"><div><div class="discovery-top"><strong>${esc(j.company)}</strong><span class="verification">Source-listed · not verified</span></div><h3>${esc(j.title)}</h3><p>${esc(j.location)} · ${esc(j.source)} · Match score ${Number(j.score)||0}/100</p><p>${esc(text(j.description))}</p><p class="discovery-caveat">2027 availability, 4–8 week duration, eligibility and deadline are unconfirmed.</p></div><div class="discovery-actions"><a class="mini-btn" href="${esc(j.url)}" target="_blank" rel="noopener noreferrer">Check source ↗</a>${decisions[j.id]==='YES'?'<span class="soft-pill pill-approved">✓ YES · Shortlisted</span>':`<button class="mini-btn strong" data-decision="YES" data-job-id="${esc(j.id)}">✓ YES</button>`}<button class="mini-btn" data-decision="NO" data-job-id="${esc(j.id)}">✕ NO</button></div></article>`).join(''):`<div class="empty-state"><h3>No matching leads in current public feeds</h3><p>Try clearing the search. Sources may not have suitable internships yet.</p></div>`;
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
 const button=e.target.closest('[data-decision]');if(!button)return;
 const j=FEED?.opportunities.find(x=>x.id===button.dataset.jobId);if(!j)return;
 const decision=button.dataset.decision;
 try{
  if(decision==='YES'&&!STATE.jobs.some(x=>x.url===j.url)){
   await req('/jobs','POST',{company:j.company,role:j.title,url:j.url,location:j.location,duration:'Unknown — verify 4–8 weeks',arrangement:'Check source',source_status:'UNVERIFIED',notes:`Shortlisted YES in discovery. Found via ${j.source}; keyword match ${j.score}/100. This is NOT permission to submit an employer application. Verify eligibility, 2027 dates, duration, deadline and source.`});
   await refresh();
  }
  decisions[j.id]=decision;
  localStorage.setItem(DECISION_KEY,JSON.stringify(decisions));
  render();
  showToast(decision==='YES'?'YES saved: shortlisted locally, no application submitted.':'NO saved: hidden from recommendations.');
 }catch(err){showToast(err.message||'Unable to save decision',true);}
});
window.loadDiscovery=load;
document.addEventListener('DOMContentLoaded',load);
})();
