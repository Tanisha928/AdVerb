package catalog

import (
	"encoding/json"
	"os"
)

func LoadTemplates(path string) ([]TemplateSpec, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var specs []TemplateSpec
	return specs, json.Unmarshal(data, &specs)
}

func LoadAssetIndex(path string) ([]AssetEntry, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var entries []AssetEntry
	return entries, json.Unmarshal(data, &entries)
}

func LoadQueryEmbeddings(path string) ([]QueryEmbedding, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var queries []QueryEmbedding
	return queries, json.Unmarshal(data, &queries)
}
