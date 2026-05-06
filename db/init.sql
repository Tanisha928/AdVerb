-- adverb schema + seed data
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Brands
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  color_primary TEXT DEFAULT '#6366f1',
  color_secondary TEXT DEFAULT '#a5b4fc',
  tone TEXT DEFAULT 'professional',
  industry TEXT,
  target_interests TEXT[],
  target_age_min INT DEFAULT 18,
  target_age_max INT DEFAULT 65,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id),
  name TEXT NOT NULL,
  objective TEXT DEFAULT 'clicks',
  status TEXT DEFAULT 'draft',
  budget NUMERIC(10,2),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  key_benefits TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  campaign_id UUID REFERENCES campaigns(id),
  headline TEXT,
  subheadline TEXT,
  cta TEXT,
  angle TEXT,
  layout TEXT,
  background_color TEXT,
  assembled_image_url TEXT,
  status TEXT DEFAULT 'pending',
  rejection_note TEXT,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  mab_weight NUMERIC(5,4) DEFAULT 0.25,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  age INT,
  gender TEXT,
  interests TEXT[],
  location_city TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  creative_id UUID REFERENCES creatives(id),
  campaign_id UUID REFERENCES campaigns(id),
  event_type TEXT,
  device_type TEXT,
  page_category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_seen_creatives (
  user_id UUID REFERENCES users(id),
  creative_id UUID REFERENCES creatives(id),
  seen_count INT DEFAULT 1,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, creative_id)
);

CREATE INDEX idx_campaigns_brand ON campaigns(brand_id);
CREATE INDEX idx_products_campaign ON products(campaign_id);
CREATE INDEX idx_creatives_campaign ON creatives(campaign_id);
CREATE INDEX idx_creatives_product ON creatives(product_id);
CREATE INDEX idx_ad_events_created ON ad_events(created_at);
CREATE INDEX idx_ad_events_campaign ON ad_events(campaign_id);

-- ========== Seed: fixed UUIDs ==========
INSERT INTO brands (id, name, logo_url, color_primary, color_secondary, tone, industry, target_interests, target_age_min, target_age_max) VALUES
('b0000001-0000-4000-8000-000000000001', 'NovaBrew Coffee', 'https://res.cloudinary.com/demo/image/upload/v1/samples/coffee.jpg', '#7c3aed', '#c4b5fd', 'playful', 'Food & Beverage', ARRAY['coffee','food','travel'], 22, 55),
('b0000001-0000-4000-8000-000000000002', 'PeakFit Gear', 'https://res.cloudinary.com/demo/image/upload/v1/samples/ecommerce/leather-bag-gray.jpg', '#059669', '#6ee7b7', 'bold', 'Fitness', ARRAY['fitness','tech','gaming'], 18, 45),
('b0000001-0000-4000-8000-000000000003', 'Luminary Skincare', 'https://res.cloudinary.com/demo/image/upload/v1/samples/people/kitchen-bar.jpg', '#db2777', '#fbcfe8', 'luxury', 'Beauty', ARRAY['beauty','fashion','travel'], 25, 60);

INSERT INTO campaigns (id, brand_id, name, objective, status, budget, start_date, end_date) VALUES
('c0000001-0000-4000-8000-000000000101', 'b0000001-0000-4000-8000-000000000001', 'Morning Ritual Push', 'clicks', 'live', 5000, CURRENT_DATE - 30, CURRENT_DATE + 60),
('c0000001-0000-4000-8000-000000000102', 'b0000001-0000-4000-8000-000000000001', 'Cold Brew Summer', 'awareness', 'live', 3200, CURRENT_DATE - 14, CURRENT_DATE + 45),
('c0000001-0000-4000-8000-000000000201', 'b0000001-0000-4000-8000-000000000002', 'HIIT Essentials', 'conversions', 'live', 8000, CURRENT_DATE - 20, CURRENT_DATE + 40),
('c0000001-0000-4000-8000-000000000202', 'b0000001-0000-4000-8000-000000000002', 'Recovery Week', 'clicks', 'live', 4100, CURRENT_DATE - 7, CURRENT_DATE + 30),
('c0000001-0000-4000-8000-000000000301', 'b0000001-0000-4000-8000-000000000003', 'Glow Serum Launch', 'awareness', 'live', 6200, CURRENT_DATE - 25, CURRENT_DATE + 90),
('c0000001-0000-4000-8000-000000000302', 'b0000001-0000-4000-8000-000000000003', 'Night Repair', 'clicks', 'live', 2800, CURRENT_DATE - 10, CURRENT_DATE + 50);

