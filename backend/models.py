"""
Canonical Data Models for RUD System
Unified entities across all crypto platform systems
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from dataclasses import dataclass, asdict, field


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ONBOARDING = "onboarding"
    ABANDONED = "abandoned"
    RECOVERED = "recovered"


class SeverityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ActionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    EXECUTED = "executed"
    REJECTED = "rejected"


@dataclass
class UserProfile:
    """Canonical user entity"""
    user_id: str
    email: str
    name: str
    status: UserStatus
    creation_date: datetime
    last_active: datetime
    country: str
    source: str  # acquisition source: ads, affiliate, referral, organic
    high_value_score: float  # 0-100
    
    # Metadata for identity resolution
    external_id: Dict[str, str] = field(default_factory=dict)  # {system: id}
    last_synced_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self):
        data = asdict(self)
        data['status'] = self.status.value
        data['creation_date'] = self.creation_date.isoformat()
        data['last_active'] = self.last_active.isoformat()
        data['last_synced_at'] = self.last_synced_at.isoformat()
        return data


@dataclass
class Wallet:
    """User wallet entity"""
    wallet_id: str
    user_id: str
    blockchain: str  # "ethereum", "bitcoin", etc.
    balance_usd: float
    transaction_count: int
    last_transaction: Optional[datetime]
    created_at: datetime
    
    external_id: Dict[str, str] = field(default_factory=dict)
    last_synced_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self):
        data = asdict(self)
        data['last_transaction'] = self.last_transaction.isoformat() if self.last_transaction else None
        data['created_at'] = self.created_at.isoformat()
        data['last_synced_at'] = self.last_synced_at.isoformat()
        return data


@dataclass
class Campaign:
    """Marketing campaign entity"""
    campaign_id: str
    user_id: str
    campaign_name: str
    channel: str  # "google_ads", "facebook", "affiliate", "email"
    cpa: float  # Cost per acquisition
    created_at: datetime
    
    external_id: Dict[str, str] = field(default_factory=dict)
    last_synced_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self):
        data = asdict(self)
        data['created_at'] = self.created_at.isoformat()
        data['last_synced_at'] = self.last_synced_at.isoformat()
        return data


@dataclass
class Ticket:
    """Support ticket entity"""
    ticket_id: str
    user_id: str
    subject: str
    status: str  # "open", "in_progress", "resolved", "closed"
    priority: str  # "low", "medium", "high"
    created_at: datetime
    last_updated: datetime
    category: str  # "kyc", "wallet", "transaction", "general"
    
    external_id: Dict[str, str] = field(default_factory=dict)
    last_synced_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self):
        data = asdict(self)
        data['created_at'] = self.created_at.isoformat()
        data['last_updated'] = self.last_updated.isoformat()
        data['last_synced_at'] = self.last_synced_at.isoformat()
        return data


@dataclass
class RiskFlag:
    """Risk/Issue detection entity"""
    flag_id: str
    user_id: str
    flag_type: str  # "onboarding_delay", "inactivity", "support_unresolved", "compliance_issue"
    severity: SeverityLevel
    detected_at: datetime
    description: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self):
        data = asdict(self)
        data['severity'] = self.severity.value
        data['detected_at'] = self.detected_at.isoformat()
        return data


@dataclass
class ActionRecommendation:
    """Recommended recovery action"""
    action_id: str
    user_id: str
    risk_flag_id: str
    action_type: str  # "priority_support", "workflow_trigger", "account_flag", "personal_outreach"
    status: ActionStatus
    priority: str  # "low", "medium", "high"
    reason: str
    estimated_recovery_value: float
    created_at: datetime
    executed_at: Optional[datetime] = None
    
    def to_dict(self):
        data = asdict(self)
        data['status'] = self.status.value
        data['created_at'] = self.created_at.isoformat()
        data['executed_at'] = self.executed_at.isoformat() if self.executed_at else None
        return data
