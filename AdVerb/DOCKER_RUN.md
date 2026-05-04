# Run with Docker Compose (AdVerb reference stack)

## Prerequisite

- Install Docker Desktop and ensure it is running.

## Start the stack

From **`AdVerb/`** (paths assume `decision-engine/`, `ml/`, and `templates/` live next to this folder at repo root):

```bash
cd AdVerb
docker compose up --build
```

Services:

- UI: **http://localhost:3100** (host maps container port 3000)
- Decision engine: **http://localhost:8080/health**
- Creative cache: **http://localhost:8001/health**
- Prometheus: **http://localhost:9090**
- Grafana: **http://localhost:3200** (login `admin` / `admin`; change password on first use)

Prometheus scrapes `decision-engine:8080/metrics` and `ui:3000/api/metrics`. Grafana loads the **AdVerb — Overview** dashboard automatically (browse **Dashboards**).

## Stop the stack

```bash
docker compose down
```

## Notes

- In Docker mode, the UI calls a local Next.js API route (`/api/ad`), which forwards profile data to the decision engine.
- For the **AdaptAI** product (Postgres, brand-api, Pollinations creatives), start **`docker compose`** from the **repository root** instead; see root **`README.md`** and **`ARCHITECTURE.md`**.
