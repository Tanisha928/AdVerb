package handler

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"adverb/decision-engine/internal/catalog"
	"adverb/decision-engine/internal/engagement"
	"adverb/decision-engine/internal/metrics"
	"adverb/decision-engine/internal/scoring"
)

var interestLabels = []string{
	"running", "weightlifting", "yoga", "cycling", "basketball",
	"soccer", "nutrition", "outdoor", "fashion", "tech", "wellness", "gaming",
}

const defaultVariantCount = 3

type RecommendHandler struct {
	Templates       []catalog.TemplateSpec
	Assets          []catalog.AssetEntry
	QueryEmbeddings []catalog.QueryEmbedding
	R2PublicBase    string
	Engagement      engagement.Store
}

func NewRecommendHandler(
	templates []catalog.TemplateSpec,
	assets []catalog.AssetEntry,
	queries []catalog.QueryEmbedding,
	store engagement.Store,
) *RecommendHandler {
	base := os.Getenv("R2_PUBLIC_BASE")
	if base == "" {
		base = "https://pub-XXXX.r2.dev"
	}
	return &RecommendHandler{
		Templates:       templates,
		Assets:          assets,
		QueryEmbeddings: queries,
		R2PublicBase:    strings.TrimRight(base, "/"),
		Engagement:      store,
	}
}

