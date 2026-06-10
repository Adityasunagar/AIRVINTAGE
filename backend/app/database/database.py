import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./airvintage.db"

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 30}

try:
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception as e:
    print(f"Database connection error: {e}")
    # Provide a fallback mock engine so the app doesn't immediately crash if DB is not active yet
    engine = None
    SessionLocal = None

Base = declarative_base()

def get_db():
    if not SessionLocal:
        yield None
        return
        
    db = SessionLocal()
    try:
        yield db
    finally:
        if db:
            db.close()

