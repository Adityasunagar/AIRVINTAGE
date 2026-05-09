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
        print("Checking if NO2, CO, SO2, O3 columns exist in environmental_data table...")
        
        # Add columns one by one, ignoring errors if they already exist
        columns = ["no2", "co", "so2", "o3"]
        for col in columns:
            try:
                conn.execute(text(f"ALTER TABLE environmental_data ADD COLUMN {col} FLOAT;"))
                print(f"[OK] Added {col} column successfully.")
            except Exception as e:
                # Column likely already exists
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    print(f"[INFO] Column {col} already exists, skipping.")
                else:
                    print(f"[ERROR] Error adding {col}: {e}")
                    
    print("Database migration complete!")
except Exception as e:
    print(f"Fatal error connecting to DB: {e}")
