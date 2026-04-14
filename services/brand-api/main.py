from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from routers import brands, campaigns, products, creatives

app = FastAPI(title="AdaptAI Brand API", version="1.0.0")

# Any localhost / 127.0.0.1 port (e.g. brand portal on 3010 in Docker) — dev-friendly for coursework
_LOCAL_ORIGIN = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=_LOCAL_ORIGIN,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(brands.router)
app.include_router(campaigns.router)
app.include_router(products.router)
app.include_router(creatives.router)
Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


@app.get("/health")
def health():
    return {"status": "ok"}
