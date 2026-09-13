import uuid
from typing import List, Optional
from sqlalchemy.orm import Session

from backend.app.core.security import validate_dataset_id
from backend.app.models.report import ReportModel
from backend.app.schemas.report import ReportResponse, ReportSection
from backend.app.services.dataset_service import DatasetService
from backend.app.tools.analytical_tools import (
    calculate_kpis,
    detect_anomalies,
    detect_trends,
    summarize_grouped_metrics,
)

class ReportService:
    def __init__(self, db: Session):
        self.db = db
        self.dataset_service = DatasetService(db)

    def generate_report(
        self,
        dataset_id: str,
        title: Optional[str] = None,
        focus_areas: Optional[List[str]] = None,
    ) -> ReportResponse:
        clean_id = validate_dataset_id(dataset_id)
        metadata = self.dataset_service.get_dataset_metadata(clean_id)
        df = self.dataset_service.load_dataframe(clean_id)

        report_title = title or f"Executive Intelligence Report: {metadata.filename}"
        sections: List[ReportSection] = []

        # 1. Dataset Overview & Data Quality Section
        quality = metadata.quality_summary
        overview_text = (
            f"Analysis of dataset '{metadata.filename}' comprising {metadata.row_count} records and "
            f"{metadata.column_count} attributes. Overall data health score is {quality.quality_score}/100 "
            f"with {quality.missing_cells_percentage}% missing values and {quality.duplicate_rows_count} duplicate records."
        )
        sections.append(
            ReportSection(
                title="1. Executive Summary & Data Hygiene",
                content=overview_text,
                kpis={
                    "total_records": metadata.row_count,
                    "total_attributes": metadata.column_count,
                    "quality_score": quality.quality_score,
                },
            )
        )

        # 2. Key Performance Indicators Section
        try:
            kpi_data = calculate_kpis(df)
            kpi_lines = []
            for metric, stats in kpi_data.get("kpis", {}).items():
                kpi_lines.append(f"- **{metric}**: Total = {stats['sum']:,}, Avg = {stats['mean']:,}, Max = {stats['max']:,}")
            kpi_summary = "\n".join(kpi_lines) if kpi_lines else "No numeric KPI columns available."
            sections.append(
                ReportSection(
                    title="2. Key Financial & Operational Indicators",
                    content=f"Summary of primary numerical metrics:\n{kpi_summary}",
                    kpis=kpi_data.get("kpis"),
                )
            )
        except Exception:
            pass

        # 3. Categorical Breakdown Section
        cat_cols = [c.name for c in metadata.schema_fields if c.inferred_type in ("categorical", "text")]
        num_cols = [c.name for c in metadata.schema_fields if c.inferred_type == "numeric"]
        if cat_cols and num_cols:
            try:
                group_res = summarize_grouped_metrics(df, [cat_cols[0]], [num_cols[0]])
                data = group_res.get("data", [])
                top_item = data[0] if data else {}
                sections.append(
                    ReportSection(
                        title=f"3. Segment Performance ({cat_cols[0]})",
                        content=(
                            f"Performance breakdown across {len(data)} distinct segments in '{cat_cols[0]}'. "
                            f"Leading segment is '{top_item.get(cat_cols[0])}' with {num_cols[0]} of {top_item.get(num_cols[0], 0):,}."
                        ),
                        chart_spec={
                            "chart_type": "bar",
                            "title": f"{num_cols[0]} by {cat_cols[0]}",
                            "x_axis": cat_cols[0],
                            "y_axis": num_cols[0],
                            "series": [num_cols[0]],
                            "data": data[:10],
                        },
                    )
                )
            except Exception:
                pass

        # 4. Outlier & Risk Detection Section
        if num_cols:
            try:
                anomaly_res = detect_anomalies(df, [num_cols[0]])
                count = anomaly_res.get("anomalies_count", 0)
                sections.append(
                    ReportSection(
                        title="4. Risk & Outlier Assessment",
                        content=(
                            f"Statistical outlier scan flagged {count} anomalous records in metric '{num_cols[0]}'. "
                            "These records deviate significantly from expected normal variance and warrant closer auditing."
                            if count > 0 else
                            f"No significant statistical anomalies detected in '{num_cols[0]}'. Distribution remains stable."
                        ),
                        kpis={"anomalies_detected": count},
                    )
                )
            except Exception:
                pass

        report_id = str(uuid.uuid4())
        summary_text = (
            f"Autonomous executive summary synthesized across {len(sections)} key business dimensions. "
            f"Data health verified at {quality.quality_score}%."
        )

        record = ReportModel(
            report_id=report_id,
            dataset_id=clean_id,
            title=report_title,
            summary=summary_text,
            sections=[s.model_dump() for s in sections],
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)

        return ReportResponse(
            report_id=record.report_id,
            dataset_id=record.dataset_id,
            title=record.title,
            summary=record.summary,
            sections=[ReportSection(**s) for s in record.sections],
            created_at=record.created_at,
        )

    def get_report(self, report_id: str) -> Optional[ReportResponse]:
        record = self.db.query(ReportModel).filter(ReportModel.report_id == report_id).first()
        if not record:
            return None
        return ReportResponse(
            report_id=record.report_id,
            dataset_id=record.dataset_id,
            title=record.title,
            summary=record.summary,
            sections=[ReportSection(**s) for s in record.sections],
            created_at=record.created_at,
        )
