"""Bounded, deterministic statistical analytics. No language-model estimates."""
from __future__ import annotations

import warnings
import numpy as np
import pandas as pd
from statsmodels.regression.linear_model import OLS
from statsmodels.tools.tools import add_constant
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import RobustScaler
from statsmodels.tsa.statespace.structural import UnobservedComponents
from statsmodels.tsa.statespace.sarimax import SARIMAX


class AnalyticsInputError(ValueError):
    pass


def _fit(series: pd.Series, model: str):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        if model == "local_linear_trend":
            fitted = UnobservedComponents(series, level="local linear trend").fit(disp=False, maxiter=100)
        else:
            fitted = SARIMAX(series, order=(0, 1, 0), trend="t").fit(disp=False, maxiter=100)
    if not fitted.mle_retvals.get("converged", True):
        raise RuntimeError("Statistical model did not converge")
    return fitted


def _prediction(fitted, steps: int):
    forecast = fitted.get_forecast(steps=steps)
    mean = np.asarray(forecast.predicted_mean, dtype=float)
    intervals = np.asarray(forecast.conf_int(alpha=0.05), dtype=float)
    if not (np.isfinite(mean).all() and np.isfinite(intervals).all()):
        raise RuntimeError("Model produced nonfinite predictions")
    return mean, intervals


