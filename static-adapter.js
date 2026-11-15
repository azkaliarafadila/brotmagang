/* GitHub Pages adapter: no server, no email, no automatic employer submission. */
(() => {
  const KEY = 'internhub-pages-v1';
  const defaultProfile = {full_name:'',email:'',phone:'',location:'Jabodetabek, Indonesia',linkedin:'',portfolio:'',university:'Institut Teknologi Bandung',degree:'Electrical Engineering (Electrical Power)',graduation_year:'',gpa:'',citizenship:'Indonesian',work_authorization:'',availability_start:'2027-05-01',availability_end:'2027-08-31',preferred_duration:'4–8 weeks',skills:'DIgSILENT PowerFactory (basic), Microsoft Excel, Word, mathematics, AI-assisted research',summary:'Third-year ITB engineering undergraduate interested in technology, business, energy, product, and operations.',notification_email:'',notes:''};
  let data;
  try { data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { data = {}; }
  data = {...{profile:defaultProfile,resume:null,jobs:[],events:[]},...data,profile:{...defaultProfile,...(data.profile||{})}};
  const now=()=>new Date().toISOString(), id=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2);
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(data));}catch{throw new Error('Browser storage is full or disabled. Export your backup first.');}};
  const log=(kind,message,job_id=null)=>data.events.unshift({id:id(),kind,message,job_id,created_at:now()});
  const getJob=id=>{const j=data.jobs.find(j=>j.id===id);if(!j)throw new Error('Job not found');return j;};
  const err=(message,status=400)=>new Response(JSON.stringify({detail:message}),{status,headers:{'Content-Type':'application/json'}});
  const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  const fields=()=>{const keys=['full_name','email','phone','location','linkedin','portfolio','university','degree','graduation_year','gpa','citizenship','work_authorization','availability_start','availability_end','preferred_duration','skills','summary'];return Object.fromEntries(keys.map(k=>[k,data.profile[k]||'']));};
  window.__originalFetch=window.fetch.bind(window);
  window.fetch=async(input,options={})=>{
    const path=typeof input==='string'?input:input.url;
    if(!path.startsWith('/api'))return window.__originalFetch(input,options);
    try {
      const method=(options.method||'GET').toUpperCase();const route=path.slice(4);
      const body=options.body instanceof FormData?null:options.body?JSON.parse(options.body):{};
      if(route==='/state'&&method==='GET')return response({...data,capabilities:{live_auto_submit:false,email_notifications:false}});
      if(route==='/export')return response({...data,exported_at:now(),warning:'Contains personal data; save privately. This browser data does not sync to other devices.'});
      if(route==='/profile'&&method==='PUT'){
        if(!body.profile||typeof body.profile!=='object')throw new Error('Missing profile');
        const critical=['full_name','email','phone','linkedin','portfolio','university','degree','gpa','citizenship','work_authorization'];
        if(critical.some(k=>(data.profile[k]||'')!==(body.profile[k]||'')))data.jobs.forEach(j=>{if(['AWAITING_APPROVAL','APPROVED'].includes(j.stage)){j.stage='SAVED';j.approval=null;j.approval_at=null;}});
        data.profile={...data.profile,...body.profile};log('profile','Candidate profile updated locally');save();return response({ok:true,profile:data.profile});
      }
      if(route==='/resume'&&method==='POST'){
        const file=options.body.get('file');if(!file||!/\.(pdf|docx|txt)$/i.test(file.name))throw new Error('Choose a PDF, DOCX, or TXT CV');if(file.size>5*1024*1024)throw new Error('Maximum file size is 5 MB');
        const buf=await file.arrayBuffer();const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buf))].map(x=>x.toString(16).padStart(2,'0')).join('');
        data.resume={filename:file.name,uploaded_at:now(),bytes:file.size,sha256:hash};data.jobs.forEach(j=>{if(['AWAITING_APPROVAL','APPROVED'].includes(j.stage)){j.stage='SAVED';j.approval=null;j.approval_at=null;}});log('resume','CV selected locally; only filename and fingerprint saved (not the document itself)');save();
        let text='';if(/\.txt$/i.test(file.name))text=(await file.text()).slice(0,2600);
        const email=(text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)||[])[0]||'';
        const phone=(text.match(/(?:\+62|0)[\d\s()-]{8,18}\d/)||[])[0]||'';
        return response({ok:true,resume:data.resume,suggestions:{full_name:'',email,phone,linkedin:'',university:'',raw_excerpt:text||'PDF/DOCX content is not extracted in browser-only mode. Enter your profile details manually.'}});
      }
      if(route==='/jobs'&&method==='POST'){
        if(!body.company?.trim()||!body.role?.trim())throw new Error('Company and role are required');
        if(body.url&&!/^https:\/\/[^\s/]+/.test(body.url))throw new Error('Use a valid HTTPS application URL');
        const j={...body,id:id(),stage:'SAVED',approval:null,approval_at:null,submitted_at:null,confirmation:null,created_at:now(),updated_at:now()};data.jobs.unshift(j);log('job_saved',`Added ${j.role} at ${j.company}`,j.id);save();return response({ok:true,job:j});
      }
      const m=route.match(/^\/jobs\/([^/]+)(?:\/(.*))?$/);
      if(m){const j=getJob(m[1]),action=m[2]||'';
        if(!action&&method==='PUT'){
          if(j.stage==='APPLIED')throw new Error('Submitted records cannot be edited');Object.assign(j,body,{stage:'SAVED',approval:null,approval_at:null,updated_at:now()});log('job_edited',`Updated ${j.company}; old approval cleared`,j.id);save();return response({ok:true,job:j});
        }
        if(!action&&method==='DELETE'){
          if(j.stage==='APPLIED')throw new Error('Keep submitted records for your audit trail');data.jobs=data.jobs.filter(x=>x.id!==j.id);log('job_deleted',`Deleted ${j.company}`,j.id);save();return response({ok:true});
        }
        if(action==='request-approval'&&method==='POST'){
          if(!j.url)throw new Error('Add the official application URL first');if(!data.resume)throw new Error('Select your CV first');if(!data.profile.full_name||!data.profile.email)throw new Error('Complete name and email first');if(j.stage==='APPLIED')throw new Error('Already applied');
          j.approval={company:j.company,role:j.role,url:j.url,candidate:data.profile.full_name,email:data.profile.email,resume_sha256:data.resume.sha256,resume_name:data.resume.filename,requested_at:now(),expires_at:new Date(Date.now()+7*86400000).toISOString(),authorization_scope:'One specific job; NOT an employer submission'};j.stage='AWAITING_APPROVAL';j.updated_at=now();log('approval_requested',`Awaiting YES or NO: ${j.role} at ${j.company}`,j.id);save();return response({ok:true,job:j});
        }
        if(action==='decision'&&method==='POST'){
          if(j.stage!=='AWAITING_APPROVAL'||!j.approval)throw new Error('No pending approval');if(Date.parse(j.approval.expires_at)<Date.now())throw new Error('Approval request expired');if(!['YES','NO'].includes(body.decision))throw new Error('Type YES or NO');j.stage=body.decision==='YES'?'APPROVED':'DECLINED';j.approval_at=j.stage==='APPROVED'?now():null;j.updated_at=now();log(j.stage==='APPROVED'?'approved':'declined',`${j.stage}: ${j.role} at ${j.company}`,j.id);save();return response({ok:true,job:j});
        }
        if(action==='pack'&&method==='GET'){
          if(!['APPROVED','APPLIED'].includes(j.stage))throw new Error('Explicit YES required');if(!j.approval||Date.parse(j.approval.expires_at)<Date.now())throw new Error('Approval expired');if(data.resume?.sha256!==j.approval.resume_sha256)throw new Error('CV changed. Review again');return response({fields:fields(),job:{company:j.company,role:j.role,url:j.url,location:j.location,duration:j.duration},resume_filename:data.resume.filename,approved_at:j.approval_at,note:'Browser-only autofill data. Not submitted to employer.'});
        }
        if(action==='record-submission'&&method==='POST'){
          if(j.stage!=='APPROVED'||Date.parse(j.approval.expires_at)<Date.now())throw new Error('Fresh approval required');if(!body.reference||body.reference.trim().length<5)throw new Error('Enter submission evidence');j.stage='APPLIED';j.submitted_at=now();j.confirmation=body.reference.trim();j.updated_at=now();log('applied',`Submission self-recorded: ${j.role} at ${j.company}`,j.id);save();return response({ok:true,notification:'not_configured',job:j});
        }
      }
      return err('Unknown action',404);
    }catch(e){return err(e.message||'Unexpected error')}
  };
})();
