from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("No DATABASE_URL found. Cannot run migrations.")
    exit(1)

try:
    engine = create_engine(DATABASE_URL)
    with engine.begin() as conn:
        print("Checking if new columns exist in weather table...")
        
        columns = [
            ("wind_direction", "VARCHAR"),
            ("max_temp", "FLOAT"),
            ("min_temp", "FLOAT"),
            ("is_day", "INTEGER"),
            ("uv_index", "FLOAT")
        ]
        
        for col_name, col_type in columns:
            try:
                conn.execute(text(f"ALTER TABLE weather ADD COLUMN {col_name} {col_type};"))
                print(f"[OK] Added {col_name} column successfully.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    print(f"[INFO] Column {col_name} already exists, skipping.")
                else:
                    print(f"[ERROR] Error adding {col_name}: {e}")
                    
    print("Weather database migration complete!")
except Exception as e:
    print(f"Fatal error connecting to DB: {e}")
