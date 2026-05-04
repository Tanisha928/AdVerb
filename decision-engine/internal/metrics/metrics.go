package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	RecommendDurationSeconds = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "adverb_recommend_handler_duration_seconds",
			Help:    "Wall time for successful recommend requests (handler only).",
			Buckets: []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
		},
	)

	RecommendMatchingSeconds = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "adverb_recommend_matching_phase_seconds",
			Help:    "Time spent in asset matching / scoring inside recommend.",
			Buckets: []float64{.0005, .001, .002, .005, .01, .025, .05, .1, .25},
		},
	)
)
