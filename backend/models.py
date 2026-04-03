"""
SQLAlchemy ORM Models for the High-Value User Recovery Engine.
Canonical data model representing entities from multiple crypto platform systems.
"""

from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class UserProfile(Base):
    """Core user profile aggregated from multiple sources."""
    __tablename__ = "user_profiles"
    
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    acquisition_source = Column(String)  # twitter, discord, affiliate, paid_ads, organic
    lifecycle_stage = Column(String)  # onboarding, active, inactive, churned, high_value
    estimated_ltv = Column(Float, default=0.0)
    first_seen_at = Column(DateTime, default=datetime.utcnow)
    last_activity_at = Column(DateTime)
    country = Column(String)
    
    # Multi-system tracking
    source_system = Column(String, default="demo_platform")
    external_id = Column(String)
    last_synced_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    wallet = relationship("Wallet", uselist=False, back_populates="user", cascade="all, delete-orphan")
    risk_flags = relationship("RiskFlag", back_populates="user", cascade="all, delete-orphan")
    support_tickets = relationship("SupportTicket", back_populates="user", cascade="all, delete-orphan")
    recovery_actions = relationship("RecoveryAction", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<UserProfile(id={self.id}, stage={self.lifecycle_stage}, ltv={self.estimated_ltv})>"


class Wallet(Base):
    """Wallet activity and balance data."""
    __tablename__ = "wallets"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("user_profiles.id"), nullable=False)
    blockchain = Column(String, default="ethereum")
    balance_usd = Column(Float, default=0.0)
    wallet_age_days = Column(Integer, default=0)
    transaction_count = Column(Integer, default=0)
    activity_score = Column(Float, default=0.0)  # 0-100
    last_activity_at = Column(DateTime)
    
    # Multi-system tracking
    source_system = Column(String, default="demo_blockchain")
    external_id = Column(String)
    last_synced_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("UserProfile", back_populates="wallet")
    
    def __repr__(self):
        return f"<Wallet(user_id={self.user_id}, balance={self.balance_usd})>"


class RiskFlag(Base):
    """Risk indicators for each user."""
    __tablename__ = "risk_flags"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("user_profiles.id"), nullable=False)
    flag_type = Column(String)  # onboarding_incomplete, inactivity, support_unresolved, compliance_issue, low_activity, unusual_behavior
    severity = Column(String)  # critical, high, medium, low
    description = Column(Text)
    detected_at = Column(DateTime, default=datetime.utcnow)
    days_since_detection = Column(Integer, default=0)
    
    # Multi-system tracking
    source_system = Column(String, default="demo_orchestrator")
    external_id = Column(String)
    last_synced_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("UserProfile", back_populates="risk_flags")
    
    def __repr__(self):
        return f"<RiskFlag(user_id={self.user_id}, type={self.flag_type}, severity={self.severity})>"


class SupportTicket(Base):
    """Support issues and their resolution status."""
    __tablename__ = "support_tickets"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("user_profiles.id"), nullable=False)
    subject = Column(String)
    status = Column(String)  # open, pending, resolved, escalated
    priority = Column(String)  # critical, high, medium, low
    category = Column(String)  # kyc_delay, withdrawal_issue, login_problem, transaction_error, compliance
    created_at = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow)
    unresolved_days = Column(Integer, default=0)
    
    # Multi-system tracking
    source_system = Column(String, default="demo_support")
    external_id = Column(String)
    last_synced_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("UserProfile", back_populates="support_tickets")
    
    def __repr__(self):
        return f"<SupportTicket(id={self.id}, user_id={self.user_id}, status={self.status})>"


class RecoveryAction(Base):
    """Actions taken or planned for recovery."""
    __tablename__ = "recovery_actions"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("user_profiles.id"), nullable=False)
    action_type = Column(String)  # email_outreach, priority_support, workflow_trigger, account_review, incentive_offer
    status = Column(String)  # pending, approved, executed, failed
    priority = Column(String)  # critical, high, medium, low
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    executed_at = Column(DateTime, nullable=True)
    estimated_recovery_value = Column(Float, default=0.0)
    
    # Multi-system tracking
    source_system = Column(String, default="demo_orchestrator")
    external_id = Column(String)
    last_synced_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("UserProfile", back_populates="recovery_actions")
    
    def __repr__(self):
        return f"<RecoveryAction(id={self.id}, action_type={self.action_type}, status={self.status})>"


class Campaign(Base):
    """Marketing campaigns and their performance metrics."""
    __tablename__ = "campaigns"
    
    id = Column(String, primary_key=True)
    campaign_name = Column(String)
    channel = Column(String)  # twitter, discord, affiliate, paid_ads, content, organic
    spend_usd = Column(Float, default=0.0)
    conversions = Column(Integer, default=0)
    revenue_usd = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Calculated fields
    cpa = Column(Float, default=0.0)  # Cost per acquisition
    roi = Column(Float, default=0.0)  # Return on investment
    
    # Multi-system tracking
    source_system = Column(String, default="demo_marketing")
    external_id = Column(String)
    last_synced_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<Campaign(id={self.id}, channel={self.channel}, cpa={self.cpa})>"


class ActionExecutionLog(Base):
    """Simulated external actions triggered from chat or dashboard (demo audit trail)."""

    __tablename__ = "action_execution_log"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True)  # optional FK target; no DB constraint for flexible demo logs
    action_type = Column(String, nullable=False)
    source = Column(String, default="chat_simulate")  # chat_simulate, dashboard
    request_summary = Column(Text)
    payload_json = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
