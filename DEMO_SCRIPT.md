# adverb — Demo Script
**Presenters: Tanisha & Krati | Suggested runtime: 5–7 minutes**

---

## Setup (before recording)

Make sure everything is running:
```bash
docker compose up -d          # all backend services
cd apps/adpulse && npm run dev # frontend at localhost:3000
```

Open **http://localhost:3000** in a clean browser window (no extensions, full screen).  
Have a product image ready (any JPEG/PNG, e.g. a coffee cup or tech gadget).

---

---

# 🎤 TANISHA — Scenes 1 – 4
### (Brand Setup, Campaign Creation, AI Creative Generation)

---

## Scene 1 — Landing Page (0:00 – 0:20)
**[TANISHA]**

**What to show:** http://localhost:3000

**Narrate:**
> "Hi, I'm Tanisha. This is adverb — an end-to-end AI-powered ad platform. From a single URL, advertisers can manage brands and campaigns, users can experience a personalized ad feed, and admins can monitor everything in real time. Let me walk you through the advertiser side."

**Action:** Click **"Brand Portal → Open"**

---

## Scene 2 — Brand Portal: Brands List (0:20 – 0:45)
**[TANISHA]**

**What to show:** `/brands`

**Narrate:**
> "The brand portal is where advertisers set up their identity. Each brand has a name, tone of voice, brand colors, and audience targeting parameters. You can see the seeded brands here. Let me open one."

**Action:** Click any existing brand card

---

## Scene 3 — Brand Dashboard & Stats (0:45 – 1:15)
**[TANISHA]**

**What to show:** `/brands/[id]`

**Narrate:**
> "Each brand has its own live dashboard — total impressions, clicks, average CTR, and active campaigns. Below that are all campaigns under this brand. I'll open a campaign to show the full creation workflow."

**Action:** Click any campaign in the list

---

## Scene 4 — Campaign: Products & AI Creative Generation (1:15 – 2:30)
**[TANISHA]**

**What to show:** `/campaigns/[id]`

**Narrate:**
> "This is the campaign management view. You can see the 4-step workflow — draft, generating, review, and live. Products are the building blocks — each product gets its own set of AI-generated creatives."

**Action:** Click **"Generate creatives"** on a product card — show the loading state

> "When I click Generate, the backend sends the product details to Groq, which writes multiple ad copy variants — different headlines, subheadlines, CTAs, and persuasion angles like urgency, social proof, curiosity, or benefit. At the same time, a background is generated and composited with the product photo using Pillow, then uploaded to Cloudinary. Each product card tracks its own generating state independently."

**Action:** Wait for generation to complete, then click **"Review"**

> "Now I'll hand it over to Krati, who will walk through creative review, the user feed, and the admin dashboard."

---

---

# 🎤 KRATI — Scenes 5 – 8
### (Creative Review, User Feed, Admin Dashboard)

---

## Scene 5 — Creative Review & Launch (2:30 – 3:15)
**[KRATI]**

**What to show:** `/campaigns/[id]/review`

**Narrate:**
> "Thanks Tanisha! I'm Krati. The creatives Krati just generated are now in the review queue. Each card shows the AI-assembled image — the product photo composited with headline, subheadline, and CTA — along with an angle badge showing the persuasion strategy."

**Action:** Point to angle badges (benefit, urgency, social_proof, curiosity)

> "We approve or reject each creative. A campaign needs at least 2 approved creatives per product before it can go live — this gives the Multi-Armed Bandit algorithm enough variants to learn from."

**Action:** Approve 2–3 creatives, reject 1 with a short note

> "The Launch button is now active."

**Action:** Click **"Launch Campaign"**

> "The campaign is live. Creatives are now competing in real time."

---

## Scene 6 — Personalized User Feed (3:15 – 4:15)
**[KRATI]**

**What to show:** Click **"User Feed"** in the top nav → `/feed`

