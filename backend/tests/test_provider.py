import pytest
from backend.app.agents.provider import LLMProviderAdapter
from backend.app.core.security import mask_secrets
from backend.app.schemas.analysis import AgentPlanOutput

def test_provider_initialization():
    adapter = LLMProviderAdapter(
        api_key="sk-test-secret-key-12345",
        model="gpt-4o-mini",
        timeout_seconds=10.0,
        max_retries=1,
    )
    assert adapter.model == "gpt-4o-mini"
    assert adapter.timeout_seconds == 10.0
    assert adapter.max_retries == 1
    assert adapter.is_configured is True

def test_secret_masking():
    headers = {
        "Authorization": "Bearer sk-proj-supersecretkey9999",
        "Content-Type": "application/json",
        "nested": {"api_key": "secret12345", "public_id": "12345"},
    }
    masked = mask_secrets(headers)
    assert "supersecretkey" not in str(masked)
    assert masked["Authorization"].startswith("Bea...")
    assert "secret12345" not in str(masked)
    assert masked["nested"]["public_id"] == "12345"

def test_provider_deterministic_mock_completion():
    adapter = LLMProviderAdapter(api_key="", mock_fallback=True)
    assert adapter.is_configured is False
    completion = adapter.generate_completion("Show me SQL query for revenue")
    assert "SELECT" in completion
    assert "FROM dataset" in completion

def test_provider_structured_output():
    adapter = LLMProviderAdapter(api_key="", mock_fallback=True)
    plan = adapter.generate_structured_output(
        prompt="What is the revenue trend over time?",
        schema_class=AgentPlanOutput,
    )
    assert isinstance(plan, AgentPlanOutput)
    assert plan.selected_tool == "detect_trends"
    assert "date" in plan.parameters.values() or "revenue" in plan.parameters.values()
    assert plan.rationale != ""
