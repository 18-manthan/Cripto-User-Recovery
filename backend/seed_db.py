"""
Database seeding script - generates 500 realistic crypto users with related data.
Run this once to populate the database with demo data.
"""

import random
import string
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal, init_db, engine
from models import Base, UserProfile, Wallet, RiskFlag, SupportTicket, RecoveryAction, Campaign

# Real crypto platform names and sources
CRYPTO_PLATFORMS = ["CoinbaseX", "KrakenHub", "BinanceFlow", "FTXPlus", "HuobiGlobal"]
ACQUISITION_SOURCES = ["twitter", "discord", "affiliate", "paid_ads", "organic", "referral", "content"]
LIFECYCLE_STAGES = ["onboarding", "active", "inactive", "churned", "high_value"]
COUNTRIES = ["US", "UK", "DE", "SG", "JP", "AU", "CA", "NL", "FR", "CH", "HK", "UAE"]

# Risk flag types
RISK_FLAG_TYPES = [
    "onboarding_incomplete",
    "inactivity",
    "support_unresolved",
    "compliance_issue",
    "low_activity",
    "unusual_behavior"
]

# Support ticket categories
TICKET_CATEGORIES = [
    "kyc_delay",
    "withdrawal_issue",
    "login_problem",
    "transaction_error",
    "compliance",
    "account_locked",
    "API_issue"
]

# Action types
ACTION_TYPES = [
    "email_outreach",
    "priority_support",
    "workflow_trigger",
    "account_review",
    "incentive_offer"
]

# Recovery estimates
RECOVERY_VALUES = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000]


def generate_user_id(index: int) -> str:
    """Generate realistic user ID."""
    prefix = random.choice(["user", "account", "trader", "investor", "holder"])
    suffix = random.choice(["", "_early", "_beta", "_vip"])
    return f"{prefix}_{index:06d}{suffix}".lower()


def generate_email(user_id: str) -> str:
    """Generate realistic email."""
    domains = ["gmail.com", "outlook.com", "crypto-trader.io", "blockchainmail.com", "web3.email", "protonmail.com"]
    return f"{user_id}@{random.choice(domains)}"


def generate_name() -> str:
    """Generate realistic name."""
    first_names = ["Alex", "Jordan", "Casey", "Morgan", "Riley", "Evan", "Blake", "Taylor", "Quinn", "Shannon"]
    last_names = ["Chen", "Garcia", "Kumar", "Müller", "Patel", "Singh", "Zhang", "Brown", "Davis", "Wilson"]
    return f"{random.choice(first_names)} {random.choice(last_names)}"


def generate_wallet_data(user_id: str) -> dict:
    """Generate realistic wallet data."""
    # Balance distribution: weighted toward lower values (more realistic)
    balance_distribution = [0, 100, 500, 1000, 5000, 10000, 50000, 100000, 250000, 1000000]
    balance = random.choice(balance_distribution) if random.random() < 0.8 else random.uniform(100, 1000000)
    
    wallet_age = random.randint(1, 1000)
    tx_count = int(balance / 1000) + random.randint(0, 100)  # More transactions for larger balances
    
    # Activity score: weighted by address holding longer and more transactions
    activity_score = min(100, (wallet_age / 10) + (tx_count / 5) + random.randint(0, 20))
    
    days_since_activity = random.choice([0, 1, 2, 5, 10, 30, 60, 90, 180]) if random.random() < 0.7 else random.randint(1, 365)
    
    return {
        "balance_usd": balance,
        "wallet_age_days": wallet_age,
        "transaction_count": tx_count,
        "activity_score": activity_score,
        "days_since_activity": days_since_activity,
        "blockchain": random.choice(["ethereum", "polygon", "solana", "arbitrum", "optimism"])
    }


def generate_risk_flags(user_id: str, db: Session) -> list:
    """Generate risk flags for user."""
    flags = []
    
    # Most users have 1-3 risk flags, some have none
    if random.random() < 0.65:
        num_flags = random.randint(1, 3)
        flag_types_used = random.sample(RISK_FLAG_TYPES, min(num_flags, len(RISK_FLAG_TYPES)))
        
        for flag_type in flag_types_used:
            # Severity: weighted toward lower severity
            severity = random.choice(["low"] * 40 + ["medium"] * 35 + ["high"] * 20 + ["critical"] * 5)
            days_old = random.randint(1, 365)
            
            descriptions = {
                "onboarding_incomplete": f"User completed {random.randint(30,90)}% of KYC process",
                "inactivity": f"No activity for {days_old} days",
                "support_unresolved": f"{random.randint(1,5)} open support tickets",
                "compliance_issue": f"Requires {random.choice(['additional verification', 'document re-submission', 'source of funds clarification'])}",
                "low_activity": f"Activity score: {random.randint(10,40)}/100",
                "unusual_behavior": f"Flagged {random.choice(['sudden wallet transfer', 'rapid liquidation', 'automated trading detected'])}"
            }
            
            flag = RiskFlag(
                id=f"{user_id}_risk_{len(flags)}",
                user_id=user_id,
                flag_type=flag_type,
                severity=severity,
                description=descriptions.get(flag_type, "Risk detected"),
                detected_at=datetime.utcnow() - timedelta(days=days_old),
                days_since_detection=days_old,
                source_system="demo_orchestrator"
            )
            flags.append(flag)
    
    return flags


