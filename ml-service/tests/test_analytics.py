import math
import os
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
from app.main import app
from app.analytics import analyze


def series():
    random = np.random.default_rng(42)
    values = 100 + np.arange(100) * 2 + random.normal(0, 2, 100)
    values[45] += 600
    return [{"date": str(day.date()), "revenue": float(value)}
            for day, value in zip(pd.date_range("2025-01-01", periods=100), values)]


def test_real_forecast_intervals_evaluation_and_anomaly_detection():
    result = analyze(series(), "date", "revenue", horizon=7)
    forecast = [point for point in result["points"] if point["forecast"] is not None]
    assert len(forecast) == 7
    assert all(point["actual"] is None for point in forecast)
    assert all(point["lower"] <= point["forecast"] <= point["upper"] for point in forecast)
    assert any(point["date"].startswith("2025-02-15") for point in result["anomalies"])
    assert result["trend"]["slopePerPeriod"] > 0
    assert math.isfinite(result["evaluation"]["rmse"])
    assert result["evaluation"]["trainEnd"] < result["evaluation"]["testStart"]
    assert 0 <= result["evaluation"]["intervalCoverage"] <= 1


def test_service_requires_shared_secret_and_validates_inputs(monkeypatch):
    monkeypatch.setenv("ML_SERVICE_TOKEN", "test-only-service-token-not-a-deployment-secret")
    client = TestClient(app)
    assert client.get("/health").json()["status"] == "UP"
    assert client.post("/v1/analyze", json={"rows": series(), "dateColumn": "date", "metricColumn": "revenue"}).status_code == 401
    headers = {"X-ML-Token": os.environ["ML_SERVICE_TOKEN"]}
    assert client.post("/v1/analyze", json={"rows": [], "dateColumn": "date", "metricColumn": "revenue"}, headers=headers).status_code == 422
    response = client.post("/v1/analyze", json={"rows": series(), "dateColumn": "date", "metricColumn": "revenue", "horizon": 7}, headers=headers)
    assert response.status_code == 200
    assert len(response.json()["points"]) == 107


def test_missing_periods_remain_distinguishable_from_actuals():
    rows = series()
    del rows[20]
    result = analyze(rows, "date", "revenue", horizon=3)
    point = next(p for p in result["points"] if p["date"].startswith("2025-01-21"))
    assert point["actual"] is None and point["imputed"] is True
    assert result["dataQuality"]["imputedPeriods"] == 1
