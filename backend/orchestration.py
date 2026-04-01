"""
Orchestration Engine - Core Intelligence
Detects patterns, analyzes risks, and recommends recovery actions
"""
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from models import (
    UserProfile, Wallet, Campaign, Ticket, RiskFlag, ActionRecommendation,
    UserStatus, SeverityLevel, ActionStatus
)
import uuid


class AnalysisEngine:
    """Analyzes user data and detects recovery opportunities"""
    
    def __init__(self, users: List[UserProfile], wallets: List[Wallet], 
                 campaigns: List[Campaign], tickets: List[Ticket]):
        self.users = users
        self.wallets = wallets
        self.campaigns = campaigns
        self.tickets = tickets
        self.user_map = {u.user_id: u for u in users}
        self.wallet_map = {w.user_id: w for w in wallets}
        self.campaign_map = {c.user_id: c for c in campaigns}
        self.ticket_map = {t.user_id: [] for t in tickets}
        for t in tickets:
            self.ticket_map[t.user_id].append(t)
    
    def detect_onboarding_dropout(self) -> List[RiskFlag]:
        """Detect users stuck in onboarding (high-value but incomplete KYC)"""
        flags = []
        now = datetime.utcnow()
        one_week_ago = now - timedelta(days=7)
        
        for user in self.users:
            if user.status == UserStatus.ONBOARDING:
                # Check if user has been onboarding for too long
                days_in_onboarding = (now - user.creation_date).days
                
                kyc_tickets = [t for t in self.ticket_map.get(user.user_id, [])
                             if t.category == "kyc" and t.status in ["open", "in_progress"]]
                
                if days_in_onboarding > 7 and kyc_tickets:
                    flags.append(RiskFlag(
                        flag_id=str(uuid.uuid4()),
                        user_id=user.user_id,
                        flag_type="onboarding_delay",
                        severity=SeverityLevel.HIGH if user.high_value_score > 75 else SeverityLevel.MEDIUM,
                        detected_at=now,
                        description=f"User stuck in onboarding for {days_in_onboarding} days. "
                                   f"KYC ticket status: {kyc_tickets[0].status if kyc_tickets else 'None'}",
                        metadata={
                            "days_in_onboarding": days_in_onboarding,
                            "high_value_score": user.high_value_score,
                            "kyc_ticket_count": len(kyc_tickets)
                        }
                    ))
        
        return flags
    
    def detect_inactive_high_value(self) -> List[RiskFlag]:
        """Detect high-value users who became inactive"""
        flags = []
        now = datetime.utcnow()
        thirty_days_ago = now - timedelta(days=30)
        
        for user in self.users:
            if user.status == UserStatus.INACTIVE:
                # High-value but no recent activity
                if user.high_value_score > 70 and user.last_active < thirty_days_ago:
                    days_inactive = (now - user.last_active).days
                    flags.append(RiskFlag(
                        flag_id=str(uuid.uuid4()),
                        user_id=user.user_id,
                        flag_type="inactivity",
                        severity=SeverityLevel.CRITICAL if user.high_value_score > 85 else SeverityLevel.HIGH,
                        detected_at=now,
                        description=f"High-value user inactive for {days_inactive} days. "
                                   f"Last activity: {user.last_active.date()}",
                        metadata={
                            "days_inactive": days_inactive,
                            "high_value_score": user.high_value_score,
                            "acquisition_source": user.source,
                            "original_cpa": self.campaign_map.get(user.user_id, {}).cpa if user.user_id in [c.user_id for c in self.campaigns] else None
                        }
                    ))
        
        return flags
    
    def detect_support_unresolved(self) -> List[RiskFlag]:
        """Detect high-value users with unresolved support tickets"""
        flags = []
        now = datetime.utcnow()
        
        for user in self.users:
            if user.high_value_score > 65:
                unresolved_tickets = [t for t in self.ticket_map.get(user.user_id, [])
                                    if t.status in ["open", "in_progress"]]
                
                if unresolved_tickets:
                    oldest_ticket = min(unresolved_tickets, key=lambda t: t.created_at)
                    days_open = (now - oldest_ticket.created_at).days
                    
                    if days_open > 3:  # More than 3 days unresolved
                        flags.append(RiskFlag(
                            flag_id=str(uuid.uuid4()),
                            user_id=user.user_id,
                            flag_type="support_unresolved",
                            severity=SeverityLevel.CRITICAL if days_open > 14 else SeverityLevel.HIGH,
                            detected_at=now,
                            description=f"User has {len(unresolved_tickets)} unresolved support tickets. "
                                       f"Oldest: {oldest_ticket.subject} ({days_open} days open)",
                            metadata={
                                "unresolved_count": len(unresolved_tickets),
                                "oldest_ticket_days": days_open,
                                "ticket_category": oldest_ticket.category,
                                "high_value_score": user.high_value_score
                            }
                        ))
        
        return flags
    
    def detect_abandoned_high_value(self) -> List[RiskFlag]:
        """Detect abandoned users who were initially high-value"""
        flags = []
        now = datetime.utcnow()
        
        for user in self.users:
            if user.status == UserStatus.ABANDONED and user.high_value_score > 75:
                days_since_signup = (now - user.creation_date).days
                days_since_last_active = (now - user.last_active).days
                
                # Check if acquisition was expensive (high CPA)
                campaign = self.campaign_map.get(user.user_id)
                cpa = campaign.cpa if campaign else 0
                
                if days_since_last_active > 30:
                    flags.append(RiskFlag(
                        flag_id=str(uuid.uuid4()),
                        user_id=user.user_id,
                        flag_type="abandoned",
                        severity=SeverityLevel.CRITICAL,
                        detected_at=now,
                        description=f"High-value user abandoned {days_since_last_active} days ago. "
                                   f"Acquisition cost: ${cpa:.2f}. Lost revenue potential: ${user.high_value_score * 10}+",
                        metadata={
                            "days_since_signup": days_since_signup,
                            "days_since_last_active": days_since_last_active,
                            "acquisition_cost": cpa,
                            "high_value_score": user.high_value_score,
                            "acquisition_source": user.source
                        }
                    ))
        
        return flags
    
    def detect_all_risks(self) -> List[RiskFlag]:
        """Run all detection engines"""
        all_flags = []
        all_flags.extend(self.detect_onboarding_dropout())
        all_flags.extend(self.detect_inactive_high_value())
        all_flags.extend(self.detect_support_unresolved())
        all_flags.extend(self.detect_abandoned_high_value())
        return all_flags