def generate_support_tickets(user_id: str) -> list:
    """Generate support tickets for user."""
    tickets = []
    
    # ~30% of users have open support tickets
    if random.random() < 0.30:
        num_tickets = random.randint(1, 2)
        
        for i in range(num_tickets):
            category = random.choice(TICKET_CATEGORIES)
            status = random.choice(["open"] * 50 + ["pending"] * 30 + ["resolved"] * 20)
            priority = random.choice(["low"] * 30 + ["medium"] * 40 + ["high"] * 25 + ["critical"] * 5)
            
            days_old = random.choice([1, 2, 3, 7, 14, 30, 60, 90]) if status in ["open", "pending"] else random.randint(1, 30)
            
            subjects = {
                "kyc_delay": "KYC verification pending",
                "withdrawal_issue": "Withdrawal stuck in processing",
                "login_problem": "Cannot access account",
                "transaction_error": "Transaction failed unexpectedly",
                "compliance": "Additional compliance review needed",
                "account_locked": "Account temporarily locked",
                "API_issue": "API integration problems"
            }
            
            ticket = SupportTicket(
                id=f"{user_id}_ticket_{i}",
                user_id=user_id,
                subject=subjects.get(category, "Support request"),
                status=status,
                priority=priority,
                category=category,
                created_at=datetime.utcnow() - timedelta(days=days_old),
                last_updated=datetime.utcnow() - timedelta(days=random.randint(0, max(1, days_old-1))),
                unresolved_days=days_old if status in ["open", "pending"] else 0,
                source_system="demo_support"
            )
            tickets.append(ticket)
    
    return tickets


def generate_recovery_actions(user_id: str, num_risk_flags: int) -> list:
    """Generate recovery actions for user."""
    actions = []
    
    # Generate 0-2 actions per user
    if random.random() < 0.40 and num_risk_flags > 0:
        num_actions = random.randint(1, 2)
        
        for i in range(num_actions):
            action_type = random.choice(ACTION_TYPES)
            status = random.choice(["pending"] * 40 + ["approved"] * 30 + ["executed"] * 25 + ["failed"] * 5)
            priority = random.choice(["low"] * 20 + ["medium"] * 35 + ["high"] * 35 + ["critical"] * 10)
            recovery_value = random.choice(RECOVERY_VALUES)
            
            created_days_ago = random.randint(1, 30)
            executed_at = None
            if status == "executed":
                executed_at = datetime.utcnow() - timedelta(days=random.randint(1, created_days_ago))
            
            reasons = {
                "email_outreach": "Send personalized recovery email",
                "priority_support": "Escalate to VIP support queue",
                "workflow_trigger": "Initiate automated recovery workflow",
                "account_review": "Schedule account review call",
                "incentive_offer": "Offer trading fee discount"
            }
            
            action = RecoveryAction(
                id=f"{user_id}_action_{i}",
                user_id=user_id,
                action_type=action_type,
                status=status,
                priority=priority,
                reason=reasons.get(action_type, "Recovery action"),
                created_at=datetime.utcnow() - timedelta(days=created_days_ago),
                executed_at=executed_at,
                estimated_recovery_value=recovery_value,
                source_system="demo_orchestrator"
            )
            actions.append(action)
    
    return actions


def seed_campaigns(db: Session):
    """Create campaign records."""
    campaigns_data = [
        ("campaign_twitter_001", "Twitter Growth Q1", "twitter", 50000, 1200, 150000),
        ("campaign_discord_001", "Discord Community Q1", "discord", 25000, 800, 120000),
        ("campaign_affiliate_001", "Affiliate Network Q1", "affiliate", 75000, 3000, 400000),
        ("campaign_paid_ads_001", "Google Ads Campaign Q1", "paid_ads", 100000, 2000, 250000),
        ("campaign_organic_001", "Organic Growth Q1", "organic", 0, 4000, 500000),
        ("campaign_content_001", "Content Marketing Q1", "content", 30000, 1500, 200000),
    ]
    
    for camp_id, name, channel, spend, conversions, revenue in campaigns_data:
        cpa = spend / conversions if conversions > 0 else 0
        roi = (revenue - spend) / spend * 100 if spend > 0 else 0
        
        campaign = Campaign(
            id=camp_id,
            campaign_name=name,
            channel=channel,
            spend_usd=spend,
            conversions=conversions,
            revenue_usd=revenue,
            cpa=cpa,
            roi=roi,
            source_system="demo_marketing"
        )
        db.add(campaign)
    
    db.commit()
    print(f"✅ Created {len(campaigns_data)} campaigns")


