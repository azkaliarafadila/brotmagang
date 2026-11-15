#!/usr/bin/env python3
"""Public job-feed discovery. No AI API keys, no scraping login pages."""
import datetime as dt
import hashlib
import json
import re
import urllib.request
from pathlib import Path
from html import unescape

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"opportunities.json"
NOW=dt.datetime.now(dt.timezone.utc)
HEADERS={"User-Agent":"BrotMagang/2.0 (personal job discovery; GitHub Actions)","Accept":"application/json"}
PATTERN=re.compile(r"intern(ship)?|trainee|industrial attachment|summer analyst|working student|student assistant|graduate internship",re.I)
FIELDS=re.compile(r"engineering|electrical|energy|renewable|power|sustainab|business|operations|product|strategy|analyst|data|commercial|supply chain|project|software|consult|technology|procurement|research",re.I)
BLOCK=re.compile(r"senior|staff engineer|principal|director|head of|lead engineer|manager,|[5-9]\+ years",re.I)
REGION=re.compile(r"indonesia|jakarta|bogor|depok|tangerang|bekasi|remote|worldwide|anywhere|global|singapore|malaysia|taiwan|japan",re.I)
def get(url):
    req=urllib.request.Request(url,headers=HEADERS)
    with urllib.request.urlopen(req,timeout=22) as r:
        return json.load(r)
def clean(v):
    return re.sub(r"\s+"," ",unescape(re.sub(r"<[^>]*>"," ",str(v or "")))).strip()
def score(j):
    s=30
    t=(j["title"]+" "+j["description"][:900]).lower()
    loc=j["location"].lower()
    if re.search(r"intern|internship",j["title"],re.I):s+=30
    if re.search(r"energy|power|electrical|renewable|tech|product|business|operations|analyst",t):s+=15
    if "indonesia" in loc or "jakarta" in loc:s+=18
    if "remote" in loc or "worldwide" in loc:s+=8
    if re.search(r"4.?8 weeks|1.?2 months|summer 2027|2027 summer",t):s+=8
    return min(s,100)
def normalize(source,company,title,url,location,description,posted):
    title=clean(title);company=clean(company);location=clean(location);description=clean(description)
    if not title or not company or not url.startswith("https://"):return None
    if not PATTERN.search(title):return None
    if not FIELDS.search(title+" "+description[:1100]):return None
    if BLOCK.search(title):return None
    # Remote roles outside Indonesia remain visible, but work authorization is NOT assumed.
    if not REGION.search(location):return None
    key=hashlib.sha256((company.lower()+"|"+title.lower()+"|"+url).encode()).hexdigest()[:16]
    return dict(id=key,company=company,title=title,url=url,location=location or "Not stated",
                source=source,posted_at=str(posted or "")[:30],description=description[:850],
                score=0,status="SOURCE_LISTED_UNVERIFIED",duration="Not verified",eligibility="Not verified")
jobs=[];errors=[];counts={}
try:
    d=get("https://www.arbeitnow.com/api/job-board-api")
    items=d.get("data",[])
    counts["Arbeitnow"]=len(items)
    for x in items:
        loc=x.get("location") or ("Remote" if x.get("remote") else "")
        j=normalize("Arbeitnow",x.get("company_name"),x.get("title"),x.get("url"),loc,x.get("description"),x.get("created_at"))
        if j:jobs.append(j)
except Exception as e:errors.append("Arbeitnow: "+type(e).__name__)
try:
    d=get("https://remotive.com/api/remote-jobs?limit=500")
    items=d.get("jobs",[])
    counts["Remotive"]=len(items)
    for x in items:
        j=normalize("Remotive",x.get("company_name"),x.get("title"),x.get("url"),x.get("candidate_required_location") or "Remote",x.get("description"),x.get("publication_date"))
        if j:jobs.append(j)
except Exception as e:errors.append("Remotive: "+type(e).__name__)
unique={j["id"]:j for j in jobs}
for j in unique.values():j["score"]=score(j)
ordered=sorted(unique.values(),key=lambda j:(-j["score"],j["company"]))[:120]
payload=dict(updated_at=NOW.isoformat(),sources=counts,errors=errors,count=len(ordered),
             notice="Automated public-feed leads, NOT verified open applications. Confirm eligibility, duration, location and deadline on employer website. No applications submitted.",
             opportunities=ordered)
OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(f"Published {len(ordered)} leads; sources={counts}; errors={errors}")