class ActionRecommender:
    """Generates recovery action recommendations based on detected risks"""
    
    def __init__(self, users: List[UserProfile], tickets: List[Ticket]):
        self.users = users
        self.tickets = tickets
        self.user_map = {u.user_id: u for u in users}
    
    def recommend_actions(self, risk_flags: List[RiskFlag]) -> List[ActionRecommendation]:
        """Generate action recommendations for identified risks"""
        actions = []
        now = datetime.utcnow()
        
        for flag in risk_flags:
            user = self.user_map.get(flag.user_id)
            if not user:
                continue
            
            action_type = None
            reason = None
            estimated_value = 0
            
            # Onboarding dropouts -> Priority support + workflow trigger
            if flag.flag_type == "onboarding_delay":
                action_type = "priority_support"
                reason = "Prioritize KYC verification with personal support to unblock user"
                estimated_value = user.high_value_score * 15  # Potential per-user value
                
                actions.append(ActionRecommendation(
                    action_id=str(uuid.uuid4()),
                    user_id=flag.user_id,
                    risk_flag_id=flag.flag_id,
                    action_type=action_type,
                    status=ActionStatus.PENDING,
                    priority="high",
                    reason=reason,
                    estimated_recovery_value=estimated_value,
                    created_at=now
                ))
            
            # Inactive high-value -> Personalized outreach
            elif flag.flag_type == "inactivity":
                action_type = "personal_outreach"
                reason = f"Personalized email/SMS re-engagement campaign for {flag.metadata['days_inactive']} days inactive user"
                estimated_value = user.high_value_score * 20
                
                actions.append(ActionRecommendation(
                    action_id=str(uuid.uuid4()),
                    user_id=flag.user_id,
                    risk_flag_id=flag.flag_id,
                    action_type=action_type,
                    status=ActionStatus.PENDING,
                    priority="high" if flag.severity == SeverityLevel.CRITICAL else "medium",
                    reason=reason,
                    estimated_recovery_value=estimated_value,
                    created_at=now
                ))
            
            # Unresolved support -> Escalation + account flag
            elif flag.flag_type == "support_unresolved":
                # Action 1: Escalate ticket
                actions.append(ActionRecommendation(
                    action_id=str(uuid.uuid4()),
                    user_id=flag.user_id,
                    risk_flag_id=flag.flag_id,
                    action_type="workflow_trigger",
                    status=ActionStatus.PENDING,
                    priority="high",
                    reason="Escalate unresolved support ticket to priority queue",
                    estimated_recovery_value=user.high_value_score * 10,
                    created_at=now
                ))
                
                # Action 2: Flag account for special handling
                actions.append(ActionRecommendation(
                    action_id=str(uuid.uuid4()),
                    user_id=flag.user_id,
                    risk_flag_id=flag.flag_id,
                    action_type="account_flag",
                    status=ActionStatus.PENDING,
                    priority="high",
                    reason="Flag as priority customer - ensure dedicated support",
                    estimated_recovery_value=user.high_value_score * 5,
                    created_at=now
                ))
            
            # Abandoned high-value -> Multi-channel recovery campaign
            elif flag.flag_type == "abandoned":
                action_type = "personal_outreach"
                reason = f"Launch win-back campaign: Email, SMS, and direct outreach. Estimated customer lifetime value: ${estimated_value:.0f}"
                estimated_value = user.high_value_score * 50  # High potential value
                
                actions.append(ActionRecommendation(
                    action_id=str(uuid.uuid4()),
                    user_id=flag.user_id,
                    risk_flag_id=flag.flag_id,
                    action_type=action_type,
                    status=ActionStatus.PENDING,
                    priority="critical",
                    reason=reason,
                    estimated_recovery_value=estimated_value,
                    created_at=now
                ))
        
        return actions