def analyze(rows: list[dict], date_column: str, metric_column: str, horizon: int = 14,
            frequency: str = "D", aggregation: str = "sum") -> dict:
    frame = pd.DataFrame(rows)
    if date_column not in frame or metric_column not in frame:
        raise AnalyticsInputError("Choose a date column and a numeric metric from the dataset")
    frame = pd.DataFrame({
        "date": pd.to_datetime(frame[date_column], errors="coerce", utc=True).dt.tz_convert(None),
        "value": pd.to_numeric(frame[metric_column], errors="coerce"),
    }).replace([np.inf, -np.inf], np.nan)
    discarded = int(frame.isna().any(axis=1).sum())
    frame = frame.dropna().sort_values("date")
    if len(frame) < 20:
        raise AnalyticsInputError("At least 20 valid dated numeric observations are required")
    if (frame["date"].max() - frame["date"].min()).days > 3650:
        raise AnalyticsInputError("Select a date range of ten years or less")
    grouped = frame.set_index("date")["value"].resample(frequency)
    observed = grouped.sum(min_count=1) if aggregation == "sum" else grouped.mean()
    if len(observed) < 20 or len(observed) > 2000:
        raise AnalyticsInputError("Use a frequency producing 20 to 2,000 periods")
    missing = int(observed.isna().sum())
    if missing / len(observed) > 0.2:
        raise AnalyticsInputError("More than 20% of periods are missing. Use a coarser frequency or review your dates.")
    series = observed.interpolate(method="time").astype(float)
    holdout_size = min(28, max(4, len(series) // 5))
    # Separate model selection from the final temporal evaluation. Impute each
    # training segment independently so held-out values cannot leak backwards.
    selection_train = observed.iloc[:-2 * holdout_size].interpolate(method="time").ffill().astype(float)
    selection_test = observed.iloc[-2 * holdout_size:-holdout_size]
    selection_mask = selection_test.notna().to_numpy()
    if int(selection_mask.sum()) < 3:
        raise AnalyticsInputError("At least three observed periods are required in the model-selection window")
    candidates = []
    for model in ("local_linear_trend", "random_walk_with_drift"):
        try:
            predicted, _ = _prediction(_fit(selection_train, model), holdout_size)
            candidates.append((float(np.mean(np.abs(selection_test.to_numpy()[selection_mask] - predicted[selection_mask]))), model))
        except (ValueError, RuntimeError, np.linalg.LinAlgError):
            continue
    if not candidates:
        raise AnalyticsInputError("A stable statistical model could not be fitted. Review data quality or try weekly aggregation.")
    _, model = min(candidates, key=lambda item: item[0])
    train = observed.iloc[:-holdout_size].interpolate(method="time").ffill().astype(float)
    test = observed.iloc[-holdout_size:]
    test_mask = test.notna().to_numpy()
    if int(test_mask.sum()) < 3:
        raise AnalyticsInputError("At least three observed periods are required in the final evaluation window")
    validation_prediction, validation_interval = _prediction(_fit(train, model), holdout_size)
    validation_prediction = validation_prediction[test_mask]
    validation_interval = validation_interval[test_mask]
    actual_test = test.to_numpy()[test_mask]
    residuals = actual_test - validation_prediction
    mae = float(np.mean(np.abs(residuals)))
    denominator = np.abs(actual_test) + np.abs(validation_prediction)
    smape = float(np.mean(np.divide(200 * np.abs(residuals), denominator,
                                  out=np.zeros_like(denominator), where=denominator > 0)))
    naive_prediction = np.repeat(float(train.iloc[-1]), len(actual_test))
    naive_mae = float(np.mean(np.abs(actual_test - naive_prediction)))
    forecast, interval = _prediction(_fit(series, model), horizon)
    x = np.arange(len(series), dtype=float).reshape(-1, 1)
    regression = LinearRegression().fit(x, series.to_numpy())
    trend = regression.predict(x)
    robust_trend = OLS(series.to_numpy(), add_constant(x)).fit(
        cov_type="HAC", cov_kwds={"maxlags": min(7, max(1, len(series) // 4))})
    slope_interval = np.asarray(robust_trend.conf_int(alpha=0.05))[1]
    rolling_median = series.rolling(7, min_periods=1, center=True).median()
    features = np.column_stack([series, series.diff().fillna(0), series - rolling_median])
    transformed = RobustScaler().fit_transform(features)
    detector = IsolationForest(n_estimators=100, contamination="auto", random_state=42, n_jobs=1)
    labels = detector.fit_predict(transformed)
    scores = -detector.decision_function(transformed)
    points = []
    for i, timestamp in enumerate(series.index):
        is_observed = bool(pd.notna(observed.iloc[i]))
        points.append({"date": timestamp.isoformat(), "actual": float(observed.iloc[i]) if is_observed else None,
                       "forecast": None, "lower": None, "upper": None, "trend": float(trend[i]),
                       "imputed": not is_observed, "isAnomaly": bool(labels[i] == -1 and is_observed),
                       "anomalyScore": float(scores[i]) if is_observed else None})
    future = pd.date_range(series.index[-1], periods=horizon + 1, freq=frequency)[1:]
    for i, timestamp in enumerate(future):
        points.append({"date": timestamp.isoformat(), "actual": None, "forecast": float(forecast[i]),
                       "lower": float(interval[i, 0]), "upper": float(interval[i, 1]), "trend": None,
                       "imputed": False, "isAnomaly": False, "anomalyScore": None})
    notes = ["Predictions are statistical estimates, not actual transactions or guaranteed outcomes.",
             "95% prediction intervals depend on the selected model's assumptions.",
             "IsolationForest flags unusual observations; it does not establish fraud or causality.",
             "Model selection uses an earlier validation window; evaluation uses a separate final temporal holdout. Missing test actuals are excluded."]
    if missing:
        notes.append(f"{missing} missing periods were linearly interpolated for modeling; displayed actual values remain missing.")
    if discarded:
        notes.append(f"{discarded} rows with invalid dates or numeric values were excluded.")
    if mae > naive_mae:
        notes.append("The selected model did not outperform the last-value baseline on the holdout.")
    slope = float(regression.coef_[0])
    return {
        "model": model, "metric": metric_column, "dateColumn": date_column,
        "frequency": frequency, "aggregation": aggregation, "horizon": horizon,
        "intervalLevel": 0.95, "points": points,
        "anomalies": [point for point in points if point["isAnomaly"]],
        "trend": {"slopePerPeriod": slope, "lower95": float(slope_interval[0]), "upper95": float(slope_interval[1]),
                  "rSquared": float(regression.score(x, series.to_numpy())), "pValue": float(robust_trend.pvalues[1]),
                  "direction": "increasing" if slope_interval[0] > 0 else "decreasing" if slope_interval[1] < 0 else "no clear linear trend"},
        "evaluation": {"mae": mae, "rmse": float(np.sqrt(np.mean(residuals ** 2))), "smape": smape,
                       "naiveMae": naive_mae, "intervalCoverage": float(np.mean((actual_test >= validation_interval[:, 0]) & (actual_test <= validation_interval[:, 1]))),
                       "trainPeriods": len(train), "testPeriods": holdout_size, "evaluatedPeriods": len(actual_test), "selectionPeriods": holdout_size,
                       "trainEnd": train.index[-1].isoformat(), "testStart": test.index[0].isoformat()},
        "dataQuality": {"inputRows": len(rows), "validRows": len(frame), "periods": len(series),
                        "imputedPeriods": missing, "excludedRows": discarded},
        "notes": notes,
    }
