# Run with Docker Compose

## Prerequisite

- Install Docker Desktop and ensure it is running.

## Start the stack

From repository root:

```bash
docker compose up --build
```

Services:

- UI: `http://localhost:3000`
- Decision engine: `http://localhost:8080/health`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001` (login `admin` / `admin`; change password on first use)

Prometheus scrapes `decision-engine:8080/metrics` and `ui:3000/api/metrics`. Grafana loads the **AdVerb — Overview** dashboard automatically (browse **Dashboards**).

## Stop the stack

```bash
docker compose down
```

## Notes

- In Docker mode, the UI calls a local Next.js API route (`/api/ad`), which forwards profile data to the decision engine.
- If `decision-engine/item_embeddings.json` is missing, the decision engine auto-generates deterministic fallback embeddings at startup.
