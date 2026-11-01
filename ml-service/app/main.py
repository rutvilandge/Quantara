from __future__ import annotations

import os
import secrets
from threading import BoundedSemaphore
from typing import Annotated, Literal
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse
from .analytics import AnalyticsInputError, analyze

app = FastAPI(title="QUANTARA Statistical Analytics", version="1.0.0", docs_url=None, redoc_url=None)
capacity = BoundedSemaphore(2)


@app.middleware("http")
async def limit_body(request: Request, call_next):
    try:
        if int(request.headers.get("content-length", "0")) > 3 * 1024 * 1024:
            return JSONResponse({"message": "Request exceeds 3 MB"}, status_code=413)
    except ValueError:
        return JSONResponse({"message": "Invalid content length"}, status_code=400)
    return await call_next(request)


def authorize(x_ml_token: Annotated[str | None, Header()] = None):
    expected = os.environ.get("ML_SERVICE_TOKEN", "")
    if not expected or not x_ml_token or not secrets.compare_digest(expected, x_ml_token):
        raise HTTPException(status_code=401, detail="Service authentication required")


class AnalysisRequest(BaseModel):
    rows: list[dict] = Field(min_length=20, max_length=10_000)
    dateColumn: str = Field(min_length=1, max_length=63)
    metricColumn: str = Field(min_length=1, max_length=63)
    horizon: int = Field(default=14, ge=1, le=60)
    frequency: Literal["D", "W", "MS"] = "D"
    aggregation: Literal["sum", "mean"] = "sum"


@app.get("/health")
def health():
    return {"status": "UP", "service": "quantara-ml"}


@app.post("/v1/analyze", dependencies=[Depends(authorize)])
def analysis(body: AnalysisRequest):
    if not capacity.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="Statistical workers are busy; try again shortly")
    try:
        return analyze(body.rows, body.dateColumn, body.metricColumn, body.horizon, body.frequency, body.aggregation)
    except AnalyticsInputError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    except (ValueError, RuntimeError, ArithmeticError):
        raise HTTPException(status_code=422, detail="The statistical model could not fit this series. Review the data or choose another frequency.") from None
    finally:
        capacity.release()
