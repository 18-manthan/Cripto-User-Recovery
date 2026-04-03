"""
Legacy / alternate schema — not wired to the current FastAPI models.

Use ``seed_db.py`` for the demo database (personas + rule-based risk flags).
"""
from datetime import datetime, timedelta
import random
from models import (
    UserProfile, Wallet, Campaign, Ticket, UserStatus, RiskFlag, SeverityLevel
)


def generate_dummy_users(count: int = 50) -> list:
    """Generate realistic user profiles with various statuses"""
    users = []
    sources = ["google_ads", "facebook", "affiliate", "email", "organic", "referral"]
    countries = ["US", "UK", "Germany", "Singapore", "UAE", "Canada", "Australia"]
    
    now = datetime.utcnow()
    
    # Scenario 1: Inactive high-value users (not converted)
    for i in range(15):
        user_id = f"user_inactive_{i:03d}"
        creation_date = now - timedelta(days=random.randint(60, 180))
        users.append(UserProfile(
            user_id=user_id,
            email=f"inactive_{i}@example.com",
            name=f"Inactive User {i}",
            status=UserStatus.INACTIVE,
            creation_date=creation_date,
            last_active=creation_date + timedelta(days=random.randint(1, 5)),
            country=random.choice(countries),
            source=random.choice(sources),
            high_value_score=random.uniform(65, 95),  # High similarity to valuable users
            external_id={
                "crm": f"crm_{i:05d}",
                "ads_platform": f"ads_{i:05d}"
            }
        ))
    
    # Scenario 2: Onboarding stuck users (KYC not completed)
    for i in range(10):
        user_id = f"user_onboarding_{i:03d}"
        creation_date = now - timedelta(days=random.randint(7, 30))
        users.append(UserProfile(
            user_id=user_id,
            email=f"onboarding_{i}@example.com",
            name=f"Onboarding User {i}",
            status=UserStatus.ONBOARDING,
            creation_date=creation_date,
            last_active=creation_date + timedelta(days=random.randint(0, 3)),
            country=random.choice(countries),
            source=random.choice(sources),
            high_value_score=random.uniform(55, 85),
            external_id={
                "crm": f"crm_{i:05d}",
                "kyc_provider": f"kyc_{i:05d}"
            }
        ))
    
    # Scenario 3: Active users (baseline)
    for i in range(20):
        user_id = f"user_active_{i:03d}"
        creation_date = now - timedelta(days=random.randint(10, 90))
        users.append(UserProfile(
            user_id=user_id,
            email=f"active_{i}@example.com",
            name=f"Active User {i}",
            status=UserStatus.ACTIVE,
            creation_date=creation_date,
            last_active=now - timedelta(hours=random.randint(1, 48)),
            country=random.choice(countries),
            source=random.choice(sources),
            high_value_score=random.uniform(30, 70),
            external_id={
                "crm": f"crm_{i:05d}",
                "wallet": f"wallet_{i:05d}"
            }
        ))
    
    # Scenario 4: Abandoned users (high-value at signup, disappeared)
    for i in range(5):
        user_id = f"user_abandoned_{i:03d}"
        creation_date = now - timedelta(days=random.randint(100, 200))
        users.append(UserProfile(
            user_id=user_id,
            email=f"abandoned_{i}@example.com",
            name=f"Abandoned User {i}",
            status=UserStatus.ABANDONED,
            creation_date=creation_date,
            last_active=creation_date + timedelta(days=random.randint(1, 10)),
            country=random.choice(countries),
            source=random.choice(sources),
            high_value_score=random.uniform(75, 95),  # High initial value!
            external_id={
                "crm": f"crm_{i:05d}",
                "ads_platform": f"ads_{i:05d}"
            }
        ))
    
    return users


def generate_wallets(users: list) -> list:
    """Generate wallet data for users"""
    wallets = []
    blockchains = ["ethereum", "bitcoin", "polygon", "arbitrum"]
    
    for i, user in enumerate(users):
        # Active users have wallets with transactions
        if user.status == UserStatus.ACTIVE:
            wallet_id = f"wallet_{i:03d}"
            wallets.append(Wallet(
                wallet_id=wallet_id,
                user_id=user.user_id,
                blockchain=random.choice(blockchains),
                balance_usd=random.uniform(100, 50000),
                transaction_count=random.randint(5, 150),
                last_transaction=user.last_active,
                created_at=user.creation_date,
                external_id={"blockchain_api": f"addr_{i:05d}"}
            ))
        
        # Inactive/onboarding users might not have wallets or have empty ones
        elif user.status in [UserStatus.INACTIVE, UserStatus.ONBOARDING]:
            if random.random() > 0.5:  # 50% chance
                wallet_id = f"wallet_{i:03d}"
                wallets.append(Wallet(
                    wallet_id=wallet_id,
                    user_id=user.user_id,
                    blockchain=random.choice(blockchains),
                    balance_usd=random.uniform(0, 500),
                    transaction_count=random.randint(0, 2),
                    last_transaction=None,
                    created_at=user.creation_date,
                    external_id={"blockchain_api": f"addr_{i:05d}"}
                ))
    
    return wallets