**Narrate:**
> "Now let's switch to the user side. We have 5 demo personas, each with different interests — this demonstrates how interest-based targeting works."

**Action:** Click **"Alex Rivera"** (interests: coffee, tech, travel)

**What to show:** `/feed/browse`

> "Alex is into coffee, tech, and travel — so the feed surfaces creatives from campaigns that match those categories. The ad-serving layer uses a Multi-Armed Bandit algorithm. Initially all approved creatives compete equally. As users click, the system updates weights in Redis so better-performing creatives get served more often over time."

**Action:** Click the CTA button on 2–3 ads — show the "✓ Visited" state

> "Every click is tracked — sent to the analytics worker via a Redis stream, which persists it to Postgres and updates the MAB weights immediately."

**Action:** Click **"Switch user"** → pick **Jordan Lee** (fitness, gaming, food)

> "Completely different persona — completely different feed. The targeting is working in real time."

---

## Scene 7 — Admin Dashboard (4:15 – 5:30)
**[KRATI]**

**What to show:** Click **"Admin"** in the top nav → `/admin`

**Narrate:**
> "The admin dashboard gives a live view of the entire platform."

**Point to KPI cards:**
> "At the top — today's impressions, clicks, CTR, and active campaigns, all with deltas versus yesterday. Serve latency p50 and p95 are in the header."

**Point to MAB Convergence chart:**
> "This is the most technically interesting part — the MAB convergence chart. Each line represents a creative variant. As users interact, Thompson Sampling shifts weight toward the winning creative. You can see this converging live."

**Action:** Select the just-launched campaign from the dropdown

> "The variants start equal and diverge as click signals come in — this is reinforcement learning running in production."

**Point to Live Events panel:**
> "On the left — a real-time event stream. Every impression and click appears here within 3 seconds, streamed directly from Redis."

**Point to Campaign Performance table:**
> "On the right — campaign performance ranked by CTR. The bar chart gives an instant visual of how each campaign is doing."

---

## Scene 8 — Wrap-up (5:30 – 6:00)
**[KRATI]**

**Navigate back to** http://localhost:3000

**Narrate:**
> "To summarize — adverb is a full-stack AI advertising platform. Brands create campaigns and products. Groq generates ad copy variants. Pillow and Cloudinary assemble and store the creatives. The ad-serving layer uses Multi-Armed Bandit to optimize creative selection in real time. A Redis stream feeds an analytics worker that persists events to Postgres. And the admin dashboard surfaces everything live. The entire stack runs with a single `docker compose up` — Postgres, Redis, RabbitMQ, brand-api, ad-serving, analytics-worker, Prometheus, and Grafana included. Thank you."

---

---

## Quick Reference: URLs during demo

| Screen | Presenter | URL |
|---|---|---|
| Landing | Tanisha | http://localhost:3000 |
| Brand Portal | Tanisha | http://localhost:3000/brands |
| Brand Dashboard | Tanisha | http://localhost:3000/brands/[id] |
| Campaign + Generation | Tanisha | http://localhost:3000/campaigns/[id] |
| Creative Review | Krati | http://localhost:3000/campaigns/[id]/review |
| User Feed Picker | Krati | http://localhost:3000/feed |
| Live Feed | Krati | http://localhost:3000/feed/browse |
| Admin Dashboard | Krati | http://localhost:3000/admin |

---

## Tips for a clean recording

- Use **browser full screen** (F11) — hides address bar clutter
- **Zoom to 90%** so more content fits without scrolling
- Pre-load the campaign page with existing products so there's no DB wait during recording
- If creative generation takes too long on camera, **cut after clicking Generate** and **resume on the Review page** with creatives already loaded
- **Generate 5–10 clicks in the User Feed before recording the Admin scene** — so the MAB convergence chart has actual curves to show, which is the most visually impressive part
- Krati ends Scene 4 with a clear handoff line so the transition feels natural
