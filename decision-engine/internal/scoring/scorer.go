package scoring

import (
	"math"
	"sort"

	"adverb/decision-engine/internal/catalog"
)

func DotProduct(a, b []float32) float32 {
	var sum float32
	for i := 0; i < len(a) && i < len(b); i++ {
		sum += a[i] * b[i]
	}
	return sum
}

func TopIndex(values []float32) int {
	best := 0
	for i := 1; i < len(values); i++ {
		if values[i] > values[best] {
			best = i
		}
	}
	return best
}

// TopKIndices returns the indices of the top-k highest scores, sorted descending.
func TopKIndices(scores []float32, k int) []int {
	type pair struct {
		idx   int
		score float32
	}
	pairs := make([]pair, len(scores))
	for i, s := range scores {
		pairs[i] = pair{i, s}
	}
	sort.Slice(pairs, func(a, b int) bool { return pairs[a].score > pairs[b].score })
	if k > len(pairs) {
		k = len(pairs)
	}
	result := make([]int, k)
	for i := 0; i < k; i++ {
		result[i] = pairs[i].idx
	}
	return result
}

// ScoreAssets scores all assets of the given type against a query embedding.
// If categoryFilter is non-empty, only assets whose Category matches are considered;
// if no assets match the category, the filter is dropped and all assets of that type are scored.
func ScoreAssets(queryEmb []float32, assets []catalog.AssetEntry, assetType, categoryFilter string) (catalog.AssetEntry, []catalog.AssetEntry, []float32) {
	var pool []catalog.AssetEntry
	for _, a := range assets {
		if a.Type == assetType {
			pool = append(pool, a)
		}
	}
	if len(pool) == 0 {
		return catalog.AssetEntry{}, nil, nil
	}

	// Narrow by category when possible.
	if categoryFilter != "" {
		var filtered []catalog.AssetEntry
		for _, a := range pool {
			if a.Category == categoryFilter {
				filtered = append(filtered, a)
			}
		}
		if len(filtered) > 0 {
			pool = filtered
		}
	}

	scores := make([]float32, len(pool))
	for i, a := range pool {
		scores[i] = DotProduct(queryEmb, a.Embedding)
	}
	return pool[TopIndex(scores)], pool, scores
}

// UcbCTR computes an "optimistic" CTR estimate for Bernoulli rewards.
//
// - clicks/impressions is the empirical mean (0 when impressions=0)
// - the exploration term shrinks as impressions grow, and grows with total traffic
//
// Returns a value in [0, 1].
func UcbCTR(clicks, impressions, totalImpressions int64) float64 {
	var mean float64
	if impressions > 0 {
		mean = float64(clicks) / float64(impressions)
	}

	// t is the "time" term in UCB1; keep it >= 1 so ln(t) is defined.
	t := float64(totalImpressions)
	if t < 1 {
		t = 1
	}

	// n is how often we've tried this variant; keep it >= 1 to avoid div-by-zero.
	n := float64(impressions)
	if n < 1 {
		n = 1
	}

	bonus := math.Sqrt((2 * math.Log(t)) / n)
	ucb := mean + bonus
	if ucb < 0 {
		return 0
	}
	if ucb > 1 {
		return 1
	}
	return ucb
}
