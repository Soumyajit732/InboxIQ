from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql://soumyajitsaha:saha1234@localhost:5432/inboxiq"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)