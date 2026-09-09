import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(BACKEND_DIR / "samples"))
sys.path.insert(0, str(ROOT_DIR / "samples"))

from sqlalchemy.pool import StaticPool
import app.core.database as db_mod

test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Patch runtime singletons to use isolated test DB
db_mod.engine = test_engine
db_mod.SessionLocal = TestSessionLocal

from app.core.database import Base
from app.main import app
from app.services.store import DepotPostgres
from app.services.samples_bootstrap import amorcer


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    depot_inst = DepotPostgres(TestSessionLocal)
    amorcer(depot_inst)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def depot():
    return DepotPostgres(TestSessionLocal)

