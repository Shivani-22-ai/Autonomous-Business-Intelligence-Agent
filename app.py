import io
import time
from pathlib import Path
import pandas as pd
import streamlit as st

# Configure page
st.set_page_config(
    page_title="Autonomous BI Agent",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Backend imports
from backend.app.core.config import settings
from backend.app.db.session import SessionLocal, init_db
from backend.app.services.dataset_service import DatasetService
from backend.app.services.history_service import HistoryService
from backend.app.services.query_service import QueryService
from backend.app.services.report_service import ReportService
from backend.app.tools.analytical_tools import (
    calculate_kpis,
    detect_anomalies,
    detect_trends,
    summarize_grouped_metrics,
)

# Initialize DB
init_db()

def get_db_session():
    return SessionLocal()

# Custom CSS for modern design aesthetics
st.markdown("""
<style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 700;
        background: linear-gradient(135deg, #2563eb, #7c3aed);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.5rem;
    }
    .sub-header {
        color: #64748b;
        font-size: 1.05rem;
        margin-bottom: 1.5rem;
    }
    .metric-card {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 1rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .insight-box {
        background-color: #eff6ff;
        border-left: 4px solid #3b82f6;
        padding: 0.75rem 1rem;
        border-radius: 0.25rem;
        margin-bottom: 0.5rem;
    }
</style>
""", unsafe_allow_html=True)

# Sidebar Navigation
st.sidebar.title("⚡ Autonomous BI")
st.sidebar.caption("Enterprise AI Analytics & Safe SQL")
menu = st.sidebar.radio(
    "Navigation",
    ["📊 Dashboard", "📁 Upload & Profile", "🤖 AI Agent Query", "📈 Trend & Anomaly Explorer", "📑 Executive Report", "📜 Audit History"]
)

db = get_db_session()
dataset_service = DatasetService(db)
query_service = QueryService(db)
history_service = HistoryService(db)
report_service = ReportService(db)

datasets = dataset_service.list_datasets()

# Initialize active dataset
if "active_dataset_id" not in st.session_state and datasets:
    st.session_state["active_dataset_id"] = datasets[0].dataset_id

# Dataset selector in sidebar if datasets exist
active_dataset = None
if datasets:
    ds_options = {d.dataset_id: f"{d.filename} ({d.row_count} rows)" for d in datasets}
    selected_id = st.sidebar.selectbox(
        "Active Dataset",
        options=list(ds_options.keys()),
        format_func=lambda x: ds_options[x],
        index=0 if st.session_state.get("active_dataset_id") not in ds_options else list(ds_options.keys()).index(st.session_state["active_dataset_id"])
    )
    st.session_state["active_dataset_id"] = selected_id
    active_dataset = dataset_service.get_dataset_metadata(selected_id)
else:
    st.sidebar.info("No datasets loaded yet. Go to 'Upload & Profile' or load sample fixture.")

# -------------------------------------------------------------
# 1. DASHBOARD
# -------------------------------------------------------------
if menu == "📊 Dashboard":
    st.markdown('<div class="main-header">Executive BI Dashboard</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Real-time computed business intelligence & autonomous agent overview</div>', unsafe_allow_html=True)

    if not active_dataset:
        st.warning("Please upload a dataset or load the demo fixture from the 'Upload & Profile' page.")
        if st.button("Load Pre-seeded Business Fixture Data"):
            fixture_path = settings.DATA_DIR / "fixtures" / "synthetic_business_data.csv"
            if not fixture_path.exists():
                fixture_path = settings.DATA_DIR / "fixtures" / "sample_business_sales.csv"
            if fixture_path.exists():
                new_ds = dataset_service.register_existing_file(fixture_path, "synthetic_business_data.csv")
                st.session_state["active_dataset_id"] = new_ds.dataset_id
                st.success(f"Loaded {new_ds.filename} successfully!")
                st.rerun()
    else:
        df = dataset_service.load_dataframe(active_dataset.dataset_id)
        
        # KPI Row
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Dataset Rows", f"{active_dataset.row_count:,}")
        col2.metric("Attributes", f"{active_dataset.column_count}")
        quality = active_dataset.quality_summary
        col3.metric("Data Health Score", f"{quality.quality_score}/100")
        col4.metric("Missing Cells", f"{quality.missing_cells_percentage}%")

        st.markdown("---")
        
        # Primary visual breakdown
        cat_cols = [c.name for c in active_dataset.schema_fields if c.inferred_type in ("categorical", "text")]
        num_cols = [c.name for c in active_dataset.schema_fields if c.inferred_type == "numeric"]

        if cat_cols and num_cols:
            st.subheader(f"Top Performance: {num_cols[0]} by {cat_cols[0]}")
            grouped_data = df.groupby(cat_cols[0])[num_cols[0]].sum().reset_index()
            st.bar_chart(grouped_data, x=cat_cols[0], y=num_cols[0], use_container_width=True)

        st.subheader("Data Preview")
        st.dataframe(df.head(10), use_container_width=True)

# -------------------------------------------------------------
# 2. UPLOAD & PROFILE
# -------------------------------------------------------------
elif menu == "📁 Upload & Profile":
    st.markdown('<div class="main-header">Dataset Ingestion & Schema Profiler</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Upload business CSV or XLSX datasets for automated schema inference and quality scoring.</div>', unsafe_allow_html=True)

    uploaded_file = st.file_uploader("Upload CSV or Excel file", type=["csv", "xlsx", "xls", "json"])
    if uploaded_file is not None:
        if st.button("Ingest & Profile Dataset", type="primary"):
            with st.spinner("Profiling dataset schema and calculating quality metrics..."):
                content = uploaded_file.getvalue()
                metadata = dataset_service.save_and_profile_file(uploaded_file.name, content)
                st.session_state["active_dataset_id"] = metadata.dataset_id
                st.success(f"Successfully ingested and profiled '{metadata.filename}' ({metadata.row_count} rows)!")
                st.rerun()

    st.markdown("---")
    st.subheader("Or Load Synthetic Business Fixture")
    if st.button("Load Pre-seeded Business Sales Demo (500 records)"):
        fixture_path = settings.DATA_DIR / "fixtures" / "synthetic_business_data.csv"
        if fixture_path.exists():
            new_ds = dataset_service.register_existing_file(fixture_path, "synthetic_business_data.csv")
            st.session_state["active_dataset_id"] = new_ds.dataset_id
            st.success("Sample business dataset loaded!")
            st.rerun()

    if active_dataset:
        st.markdown("---")
        st.subheader(f"Profile: {active_dataset.filename}")
        cols_df = pd.DataFrame([
            {
                "Column": col.name,
                "Type": col.inferred_type,
                "Nullable": col.nullable,
                "Unique Values": col.unique_count,
                "Sample Values": str(col.sample_values)
            }
            for col in active_dataset.schema_fields
        ])
        st.dataframe(cols_df, use_container_width=True)

# -------------------------------------------------------------
# 3. AI AGENT QUERY
# -------------------------------------------------------------
elif menu == "🤖 AI Agent Query":
    st.markdown('<div class="main-header">Autonomous AI Agent Query</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Ask natural language business questions. The agent plans, generates safe analytical SQL, and validates insights.</div>', unsafe_allow_html=True)

    if not active_dataset:
        st.warning("Please upload a dataset first.")
    else:
        sample_questions = [
            "What is the revenue trend over time?",
            "Show me revenue breakdown by region",
            "What is the total and average revenue?",
            "Are there any outliers or anomalies in revenue?",
        ]
        st.caption("Quick suggestions:")
        cols = st.columns(len(sample_questions))
        selected_q = None
        for i, sq in enumerate(sample_questions):
            if cols[i].button(sq, key=f"q_btn_{i}"):
                selected_q = sq

        question = st.text_input("Ask a business question about your data:", value=selected_q or "", placeholder="e.g. Which region generated the highest revenue?")

        if st.button("Run Autonomous Analysis", type="primary") and question.strip():
            with st.spinner("Agent planning tool call, validating SQL, and executing..."):
                res = query_service.process_query(active_dataset.dataset_id, question)
                
                if res.status == "success":
                    st.success(f"**Agent Decision**: Selected tool `{res.tool}` ({res.latency_ms}ms)")
                    st.markdown(f"**Rationale**: *{res.reason}*")
                    
                    st.subheader("Key Verified Insights")
                    for ins in res.insights:
                        st.markdown(f'<div class="insight-box">💡 {ins}</div>', unsafe_allow_html=True)

                    if res.chart_spec and res.chart_spec.get("data"):
                        st.subheader(res.chart_spec.get("title", "Visual Analytics"))
                        cdata = pd.DataFrame(res.chart_spec["data"])
                        ctype = res.chart_spec.get("chart_type", "bar")
                        
                        if ctype == "line" and res.chart_spec.get("x_axis"):
                            st.line_chart(cdata, x=res.chart_spec["x_axis"], y=res.chart_spec.get("y_axis"))
                        elif ctype in ("bar", "pie") and res.chart_spec.get("x_axis"):
                            st.bar_chart(cdata, x=res.chart_spec["x_axis"], y=res.chart_spec.get("y_axis"))
                        elif ctype == "metric_card":
                            st.dataframe(cdata, use_container_width=True)
                        else:
                            st.dataframe(cdata, use_container_width=True)
                    
                    if res.data_preview:
                        with st.expander("View Data Records"):
                            st.dataframe(pd.DataFrame(res.data_preview), use_container_width=True)
                else:
                    st.error(f"Analysis failed: {res.reason}")

# -------------------------------------------------------------
# 4. TREND & ANOMALY EXPLORER
# -------------------------------------------------------------
elif menu == "📈 Trend & Anomaly Explorer":
    st.markdown('<div class="main-header">Trend & Anomaly Explorer</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Deterministic time-series analysis and machine learning outlier detection</div>', unsafe_allow_html=True)

    if not active_dataset:
        st.warning("Please upload a dataset first.")
    else:
        df = dataset_service.load_dataframe(active_dataset.dataset_id)
        tab1, tab2 = st.tabs(["📈 Chronological Trends", "🚨 Outlier / Anomaly Detection"])
        
        with tab1:
            date_cols = [c.name for c in active_dataset.schema_fields if c.inferred_type == "datetime" or "date" in c.name.lower()]
            num_cols = [c.name for c in active_dataset.schema_fields if c.inferred_type == "numeric"]
            
            if date_cols and num_cols:
                tc = st.selectbox("Date Column", date_cols)
                mc = st.selectbox("Metric Column", num_cols)
                if st.button("Compute Trend"):
                    trend_res = detect_trends(df, tc, mc)
                    st.metric("Overall Direction", trend_res["trend_direction"].capitalize(), delta=f"{trend_res['growth_rate_pct']}%")
                    tdf = pd.DataFrame(trend_res["data"])
                    st.line_chart(tdf, x="date", y=mc)
            else:
                st.info("Dataset must contain at least one date and one numeric column.")

        with tab2:
            num_cols = [c.name for c in active_dataset.schema_fields if c.inferred_type == "numeric"]
            if num_cols:
                selected_features = st.multiselect("Select Numeric Features for ML Outlier Analysis", num_cols, default=num_cols[:2])
                contam = st.slider("Outlier Contamination Rate", 0.01, 0.20, 0.05, 0.01)
                if st.button("Run Isolation Forest Anomaly Detection"):
                    with st.spinner("Fitting IsolationForest model..."):
                        anom_res = detect_anomalies(df, selected_features, contamination=contam)
                        st.metric("Outliers Flagged", anom_res["anomalies_count"])
                        if anom_res["anomalies"]:
                            st.dataframe(pd.DataFrame(anom_res["anomalies"]), use_container_width=True)
                        else:
                            st.success("No anomalies detected at this threshold.")
            else:
                st.info("No numeric columns available.")

# -------------------------------------------------------------
# 5. EXECUTIVE REPORT
# -------------------------------------------------------------
elif menu == "📑 Executive Report":
    st.markdown('<div class="main-header">Executive Intelligence Report</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Automated multi-section executive briefing synthesizing business dimensions</div>', unsafe_allow_html=True)

    if not active_dataset:
        st.warning("Please upload a dataset first.")
    else:
        rep_title = st.text_input("Report Title", value=f"Executive Briefing: {active_dataset.filename}")
        if st.button("Generate Full Executive Report", type="primary"):
            with st.spinner("Synthesizing multi-section executive report..."):
                rep = report_service.generate_report(active_dataset.dataset_id, title=rep_title)
                st.success(f"Generated report '{rep.title}'!")

                st.markdown(f"### {rep.title}")
                st.markdown(f"*{rep.summary}*")
                st.markdown("---")

                markdown_download = f"# {rep.title}\n\n_{rep.summary}_\n\n"
                for sec in rep.sections:
                    st.subheader(sec.title)
                    st.markdown(sec.content)
                    markdown_download += f"## {sec.title}\n\n{sec.content}\n\n"
                    if sec.kpis:
                        st.json(sec.kpis)
                    if sec.chart_spec and sec.chart_spec.get("data"):
                        cdata = pd.DataFrame(sec.chart_spec["data"])
                        st.bar_chart(cdata, x=sec.chart_spec.get("x_axis"), y=sec.chart_spec.get("y_axis"))
                    st.markdown("---")

                st.download_button(
                    label="📥 Download Executive Report (Markdown)",
                    data=markdown_download,
                    file_name="executive_intelligence_report.md",
                    mime="text/markdown"
                )

# -------------------------------------------------------------
# 6. AUDIT HISTORY
# -------------------------------------------------------------
elif menu == "📜 Audit History":
    st.markdown('<div class="main-header">Analysis Audit History</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Auditable log of executed queries, tools, latency, and verified results.</div>', unsafe_allow_html=True)

    history_items = history_service.get_history(limit=50)
    if not history_items:
        st.info("No queries executed yet.")
    else:
        hist_df = pd.DataFrame([
            {
                "Time": item.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "Question": item.question,
                "Tool": item.tool,
                "Status": item.status,
                "Latency (ms)": item.latency_ms,
                "Rationale": item.reason,
            }
            for item in history_items
        ])
        st.dataframe(hist_df, use_container_width=True)
