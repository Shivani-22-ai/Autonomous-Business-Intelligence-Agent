import io
import pytest

def test_upload_dataset_success(client, sample_csv_bytes):
    response = client.post(
        "/api/datasets/upload",
        files={"file": ("sales_data.csv", sample_csv_bytes, "text/csv")},
    )
    assert response.status_code == 201
    data = response.json()
    assert "dataset" in data
    dataset = data["dataset"]
    assert dataset["filename"] == "sales_data.csv"
    assert dataset["file_type"] == "csv"
    assert dataset["row_count"] == 8
    assert dataset["column_count"] == 6
    assert len(dataset["schema"]) == 6
    
    # Verify no filesystem paths are leaked in the response
    assert "file_path" not in dataset
    
    # Check schema inferred types
    schema_map = {c["name"]: c for c in dataset["schema"]}
    assert "revenue" in schema_map
    assert schema_map["revenue"]["inferred_type"] == "numeric"
    assert "region" in schema_map
    assert schema_map["region"]["inferred_type"] == "categorical"
    assert "date" in schema_map
    assert schema_map["date"]["inferred_type"] == "datetime"

def test_get_dataset_profile(client, sample_csv_bytes):
    upload_res = client.post(
        "/api/datasets/upload",
        files={"file": ("profile_test.csv", sample_csv_bytes, "text/csv")},
    )
    dataset_id = upload_res.json()["dataset"]["dataset_id"]

    res = client.get(f"/api/datasets/{dataset_id}/profile")
    assert res.status_code == 200
    meta = res.json()
    assert meta["dataset_id"] == dataset_id
    assert meta["row_count"] == 8
    assert meta["quality_summary"]["quality_score"] > 90

def test_list_datasets(client, sample_csv_bytes):
    client.post(
        "/api/datasets/upload",
        files={"file": ("list_test.csv", sample_csv_bytes, "text/csv")},
    )
    res = client.get("/api/datasets")
    assert res.status_code == 200
    data = res.json()
    assert "datasets" in data
    assert data["total"] >= 1

def test_upload_invalid_extension(client):
    res = client.post(
        "/api/datasets/upload",
        files={"file": ("malicious.exe", b"binary content", "application/octet-stream")},
    )
    assert res.status_code == 400
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == "BAD_REQUEST"
    assert "Invalid file extension" in data["error"]["message"]

def test_get_dataset_not_found(client):
    fake_uuid = "00000000-0000-4000-8000-000000000000"
    res = client.get(f"/api/datasets/{fake_uuid}/profile")
    assert res.status_code == 404
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == "NOT_FOUND"

def test_get_dataset_invalid_uuid(client):
    res = client.get("/api/datasets/invalid-id-format/profile")
    assert res.status_code in (400, 422)
    data = res.json()
    assert "error" in data
