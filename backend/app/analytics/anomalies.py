"""
Anomaly Detection Engine.
Implements unsupervised multi-feature anomaly detection using Scikit-Learn's Isolation Forest,
along with per-record feature attribution and explainability for business users.
"""

from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer

from backend.app.schemas.analytics import (
    AnomalyPoint,
    AnomalyResult,
)


class AnomalyDetector:
    """
    Unsupervised multi-dimensional anomaly detector for business datasets.

    Methodology:
    - Algorithm: Isolation Forest (scikit-learn).
      Why: Isolation Forest isolates anomalous observations by randomly selecting a feature and
      randomly selecting a split value between the maximum and minimum values of that feature.
      Because anomalies are few and structurally distinct, they require significantly fewer random
      partitions to isolate (shorter path length in tree ensembles) than normal points.
      It does not assume Gaussian distributions and performs exceptionally well in business datasets.

    - Preprocessing:
      1. Numeric feature selection and missing value median imputation.
      2. Standardization (StandardScaler) to prevent high-magnitude features from dominating tree splits.

    - Explainability:
      For each flagged record, we compute the Z-score deviation against the dataset's normal baseline
      for each feature. The features with the largest absolute deviations (|z| > 2.0) are reported as the
      primary contributing factors for that anomaly.

    - Assumptions & Limitations:
      - Contamination parameter specifies the expected proportion of outliers (default 0.05 = 5%).
      - Purely unsupervised: does not know whether an anomaly is a high-value opportunity or a data entry error.
      - Requires numeric columns (categorical features must be encoded or aggregated).
    """

    @classmethod
    def detect_anomalies(
        cls,
        df: pd.DataFrame,
        feature_columns: Optional[List[str]] = None,
        contamination: float = 0.05,
        random_state: int = 42,
    ) -> AnomalyResult:
        """
        Detect anomalous records in the DataFrame.

        Args:
            df: Input dataset.
            feature_columns: List of numeric column names to analyze. If None, all numeric columns are used.
            contamination: Expected proportion of outliers in the data (0.01 to 0.20).
            random_state: Seed for deterministic execution.

        Returns:
            AnomalyResult with flagged points and feature-level explanations.
        """
        if df.empty or len(df) < 5:
            return AnomalyResult(
                total_records=len(df),
                anomaly_count=0,
                contamination_rate=contamination,
                method="IsolationForest",
                features_analyzed=[],
                anomalies=[],
                insights=["Dataset too small for anomaly detection (minimum 5 records required)."],
                warnings=["Insufficient records."],
            )

        # Determine features to analyze
        if feature_columns:
            selected_cols = []
            for fc in feature_columns:
                matched = [c for c in df.columns if c.lower() == fc.strip().lower()]
                if matched and pd.api.types.is_numeric_dtype(df[matched[0]]):
                    selected_cols.append(matched[0])
        else:
            selected_cols = [
                c for c in df.columns
                if pd.api.types.is_numeric_dtype(df[c]) and df[c].nunique() > 1
            ]

        if not selected_cols:
            return AnomalyResult(
                total_records=len(df),
                anomaly_count=0,
                contamination_rate=contamination,
                method="IsolationForest",
                features_analyzed=[],
                anomalies=[],
                insights=["No suitable numeric features found for anomaly detection."],
                warnings=["Zero numeric features selected."],
            )

        # Extract numeric matrix
        X_raw = df[selected_cols].copy()

        # Median imputation for any missing cells
        imputer = SimpleImputer(strategy="median")
        X_imputed = imputer.fit_transform(X_raw)

        # Feature scaling
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X_imputed)

        # Fit Isolation Forest
        bounded_contamination = max(0.01, min(0.20, contamination))
        model = IsolationForest(
            contamination=bounded_contamination,
            random_state=random_state,
            n_estimators=100,
        )
        # Predictions: -1 for anomaly, 1 for inlier
        preds = model.fit_predict(X_scaled)
        # Raw anomaly scores: lower score = more abnormal
        raw_scores = model.decision_function(X_scaled)

        # Calculate baselines for explainability
        feature_means = np.mean(X_imputed, axis=0)
        feature_stds = np.std(X_imputed, axis=0)
        feature_stds[feature_stds == 0] = 1.0  # Prevent division by zero

        anomalies: List[AnomalyPoint] = []
        anomaly_indices = np.where(preds == -1)[0]

        # Identify ID column for record identification if available
        id_col = None
        for candidate in ["order_id", "id", "transaction_id", "customer_id"]:
            matching = [c for c in df.columns if c.lower() == candidate]
            if matching:
                id_col = matching[0]
                break

        for idx in anomaly_indices:
            row_data = df.iloc[idx].to_dict()
            rec_id = str(row_data.get(id_col)) if id_col else f"Row #{idx + 1}"
            score = round(float(raw_scores[idx]), 4)

            # Feature-level attribution (calculate z-scores for this record)
            outlier_features: List[Dict[str, Any]] = []
            explanations: List[str] = []

            for f_idx, col_name in enumerate(selected_cols):
                val = float(X_imputed[idx, f_idx])
                mean_val = float(feature_means[f_idx])
                std_val = float(feature_stds[f_idx])
                z_score = (val - mean_val) / std_val

                if abs(z_score) >= 1.8:
                    direction = "significantly higher than normal" if z_score > 0 else "significantly lower than normal"
                    outlier_features.append({
                        "feature": col_name,
                        "value": round(val, 2),
                        "baseline_mean": round(mean_val, 2),
                        "z_score": round(float(z_score), 2),
                        "direction": direction,
                    })
                    explanations.append(
                        f"{col_name} ({val:,.2f}) is {direction} (avg: {mean_val:,.2f})"
                    )

            if not explanations:
                explanation = "Multi-variate interaction: combination of feature values is rare across the dataset."
            else:
                explanation = "Key anomalies: " + "; ".join(explanations) + "."

            # Clean row dict for JSON serialization
            cleaned_row_data = {
                k: (int(v) if isinstance(v, (np.integer, int)) else (float(v) if isinstance(v, (np.floating, float)) else str(v)))
                for k, v in row_data.items()
            }

            anomalies.append(
                AnomalyPoint(
                    row_index=int(idx),
                    record_id=rec_id,
                    anomaly_score=score,
                    is_anomaly=True,
                    outlier_features=outlier_features,
                    record_data=cleaned_row_data,
                    explanation=explanation,
                )
            )

        # Sort anomalies by score ascending (most anomalous first)
        anomalies.sort(key=lambda a: a.anomaly_score)

        insights = [
            f"Detected {len(anomalies)} anomalous observations ({len(anomalies) / len(df) * 100:.1f}% of total) across {len(selected_cols)} numeric features.",
        ]
        if anomalies:
            insights.append(
                f"Most severe anomaly identified at {anomalies[0].record_id}: {anomalies[0].explanation}"
            )

        return AnomalyResult(
            total_records=len(df),
            anomaly_count=len(anomalies),
            contamination_rate=bounded_contamination,
            method="IsolationForest",
            features_analyzed=selected_cols,
            anomalies=anomalies,
            insights=insights,
            warnings=[],
        )
