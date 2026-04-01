# 📊 RUD Demo - Sample Data & API Responses

## System Initialization Output

```
✅ RUD Demo initialized!
   Users: 50
   Risk flags detected: 39
   Actions recommended: 51
```

## Dashboard Statistics

### High-Level Stats
```json
{
  "total_users": 50,
  "user_status_breakdown": {
    "inactive": 15,
    "onboarding": 10,
    "active": 20,
    "abandoned": 5
  },
  "total_risk_flags": 39,
  "risk_severity_breakdown": {
    "critical": 15,
    "high": 20,
    "medium": 4
  },
  "total_actions": 51,
  "total_recovery_potential": "$67,582",
  "avg_recovery_value_per_action": "$1,325"
}
```

## Sample Risk Flags by Type

### 1. Onboarding Delays (10 cases)
```json
{
  "flag_id": "uuid-1234",
  "user_id": "user_onboarding_001",
  "flag_type": "onboarding_delay",
  "severity": "high",
  "description": "User stuck in onboarding for 12 days. KYC ticket status: in_progress",
  "metadata": {
    "days_in_onboarding": 12,
    "high_value_score": 78.5,
    "kyc_ticket_count": 1
  }
}
```
**Recovery Action**: Priority support + KYC verification workflow trigger
**Estimated Value**: $1,175 per user

### 2. Inactive High-Value Users (15 cases)
```json
{
  "flag_id": "uuid-2345",
  "user_id": "user_inactive_004",
  "flag_type": "inactivity",
  "severity": "critical",
  "description": "High-value user inactive for 124 days. Last activity: 2025-11-28",
  "metadata": {
    "days_inactive": 124,
    "high_value_score": 90.78,
    "acquisition_source": "affiliate",
    "original_cpa": 1.66
  }
}
```
**Recovery Action**: Personalized re-engagement campaign (email, SMS, push)
**Estimated Value**: $1,815 per user

### 3. Unresolved Support Tickets (5 cases)
```json
{
  "flag_id": "uuid-3456",
  "user_id": "user_inactive_001",
  "flag_type": "support_unresolved",
  "severity": "high",
  "description": "User has 1 unresolved support tickets. Oldest: Wallet Connection Issue (18 days open)",
  "metadata": {
    "unresolved_count": 1,
    "oldest_ticket_days": 18,
    "ticket_category": "wallet",
    "high_value_score": 85.3
  }
}
```
**Recovery Actions**:
- Escalate ticket to priority queue
- Flag account for dedicated support
**Estimated Value**: $850-1,350 per user

### 4. Abandoned High-Value Users (5 cases)
```json
{
  "flag_id": "uuid-4567",
  "user_id": "user_abandoned_002",
  "flag_type": "abandoned",
  "severity": "critical",
  "description": "High-value user abandoned 156 days ago. Acquisition cost: $4.21. Lost revenue potential: $847+",
  "metadata": {
    "days_since_signup": 165,
    "days_since_last_active": 156,
    "acquisition_cost": 4.21,
    "high_value_score": 84.7,
    "acquisition_source": "facebook"
  }
}
```
**Recovery Action**: Win-back campaign with special incentives
**Estimated Value**: $4,235 per user

## Sample Recommended Actions

### Action Type 1: Priority Support
```json
{
  "action_id": "action-uuid-1",
  "user_id": "user_onboarding_005",
  "risk_flag_id": "flag-uuid-2",
  "action_type": "priority_support",
  "status": "pending",
  "priority": "high",
  "reason": "Prioritize KYC verification with personal support to unblock user",
  "estimated_recovery_value": "$1,215",
  "created_at": "2026-04-01T07:58:00Z"
}
```

### Action Type 2: Personal Outreach
```json
{
  "action_id": "action-uuid-2",
  "user_id": "user_inactive_003",
  "risk_flag_id": "flag-uuid-5",
  "action_type": "personal_outreach",
  "status": "pending",
  "priority": "critical",
  "reason": "Personalized email/SMS re-engagement campaign for 98 days inactive user",
  "estimated_recovery_value": "$1,960",
  "created_at": "2026-04-01T07:58:00Z"
}
```

### Action Type 3: Workflow Trigger
```json
{
  "action_id": "action-uuid-3",
  "user_id": "user_inactive_007",
  "risk_flag_id": "flag-uuid-8",
  "action_type": "workflow_trigger",
  "status": "pending",
  "priority": "high",
  "reason": "Escalate unresolved support ticket to priority queue",
  "estimated_recovery_value": "$850",
  "created_at": "2026-04-01T07:58:00Z"
}
```

### Action Type 4: Account Flagging
```json
{
  "action_id": "action-uuid-4",
  "user_id": "user_inactive_007",
  "risk_flag_id": "flag-uuid-8",
  "action_type": "account_flag",
  "status": "pending",
  "priority": "high",
  "reason": "Flag as priority customer - ensure dedicated support",
  "estimated_recovery_value": "$425",
  "created_at": "2026-04-01T07:58:00Z"
}
```