func (h *RecommendHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req catalog.RecommendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	primaryIdx, primaryLabel := primaryInterest(req.Interests)

	matchStart := time.Now()
	queryEmb := findQueryEmbedding(h.QueryEmbeddings, req.AgeGroup, primaryLabel)
	t := bestTemplate(h.Templates, primaryIdx)

	// Score overlays by CLIP dot product, filtered by template category.
	_, overlayPool, overlayScores := scoring.ScoreAssets(queryEmb, h.Assets, "overlay", t.Category)

	// Optionally adjust scores with UCB CTR from Redis.
	adjustedScores := overlayScores
	var segKeys []engagement.SegmentKey
	var counts map[engagement.SegmentKey]engagement.Counts
	var totalImpr int64

	if h.Engagement != nil && len(overlayPool) > 0 {
		segKeys = make([]engagement.SegmentKey, len(overlayPool))
		for i, a := range overlayPool {
			segKeys[i] = engagement.SegmentKey{
				TemplateSlug: t.Slug,
				OverlayKey:   a.Key,
				AgeGroup:     req.AgeGroup,
				Interest:     primaryLabel,
			}
		}
		if c, err := h.Engagement.GetCounts(r.Context(), segKeys); err == nil {
			counts = c
			for _, cnt := range c {
				totalImpr += cnt.Impressions
			}
			adjustedScores = make([]float32, len(overlayScores))
			for i, k := range segKeys {
				cnt := c[k]
				u := float32(scoring.UcbCTR(cnt.Clicks, cnt.Impressions, totalImpr))
				adjustedScores[i] = overlayScores[i] + u
			}
		}
	}

	// Select top-k overlay variants (default 3).
	k := defaultVariantCount
	if req.TopK > 0 && req.TopK < k {
		k = req.TopK
	}
	topIndices := scoring.TopKIndices(adjustedScores, k)

	matchingLatency := time.Since(matchStart).Milliseconds()

	// Assign background by template slug — plain-color JPEGs have no semantic content so
	// CLIP scoring always returns the same one. Explicit mapping guarantees visual variety.
	backgroundURL := h.R2PublicBase + "/" + templateBackground(t.Slug)

	// Build copy prompt template (same for all variants — copy gen differentiates per variantId).
	prompt := strings.NewReplacer(
		"{brand}", t.Brand,
		"{age_group}", req.AgeGroup,
		"{primary_interest}", primaryLabel,
		"{location}", req.LocationStr,
	).Replace(t.CopyPromptTemplate)

	// Build variant specs.
	variants := make([]catalog.CreativeSpec, 0, len(topIndices))
	for _, idx := range topIndices {
		if idx < 0 || idx >= len(overlayPool) {
			continue
		}
		overlay := overlayPool[idx]
		overlayURL := h.R2PublicBase + "/" + overlay.Key
		if overlay.Key == "" {
			overlayURL = h.R2PublicBase + "/" + t.R2OverlayKey
		}

		ucbCtrForVariant := float32(0)
		if counts != nil && idx < len(segKeys) {
			cnt := counts[segKeys[idx]]
			ucbCtrForVariant = float32(scoring.UcbCTR(cnt.Clicks, cnt.Impressions, totalImpr))
		}

		variants = append(variants, catalog.CreativeSpec{
			TemplateID:      t.ID,
			TemplateSlug:    t.Slug,
			Brand:           t.Brand,
			Category:        t.Category,
			R2OverlayKey:    overlay.Key,
			R2LogoURL:       h.R2PublicBase + "/" + t.R2LogoKey,
			R2BackgroundURL: backgroundURL,
			R2OverlayURL:    overlayURL,
			CopyPrompt:      prompt,
			CTA:             t.CTA,
			ColorScheme:     t.ColorScheme,
			Score:           adjustedScores[idx],
			UcbCtr:          ucbCtrForVariant,
		})
	}

	// Fallback: if no variants scored (no matching assets), return a template-defaults spec.
	if len(variants) == 0 {
		variants = append(variants, catalog.CreativeSpec{
			TemplateID:      t.ID,
			TemplateSlug:    t.Slug,
			Brand:           t.Brand,
			Category:        t.Category,
			R2OverlayKey:    t.R2OverlayKey,
			R2LogoURL:       h.R2PublicBase + "/" + t.R2LogoKey,
			R2BackgroundURL: backgroundURL,
			R2OverlayURL:    h.R2PublicBase + "/" + t.R2OverlayKey,
			CopyPrompt:      prompt,
			CTA:             t.CTA,
			ColorScheme:     t.ColorScheme,
		})
	}

	resp := catalog.RecommendResponse{
		Creative:          variants[0],
		Variants:          variants,
		CandidateScores:   adjustedScores,
		MatchingLatencyMs: matchingLatency,
		TotalLatencyMs:    time.Since(start).Milliseconds(),
		ProfileEmbedding:  queryEmb,
	}

	metrics.RecommendDurationSeconds.Observe(time.Since(start).Seconds())
	metrics.RecommendMatchingSeconds.Observe(float64(matchingLatency) / 1000.0)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func primaryInterest(interests []float32) (int, string) {
	best := 0
	for i, v := range interests {
		if v > interests[best] {
			best = i
		}
	}
	if best < len(interestLabels) {
		return best, interestLabels[best]
	}
	return 0, "fitness"
}

func findQueryEmbedding(queries []catalog.QueryEmbedding, ageGroup, interest string) []float32 {
	interest = strings.ToLower(interest)
	for _, q := range queries {
		if q.AgeGroup == ageGroup && strings.ToLower(q.Interest) == interest {
			return q.Embedding
		}
	}
	for _, q := range queries {
		if q.AgeGroup == ageGroup {
			return q.Embedding
		}
	}
	if len(queries) > 0 {
		return queries[0].Embedding
	}
	return nil
}

func firstScore(scores []float32) float32 {
	if len(scores) == 0 {
		return 0
	}
	return scores[0]
}

// templateBackground maps each catalog slug to a distinct plain-color background.
// All backgrounds/*.jpg files exist in Supabase (uploaded by ml/upload_assets.py).
func templateBackground(slug string) string {
	m := map[string]string{
		"running-shoe-sprint":   "backgrounds/deep-red.jpg",
		"protein-power-surge":   "backgrounds/deep-red.jpg",
		"fitness-watch-pro":     "backgrounds/deep-navy.jpg",
		"yoga-mat-flow":         "backgrounds/forest-green.jpg",
		"cycling-gear-velocity": "backgrounds/electric-blue.jpg",
		"basketball-kicks":      "backgrounds/charcoal.jpg",
		"gym-apparel-flex":      "backgrounds/black.jpg",
		"outdoor-trail-boot":    "backgrounds/forest-green.jpg",
		"wellness-supplement":   "backgrounds/warm-grey.jpg",
		"soccer-cleat-striker":  "backgrounds/electric-blue.jpg",
		"fashion-handbag-luxe":  "backgrounds/cream.jpg",
		"fashion-jewelry-glow":  "backgrounds/white.jpg",
	}
	if bg, ok := m[slug]; ok {
		return bg
	}
	return "backgrounds/slate.jpg"
}

// bestTemplate selects the template where primaryInterestIdx appears at the
// lowest rank (closest to position 0) in CompatibleInterests. This ensures a
// user selecting "Fashion" gets a fashion template, not basketball shoes that
// list fashion as a tertiary interest.
func bestTemplate(templates []catalog.TemplateSpec, primaryInterestIdx int) catalog.TemplateSpec {
	best := templates[0]
	bestRank := len(best.CompatibleInterests) + 1
	for _, t := range templates {
		for rank, ci := range t.CompatibleInterests {
			if ci == primaryInterestIdx && rank < bestRank {
				best = t
				bestRank = rank
			}
		}
	}
	return best
}