INSERT INTO products (id, campaign_id, name, description, image_url, key_benefits) VALUES
('f0000001-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000101', 'Nova Espresso Blend', 'Bold single-origin espresso.', 'https://res.cloudinary.com/demo/image/upload/v1/samples/coffee.jpg', ARRAY['Rich crema','Low acidity','Fair trade']),
('f0000001-0000-4000-8000-000000000002', 'c0000001-0000-4000-8000-000000000101', 'Nova Pour-Over Kit', 'Glass dripper and filters.', 'https://res.cloudinary.com/demo/image/upload/v1/samples/breakfast.jpg', ARRAY['Beginner friendly','Dishwasher safe']),
('f0000001-0000-4000-8000-000000000003', 'c0000001-0000-4000-8000-000000000102', 'Nitro Cold Brew 4-Pack', 'Silky nitrogen-infused cold brew.', 'https://res.cloudinary.com/demo/image/upload/v1/samples/food/fish-vegetables.jpg', ARRAY['No sugar','Shelf stable','Creamy mouthfeel']),
('f0000001-0000-4000-8000-000000000004', 'c0000001-0000-4000-8000-000000000102', 'Iced Latte Mixer', 'Barista-style concentrate.', 'https://res.cloudinary.com/demo/image/upload/v1/samples/dessert-on-a-plate.jpg', ARRAY['10 servings','Oat milk pairing']),
('f0000001-0000-4000-8000-000000000005', 'c0000001-0000-4000-8000-000000000201', 'PeakFit Trainer Pro', 'Smart jump rope with app.', 'https://res.cloudinary.com/demo/image/upload/v1/samples/ecommerce/accessories-bag.jpg', ARRAY['Calorie tracking','Coaching cues','USB-C charge']),
('f0000001-0000-4000-8000-000000000006', 'c0000001-0000-4000-8000-000000000201', 'Compression Sleeves', 'Graduated compression pair.', 'https://res.cloudinary.com/demo/image/upload/v1/samples/ecommerce/shoes.png', ARRAY['Muscle support','Breathable mesh']),
('f0000001-0000-4000-8000-000000000007', 'c0000001-0000-4000-8000-000000000202', 'Foam Roller Wave', 'Textured deep-tissue roller.', 'https://res.cloudinary.com/demo/image/upload/v1/samples/ecommerce/leather-bag-gray.jpg', ARRAY['Trigger points','Travel size']),
('f0000001-0000-4000-8000-000000000008', 'c0000001-0000-4000-8000-000000000202', 'Electrolyte Tabs', 'Zero-sugar hydration.', 'https://res.cloudinary.com/demo/image/upload/v1/samples/ecommerce/analog-classic.jpg', ARRAY['12 flavors','Dissolves fast']),
('f0000001-0000-4000-8000-000000000009', 'c0000001-0000-4000-8000-000000000301', 'Luminary Vitamin C Serum', '15% L-ascorbic brightening.', 'https://res.cloudinary.com/demo/image/upload/v1/samples/people/kitchen-bar.jpg', ARRAY['Derm tested','Glass bottle','AM/PM']),
('f0000001-0000-4000-8000-000000000010', 'c0000001-0000-4000-8000-000000000301', 'Barrier Cream', 'Ceramide-rich moisturizer.', 'https://res.cloudinary.com/demo/image/upload/v1/samples/upscale-car.jpg', ARRAY['Sensitive skin','SPF optional layer']),
('f0000001-0000-4000-8000-000000000011', 'c0000001-0000-4000-8000-000000000302', 'Overnight Peel Pads', 'Gentle AHA/BHA pads.', 'https://res.cloudinary.com/demo/image/upload/v1/samples/bike.jpg', ARRAY['Even tone','Single step']),
('f0000001-0000-4000-8000-000000000012', 'c0000001-0000-4000-8000-000000000302', 'Lip Renewal Balm', 'Peptide lip treatment.', 'https://res.cloudinary.com/demo/image/upload/v1/samples/animals/three-dogs.jpg', ARRAY['Matte finish','Vegan']);

