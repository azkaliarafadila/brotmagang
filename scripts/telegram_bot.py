#!/usr/bin/env python3
"""BROT Magang Telegram approval gateway. No employer applications are submitted.
GitHub Actions runs this periodically; the bot uses Telegram getUpdates (polling).
State contains only public job identifiers and approval decisions, never CVs.
"""
import datetime as dt
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
STATE=ROOT/"bot_state.json"
FEED=ROOT/"opportunities.json"
TOKEN=os.environ.get("TELEGRAM_BOT_TOKEN","")
CHAT=os.environ.get("TELEGRAM_CHAT_ID","")
LIMIT=5
def api(method, data):
    payload=json.dumps(data).encode()
    req=urllib.request.Request("https://api.telegram.org/bot"+TOKEN+"/"+method,data=payload,headers={"Content-Type":"application/json"},method="POST")
    with urllib.request.urlopen(req,timeout=20) as r:
        obj=json.load(r)
    if not obj.get("ok"):raise RuntimeError("Telegram "+method+" failed")
    return obj["result"]
def send(text,keyboard=None):
    body={"chat_id":CHAT,"text":text[:4000],"disable_web_page_preview":True}
    if keyboard:body["reply_markup"]={"inline_keyboard":keyboard}
    return api("sendMessage",body)
def main():
    if not TOKEN or not CHAT:
        print("Telegram secrets not configured; skipping bot run.")
        return
    state=json.loads(STATE.read_text()) if STATE.exists() else {"offset":0,"seen":[],"decisions":{}}
    feed=json.loads(FEED.read_text())
    jobs={j["id"]:j for j in feed.get("opportunities",[])}
    updates=api("getUpdates",{"offset":state.get("offset",0),"limit":100,"timeout":0,"allowed_updates":["message","callback_query"]})
    for update in updates:
        state["offset"]=max(state.get("offset",0),update["update_id"]+1)
        msg=update.get("message",{})
        cb=update.get("callback_query",{})
        owner=str((msg.get("chat") or cb.get("message",{}).get("chat") or {}).get("id",""))
        if owner!=CHAT:continue
        if cb:
            raw=cb.get("data","")
            if ":" in raw:
                action,jobid=raw.split(":",1)
                if action in ("YES","NO") and jobid in jobs:
                    state["decisions"][jobid]={"decision":action,"at":dt.datetime.now(dt.timezone.utc).isoformat(),"company":jobs[jobid]["company"],"role":jobs[jobid]["title"]}
                    api("answerCallbackQuery",{"callback_query_id":cb["id"],"text":"Recorded "+action})
                    send(("✅" if action=="YES" else "❌")+" "+action+" recorded for "+jobs[jobid]["company"]+" — "+jobs[jobid]["title"]+".\nYES means shortlist approval only. NO employer application has been sent. Open the source link and prepare the application manually.")
                else:api("answerCallbackQuery",{"callback_query_id":cb["id"],"text":"This lead is no longer in the current feed"})
        elif msg.get("text","").strip().lower() in ("/start","/help"):
            send("BROT Magang V3 active. /latest shows recent ranked leads. YES/NO buttons approve or reject a lead for preparation, not employer submission.")
        elif msg.get("text","").strip().lower()=="/latest":
            for j in list(jobs.values())[:LIMIT]:notify(j,state,force=True)
    fresh=[j for j in feed.get("opportunities",[]) if j["id"] not in state["seen"]]
    for j in fresh[:LIMIT]:notify(j,state)
    # Avoid resending the same leads on every run. Backlog is deliberately limited.
    state["seen"]=(state["seen"]+[j["id"] for j in feed.get("opportunities",[])])[-500:]
    STATE.write_text(json.dumps(state,indent=2,ensure_ascii=False)+"\n")
    print("Telegram bot processed",len(updates),"updates and",min(LIMIT,len(fresh)),"new leads")
def notify(j,state,force=False):
    title=j["title"];company=j["company"];url=j["url"]
    message=("🔎 BROT Magang · Public lead\n"+
             company+" — "+title+"\n"+
             "Location: "+j["location"]+"\n"+
             "Keyword match: "+str(j["score"])+"/100 (not probability)\n"+
             "Duration / 2027 / work authorization: NOT VERIFIED\n"+
             "Source: "+url+"\n\n"+
             "YES = save approval to prepare; NO = skip. No application will be sent.")
    send(message,[[{"text":"✅ YES · Prepare","callback_data":"YES:"+j["id"]},{"text":"❌ NO · Skip","callback_data":"NO:"+j["id"]}]])
if __name__=="__main__":main()
