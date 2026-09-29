from typing import Generator
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="session")
def client() -> Generator[TestClient, None, None]:
    """
    Reusable FastAPI test client fixture.
    Runs with lifespan context management enabled.
    """
    with TestClient(app) as test_client:
        yield test_client