-- 4 creatives per product (approved), angles + layouts cycle
INSERT INTO creatives (id, product_id, campaign_id, headline, subheadline, cta, angle, layout, background_color, assembled_image_url, status, impressions, clicks, mab_weight)
SELECT * FROM (VALUES
-- Product 001
('cd000001-0000-4000-8000-000000000001'::uuid,'f0000001-0000-4000-8000-000000000001'::uuid,'c0000001-0000-4000-8000-000000000101'::uuid,'Loved by thousands of baristas','Join the morning ritual everyone raves about.','Try Nova today','social_proof','left_text','#1a1a2e',NULL,'approved',120,18,0.25),
('cd000001-0000-4000-8000-000000000002'::uuid,'f0000001-0000-4000-8000-000000000001'::uuid,'c0000001-0000-4000-8000-000000000101'::uuid,'Small batch — almost gone','Roast sells out weekly. Grab yours now.','Order now','urgency','centered','#0f3460',NULL,'approved',95,12,0.25),
('cd000001-0000-4000-8000-000000000003'::uuid,'f0000001-0000-4000-8000-000000000001'::uuid,'c0000001-0000-4000-8000-000000000101'::uuid,'Crema that stays thick to the last sip','Engineered grind profile for home machines.','Brew better','benefit','bottom_bar','#16213e',NULL,'approved',80,10,0.25),
('cd000001-0000-4000-8000-000000000004'::uuid,'f0000001-0000-4000-8000-000000000001'::uuid,'c0000001-0000-4000-8000-000000000101'::uuid,'What if your espresso could taste this smooth?','Discover the Nova difference in one cup.','Taste it','curiosity','left_text','#533483',NULL,'approved',70,8,0.25),
-- 002
('cd000001-0000-4000-8000-000000000005'::uuid,'f0000001-0000-4000-8000-000000000002'::uuid,'c0000001-0000-4000-8000-000000000101'::uuid,'The pour-over kit beginners master fast','Step-by-step video included with purchase.','Start brewing','social_proof','centered','#1a1a2e',NULL,'approved',60,9,0.25),
('cd000001-0000-4000-8000-000000000006'::uuid,'f0000001-0000-4000-8000-000000000002'::uuid,'c0000001-0000-4000-8000-000000000101'::uuid,'Weekend flash: kits shipping today','Order before cutoff for same-week delivery.','Ship mine','urgency','bottom_bar','#0f3460',NULL,'approved',55,7,0.25),
('cd000001-0000-4000-8000-000000000007'::uuid,'f0000001-0000-4000-8000-000000000002'::uuid,'c0000001-0000-4000-8000-000000000101'::uuid,'Cleaner cups without the learning curve','Precision holes regulate flow automatically.','Upgrade kit','benefit','left_text','#16213e',NULL,'approved',50,6,0.25),
('cd000001-0000-4000-8000-000000000008'::uuid,'f0000001-0000-4000-8000-000000000002'::uuid,'c0000001-0000-4000-8000-000000000101'::uuid,'Ever wonder why cafes taste better?','Nova kit closes the gap in three pours.','See how','curiosity','centered','#533483',NULL,'approved',45,5,0.25),
-- 003
('cd000001-0000-4000-8000-000000000009'::uuid,'f0000001-0000-4000-8000-000000000003'::uuid,'c0000001-0000-4000-8000-000000000102'::uuid,'Rated #1 nitro in blind tastings','Creamy cascade without dairy or sweeteners.','Grab 4-pack','social_proof','bottom_bar','#1a1a2e',NULL,'approved',200,25,0.25),
('cd000001-0000-4000-8000-000000000010'::uuid,'f0000001-0000-4000-8000-000000000003'::uuid,'c0000001-0000-4000-8000-000000000102'::uuid,'Summer stock running low','Limited batches each week while supplies last.','Stock up','urgency','left_text','#0f3460',NULL,'approved',180,22,0.25),
('cd000001-0000-4000-8000-000000000011'::uuid,'f0000001-0000-4000-8000-000000000003'::uuid,'c0000001-0000-4000-8000-000000000102'::uuid,'Silky texture. Zero sugar.','Nitrogen micro-bubbles for cafe mouthfeel.','Sip nitro','benefit','centered','#16213e',NULL,'approved',160,20,0.25),
('cd000001-0000-4000-8000-000000000012'::uuid,'f0000001-0000-4000-8000-000000000003'::uuid,'c0000001-0000-4000-8000-000000000102'::uuid,'What makes cold brew feel like dessert?','Nitro magic in a can — try the difference.','Open can','curiosity','bottom_bar','#533483',NULL,'approved',140,15,0.25),
-- 004
('cd000001-0000-4000-8000-000000000013'::uuid,'f0000001-0000-4000-8000-000000000004'::uuid,'c0000001-0000-4000-8000-000000000102'::uuid,'Home baristas swear by this mixer','Concentrate crafted with award-winning beans.','Mix a latte','social_proof','centered','#1a1a2e',NULL,'approved',90,11,0.25),
('cd000001-0000-4000-8000-000000000014'::uuid,'f0000001-0000-4000-8000-000000000004'::uuid,'c0000001-0000-4000-8000-000000000102'::uuid,'48-hour launch pricing ends soon','Lock in introductory pricing on concentrate.','Save now','urgency','left_text','#0f3460',NULL,'approved',85,9,0.25),
('cd000001-0000-4000-8000-000000000015'::uuid,'f0000001-0000-4000-8000-000000000004'::uuid,'c0000001-0000-4000-8000-000000000102'::uuid,'Ten café-grade lattes from one bottle','Dial strength to match your milk of choice.','Pour concentrate','benefit','bottom_bar','#16213e',NULL,'approved',75,8,0.25),
('cd000001-0000-4000-8000-000000000016'::uuid,'f0000001-0000-4000-8000-000000000004'::uuid,'c0000001-0000-4000-8000-000000000102'::uuid,'Curious how cafes stretch margins?','This mixer brings their playbook home.','Learn trick','curiosity','centered','#533483',NULL,'approved',65,7,0.25),
-- 005 PeakFit
('cd000001-0000-4000-8000-000000000017'::uuid,'f0000001-0000-4000-8000-000000000005'::uuid,'c0000001-0000-4000-8000-000000000201'::uuid,'Trusted by competitive athletes','Syncs with PeakFit app for live coaching cues.','Train smarter','social_proof','left_text','#1a1a2e',NULL,'approved',300,40,0.25),
('cd000001-0000-4000-8000-000000000018'::uuid,'f0000001-0000-4000-8000-000000000005'::uuid,'c0000001-0000-4000-8000-000000000201'::uuid,'Inventory alert: graphite selling fast','Reserve yours before the next restock wave.','Claim rope','urgency','centered','#0f3460',NULL,'approved',280,35,0.25),
('cd000001-0000-4000-8000-000000000019'::uuid,'f0000001-0000-4000-8000-000000000005'::uuid,'c0000001-0000-4000-8000-000000000201'::uuid,'Burn more calories per minute','Smart sensors adapt interval prompts to you.','Jump higher','benefit','bottom_bar','#16213e',NULL,'approved',260,32,0.25),
('cd000001-0000-4000-8000-000000000020'::uuid,'f0000001-0000-4000-8000-000000000005'::uuid,'c0000001-0000-4000-8000-000000000201'::uuid,'What if your rope coached you back?','Haptic feedback keeps form honest every rep.','Feel it','curiosity','left_text','#533483',NULL,'approved',240,28,0.25),
-- 006
('cd000001-0000-4000-8000-000000000021'::uuid,'f0000001-0000-4000-8000-000000000006'::uuid,'c0000001-0000-4000-8000-000000000201'::uuid,'Marathoners pack these first','Graduated compression trusted on race day.','Wear PeakFit','social_proof','centered','#1a1a2e',NULL,'approved',220,26,0.25),
('cd000001-0000-4000-8000-000000000022'::uuid,'f0000001-0000-4000-8000-000000000006'::uuid,'c0000001-0000-4000-8000-000000000201'::uuid,'48h recovery sale','Discount auto-applies in cart while supplies last.','Add sleeves','urgency','bottom_bar','#0f3460',NULL,'approved',200,24,0.25),
('cd000001-0000-4000-8000-000000000023'::uuid,'f0000001-0000-4000-8000-000000000006'::uuid,'c0000001-0000-4000-8000-000000000201'::uuid,'Less soreness after leg day','Targeted compression maps to calf and shin.','Recover faster','benefit','left_text','#16213e',NULL,'approved',190,22,0.25),
('cd000001-0000-4000-8000-000000000024'::uuid,'f0000001-0000-4000-8000-000000000006'::uuid,'c0000001-0000-4000-8000-000000000201'::uuid,'Why do coaches film cool-downs?','Compression finish keeps inflammation in check.','See science','curiosity','centered','#533483',NULL,'approved',175,20,0.25),
-- 007
('cd000001-0000-4000-8000-000000000025'::uuid,'f0000001-0000-4000-8000-000000000007'::uuid,'c0000001-0000-4000-8000-000000000202'::uuid,'Physical therapists recommend Wave','Wave texture hits fascia without bruising.','Roll it out','social_proof','bottom_bar','#1a1a2e',NULL,'approved',150,18,0.25),
('cd000001-0000-4000-8000-000000000026'::uuid,'f0000001-0000-4000-8000-000000000007'::uuid,'c0000001-0000-4000-8000-000000000202'::uuid,'Travel drop ends midnight','Tuck Wave in your gym bag before price bumps.','Buy Wave','urgency','left_text','#0f3460',NULL,'approved',140,16,0.25),
('cd000001-0000-4000-8000-000000000027'::uuid,'f0000001-0000-4000-8000-000000000007'::uuid,'c0000001-0000-4000-8000-000000000202'::uuid,'Trigger points release in minutes','Aggressive ridges mimic hands-on therapy.','Release tension','benefit','centered','#16213e',NULL,'approved',130,14,0.25),
('cd000001-0000-4000-8000-000000000028'::uuid,'f0000001-0000-4000-8000-000000000007'::uuid,'c0000001-0000-4000-8000-000000000202'::uuid,'Ever finish rolling and still feel tight?','Wave pattern maps to posterior chain hotspots.','Try pattern','curiosity','bottom_bar','#533483',NULL,'approved',120,12,0.25),
-- 008
('cd000001-0000-4000-8000-000000000029'::uuid,'f0000001-0000-4000-8000-000000000008'::uuid,'c0000001-0000-4000-8000-000000000202'::uuid,'Hydration coaches keep these stocked','Electrolyte balance without sugar crash.','Refuel now','social_proof','left_text','#1a1a2e',NULL,'approved',110,13,0.25),
('cd000001-0000-4000-8000-000000000030'::uuid,'f0000001-0000-4000-8000-000000000008'::uuid,'c0000001-0000-4000-8000-000000000202'::uuid,'Heat wave bundle almost sold out','Stack savings when you bundle two tubes.','Bundle tabs','urgency','centered','#0f3460',NULL,'approved',100,11,0.25),
('cd000001-0000-4000-8000-000000000031'::uuid,'f0000001-0000-4000-8000-000000000008'::uuid,'c0000001-0000-4000-8000-000000000202'::uuid,'Fizz dissolves in 10 seconds','Portable tubes for gym bag or desk drawer.','Drop tab','benefit','bottom_bar','#16213e',NULL,'approved',95,10,0.25),
('cd000001-0000-4000-8000-000000000032'::uuid,'f0000001-0000-4000-8000-000000000008'::uuid,'c0000001-0000-4000-8000-000000000202'::uuid,'Why does plain water still leave you flat?','Electrolytes unlock cellular absorption fast.','Fix hydration','curiosity','left_text','#533483',NULL,'approved',88,9,0.25),
-- 009 Luminary
('cd000001-0000-4000-8000-000000000033'::uuid,'f0000001-0000-4000-8000-000000000009'::uuid,'c0000001-0000-4000-8000-000000000301'::uuid,'Derm-favorite brightening serum','15% L-ascorbic acid with stability packaging.','Glow brighter','social_proof','centered','#1a1a2e',NULL,'approved',400,45,0.25),
('cd000001-0000-4000-8000-000000000034'::uuid,'f0000001-0000-4000-8000-000000000009'::uuid,'c0000001-0000-4000-8000-000000000301'::uuid,'Launch allocation closing','Reserve serum from this batch before sellout.','Reserve serum','urgency','bottom_bar','#0f3460',NULL,'approved',380,42,0.25),
('cd000001-0000-4000-8000-000000000035'::uuid,'f0000001-0000-4000-8000-000000000009'::uuid,'c0000001-0000-4000-8000-000000000301'::uuid,'Fades dark spots in 4 weeks','Clinical study average with daily AM use.','See results','benefit','left_text','#16213e',NULL,'approved',360,40,0.25),
('cd000001-0000-4000-8000-000000000036'::uuid,'f0000001-0000-4000-8000-000000000009'::uuid,'c0000001-0000-4000-8000-000000000301'::uuid,'What if vitamin C did not sting?','Buffered formula stays potent yet comfortable.','Try gentle C','curiosity','centered','#533483',NULL,'approved',340,38,0.25),
-- 010
('cd000001-0000-4000-8000-000000000037'::uuid,'f0000001-0000-4000-8000-000000000010'::uuid,'c0000001-0000-4000-8000-000000000301'::uuid,'Sensitive skin editors pick Barrier','Ceramide complex seals moisture for 24h.','Moisturize deep','social_proof','bottom_bar','#1a1a2e',NULL,'approved',320,35,0.25),
('cd000001-0000-4000-8000-000000000038'::uuid,'f0000001-0000-4000-8000-000000000010'::uuid,'c0000001-0000-4000-8000-000000000301'::uuid,'48h free shipping on jars','Add Barrier Cream before promotion ends tonight.','Ship free','urgency','left_text','#0f3460',NULL,'approved',300,32,0.25),
('cd000001-0000-4000-8000-000000000039'::uuid,'f0000001-0000-4000-8000-000000000010'::uuid,'c0000001-0000-4000-8000-000000000301'::uuid,'Repairs barrier after retinol nights','Layerable under SPF without pilling.','Protect skin','benefit','centered','#16213e',NULL,'approved',290,30,0.25),
('cd000001-0000-4000-8000-000000000040'::uuid,'f0000001-0000-4000-8000-000000000010'::uuid,'c0000001-0000-4000-8000-000000000301'::uuid,'Wonder why moisturizers feel greasy?','Barrier Cream uses featherlight emulsion tech.','Feel difference','curiosity','bottom_bar','#533483',NULL,'approved',275,28,0.25),
-- 011
('cd000001-0000-4000-8000-000000000041'::uuid,'f0000001-0000-4000-8000-000000000011'::uuid,'c0000001-0000-4000-8000-000000000302'::uuid,'Influencers film peel night routines','Single-step pads simplify glow maintenance.','Peel tonight','social_proof','left_text','#1a1a2e',NULL,'approved',260,27,0.25),
('cd000001-0000-4000-8000-000000000042'::uuid,'f0000001-0000-4000-8000-000000000011'::uuid,'c0000001-0000-4000-8000-000000000302'::uuid,'Limited jars for spring restock','Peel pads sell through fast each drop.','Grab pads','urgency','centered','#0f3460',NULL,'approved',250,25,0.25),
('cd000001-0000-4000-8000-000000000043'::uuid,'f0000001-0000-4000-8000-000000000011'::uuid,'c0000001-0000-4000-8000-000000000302'::uuid,'Even tone without office peels','Balanced AHA/BHA for at-home resurfacing.','Smooth skin','benefit','bottom_bar','#16213e',NULL,'approved',240,23,0.25),
('cd000001-0000-4000-8000-000000000044'::uuid,'f0000001-0000-4000-8000-000000000011'::uuid,'c0000001-0000-4000-8000-000000000302'::uuid,'Curious how pros prep for events?','Pads deliver controlled exfoliation nightly.','Copy pros','curiosity','left_text','#533483',NULL,'approved',230,22,0.25),
-- 012
('cd000001-0000-4000-8000-000000000045'::uuid,'f0000001-0000-4000-8000-000000000012'::uuid,'c0000001-0000-4000-8000-000000000302'::uuid,'Makeup artists stash this balm','Peptide complex plumps without gloss overload.','Plump lips','social_proof','centered','#1a1a2e',NULL,'approved',220,21,0.25),
('cd000001-0000-4000-8000-000000000046'::uuid,'f0000001-0000-4000-8000-000000000012'::uuid,'c0000001-0000-4000-8000-000000000302'::uuid,'Valentine bundle ends Sunday','Pair balm with serum for automatic savings.','Bundle now','urgency','bottom_bar','#0f3460',NULL,'approved',210,20,0.25),
('cd000001-0000-4000-8000-000000000047'::uuid,'f0000001-0000-4000-8000-000000000012'::uuid,'c0000001-0000-4000-8000-000000000302'::uuid,'Matte finish that still heals','Peptides rebuild barrier while you wear it.','Heal lips','benefit','left_text','#16213e',NULL,'approved',200,19,0.25),
('cd000001-0000-4000-8000-000000000048'::uuid,'f0000001-0000-4000-8000-000000000012'::uuid,'c0000001-0000-4000-8000-000000000302'::uuid,'What if lip balm replaced liner?','Buildable tint from one vegan bullet.','Try tint','curiosity','centered','#533483',NULL,'approved',190,18,0.25)
) AS t(id, product_id, campaign_id, headline, subheadline, cta, angle, layout, background_color, assembled_image_url, status, impressions, clicks, mab_weight);

