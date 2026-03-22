from sqlalchemy import Column, Integer, String, Text, TIMESTAMP
from app.db.database import engine
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(String, unique=True)
    thread_id = Column(String)
    sender = Column(String)
    subject = Column(String)
    body = Column(Text)
    timestamp = Column(TIMESTAMP)