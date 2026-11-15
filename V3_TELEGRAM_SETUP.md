# BROT Magang V3 — Telegram automation (free-first)

## What is implemented
- GitHub Actions discovery: public Arbeitnow, Remotive and selected Greenhouse company feeds. Only internships with relevant keywords and selected location hints enter the feed.
- Keyword scoring **not** an AI/LLM eligibility verdict. A lead is unverified until you personally check it. Duration, 2027 availability, work authorization and deadlines are not validated.
- Telegram bot: scheduled GitHub Actions polling; sends up to 5 newly discovered leads and accepts per-lead YES/NO buttons. `/latest` sends the current top 5 leads; `/start` shows instructions.
- YES means **approve preparing/reviewing a lead**, NOT consent to employer submission. There is no automated application, CV upload to Telegram, or form submission.
- Non-sensitive decisions are written to `bot_state.json` on the **public repository**. Do not enter personal details or CVs into the bot. Keep API token and chat ID in GitHub Actions Secrets.

## Telegram setup
1. In Telegram, open official **@BotFather**, send `/newbot`, choose a name and unique username. Copy the bot token. **Never paste it into a GitHub file or public chat.**
2. Open your new bot in Telegram and send `/start`.
3. In a private browser session, visit `https://api.telegram.org/bot<TOKEN>/getUpdates` (substitute your token privately). Find `message.chat.id`. For a one-person private chat, it is normally a number. **Do not share the URL or screenshot containing your token.** If this returns no messages, send another message to your bot and retry. Prefer deleting the browser history entry afterward.
4. Open GitHub repository **Settings → Secrets and variables → Actions → New repository secret**. Create:
   - `TELEGRAM_BOT_TOKEN` = token from BotFather
   - `TELEGRAM_CHAT_ID` = numeric chat ID from getUpdates
5. Go to **Actions → Daily internship discovery → Run workflow**, wait for success.
6. Go to **Actions → BROT Telegram agent → Run workflow**, wait for success. Your bot should send a lead if there are newly discovered matches. Otherwise send `/latest` and run the workflow again.
7. Thereafter GitHub schedules discovery daily and polls Telegram every ~10 minutes. GitHub schedules can be delayed or paused; they are not instant real-time messaging.

## Limits and privacy
- GitHub Pages is public and the `opportunities.json` and `bot_state.json` feeds are publicly readable. Decisions are not private; never add your name, email, CV, chat ID, bot token or other private details to these files.
- Your profile/CV metadata remains in the browser localStorage on your device; there is **no sync** with the bot. Browser data may be lost.
- The bot only responds to the configured chat ID. If the token leaks, revoke it in BotFather and replace the GitHub secret.
- GitHub Actions free usage depends on account/repository policies. Telegram Bot API is free for this basic usage; GitHub scheduling may not run precisely on time.
- No paid LLM/API key is required. A genuine AI eligibility evaluator and employer application automation are **not implemented**.
- Some feeds may yield zero matches. This is not evidence that no internships exist.

## Next phase
Add employer-specific ingestion for Indonesia, verified application deadlines, evidence-backed eligibility checks, optional LLM classification (free quota if available), a private approval backend, and a separate browser-assisted application flow with explicit per-application final submission consent.
