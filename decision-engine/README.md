# Decision engine (Go)

HTTP service for **template + overlay recommendation** (`POST /recommend`), engagement-aware scoring (UCB), and Prometheus metrics.

Build locally:

```bash
cd decision-engine
go build -o decision-engine ./cmd/server
```

Docker: use **`docker compose --profile recommendation-stack`** from the repository root, or **`AdVerb/docker-compose.yml`** with the reference UI.

System context: **[`../ARCHITECTURE.md`](../ARCHITECTURE.md)**.