def generate_campaigns(users: list) -> list:
    """Generate campaign/acquisition data"""
    campaigns = []
    channels = ["google_ads", "facebook", "affiliate", "email", "organic"]
    campaign_names = [
        "Q1 Growth Campaign", "Crypto Premium", "Ethereum Push",
        "Referral Program", "Holiday Promo", "B2B Outreach"
    ]
    
    for i, user in enumerate(users):
        cpa = {
            "google_ads": random.uniform(2, 15),
            "facebook": random.uniform(1, 10),
            "affiliate": random.uniform(0.5, 8),
            "email": random.uniform(0.1, 2),
            "organic": 0
        }
        
        channel = user.source if user.source in channels else random.choice(channels[:-1])
        campaigns.append(Campaign(
            campaign_id=f"camp_{i:03d}",
            user_id=user.user_id,
            campaign_name=random.choice(campaign_names),
            channel=channel,
            cpa=cpa.get(channel, random.uniform(1, 10)),
            created_at=user.creation_date,
            external_id={"ads_platform": f"camp_{i:05d}"}
        ))
    
    return campaigns


def generate_support_tickets(users: list) -> list:
    """Generate support ticket data"""
    tickets = []
    now = datetime.utcnow()
    categories = ["kyc", "wallet", "transaction", "general", "compliance"]
    
    # Onboarding users often have KYC-related tickets
    onboarding_users = [u for u in users if u.status == UserStatus.ONBOARDING]
    for i, user in enumerate(onboarding_users):
        ticket_id = f"ticket_kyc_{i:03d}"
        created_at = user.creation_date + timedelta(days=random.randint(1, 7))
        tickets.append(Ticket(
            ticket_id=ticket_id,
            user_id=user.user_id,
            subject="KYC Verification Required",
            status="open" if random.random() > 0.3 else "in_progress",
            priority="high",
            created_at=created_at,
            last_updated=now - timedelta(hours=random.randint(2, 72)),
            category="kyc",
            external_id={"support_system": f"tkt_{i:05d}"}
        ))
    
    # Some inactive users have unresolved tickets
    inactive_users = [u for u in users if u.status == UserStatus.INACTIVE]
    for i, user in enumerate(inactive_users[:5]):
        ticket_id = f"ticket_support_{i:03d}"
        created_at = user.last_active - timedelta(days=random.randint(10, 60))
        tickets.append(Ticket(
            ticket_id=ticket_id,
            user_id=user.user_id,
            subject="Wallet Connection Issue",
            status="open",
            priority="medium",
            created_at=created_at,
            last_updated=created_at + timedelta(days=random.randint(1, 10)),
            category="wallet",
            external_id={"support_system": f"tkt_{i:05d}"}
        ))
    
    # Some active users have general tickets (control group)
    active_users = [u for u in users if u.status == UserStatus.ACTIVE]
    for i, user in enumerate(active_users[:3]):
        ticket_id = f"ticket_general_{i:03d}"
        created_at = user.last_active - timedelta(days=random.randint(1, 7))
        tickets.append(Ticket(
            ticket_id=ticket_id,
            user_id=user.user_id,
            subject="How to export transaction history?",
            status="resolved",
            priority="low",
            created_at=created_at,
            last_updated=created_at + timedelta(hours=random.randint(2, 48)),
            category="general",
            external_id={"support_system": f"tkt_{i:05d}"}
        ))
    
    return tickets


def initialize_dummy_data():
    """Initialize all dummy data"""
    users = generate_dummy_users(count=50)
    wallets = generate_wallets(users)
    campaigns = generate_campaigns(users)
    tickets = generate_support_tickets(users)
    
    return {
        "users": users,
        "wallets": wallets,
        "campaigns": campaigns,
        "tickets": tickets
    }
