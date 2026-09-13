import time
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.app.agents.planner import AgentPlanner
from backend.app.agents.provider import LLMProviderAdapter
from backend.app.agents.tool_router import ToolRouter
from backend.app.agents.validator import ResultValidator
from backend.app.core.errors import APIError, SecurityError, ValidationError
from backend.app.core.security import validate_dataset_id, validate_query_text_length
from backend.app.schemas.analysis import AgentQueryResponse
from backend.app.services.dataset_service import DatasetService
from backend.app.services.history_service import HistoryService

class QueryService:
    """Orchestrates autonomous query lifecycle: plan -> tool -> retry -> validate -> insight -> chart."""

    def __init__(self, db: Session, provider: Optional[LLMProviderAdapter] = None):
        self.db = db
        self.provider = provider or LLMProviderAdapter()
        self.dataset_service = DatasetService(db)
        self.history_service = HistoryService(db)
        self.planner = AgentPlanner(provider=self.provider)
        self.tool_router = ToolRouter()

    def process_query(
        self,
        dataset_id: str,
        question: str,
        context: Optional[Dict[str, Any]] = None,
        max_retries: int = 2,
    ) -> AgentQueryResponse:
        start_time = time.time()
        
        # 1. Validation & sanitization
        clean_dataset_id = validate_dataset_id(dataset_id)
        clean_question = validate_query_text_length(question)

        # 2. Load dataset metadata and pandas dataframe
        metadata = self.dataset_service.get_dataset_metadata(clean_dataset_id)
        df = self.dataset_service.load_dataframe(clean_dataset_id)

        # 3. Agent Planning
        plan = self.planner.create_plan(
            question=clean_question,
            columns=metadata.schema_fields,
            permitted_tools=self.tool_router.permitted_tools,
        )

        # 4. Tool Execution with Bounded Repair & Retry
        tool_name = plan.selected_tool
        parameters = plan.parameters
        execution_warnings = list(plan.warnings)
        last_error = None
        tool_result = None

        for attempt in range(max_retries + 1):
            try:
                tool_result = self.tool_router.execute_tool(
                    tool_name=tool_name,
                    df=df,
                    parameters=parameters,
                )
                break
            except (SecurityError, ValidationError) as err:
                last_error = str(err)
                execution_warnings.append(f"Tool execution attempt {attempt + 1} rejected: {last_error}")
                if attempt < max_retries:
                    # Bounded repair: fall back to safe SQL or alternative parameters
                    if tool_name != "run_safe_sql":
                        tool_name = "run_safe_sql"
                        sql, rep_warnings = self.planner.sql_generator.generate_sql(clean_question, metadata.schema_fields)
                        parameters = {"sql": sql}
                        execution_warnings.extend(rep_warnings)
                    else:
                        break
                else:
                    break
            except Exception as err:
                last_error = str(err)
                execution_warnings.append(f"Tool execution attempt {attempt + 1} failed: {last_error}")
                if attempt >= max_retries:
                    break

        total_latency_ms = round((time.time() - start_time) * 1000.0, 2)

        # 5. Handle failure if all retries exhausted
        if tool_result is None or tool_result.get("status") != "success":
            failed_id = str(uuid.uuid4())
            reason = f"Execution failed after bounded retries: {last_error or 'Unknown error'}"
            self.history_service.record_analysis(
                dataset_id=clean_dataset_id,
                question=clean_question,
                tool=tool_name,
                status="failed",
                reason=reason,
                latency_ms=total_latency_ms,
                chart_spec={},
                insights=[],
                warnings=execution_warnings,
            )
            return AgentQueryResponse(
                status="failed",
                tool=tool_name,
                reason=reason,
                result_id=failed_id,
                chart_spec={},
                insights=[],
                warnings=execution_warnings,
                latency_ms=total_latency_ms,
            )

        # 6. Result Validation, Insight Extraction & Declarative Chart Generation
        raw_payload = tool_result.get("payload", {})
        chart_spec, insights, val_warnings, preview_data = ResultValidator.validate_and_format(
            tool=tool_name,
            question=clean_question,
            payload=raw_payload,
            columns=metadata.schema_fields,
        )
        all_warnings = execution_warnings + val_warnings

        # 7. Persist to Analysis History (never persist hidden chain of thought)
        history_record = self.history_service.record_analysis(
            dataset_id=clean_dataset_id,
            question=clean_question,
            tool=tool_name,
            status="success",
            reason=plan.rationale or f"Executed tool '{tool_name}' successfully.",
            latency_ms=total_latency_ms,
            chart_spec=chart_spec,
            insights=insights,
            warnings=all_warnings,
            result_data=preview_data,
        )

        return AgentQueryResponse(
            status="success",
            tool=tool_name,
            reason=plan.rationale or f"Executed tool '{tool_name}' successfully.",
            result_id=history_record.result_id,
            chart_spec=chart_spec,
            insights=insights,
            warnings=all_warnings,
            latency_ms=total_latency_ms,
            data_preview=preview_data,
        )
