# Damen Preorder System — Complete Build Guide (Start to Finish)

From zero to a live internal website your team logs into. No prior coding experience assumed — Claude Code does the coding; you do the setup, testing, and approvals.

**Time estimate:** 1–2 hours of setup, then a few sessions of build/test over 2–5 days.
**Cost:** Claude Pro (~$20/mo) or Max plan. Supabase and Vercel both have free tiers that comfortably cover an internal tool with 3–10 users.

---

## STEP 1 — Create your accounts (15 min)

You need four accounts. Create all of them under **orders@damenalimentaire.com** so the company's infrastructure (Claude, GitHub, Supabase, Vercel) lives in one shared account rather than a personal one.

1. **Claude subscription** — claude.ai → Settings → upgrade to **Pro** (Max if you want more usage headroom). Claude Code is included with your subscription.
2. **GitHub** — github.com → sign up (free). This stores your code and connects to Vercel.
3. **Supabase** — supabase.com → sign up (free), easiest with "Continue with GitHub". This is your database + login system.
4. **Vercel** — vercel.com → sign up (free, Hobby plan), also "Continue with GitHub". This hosts the website.

---

## STEP 2 — Install Claude Code (10 min)

**Mac:** open Terminal (Cmd+Space, type "Terminal") and paste:
```
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows:** open PowerShell (Start menu, type "PowerShell") and paste:
```
irm https://claude.ai/install.ps1 | iex
```
(If Windows says the command isn't recognized, you're in CMD instead of PowerShell — your prompt should start with `PS`. Also install Git for Windows from git-scm.com — recommended so Claude Code works at full capability.)

Then close and reopen your terminal, and verify it worked:
```
claude --version
```
If you see a version number, you're good. If you see "command not found," restart the terminal once more; on Windows you may need to add the install path to PATH (Claude Code prints instructions if so).

Full official guide if anything goes wrong: https://code.claude.com/docs/en/quickstart

---

## STEP 3 — Set up the project folder (5 min)

In your terminal:

**Mac:**
```
mkdir ~/damen-preorder
cd ~/damen-preorder
```

**Windows (PowerShell):**
```
mkdir $HOME\damen-preorder
cd $HOME\damen-preorder
```

Then put two files into that folder (you can use Finder/File Explorer to drag them in):

1. **SPEC.md** — your full specification document (the one you shared with me). Save it with exactly that name.
2. **CLAUDE_CODE_KICKOFF.md** — the kickoff prompt file I made for you earlier. Keep it handy; you'll paste its contents in Step 6.

---

## STEP 4 — Create the Supabase project (10 min)

1. Go to supabase.com → Dashboard → **New Project**
2. Name: `damen-preorder` · Region: **Canada (Central)** (closest to Montréal) · Generate a strong database password and **save it somewhere safe**
3. Wait ~2 minutes for the project to spin up
4. Go to **Project Settings → API** and copy three values into a note:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public key**
   - **service_role key** (keep this one secret — never share it)

Claude Code will ask you for these. That's all the manual Supabase work — Claude Code writes the database tables, security rules, and login logic itself.

---

## STEP 5 — Log in to Claude Code and pick the model (5 min)

From inside your project folder:
```
claude
```

First run opens a browser window — log in with your Claude account (choose the subscription option, not API). Back in the terminal, set the model:
```
/model
```
Pick the most capable model available (Opus tier / Fable 5) for the build. You can switch to Sonnet later for small tweaks to save usage.

One useful thing to know: Claude Code **asks permission** before editing files or running commands. Read what it proposes; approve with Enter. You're always in control.

---

## STEP 6 — Kick off the build (Phase 1)

Open `CLAUDE_CODE_KICKOFF.md`, copy **everything below "The Prompt" line**, and paste it into Claude Code as your first message.

Claude Code will read SPEC.md, scaffold the Next.js project, create the database schema, and set up login. Along the way it will ask you for the three Supabase values from Step 4 — paste them when prompted (they go in a `.env.local` file that stays on your machine).

When Phase 1 finishes, Claude Code will tell you how to run the app locally — typically:
```
npm run dev
```
Then open **http://localhost:3000** in your browser. You should see a login page.

### Your Phase 1 test checklist
- Log in as orders@ → lands on Admin dashboard
- Log in as vincent@ → also Admin dashboard
- Log in as david@ → Buyer dashboard
- Log in as commandes@ → Rep dashboard
- (Claude Code will tell you the seed passwords, or set them via Supabase → Authentication → Users)

If something's broken, don't debug it yourself — paste the error message or describe what you see into Claude Code and say "fix this."

---

## STEP 7 — Build Phases 2–5

When a phase passes your testing, just tell Claude Code: **"Phase 1 approved. Start Phase 2."** Repeat through Phase 5. Test checklists per phase:

**Phase 2 (Rep flow):**
- As commandes@: open Fish Orders → Fill Form → pick Salmon → only Salmon questions appear → switch to Loup de Mer → questions change
- Submit an order with 2 product lines → it appears in rep Submissions
- Edit it while Pending → works. Have the buyer mark it Ready, then try editing as rep → blocked.
- **Test all of this on your phone too** (Claude Code can tell you your local network URL, e.g. `http://192.168.x.x:3000`).

