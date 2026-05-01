package handler

import (
	"encoding/json"
	"net/http"

	"adverb/decision-engine/internal/engagement"
)

type ImpressionHandler struct {
	Store engagement.Store
}

type ImpressionRequest struct {
	TemplateSlug string `json:"template_slug"`
	OverlayKey   string `json:"overlay_key"`
	AgeGroup     string `json:"age_group"`
	Interest     string `json:"interest"`
}

func (h ImpressionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.Store == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	var req ImpressionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	if req.TemplateSlug == "" || req.OverlayKey == "" {
		http.Error(w, "missing required fields", http.StatusBadRequest)
		return
	}

	_ = h.Store.IncrementImpression(r.Context(), engagement.SegmentKey{
		TemplateSlug: req.TemplateSlug,
		OverlayKey:   req.OverlayKey,
		AgeGroup:     req.AgeGroup,
		Interest:     req.Interest,
	}, 1)

	w.WriteHeader(http.StatusNoContent)
}
