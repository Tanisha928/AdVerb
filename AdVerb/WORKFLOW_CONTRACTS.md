# Creative Personalization Workflow Contracts

## Data Models

- `AppUser`: role (`brand_owner` or `shopper`), auth fields, profile metadata
- `Brand`: owner-bound brand identity (`name`, `slug`, optional `settings`)
- `Campaign`: status lifecycle (`planned`, `running`, `paused`, `ended`), dates, category/subcategory, target audience, asset URLs
- `CreativeVariant`: generated variant entry (`variantKey`, `previewImageUrl`, `generationStatus`, `reviewStatus`, embedding note, performance counters)
- `RecommendationEvent`: recommendation rationale history
- `FatigueAlert`: creative-level fatigue warnings for owner analytics

## API Contracts

Base path: `/api/workflow/*`

### Authentication

- `POST /auth/signup`
  - body: `{ role, fullName, email, password, company? }`
  - response: `{ user }` + session cookie
- `POST /auth/login`
  - body: `{ email, password }`
  - response: `{ user }` + session cookie
- `POST /auth/logout`
  - response: `{ success: true }`
- `GET /auth/me`
  - response: `{ user | null }`

### Brand Owner

- `GET /owner/dashboard`
  - response: `{ brands, campaigns, creatives }`
- `POST /owner/profile`
  - body: `{ company?, bio?, stylePrefs? }`
- `POST /owner/brands`
  - body: `{ name, slug, settings? }`
  - response: `{ brand }`
- `POST /owner/campaigns`
  - body: `{ brandId, name, startDate, endDate, category, subcategory, targetAgeRange, targetNotes }`
  - response: `{ campaign }`
- `POST /owner/campaigns/activate`
  - body: `{ campaignId }`
  - response: `{ campaign }`
- `POST /owner/campaigns/assets`
  - body: `{ campaignId, logoFileName?, productFileName? }`
  - response: `{ campaign, message }`
- `POST /owner/creatives/generate`
  - body: `{ campaignId }`
  - response: `{ creatives }`
- `POST /owner/creatives/review`
  - body: `{ creativeId, reviewStatus: "approved" | "rejected" | "pending" }`
- `POST /owner/creatives/backfill`
  - body: `{ creativeId }`
  - response: `{ creative }`
- `GET /owner/analytics`
  - response: `{ summary, creativeComparison, recommendationHistory, fatigueAlerts, series }`

### Shopper

- `GET /shopper/creatives?category=&subcategory=`
  - returns only creatives from `running` campaigns
- `POST /shopper/interaction`
  - body: `{ creativeId, action: "impression" | "click" }`
- `POST /shopper/recommend-best`
  - response: `{ best }`

## End-to-End Demo Behavior

- Seeded users:
  - owner: `owner@adverb.demo` / `demo123`
  - shopper: `shopper@adverb.demo` / `demo123`
- Seeded running campaign with generated variants and performance counters
- Owner flow supports create brand/campaign -> upload assets -> generate/review/backfill
- Shopper flow supports browse/filter/interact and best-creative recommendation
