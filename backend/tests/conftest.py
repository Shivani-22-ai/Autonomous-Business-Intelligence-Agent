import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.core.config import settings
from backend.app.db.session import Base, get_db
from backend.app.main import app

# Create in-memory SQLite database for testing
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def db_session():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def sample_csv_bytes():
    csv_content = (
        "date,region,product_category,revenue,units_sold,customer_satisfaction\n"
        "2025-01-01,North,Electronics,1200.50,15,4.5\n"
        "2025-01-02,South,Apparel,450.00,20,3.8\n"
        "2025-01-03,East,Home,890.25,12,4.2\n"
        "2025-01-04,West,Electronics,1550.00,18,4.9\n"
        "2025-01-05,North,Home,620.00,8,4.0\n"
        "2025-01-06,South,Electronics,2100.00,25,4.7\n"
        "2025-01-07,East,Apparel,730.00,30,4.1\n"
        "2025-01-08,West,Home,950.00,14,3.9\n"
    )
    return csv_content.encode("utf-8")
