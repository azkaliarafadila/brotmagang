'use strict';
let STATE = {jobs:[],events:[],profile:{},resume:null,capabilities:{}};
let PAGE = 'overview';
let CODE = sessionStorage.getItem('icc_access_code') || '';
let toastTimer;

const $ = (id) => document.getElementById(id);
const ESC = (str) => String(str ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const datefmt = s => {if(!s)return '—';try{return new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch{return s;}};
const LABELS={SAVED:'Saved',AWAITING_APPROVAL:'Needs your YES',APPROVED:'Approved',NEEDS_ACTION:'Needs action',APPLIED:'Applied (recorded)',DECLINED:'Declined'};
const STATUS_LABELS={UNVERIFIED:'Unverified',VERIFIED_OPEN:'Verified open',UPCOMING:'Announced upcoming',HISTORICAL:'Historical',OUTREACH_TARGET:'Outreach target',CLOSED:'Closed'};
const PROFILE_FIELDS=[
 ['full_name','Full name','text','Your name'],['email','Email address','email','name@email.com'],
 ['phone','Phone number','tel','+62 ...'],['location','Base location','text','Jakarta, Indonesia'],
 ['university','University','text','Institut Teknologi Bandung'],['degree','Degree / specialization','text','Electrical Engineering'],
 ['graduation_year','Expected graduation year','text','2028'],['gpa','GPA (only if verified)','text','e.g. 3.69 / 4.00'],
 ['linkedin','LinkedIn URL','url','https://linkedin.com/in/...'],['portfolio','Portfolio URL','url','https://...'],
 ['citizenship','Citizenship','text','Indonesian'],['work_authorization','Work authorization notes','text','Country-specific eligibility'],
 ['availability_start','Earliest starting date','date',''],['availability_end','Latest end date','date',''],
 ['preferred_duration','Preferred duration','text','4–8 weeks'],['notification_email','Email for submission alerts','email','name@email.com'],
 ['skills','Skills and tools (accurate level)','textarea','Excel, PowerFactory (basic), ...'],
 ['summary','Professional summary','textarea','A short, truthful introduction'],
 ['notes','Other context','textarea','Constraints, target functions, preferences']
];
function showToast(message,isError=false){const t=$('toast');t.textContent=message;t.className='toast show'+(isError?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3400);}
function authHeaders(extra={}){return {...extra,...(CODE?{'Authorization':'Bearer '+CODE}:{})};}
async function api(path, options={}){
  const response=await fetch('/api'+path,{...options,headers:authHeaders(options.headers||{})});
  if(response.status===401){$('lockScreen').hidden=false;throw new Error('Please enter your access code.');}
  let data;try{data=await response.json();}catch{throw new Error('Unexpected server response');}
  if(!response.ok){const detail=data.detail;throw new Error(typeof detail==='string'?detail:JSON.stringify(detail));}
  return data;
}
const json={ 'Content-Type':'application/json' };
const req=(path,method='POST',body={})=>api(path,{method,headers:json,body:JSON.stringify(body)});
async function refresh(){STATE=await api('/state');render();}
function navigate(page){PAGE=page;document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id==='page-'+page));document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===page));$('breadcrumbPage').textContent=page==='approvals'?'Approval queue':page==='profile'?'My profile':page==='opportunities'?'Opportunities':page==='activity'?'Activity':'Overview';window.scrollTo(0,0);}
function pill(stage){const cls=stage==='AWAITING_APPROVAL'?'awaiting':stage.toLowerCase();return `<span class="soft-pill pill-${cls}">${ESC(LABELS[stage]||stage)}</span>`;}
function logo(c){return `<div class="company-logo">${ESC(c.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase())}</div>`;}
function render(){
  $('metricJobs').textContent=STATE.jobs.length;
  $('metricPending').textContent=STATE.jobs.filter(j=>j.stage==='AWAITING_APPROVAL').length;
  $('metricApproved').textContent=STATE.jobs.filter(j=>j.stage==='APPROVED').length;
  $('metricApplied').textContent=STATE.jobs.filter(j=>j.stage==='APPLIED').length;
  $('sideJobCount').textContent=STATE.jobs.length;
  $('sideApprovalCount').textContent=STATE.jobs.filter(j=>j.stage==='AWAITING_APPROVAL').length;
  renderOverview(); renderJobs(); renderApprovals(); renderProfile(); renderActivity();
}
function renderOverview(){
  const nodes=STATE.jobs.slice(0,4).map(j=>`<div class="recent-item">${logo(j.company)}<div><div class="recent-name">${ESC(j.company)}</div><div class="recent-sub">${ESC(j.role)}</div></div><div class="recent-right">${pill(j.stage)}</div><button class="recent-arrow" data-action="details" data-id="${j.id}">↗</button></div>`);
  $('overviewJobs').innerHTML=nodes.join('')||'<div class="blank-text">Nothing in your pipeline yet. Add a target to get started.</div>';
  const checks=[
    {done:!!STATE.resume,title:'Upload your CV',sub:'PDF or DOCX, reviewed before autofill',page:'profile'},
    {done:!!STATE.profile.full_name&&!!STATE.profile.email,title:'Complete your candidate profile',sub:'Name, email, education & availability',page:'profile'},
    {done:STATE.jobs.length>0,title:'Save your first opportunity',sub:'Create a verified lead or outreach target',page:'opportunities'},
    {done:STATE.jobs.some(j=>['AWAITING_APPROVAL','APPROVED','APPLIED'].includes(j.stage)),title:'Start your approval workflow',sub:'One specific YES for each application',page:'approvals'},
  ];
  $('checklist').innerHTML=checks.map(c=>`<div class="check-row"><div class="check-mark ${c.done?'done':''}">${c.done?'✓':'○'}</div><div><strong>${ESC(c.title)}</strong><p>${ESC(c.sub)}</p></div><button data-page="${c.page}">${c.done?'View ↗':'Start ↗'}</button></div>`).join('');
}
function renderJobs(){
  const search=$('jobSearch').value.toLowerCase();const stage=$('stageFilter').value;
  const jobs=STATE.jobs.filter(j=>(stage==='ALL'||j.stage===stage)&&[j.company,j.role,j.location,j.notes].join(' ').toLowerCase().includes(search));
  $('jobsBody').innerHTML=jobs.map(j=>`<tr><td><div class="company-cell">${logo(j.company)}<div><strong>${ESC(j.company)}</strong><span>${ESC(j.role)}</span></div></div></td><td><span class="verification">${ESC(STATUS_LABELS[j.source_status]||j.source_status)}</span></td><td>${ESC(j.location||'—')}<br/><span style="color:#abb5c4;font-size:10px">${ESC(j.duration||'Duration unknown')}</span></td><td>${pill(j.stage)}</td><td><div class="job-actions">${actionButtons(j)}<button class="mini-btn" data-action="details" data-id="${j.id}">Details</button></div></td></tr>`).join('');
  $('jobsEmpty').hidden=jobs.length>0;
  $('jobsBody').closest('.table-responsive').hidden=jobs.length===0;
}
function actionButtons(j){
  if(j.stage==='SAVED'||j.stage==='DECLINED'||j.stage==='NEEDS_ACTION')return `<button class="mini-btn strong" data-action="request" data-id="${j.id}">Review →</button>`;
  if(j.stage==='AWAITING_APPROVAL')return `<button class="mini-btn strong" data-action="decision" data-id="${j.id}">Decide →</button>`;
  if(j.stage==='APPROVED')return `<button class="mini-btn strong" data-action="pack" data-id="${j.id}">Prepare ↗</button>`;
  return '<span style="color:#269b75;font-weight:800;font-size:10px">✓ Recorded</span>';
}
function renderApprovals(){
  const priority={AWAITING_APPROVAL:0,APPROVED:1,SAVED:2,NEEDS_ACTION:2,APPLIED:3,DECLINED:4};
  const jobs=STATE.jobs.slice().sort((a,b)=>(priority[a.stage]??6)-(priority[b.stage]??6));
  $('approvalList').innerHTML=jobs.map(j=>`<div class="approval-card"><div class="approval-card-main"><div class="approval-company">${ESC(j.company)}</div><div class="approval-role">${ESC(j.role)}</div><div class="approval-detail"><span>${ESC(j.location||'Location unknown')}</span><span>•</span><span>${ESC(j.duration||'Duration not specified')}</span><span>•</span><span>${ESC(STATUS_LABELS[j.source_status])}</span></div></div><div class="approval-actions">${pill(j.stage)}${actionButtons(j)}<button class="mini-btn" data-action="details" data-id="${j.id}">View</button></div></div>`).join('')||'<div class="panel blank-text">Your approval queue is empty. Add a target before requesting review.</div>';
}
function renderProfile(){
  const p=STATE.profile;
  $('profileFields').innerHTML=PROFILE_FIELDS.map(([key,label,type,placeholder])=>`<div class="input-group ${type==='textarea'?'wide':''}"><label for="p-${key}">${ESC(label)}</label>${type==='textarea'?`<textarea id="p-${key}" name="${key}" placeholder="${ESC(placeholder)}">${ESC(p[key]||'')}</textarea>`:`<input id="p-${key}" name="${key}" type="${type}" value="${ESC(p[key]||'')}" placeholder="${ESC(placeholder)}"/>`}</div>`).join('');
  $('resumeDisplay').innerHTML=STATE.resume?`<div style="padding:10px 12px;background:#edf9f3;border-radius:8px;color:#268b69"><strong>✓ ${ESC(STATE.resume.filename)}</strong><br/>Uploaded ${datefmt(STATE.resume.uploaded_at)} · ${(STATE.resume.bytes/1024).toFixed(0)} KB</div>`:'<span>No CV uploaded yet</span>';
  const ready=[['Resume uploaded',!!STATE.resume],['Full name and email',!!p.full_name&&!!p.email],['Education information',!!p.university&&!!p.degree],['Availability window',!!p.availability_start&&!!p.availability_end],['Notification email configured',STATE.capabilities.email_notifications]];
  $('readiness').innerHTML=ready.map(([label,ok])=>`<div class="readiness-step ${ok?'good':''}"><strong>${ESC(label)}</strong><span>${ok?'✓ Ready':'○ Pending'}</span></div>`).join('');
}
function renderActivity(){
  $('activityList').innerHTML=STATE.events.map(e=>`<div class="activity-row"><div class="event-icon">${e.kind==='applied'?'↗':e.kind==='approved'?'✓':e.kind==='resume'?'⇧':'•'}</div><div><strong>${ESC(e.message)}</strong><p>${datefmt(e.created_at)} · ${ESC(e.kind.replaceAll('_',' '))}</p></div></div>`).join('')||'<div class="blank-text">No actions recorded yet.</div>';
  $('emailAvailability').textContent=STATE.capabilities.email_notifications?'SMTP configured: a notice is sent after a submission is recorded with evidence.':'Not configured. In-app activity logging works; set SMTP environment variables to receive email alerts.';
}
function openModal(title,kicker,body,buttons){$('modalTitle').textContent=title;$('modalKicker').textContent=kicker;$('modalBody').innerHTML=body;$('modalActions').innerHTML=buttons;$('modalOverlay').hidden=false;}
function closeModal(){$('modalOverlay').hidden=true;$('modalBody').innerHTML='';$('modalActions').innerHTML='';}
function jobModal(j=null){
  const x=j||{company:'',role:'',url:'',location:'',duration:'4–8 weeks',arrangement:'Unspecified',source_status:'UNVERIFIED',notes:''};
  const fields=[['company','Company *','text','e.g. Schneider Electric'],['role','Position or target function *','text','e.g. Business Operations Intern'],['url','Application URL (HTTPS)','url','https://careers.example.com/...'],['location','Location','text','Jabodetabek / Remote / Singapore'],['duration','Duration / known constraint','text','4–8 weeks'],['arrangement','Work arrangement','text','Onsite / Hybrid / Remote']];
  let html='<form id="jobForm"><div class="form-grid">'+fields.map(([name,label,type,placeholder])=>`<div class="input-group ${name==='url'?'wide':''}"><label for="j-${name}">${label}</label><input id="j-${name}" type="${type}" name="${name}" ${['company','role'].includes(name)?'required':''} value="${ESC(x[name])}" placeholder="${ESC(placeholder)}"/></div>`).join('')+`<div class="input-group wide"><label for="j-status">Verification status</label><select name="source_status" id="j-status">${Object.entries(STATUS_LABELS).map(([k,v])=>`<option value="${k}" ${x.source_status===k?'selected':''}>${ESC(v)}</option>`).join('')}</select></div><div class="input-group wide"><label for="j-notes">Why this company / eligibility / notes</label><textarea name="notes" id="j-notes" placeholder="Include source and evidence for verified status">${ESC(x.notes)}</textarea></div></div></form>`;
  openModal(j?'Edit opportunity':'Add opportunity',j?'EDIT TARGET':'NEW TARGET',html,`<button class="secondary-btn" data-action="close">Cancel</button><button class="primary-btn" data-action="save-job" data-id="${j?.id||''}">${j?'Save changes':'Add to pipeline'} ↗</button>`);
}
function viewJob(j){
  const body=`<div class="review-box">${[['Company',j.company],['Role',j.role],['Location',j.location||'Unspecified'],['Duration',j.duration||'Unknown'],['Work arrangement',j.arrangement],['Verification',STATUS_LABELS[j.source_status]],['Stage',LABELS[j.stage]]].map(([a,b])=>`<div class="review-row"><span>${ESC(a)}</span><strong>${ESC(b)}</strong></div>`).join('')}</div>${j.url?`<p class="modal-note">Application URL: <a href="${ESC(j.url)}" target="_blank" rel="noopener noreferrer" class="muted-link">Open employer website ↗</a></p>`:''}${j.notes?`<p class="modal-note"><strong>Notes:</strong> ${ESC(j.notes)}</p>`:''}<p class="modal-note">Only the employer's own confirmation proves that an application was received.</p>`;
  openModal('Opportunity details','REVIEW',body,`<button class="secondary-btn" data-action="close">Close</button>${j.stage!=='APPLIED'?`<button class="secondary-btn" data-action="edit" data-id="${j.id}">Edit</button><button class="danger-btn" data-action="delete" data-id="${j.id}">Delete</button>`:''}${actionButtons(j)}`);
}
async function saveJob(id){
  const f=new FormData($('jobForm'));const body=Object.fromEntries(f.entries());
  if(!body.company.trim()||!body.role.trim())throw new Error('Company and role are required.');
  await req('/jobs'+(id?'/'+id:''),id?'PUT':'POST',body);closeModal();await refresh();showToast(id?'Opportunity updated; any previous approval was reset.':'Opportunity saved to your pipeline.');
}
function approvalReview(j){
  const p=STATE.profile;
  const body=`<p class="modal-note">You are asking yourself to review <strong>one specific application</strong>. Nothing is sent to the employer at this step.</p><div class="review-box">${[['Company',j.company],['Role',j.role],['URL',j.url||'Missing'],['Applicant',p.full_name||'Not completed'],['CV',STATE.resume?.filename||'Not uploaded']].map(([a,b])=>`<div class="review-row"><span>${ESC(a)}</span><strong>${ESC(b)}</strong></div>`).join('')}</div><p class="modal-note">Complete the CV, candidate identity, and link before requesting approval.</p>`;
  openModal('Request application approval','PRE-SUBMISSION REVIEW',body,`<button class="secondary-btn" data-action="close">Cancel</button><button class="primary-btn" data-action="send-request" data-id="${j.id}">Create approval request ↗</button>`);
}
function decisionModal(j){
  const a=j.approval;
  if(!a)return showToast('Approval snapshot missing.',true);
  const body=`<p class="modal-note">Review the exact employer, role, CV, and link. Type <span class="code-prompt">YES</span> to authorize proceeding with only this application, or <span class="code-prompt">NO</span> to decline.</p><div class="review-box">${[['Company',a.company],['Role',a.role],['Applicant',a.candidate],['CV',a.resume_name],['Link',a.url],['Approval expires',datefmt(a.expires_at)]].map(([k,v])=>`<div class="review-row"><span>${ESC(k)}</span><strong>${ESC(v)}</strong></div>`).join('')}</div><label for="decisionInput" class="modal-note">Your decision (YES / NO)</label><input class="yes-input" id="decisionInput" placeholder="TYPE YES OR NO" autocomplete="off"/><p class="modal-note">A YES unlocks an application data pack. Automatic browser submission is <strong>not yet connected</strong>.</p>`;
  openModal('Approve this application?','YOUR EXPLICIT CONSENT',body,`<button class="secondary-btn" data-action="close">Cancel</button><button class="primary-btn" data-action="apply-decision" data-id="${j.id}">Confirm decision ↗</button>`);
}
async function openPack(j){
  const pack=await api('/jobs/'+j.id+'/pack');
  const fields=Object.entries(pack.fields).filter(([k,v])=>v).map(([k,v])=>`<div class="review-row"><span>${ESC(k.replaceAll('_',' '))}</span><strong>${ESC(String(v).slice(0,150))}</strong></div>`).join('');
  openModal('Application data pack','APPROVED · GUIDED APPLICATION',`<p class="modal-note">Approved for <b>${ESC(j.role)}</b> at <b>${ESC(j.company)}</b>. Download a profile file for the Chrome autofill helper, or copy your answers. <strong>No application has been submitted.</strong></p><div class="review-box" style="max-height:220px;overflow:auto">${fields}</div><p class="modal-note">Attach your CV manually when the employer asks for it. Review every populated field, especially work authorization.</p>${j.url?`<a href="${ESC(j.url)}" target="_blank" rel="noopener noreferrer" class="muted-link">Open official application page ↗</a>`:''}`,`<button class="secondary-btn" data-action="close">Close</button><button class="secondary-btn" data-action="copy-pack" data-id="${j.id}">Copy answers</button><button class="secondary-btn" data-action="copy-work" data-id="${j.id}">Copy Work handoff</button><button class="primary-btn" data-action="download-pack" data-id="${j.id}">Download autofill JSON ⇩</button><button class="primary-btn" data-action="confirm" data-id="${j.id}">Record submission →</button>`);
}
function confirmationModal(j){
  const body=`<p class="modal-note"><strong>Only use this after you actually submit on the employer's site.</strong> You must enter an employer confirmation number/email, or your own dated record of the submission. This entry is self-reported, not verified by the employer.</p><div class="review-box"><div class="review-row"><span>Company</span><strong>${ESC(j.company)}</strong></div><div class="review-row"><span>Role</span><strong>${ESC(j.role)}</strong></div></div><div class="input-group"><label for="submissionEvidence">Confirmation number, email, or evidence description</label><textarea id="submissionEvidence" placeholder="Example: Employer confirmation email dated 2027-02-15, reference AB123"></textarea></div>`;
  openModal('Record an actual submission','EVIDENCE REQUIRED',body,`<button class="secondary-btn" data-action="close">Cancel</button><button class="primary-btn" data-action="save-confirmation" data-id="${j.id}">Record as applied ↗</button>`);
}
function resumeSuggestions(data){
  const s=data.suggestions;
  const fields=[['full_name','Name'],['email','Email'],['phone','Phone'],['linkedin','LinkedIn'],['university','University']];
  const html=`<p class="modal-note">Text extraction is heuristic and may be wrong. Choose suggestions to insert into your local profile form, then review and save them yourself.</p><div class="review-box">${fields.map(([k,label])=>`<div class="review-row"><span>${ESC(label)}</span><strong>${ESC(s[k]||'Not detected')}</strong></div>`).join('')}</div><div class="input-group"><label>CV text preview (first section)</label><div class="pack-code">${ESC(s.raw_excerpt)}</div></div>`;
  openModal('CV parsed — review suggestions','EXTRACTION RESULTS',html,`<button class="secondary-btn" data-action="close">Review manually</button><button class="primary-btn" data-action="use-suggestions">Fill detected fields ↗</button>`);
  window.__cvSuggestions=s;
}
function saveDownload(content,name){const data=new Blob([JSON.stringify(content,null,2)],{type:'application/json'});const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function perform(action,id){
  const job=STATE.jobs.find(x=>x.id===id);
  switch(action){
    case 'add': return jobModal();
    case 'details':return viewJob(job);
    case 'edit':return jobModal(job);
    case 'request':return approvalReview(job);
    case 'decision':return decisionModal(job);
    case 'pack':return await openPack(job);
    case 'confirm':return confirmationModal(job);
    case 'close':return closeModal();
    case 'save-job':return await saveJob(id);
    case 'send-request':await api(`/jobs/${id}/request-approval`,{method:'POST'});closeModal();await refresh();navigate('approvals');return showToast('Approval requested. Review the exact role and type YES or NO.');
    case 'apply-decision':{const decision=$('decisionInput').value.trim().toUpperCase();if(!['YES','NO'].includes(decision))throw new Error('Type the exact text YES or NO.');await req(`/jobs/${id}/decision`,'POST',{decision});closeModal();await refresh();return showToast(decision==='YES'?'Approved: you can now prepare this application.':'Application declined.');}
    case 'copy-work':{const p=await api(`/jobs/${id}/pack`);const prompt=`I have reviewed and approved ONE application for ${p.job.role} at ${p.job.company}, official URL: ${p.job.url}. Use the attached CV and approved profile pack (upload them separately). Verify that the role is still open and eligible for my 4–8 week Summer 2027 internship window, then fill only facts supported by my material. Do not invent skills or experience or apply to other jobs. Ask before answering sensitive or ambiguous questions, or interacting with CAPTCHA / 2FA. If you successfully submit, show the employer confirmation, time and reference. If blocked, explain exactly why; never claim success without proof. Send a post-application status message.`;await navigator.clipboard.writeText(prompt);return showToast('Work browser handoff prompt copied. Attach CV and pack in Work.');}
    case 'copy-pack':{const p=await api(`/jobs/${id}/pack`);await navigator.clipboard.writeText(Object.entries(p.fields).map(([k,v])=>`${k.replaceAll('_',' ')}: ${v}`).join('\n'));return showToast('Application fields copied.');}
    case 'download-pack':{const p=await api(`/jobs/${id}/pack`);saveDownload(p,`autofill-${job.company.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.json`);return showToast('Autofill JSON downloaded. Import it into the browser helper.');}
    case 'save-confirmation':{const reference=$('submissionEvidence').value.trim();if(reference.length<5)throw new Error('Enter meaningful submission evidence.');const d=await req(`/jobs/${id}/record-submission`,'POST',{reference});closeModal();await refresh();navigate('activity');return showToast(d.notification==='sent'?'Submission recorded and email sent.':`Submission recorded. Email: ${d.notification.replaceAll('_',' ')}.`);}
    case 'delete':{if(!window.confirm(`Delete ${job.company} — ${job.role}?`))return;await api(`/jobs/${id}`,{method:'DELETE'});closeModal();await refresh();return showToast('Target deleted.');}
    case 'use-suggestions':{const s=window.__cvSuggestions||{};for(const [k,v] of Object.entries(s)){if(k==='raw_excerpt'||!v)continue;const input=$('p-'+k);if(input&&!input.value.trim())input.value=v;}closeModal();navigate('profile');return showToast('Detected fields inserted. Check accuracy, then click Save profile.');}
  }
}
document.addEventListener('click',async e=>{
  const company=e.target.closest('[data-company]');
  if(company){jobModal();$('j-company').value=company.dataset.company;$('j-role').value='Exploratory internship inquiry';$('j-status').value='OUTREACH_TARGET';$('j-notes').value='Research target, not a verified opening. Find an official application URL before requesting approval.';return;}
  const nav=e.target.closest('[data-page]');if(nav){navigate(nav.dataset.page);return;}
  const act=e.target.closest('[data-action]');if(act){try{await perform(act.dataset.action,act.dataset.id);}catch(err){showToast(err.message,true);}return;}
});
$('topAddBtn').addEventListener('click',()=>jobModal());
$('modalClose').addEventListener('click',closeModal);
$('modalOverlay').addEventListener('click',e=>{if(e.target===$('modalOverlay'))closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
$('jobSearch').addEventListener('input',renderJobs);
$('stageFilter').addEventListener('change',renderJobs);
$('profileForm').addEventListener('submit',async e=>{
  e.preventDefault();const profile=Object.fromEntries(new FormData(e.currentTarget).entries());
  try{await req('/profile','PUT',{profile});await refresh();$('saveProfileMsg').textContent='Saved ✓';showToast('Candidate profile saved.');}catch(err){showToast(err.message,true);}
});
async function resumeFile(file){
  if(!file)return;const form=new FormData();form.append('file',file);
  try{const res=await api('/resume',{method:'POST',body:form});await refresh();navigate('profile');resumeSuggestions(res);showToast('CV uploaded and extracted for your review.');}
  catch(err){showToast(err.message,true);}
}
$('cvInput').addEventListener('change',e=>resumeFile(e.target.files[0]));
const dz=$('dropzone');
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dragging');});
dz.addEventListener('dragleave',()=>dz.classList.remove('dragging'));
dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('dragging');resumeFile(e.dataTransfer.files[0]);});
$('exportBtn').addEventListener('click',async()=>{try{const data=await api('/export');saveDownload(data,'internship-backup.json');showToast('Private database exported.');}catch(err){showToast(err.message,true);}});
$('unlockForm').addEventListener('submit',async e=>{e.preventDefault();CODE=$('accessCode').value;sessionStorage.setItem('icc_access_code',CODE);try{await refresh();$('lockScreen').hidden=true;showToast('Workspace unlocked.');}catch(err){showToast('Wrong access code or server unavailable.',true);}});
refresh().catch(e=>{if(e.message!=='Please enter your access code.')showToast('Could not contact the local dashboard server.',true);});