INSERT INTO users (id, name, email, age, gender, interests, location_city) VALUES
('e0000001-0000-4000-8000-000000000001', 'Alex Rivera', 'alex.demo@adverb.local', 24, 'nonbinary', ARRAY['coffee','tech','travel'], 'Austin'),
('e0000001-0000-4000-8000-000000000002', 'Jordan Lee', 'jordan.demo@adverb.local', 31, 'female', ARRAY['fitness','gaming','food'], 'Seattle'),
('e0000001-0000-4000-8000-000000000003', 'Sam Patel', 'sam.demo@adverb.local', 27, 'male', ARRAY['beauty','fashion','travel'], 'Miami'),
('e0000001-0000-4000-8000-000000000004', 'Casey Nguyen', 'casey.demo@adverb.local', 22, 'female', ARRAY['gaming','tech','coffee'], 'Denver'),
('e0000001-0000-4000-8000-000000000005', 'Riley Brooks', 'riley.demo@adverb.local', 35, 'male', ARRAY['fitness','food','beauty'], 'Chicago');

-- 200 synthetic ad events over last 7 days
INSERT INTO ad_events (user_id, creative_id, campaign_id, event_type, device_type, page_category, created_at)
SELECT
  u.id,
  c.id,
  c.campaign_id,
  CASE WHEN random() < 0.12 THEN 'click' ELSE 'impression' END,
  (ARRAY['mobile','desktop','tablet']::text[])[floor(random()*3)::int + 1],
  (ARRAY['coffee','fitness','beauty','tech','travel','gaming','food','fashion']::text[])[floor(random()*8)::int + 1],
  NOW() - (random() * interval '7 days')
FROM generate_series(1, 200) g
CROSS JOIN LATERAL (SELECT id, campaign_id FROM creatives WHERE status = 'approved' ORDER BY random() LIMIT 1) c
CROSS JOIN LATERAL (SELECT id FROM users ORDER BY random() LIMIT 1) u;
