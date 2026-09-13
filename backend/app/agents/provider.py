import json
import logging
import time
from typing import Any, Dict, List, Optional, Type, TypeVar
import httpx
from pydantic import BaseModel, ValidationError as PydanticValidationError

from backend.app.core.config import settings
from backend.app.core.errors import LLMProviderError
from backend.app.core.security import mask_secrets

logger = logging.getLogger("abi.provider")
T = TypeVar("T", bound=BaseModel)

class LLMProviderAdapter:
    """
    OpenAI-compatible server-side LLM provider adapter.
    Handles configurable model, timeout, bounded retries, structured output validation,
    visible errors, and safe secret masking in logs.
    """
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        max_retries: Optional[int] = None,
        mock_fallback: Optional[bool] = None,
    ):
        self.api_key = (api_key if api_key is not None else settings.LLM_API_KEY).strip()
        self.base_url = (base_url if base_url is not None else settings.LLM_BASE_URL).rstrip("/")
        self.model = model or settings.LLM_MODEL
        self.timeout_seconds = timeout_seconds if timeout_seconds is not None else settings.LLM_TIMEOUT_SECONDS
        self.max_retries = max_retries if max_retries is not None else settings.LLM_MAX_RETRIES
        self.mock_fallback = mock_fallback if mock_fallback is not None else settings.LLM_MOCK_FALLBACK

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def generate_completion(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.0,
    ) -> str:
        """Execute a text completion with bounded retries and secret masking."""
        if not self.is_configured:
            if self.mock_fallback:
                return self._mock_completion(prompt, system_prompt)
            raise LLMProviderError("LLM API key not configured and mock fallback is disabled.")

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }

        # Safe logging without secrets
        safe_headers = mask_secrets(headers)
        logger.debug(f"Calling LLM endpoint {url} with model {self.model}, headers={safe_headers}")

        last_error = None
        for attempt in range(self.max_retries + 1):
            try:
                with httpx.Client(timeout=self.timeout_seconds) as client:
                    response = client.post(url, headers=headers, json=payload)
                    if response.status_code == 200:
                        data = response.json()
                        return data["choices"][0]["message"]["content"].strip()
                    else:
                        last_error = f"LLM API returned status {response.status_code}: {response.text}"
                        logger.warning(f"LLM attempt {attempt + 1} failed: {last_error}")
            except httpx.TimeoutException as e:
                last_error = f"LLM request timed out after {self.timeout_seconds}s"
                logger.warning(f"LLM attempt {attempt + 1} timeout: {last_error}")
            except Exception as e:
                last_error = f"LLM connection error: {str(e)}"
                logger.warning(f"LLM attempt {attempt + 1} error: {last_error}")

            if attempt < self.max_retries:
                time.sleep(0.5 * (attempt + 1))

        # If retries exhausted and mock fallback is allowed, fall back
        if self.mock_fallback:
            logger.warning(f"LLM provider failed ({last_error}). Falling back to deterministic fixture.")
            return self._mock_completion(prompt, system_prompt)

        raise LLMProviderError(f"LLM provider failed after {self.max_retries + 1} attempts: {last_error}")

    def generate_structured_output(
        self,
        prompt: str,
        schema_class: Type[T],
        system_prompt: Optional[str] = None,
    ) -> T:
        """Call the provider and parse & validate the result against a Pydantic schema."""
        instructions = (
            f"\nYou must respond ONLY with a valid JSON object adhering strictly to this JSON schema:\n"
            f"{json.dumps(schema_class.model_json_schema())}\n"
            f"Do not include markdown codeblocks or other formatting outside the JSON object."
        )
        full_prompt = prompt + instructions
        raw_text = self.generate_completion(full_prompt, system_prompt=system_prompt)

        # Parse JSON
        clean_text = raw_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.startswith("```"):
            clean_text = clean_text[3:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        clean_text = clean_text.strip()

        try:
            parsed_dict = json.loads(clean_text)
            return schema_class.model_validate(parsed_dict)
        except (json.JSONDecodeError, PydanticValidationError) as e:
            logger.warning(f"Failed to validate LLM structured response against {schema_class.__name__}: {str(e)}")
            # If invalid and mock fallback enabled, provide deterministic schema instance
            if self.mock_fallback:
                return self._mock_structured(prompt, schema_class)
            raise LLMProviderError(f"Failed to validate LLM output against schema {schema_class.__name__}: {str(e)}")

    def _mock_completion(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Deterministic mock responses for test repeatability and offline execution."""
        lower_p = prompt.lower()
        if "sql" in lower_p or "query" in lower_p:
            return "SELECT region, SUM(revenue) as total_revenue FROM dataset GROUP BY region ORDER BY total_revenue DESC LIMIT 10"
        return "Deterministic analytical insight: Analysis completed successfully based on verified computed metrics."

    def _mock_structured(self, prompt: str, schema_class: Type[T]) -> T:
        """Provide fallback structured object matching requested schema."""
        from backend.app.schemas.analysis import AgentPlanOutput
        if schema_class == AgentPlanOutput:
            lower = prompt.lower()
            if "trend" in lower or "over time" in lower:
                return AgentPlanOutput(
                    selected_tool="detect_trends",
                    parameters={"time_column": "date", "metric": "revenue"},
                    rationale="User requested trend analysis over time.",
                    warnings=[],
                )
            elif "anomal" in lower or "outlier" in lower:
                return AgentPlanOutput(
                    selected_tool="detect_anomalies",
                    parameters={"feature_columns": ["revenue", "units_sold"]},
                    rationale="User requested anomaly/outlier detection.",
                    warnings=[],
                )
            elif "kpi" in lower or "metric" in lower or "total" in lower:
                return AgentPlanOutput(
                    selected_tool="calculate_kpis",
                    parameters={"metrics": ["revenue", "units_sold"]},
                    rationale="User requested overall KPI metrics calculation.",
                    warnings=[],
                )
            elif "group" in lower or "by region" in lower or "by category" in lower:
                return AgentPlanOutput(
                    selected_tool="summarize_grouped_metrics",
                    parameters={"dimensions": ["region"], "metrics": ["revenue"]},
                    rationale="User requested grouped dimension aggregation.",
                    warnings=[],
                )
            else:
                return AgentPlanOutput(
                    selected_tool="run_safe_sql",
                    parameters={"sql": "SELECT region, SUM(revenue) as total_revenue FROM dataset GROUP BY region ORDER BY total_revenue DESC LIMIT 10"},
                    rationale="Translating analytical question to safe aggregate SQL.",
                    warnings=[],
                )
        # Generic instantiation
        return schema_class.model_validate({})
