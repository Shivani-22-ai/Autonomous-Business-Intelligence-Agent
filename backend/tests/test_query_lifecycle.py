import pytest

@pytest.fixture
def uploaded_dataset_id(client, sample_csv_bytes):
    res = client.post(
        "/api/datasets/upload",
        files={"file": ("test_sales.csv", sample_csv_bytes, "text/csv")},
    )
    assert res.status_code == 201
    return res.json()["dataset"]["dataset_id"]

def test_query_lifecycle_trend(client, uploaded_dataset_id):
    req = {
        "dataset_id": uploaded_dataset_id,
        "question": "What is the revenue trend over time?",
    }
    res = client.post("/api/analysis/query", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["tool"] == "detect_trends"
    assert "result_id" in data
    assert data["chart_spec"]["chart_type"] == "line"
    assert len(data["insights"]) > 0
    assert data["latency_ms"] >= 0.0

def test_query_lifecycle_grouped_metrics(client, uploaded_dataset_id):
    req = {
        "dataset_id": uploaded_dataset_id,
        "question": "Show me revenue breakdown by region",
    }
    res = client.post("/api/analysis/query", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["tool"] == "summarize_grouped_metrics"
    assert data["chart_spec"]["chart_type"] in ("bar", "pie")
    assert any("region" in insight.lower() for insight in data["insights"])

def test_query_lifecycle_kpis(client, uploaded_dataset_id):
    req = {
        "dataset_id": uploaded_dataset_id,
        "question": "What is the total and average revenue?",
    }
    res = client.post("/api/analysis/query", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["tool"] == "calculate_kpis"
    assert len(data["insights"]) > 0

def test_query_history_persistence(client, uploaded_dataset_id):
    # Run two queries
    client.post("/api/analysis/query", json={"dataset_id": uploaded_dataset_id, "question": "Total revenue"})
    client.post("/api/analysis/query", json={"dataset_id": uploaded_dataset_id, "question": "Trend over time"})

    # Check history endpoint
    res = client.get(f"/api/analysis/history?dataset_id={uploaded_dataset_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 2
    assert len(data["history"]) >= 2
    
    # Check retrieve by result ID
    first_item = data["history"][0]
    result_id = first_item["result_id"]
    single_res = client.get(f"/api/analysis/{result_id}")
    assert single_res.status_code == 200
    assert single_res.json()["result_id"] == result_id

def test_report_generation(client, uploaded_dataset_id):
    req = {
        "dataset_id": uploaded_dataset_id,
        "title": "Quarterly Performance Audit",
    }
    res = client.post("/api/reports/generate", json=req)
    assert res.status_code == 201
    report = res.json()
    assert report["title"] == "Quarterly Performance Audit"
    assert report["dataset_id"] == uploaded_dataset_id
    assert len(report["sections"]) >= 3
    assert "report_id" in report

    # Retrieve report by ID
    get_res = client.get(f"/api/reports/{report['report_id']}")
    assert get_res.status_code == 200
    assert get_res.json()["report_id"] == report["report_id"]