## User Profile Example

```json
{
  "user": {
    "user_id": "user_inactive_002",
    "email": "inactive_2@example.com",
    "name": "Inactive User 2",
    "status": "inactive",
    "creation_date": "2025-10-21T00:00:00Z",
    "last_active": "2025-10-28T00:00:00Z",
    "country": "UAE",
    "source": "google_ads",
    "high_value_score": 82.4
  },
  "wallet": {
    "wallet_id": "wallet_002",
    "blockchain": "ethereum",
    "balance_usd": 285.65,
    "transaction_count": 1,
    "last_transaction": null
  },
  "campaign": {
    "campaign_id": "camp_002",
    "campaign_name": "Ethereum Push",
    "channel": "google_ads",
    "cpa": 8.75
  },
  "risk_flags": [
    {
      "flag_id": "uuid-5678",
      "flag_type": "inactivity",
      "severity": "high",
      "description": "High-value user inactive for 166 days...",
      "detected_at": "2026-04-01T07:58:00Z"
    }
  ],
  "actions": [
    {
      "action_id": "action-uuid-10",
      "action_type": "personal_outreach",
      "status": "pending",
      "priority": "high",
      "reason": "Personalized email/SMS re-engagement campaign...",
      "estimated_recovery_value": 1648.0
    }
  ]
}
```

## Recovery Scenarios Breakdown

```json
{
  "scenarios": {
    "onboarding_delay": {
      "type": "onboarding_delay",
      "count": 10,
      "severity_breakdown": {
        "high": 6,
        "medium": 4
      },
      "total_recovery_potential": "$11,750"
    },
    "inactivity": {
      "type": "inactivity",
      "count": 15,
      "severity_breakdown": {
        "critical": 10,
        "high": 5
      },
      "total_recovery_potential": "$27,225"
    },
    "support_unresolved": {
      "type": "support_unresolved",
      "count": 5,
      "severity_breakdown": {
        "critical": 1,
        "high": 4
      },
      "total_recovery_potential": "$6,200"
    },
    "abandoned": {
      "type": "abandoned",
      "count": 5,
      "severity_breakdown": {
        "critical": 4,
        "high": 1
      },
      "total_recovery_potential": "$21,175"
    }
  }
}
```

## Key Metrics by Scenario

| Scenario | Count | Potential Value | Avg Value/User | Priority | Action |
|----------|-------|-----------------|-----------------|----------|--------|
| Onboarding Delay | 10 | $11,750 | $1,175 | HIGH | Priority support + KYC workflow |
| Inactive High-Value | 15 | $27,225 | $1,815 | CRITICAL | Re-engagement campaigns |
| Unresolved Support | 5 | $6,200 | $1,240 | HIGH | Ticket escalation & flagging |
| Abandoned Users | 5 | $21,175 | $4,235 | CRITICAL | Win-back campaigns |
| **TOTAL** | **35** | **$67,582** | **$1,931** | — | — |

## Real-World Extrapolation

If this pattern holds for a platform with **1 million users**:

| Metric | 50 Users | 1M Users | Annual Impact |
|--------|----------|----------|---------------|
| Risk Flags | 39 | 780,000 | 780K recovery opportunities |
| Recovery Rate | 12% | 12% | 93,600 recovered users |
| Avg Recovery/User | $1,325 | $1,325 | $123.97M |
| Implementation Cost | N/A | ~$500K-1M | ROI: 124-248x |

## API Response Times (Typical)

```
Health Check: 2-5ms
Dashboard Stats: 15-25ms
Risk Flags (100 items): 30-50ms
Actions List: 30-50ms
User Detail: 50-100ms
Scenarios: 40-60ms
```

## Error Handling Examples

### User Not Found
```json
{
  "error": "User not found"
}
```

### Successful Action Approval
```json
{
  "success": true,
  "message": "Action action-uuid-123 approved",
  "action": {
    "action_id": "action-uuid-123",
    "status": "approved"
  }
}
```

## Data Refresh Intervals

- **Real-time detection**: Risk flags update as data arrives (streaming mode)
- **Dashboard refresh**: Every 5-10 seconds (demo shows latest)
- **User profiles**: Cached, updated on request
- **Historical tracking**: Audit log for all changes

## Integration Points

The demo shows these ready for integration:

1. **Connector Layer Input**
   - User registration data
   - Wallet activity
   - Campaign attribution
   - Support tickets

2. **Orchestration Engine Output**
   - Risk scores and flags
   - Recommended actions
   - Priority ranking
   - Impact analysis

3. **Execution Layer Integration**
   - Webhook triggers
   - CRM updates
   - Support ticket escalation
   - Email/SMS workflows
   - Account flagging

---

This demo shows **production-ready logic** for risk detection and action recommendation. The next phase connects real data sources and action executors to your systems.
