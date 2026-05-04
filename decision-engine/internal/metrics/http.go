package metrics

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	httpRequests = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "adverb_http_requests_total",
			Help: "HTTP requests to the decision engine by handler, method, and status code.",
		},
		[]string{"handler", "method", "code"},
	)

	httpDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "adverb_http_request_duration_seconds",
			Help:    "HTTP request duration in seconds.",
			Buckets: []float64{.0005, .001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
		},
		[]string{"handler", "method"},
	)
)

type statusRecorder struct {
	http.ResponseWriter
	code int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.code = code
	s.ResponseWriter.WriteHeader(code)
}

// InstrumentHandler records request counts and latency for a named HTTP handler.
func InstrumentHandler(handlerName string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &statusRecorder{ResponseWriter: w, code: http.StatusOK}
		start := time.Now()
		next.ServeHTTP(rec, r)
		code := strconv.Itoa(rec.code)
		httpRequests.WithLabelValues(handlerName, r.Method, code).Inc()
		httpDuration.WithLabelValues(handlerName, r.Method).Observe(time.Since(start).Seconds())
	})
}
