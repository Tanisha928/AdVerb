# Deployment Runbook

## 1) Train and export model

```bash
cd ml
pip install -r requirements.txt
python data/generate_dataset.py
python model/train.py
python model/export_onnx.py
```

## 2) Upload assets to R2

```bash
wrangler r2 bucket create adverb-assets
cd assets
bash upload_to_r2.sh
```

## 3) Deploy decision engine

```bash
flyctl launch --name adverb-decision-engine --region iad --no-deploy
flyctl deploy -c infra/fly.toml
flyctl scale count 2 --region sjc
```

## 4) Deploy worker

```bash
cd worker
npm install
wrangler kv:namespace create CREATIVE_CACHE
wrangler deploy
```

## 5) Deploy UI

```bash
cd ui
npm install
npm run build
```

Set `NEXT_PUBLIC_WORKER_URL` in your Pages environment before publishing.