**Phase 3 (Buyer flow):**
- As david@: see the rep's order in All Submissions and in the Buyer Table
- Default view shows Pending + today/tomorrow
- Change buyer status to Ordered → as commandes@, confirm the rep does NOT see buyer statuses
- Submit several orders with different delivery dates and statuses → verify the sort order: Pending top, Received bottom, grouped by delivery date
- **Security test:** while logged in as commandes@, try visiting the buyer table URL directly (e.g. /buyer-table) → must be blocked

**Phase 4 (Buying sheet + exports):**
- Two orders for Salmon 10/12 with identical specs → grouped sheet shows combined quantity/weight and client count
- Export CSV → open it → check `external_id` columns are present (Odoo-ready)

**Phase 5 (Polish):**
- Every screen comfortable on a phone
- Full loop: rep submits → buyer sees it without refreshing → buyer changes status → rep sees the update

---

## STEP 8 — Put the code on GitHub (10 min)

In Claude Code, just say:
> "Create a private GitHub repository called damen-preorder and push the code."

It will walk you through authenticating with GitHub (via the `gh` tool) and do the rest. Confirm the repo is **private** — this is internal company software.

---

## STEP 9 — Deploy to Vercel (15 min)

1. vercel.com → **Add New → Project** → Import the `damen-preorder` repo from GitHub
2. Before deploying, open **Environment Variables** and add the same three values from Step 4 (Claude Code can tell you the exact variable names it used, e.g. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
3. Click **Deploy** → ~2 minutes later you get a live URL like `damen-preorder.vercel.app`
4. In Supabase → **Authentication → URL Configuration**, add that Vercel URL as the Site URL / redirect URL (Claude Code can give you the exact setting)
5. Test the live URL on your phone: log in as each user, submit an order, change a status

If the deploy fails, paste the Vercel error log into Claude Code.

From now on, every time Claude Code pushes a change to GitHub, Vercel automatically redeploys the site. Updates are: open Claude Code → describe the change → approve → it's live in 2 minutes.

---

## STEP 10 — Launch to your team

1. Set real passwords for all four users — Orders, Vinny, David, and Commandes (Supabase → Authentication → Users, or ask Claude Code to build a password-set flow)
2. Send the team the URL; on phones, "Add to Home Screen" makes it feel like an app
3. Run one real day of orders in parallel with your current process before fully switching over
4. Collect feedback for a few days, then bring the improvement list back to Claude Code (section 31 of your spec: Excel/PDF export, client dropdowns, copy previous order, Odoo sync...)

---

## Quick troubleshooting reference

| Problem | What to do |
|---|---|
| Terminal says command not found | Restart terminal; on Windows check PATH per Claude Code's printed instructions |
| App errors locally | Paste the exact error into Claude Code: "fix this" |
| Claude Code session gets long/slow | Type `/compact`, or start fresh with `claude` and say "read SPEC.md, we're on Phase 3" |
| Want to resume yesterday's session | Run `claude --resume` |
| Vercel deploy fails | Paste the build log into Claude Code |
| Login redirect broken on live site | Check Supabase Auth URL Configuration matches your Vercel URL |
| Hit usage limits on Pro | Wait for the reset window, switch `/model` to Sonnet, or upgrade to Max |

---

## The golden rules

1. **One phase at a time.** Never say "build everything" — test each phase before the next.
2. **You never need to write code.** Describe problems in plain language; paste error messages verbatim.
3. **Test as the rep on a phone.** That's your real-world usage. If Commandes can't submit a salmon order in under a minute on a phone, send Claude Code back to fix it.
4. **Keep the service_role key secret.** It's the master key to your database.
5. **SPEC.md is the contract.** If Claude Code drifts from it, say "re-read SPEC.md section X and fix this."
