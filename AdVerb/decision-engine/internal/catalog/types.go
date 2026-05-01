package catalog

type RecommendRequest struct {
	UserID      string    `json:"user_id"`
	AgeBucket   int       `json:"age_bucket"`
	Interests   []float32 `json:"interests"`
	LocationID  int       `json:"location_id"`
	Device      int       `json:"device"`
	LocationStr string    `json:"location_str"`
	AgeGroup    string    `json:"age_group"`
	TopK        int       `json:"top_k"`
}

type ColorScheme struct {
	Primary   string `json:"primary"`
	Secondary string `json:"secondary"`
}

type TemplateSpec struct {
	ID                  int         `json:"id"`
	Slug                string      `json:"slug"`
	Category            string      `json:"category"`
	CategoryID          int         `json:"category_id"`
	Brand               string      `json:"brand"`
	BrandID             int         `json:"brand_id"`
	R2LogoKey           string      `json:"r2_logo_key"`
	R2BackgroundKey     string      `json:"r2_background_key"`
	R2OverlayKey        string      `json:"r2_overlay_key"`
	CopyPromptTemplate  string      `json:"copy_prompt_template"`
	CTA                 string      `json:"cta"`
	ColorScheme         ColorScheme `json:"color_scheme"`
	CompatibleInterests []int       `json:"compatible_interests"`
}

// AssetEntry is one image from asset_index.json with its CLIP embedding.
// Metadata fields are populated by ml/embed_assets.py from assets/metadata.yaml.
type AssetEntry struct {
	Key            string    `json:"key"`             // e.g. "overlays/shoe-running.png"
	Type           string    `json:"type"`            // "overlay" or "background"
	Category       string    `json:"category"`        // matches TemplateSpec.Category
	BrandHint      string    `json:"brand_hint"`      // lowercase brand identifier
	Tags           []string  `json:"tags"`            // interest labels (see interestLabels in recommend.go)
	LabelStudioID  *string   `json:"label_studio_id"` // Label Studio task ID, null if not applicable
	Embedding      []float32 `json:"embedding"`       // 512-dim CLIP image embedding
}

// QueryEmbedding is a precomputed CLIP text embedding for one (age_group, interest) pair.
type QueryEmbedding struct {
	AgeGroup  string    `json:"age_group"`
	Interest  string    `json:"interest"`
	Query     string    `json:"query"`
	Embedding []float32 `json:"embedding"` // 512-dim CLIP text embedding
}

type CreativeSpec struct {
	TemplateID      int         `json:"template_id"`
	TemplateSlug    string      `json:"template_slug"`
	Brand           string      `json:"brand"`
	Category        string      `json:"category"`
	R2OverlayKey    string      `json:"r2_overlay_key"`
	R2LogoURL       string      `json:"r2_logo_url"`
	R2BackgroundURL string      `json:"r2_background_url"`
	R2OverlayURL    string      `json:"r2_overlay_url"`
	CopyPrompt      string      `json:"copy_prompt"`
	CTA             string      `json:"cta"`
	ColorScheme     ColorScheme `json:"color_scheme"`
	Score           float32     `json:"score"`
	UcbCtr          float32     `json:"ucb_ctr"`
}

type RecommendResponse struct {
	Creative          CreativeSpec   `json:"creative"`
	Variants          []CreativeSpec `json:"variants"`
	CandidateScores   []float32      `json:"candidate_scores"`
	MatchingLatencyMs int64          `json:"matching_latency_ms"`
	TotalLatencyMs    int64          `json:"total_latency_ms"`
	ProfileEmbedding  []float32      `json:"profile_embedding"`
}