def seed_users(db: Session, num_users: int = 500):
    """Generate and insert users into database."""
    print(f"🌱 Seeding database with {num_users} users...")
    
    for i in range(num_users):
        # Generate user profile
        user_id = generate_user_id(i)
        
        # Lifecycle stage distribution: weighted toward more active/valuable users
        lifecycle = random.choices(
            LIFECYCLE_STAGES,
            weights=[15, 40, 20, 15, 10]  # onboarding, active, inactive, churned, high_value
        )[0]
        
        # LTV estimation: depends on lifecycle and source
        ltv_base = {"onboarding": 500, "active": 5000, "inactive": 1000, "churned": 500, "high_value": 25000}
        ltv = ltv_base.get(lifecycle, 2000) + random.uniform(-500, 2000)
        
        # Account age
        account_age = random.randint(7, 730)  # 1 week to 2 years
        first_seen = datetime.utcnow() - timedelta(days=account_age)
        
        # Last activity
        days_since_activity = random.choice([0, 1, 2, 5, 10, 30, 60, 90, 180]) if lifecycle == "active" else random.randint(30, 365)
        last_activity = datetime.utcnow() - timedelta(days=days_since_activity)
        
        user = UserProfile(
            id=user_id,
            email=generate_email(user_id),
            name=generate_name(),
            acquisition_source=random.choice(ACQUISITION_SOURCES),
            lifecycle_stage=lifecycle,
            estimated_ltv=max(0, ltv),
            first_seen_at=first_seen,
            last_activity_at=last_activity,
            country=random.choice(COUNTRIES),
            source_system="demo_platform",
            external_id=f"ext_{user_id}",
            last_synced_at=datetime.utcnow()
        )
        
        # Generate wallet
        wallet_data = generate_wallet_data(user_id)
        wallet = Wallet(
            id=f"wallet_{user_id}",
            user_id=user_id,
            blockchain=wallet_data["blockchain"],
            balance_usd=wallet_data["balance_usd"],
            wallet_age_days=wallet_data["wallet_age_days"],
            transaction_count=wallet_data["transaction_count"],
            activity_score=wallet_data["activity_score"],
            last_activity_at=datetime.utcnow() - timedelta(days=wallet_data["days_since_activity"]),
            source_system="demo_blockchain",
            external_id=f"wallet_{user_id}_eth"
        )
        user.wallet = wallet
        
        # Generate risk flags
        risk_flags = generate_risk_flags(user_id, db)
        user.risk_flags = risk_flags
        
        # Generate support tickets
        tickets = generate_support_tickets(user_id)
        user.support_tickets = tickets
        
        # Generate recovery actions
        actions = generate_recovery_actions(user_id, len(risk_flags))
        user.recovery_actions = actions
        
        db.add(user)
        
        # Commit every 50 users to show progress
        if (i + 1) % 50 == 0:
            db.commit()
            print(f"  ✓ Created {i + 1} users...")
    
    db.commit()
    print(f"✅ Successfully seeded {num_users} users with realistic crypto platform data")


def print_stats(db: Session):
    """Print database statistics."""
    from sqlalchemy import func
    
    total_users = db.query(func.count(UserProfile.id)).scalar()
    total_wallets = db.query(func.count(Wallet.id)).scalar()
    high_value_users = db.query(func.count(UserProfile.id)).filter(
        UserProfile.lifecycle_stage == "high_value"
    ).scalar()
    critical_risks = db.query(func.count(RiskFlag.id)).filter(
        RiskFlag.severity == "critical"
    ).scalar()
    pending_actions = db.query(func.count(RecoveryAction.id)).filter(
        RecoveryAction.status == "pending"
    ).scalar()
    open_tickets = db.query(func.count(SupportTicket.id)).filter(
        SupportTicket.status == "open"
    ).scalar()
    
    print("\n📊 DATABASE STATISTICS:")
    print(f"  Total Users: {total_users}")
    print(f"  Wallets: {total_wallets}")
    print(f"  High-Value Users: {high_value_users}")
    print(f"  Critical Risk Flags: {critical_risks}")
    print(f"  Pending Recovery Actions: {pending_actions}")
    print(f"  Open Support Tickets: {open_tickets}")


if __name__ == "__main__":
    print("🚀 Starting database initialization...\n")
    
    # Initialize database schema
    init_db()
    
    # Get session
    db = SessionLocal()
    
    try:
        # Seed data
        seed_campaigns(db)
        seed_users(db, num_users=500)
        print_stats(db)
        print("\n✅ Database seeding complete!")
    finally:
        db.close()
