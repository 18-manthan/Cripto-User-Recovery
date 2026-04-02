"""
FastAPI Backend for RUD Demo
Provides API endpoints for the operator dashboard
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from datetime import datetime
from typing import List, Dict, Optional
from sqlalchemy import func
import os
import uuid

from database import SessionLocal, init_db
from models import UserProfile, Wallet, RiskFlag, SupportTicket, RecoveryAction, Campaign
from chat import ChatBot, ConversationManager

app = FastAPI(
    title="High-Value User Recovery Engine - Demo",
    description="Real-time recovery system for high-value crypto users",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize global state
CHATBOT = None
CONVERSATION_MANAGER = None

@app.on_event("startup")
async def startup_event():
    """Initialize the demo system with database"""
    global CHATBOT, CONVERSATION_MANAGER
    
    # Initialize database
    init_db()
    print("✅ Database initialized!")
    
    # Initialize chatbot and conversation manager
    try:
        CHATBOT = ChatBot()
        CONVERSATION_MANAGER = ConversationManager()
        print("✅ ChatBot initialized successfully!")
    except ValueError as e:
        print(f"⚠️  ChatBot initialization warning: {e}")
        print("   Chat feature will be unavailable until GROQ_API_KEY is set")
        CHATBOT = None
        CONVERSATION_MANAGER = None
    
    # Get stats from database
    db = SessionLocal()
    try:
        user_count = db.query(func.count(UserProfile.id)).scalar()
        risk_count = db.query(func.count(RiskFlag.id)).scalar()
        action_count = db.query(func.count(RecoveryAction.id)).scalar()
        print(f"✅ RUD Demo initialized!")
        print(f"   Users: {user_count}")
        print(f"   Risk flags in DB: {risk_count}")
        print(f"   Recovery actions in DB: {action_count}")
    finally:
        db.close()


# ==================== DASHBOARD API ====================

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Get high-level dashboard statistics"""
    db = SessionLocal()
    try:
        # Count users by lifecycle stage
        stage_breakdown = {}
        for stage in ["onboarding", "active", "inactive", "churned", "high_value"]:
            count = db.query(func.count(UserProfile.id)).filter(
                UserProfile.lifecycle_stage == stage
            ).scalar()
            stage_breakdown[stage] = count
        
        # Risk summary by severity
        severity_breakdown = {}
        for severity in ["critical", "high", "medium", "low"]:
            count = db.query(func.count(RiskFlag.id)).filter(
                RiskFlag.severity == severity
            ).scalar()
            severity_breakdown[severity] = count
        
        # Action status breakdown
        action_status_breakdown = {}
        for status in ["pending", "approved", "executed", "failed"]:
            count = db.query(func.count(RecoveryAction.id)).filter(
                RecoveryAction.status == status
            ).scalar()
            action_status_breakdown[status] = count
        
        # Recovery potential
        recovery_potential = db.query(func.sum(RecoveryAction.estimated_recovery_value)).scalar() or 0
        action_count = db.query(func.count(RecoveryAction.id)).scalar()
        avg_recovery = recovery_potential / action_count if action_count > 0 else 0
        
        total_users = db.query(func.count(UserProfile.id)).scalar()
        total_risks = db.query(func.count(RiskFlag.id)).scalar()
        total_actions = db.query(func.count(RecoveryAction.id)).scalar()
        
        return {
            "total_users": total_users,
            "user_status_breakdown": stage_breakdown,
            "total_risk_flags": total_risks,
            "risk_severity_breakdown": severity_breakdown,
            "total_actions": total_actions,
            "action_status_breakdown": action_status_breakdown,
            "total_recovery_potential": f"${recovery_potential:,.0f}",
            "avg_recovery_value_per_action": f"${avg_recovery:,.0f}"
        }
    finally:
        db.close()


@app.get("/api/risk-flags")
async def get_risk_flags(
    flag_type: str = None,
    severity: str = None,
    limit: int = 100,
    offset: int = 0
):
    """Get detected risk flags with optional filtering"""
    db = SessionLocal()
    try:
        query = db.query(RiskFlag)
        
        if flag_type:
            query = query.filter(RiskFlag.flag_type == flag_type)
        
        if severity:
            query = query.filter(RiskFlag.severity == severity)
        
        total = query.count()
        items = query.offset(offset).limit(limit).all()
        
        return {
            "total": total,
            "offset": offset,
            "limit": limit,
            "items": [
                {
                    "flag_id": f.id,
                    "user_id": f.user_id,
                    "flag_type": f.flag_type,
                    "severity": f.severity,
                    "detected_at": f.detected_at.isoformat(),
                    "description": f.description,
                    "days_since_detection": f.days_since_detection
                }
                for f in items
            ]
        }
    finally:
        db.close()


@app.get("/api/actions")
async def get_actions(
    status: str = None,
    priority: str = None,
    limit: int = 100,
    offset: int = 0
):
    """Get recommended actions with optional filtering"""
    db = SessionLocal()
    try:
        query = db.query(RecoveryAction)
        
        if status:
            query = query.filter(RecoveryAction.status == status)
        
        if priority:
            query = query.filter(RecoveryAction.priority == priority)
        
        total = query.count()
        items = query.offset(offset).limit(limit).all()
        
        return {
            "total": total,
            "offset": offset,
            "limit": limit,
            "items": [
                {
                    "action_id": a.id,
                    "user_id": a.user_id,
                    "action_type": a.action_type,
                    "status": a.status,
                    "priority": a.priority,
                    "reason": a.reason,
                    "estimated_recovery_value": f"${a.estimated_recovery_value:,.2f}",
                    "created_at": a.created_at.isoformat()
                }
                for a in items
            ]
        }
    finally:
        db.close()


@app.post("/api/actions/{action_id}/approve")
async def approve_action(action_id: str):
    """Approve a pending action"""
    db = SessionLocal()
    try:
        action = db.query(RecoveryAction).filter(RecoveryAction.id == action_id).first()
        if action and action.status == "pending":
            action.status = "approved"
            db.commit()
            return {
                "success": True,
                "message": f"Action {action_id} approved",
                "action": {
                    "action_id": action.id,
                    "status": action.status
                }
            }
        
        return {"success": False, "error": "Action not found or not pending"}
    finally:
        db.close()


@app.post("/api/actions/{action_id}/execute")
async def execute_action(action_id: str):
    """Execute an approved action"""
    db = SessionLocal()
    try:
        action = db.query(RecoveryAction).filter(RecoveryAction.id == action_id).first()
        if action and action.status in ["pending", "approved"]:
            action.status = "executed"
            action.executed_at = datetime.utcnow()
            db.commit()
            return {
                "success": True,
                "message": f"Action {action_id} executed",
                "action": {
                    "action_id": action.id,
                    "status": action.status,
                    "executed_at": action.executed_at.isoformat()
                }
            }
        
        return {"success": False, "error": "Action not found or already executed"}
    finally:
        db.close()


@app.get("/api/users/{user_id}")
async def get_user_details(user_id: str):
    """Get detailed user profile with related data"""
    db = SessionLocal()
    try:
        user = db.query(UserProfile).filter(UserProfile.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
        tickets = db.query(SupportTicket).filter(SupportTicket.user_id == user_id).all()
        flags = db.query(RiskFlag).filter(RiskFlag.user_id == user_id).all()
        actions = db.query(RecoveryAction).filter(RecoveryAction.user_id == user_id).all()
        
        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "lifecycle_stage": user.lifecycle_stage,
                "acquisition_source": user.acquisition_source,
                "estimated_ltv": user.estimated_ltv,
                "first_seen_at": user.first_seen_at.isoformat(),
                "last_activity_at": user.last_activity_at.isoformat() if user.last_activity_at else None,
                "country": user.country
            },
            "wallet": {
                "balance_usd": wallet.balance_usd,
                "activity_score": wallet.activity_score,
                "transaction_count": wallet.transaction_count,
                "wallet_age_days": wallet.wallet_age_days,
                "blockchain": wallet.blockchain,
                "last_activity_at": wallet.last_activity_at.isoformat() if wallet.last_activity_at else None
            } if wallet else None,
            "tickets": [
                {
                    "id": t.id,
                    "subject": t.subject,
                    "category": t.category,
                    "status": t.status,
                    "priority": t.priority,
                    "unresolved_days": t.unresolved_days,
                    "created_at": t.created_at.isoformat()
                }
                for t in tickets
            ],
            "risk_flags": [
                {
                    "id": f.id,
                    "type": f.flag_type,
                    "severity": f.severity,
                    "description": f.description,
                    "days_since_detection": f.days_since_detection
                }
                for f in flags
            ],
            "recovery_actions": [
                {
                    "id": a.id,
                    "type": a.action_type,
                    "status": a.status,
                    "priority": a.priority,
                    "recovery_value": a.estimated_recovery_value
                }
                for a in actions
            ]
        }
    finally:
        db.close()


@app.get("/api/scenarios")
async def get_scenario_breakdown():
    """Get breakdown of recovery scenarios by risk type"""
    db = SessionLocal()
    try:
        # Group risk flags by type
        flag_types = ["onboarding_incomplete", "inactivity", "support_unresolved", "compliance_issue", "low_activity", "unusual_behavior"]
        scenarios = {}
        
        for flag_type in flag_types:
            flags = db.query(RiskFlag).filter(RiskFlag.flag_type == flag_type).all()
            
            if flags:
                # Get severity breakdown
                severity_breakdown = {}
                for severity in ["critical", "high", "medium", "low"]:
                    count = len([f for f in flags if f.severity == severity])
                    if count > 0:
                        severity_breakdown[severity] = count
                
                # Get total recovery potential for this flag type
                total_recovery = 0
                for flag in flags:
                    actions = db.query(RecoveryAction).filter(
                        RecoveryAction.user_id == flag.user_id
                    ).all()
                    total_recovery += sum([a.estimated_recovery_value for a in actions])
                
                scenarios[flag_type] = {
                    "type": flag_type,
                    "count": len(flags),
                    "total_recovery_potential": f"${total_recovery:,.0f}",
                    "severity_breakdown": severity_breakdown
                }
        
        return {"scenarios": scenarios}
    finally:
        db.close()


# ==================== CHATBOT API ====================

@app.post("/api/chat")
async def chat(request: Dict):
    """
    Natural language chat interface to RUD system
    Supports multi-turn conversations with context awareness
    """
    if not CHATBOT or not CONVERSATION_MANAGER:
        raise HTTPException(status_code=503, detail="ChatBot service not initialized. Please set GROQ_API_KEY environment variable.")
    
    try:
        user_message = request.get("message", "")
        session_id = request.get("session_id") or str(uuid.uuid4())
        
        if not user_message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        # Get conversation history
        history = CONVERSATION_MANAGER.get_history(session_id)
        
        # Get database connection
        db = SessionLocal()
        
        try:
            # Prepare context data from database
            context_data = await get_dashboard_stats()
            
            # Build risk summary
            risk_summary = {"total": db.query(func.count(RiskFlag.id)).scalar(), "by_type": {}}
            for flag_type in ["onboarding_incomplete", "inactivity", "support_unresolved", "compliance_issue", "low_activity"]:
                count = db.query(func.count(RiskFlag.id)).filter(RiskFlag.flag_type == flag_type).scalar()
                if count > 0:
                    risk_summary["by_type"][flag_type] = count
            
            context_data["risk_summary"] = risk_summary
            
            # Define data functions for chatbot
            def get_user_profile(user_id: str):
                """Get user profile from the database"""
                user = db.query(UserProfile).filter(UserProfile.id == user_id).first()
                if not user:
                    return {"error": f"User {user_id} not found"}
                
                wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
                tickets = db.query(SupportTicket).filter(SupportTicket.user_id == user_id).all()
                flags = db.query(RiskFlag).filter(RiskFlag.user_id == user_id).all()
                actions = db.query(RecoveryAction).filter(RecoveryAction.user_id == user_id).all()
                
                return {
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "name": user.name,
                        "lifecycle_stage": user.lifecycle_stage,
                        "estimated_ltv": user.estimated_ltv,
                        "acquisition_source": user.acquisition_source,
                        "first_seen_at": user.first_seen_at.isoformat()
                    },
                    "wallet": {
                        "balance_usd": wallet.balance_usd if wallet else 0,
                        "activity_score": wallet.activity_score if wallet else 0,
                        "transaction_count": wallet.transaction_count if wallet else 0
                    },
                    "tickets": len(tickets),
                    "risk_flags": [{"type": f.flag_type, "severity": f.severity} for f in flags],
                    "recovery_actions": [{"type": a.action_type, "status": a.status} for a in actions]
                }
            
            def get_risk_flags(flag_type: str = None, severity: str = None):
                """Get risk flags from the database"""
                query = db.query(RiskFlag)
                
                if flag_type:
                    query = query.filter(RiskFlag.flag_type == flag_type)
                
                if severity:
                    query = query.filter(RiskFlag.severity == severity)
                
                flags = query.limit(50).all()
                
                return {
                    "total": db.query(func.count(RiskFlag.id)).filter(
                        (RiskFlag.flag_type == flag_type) if flag_type else True,
                        (RiskFlag.severity == severity) if severity else True
                    ).scalar(),
                    "flags": [
                        {
                            "user_id": f.user_id,
                            "type": f.flag_type,
                            "severity": f.severity,
                            "description": f.description
                        }
                        for f in flags
                    ]
                }
            
            def get_recovery_actions(status: str = None):
                """Get recovery actions from the database"""
                query = db.query(RecoveryAction)
                
                if status:
                    query = query.filter(RecoveryAction.status == status)
                
                actions = query.limit(50).all()
                
                return {
                    "total": db.query(func.count(RecoveryAction.id)).filter(
                        (RecoveryAction.status == status) if status else True
                    ).scalar(),
                    "actions": [
                        {
                            "user_id": a.user_id,
                            "type": a.action_type,
                            "status": a.status,
                            "recovery_value": a.estimated_recovery_value,
                            "reason": a.reason
                        }
                        for a in actions
                    ]
                }
            
            # Process message with chatbot
            response = CHATBOT.process_query(
                user_message=user_message,
                context_data=context_data,
                conversation_history=history,
                data_functions={
                    "get_user_profile": get_user_profile,
                    "get_risk_flags": get_risk_flags,
                    "get_recovery_actions": get_recovery_actions
                }
            )
            
            # Store messages in conversation history
            CONVERSATION_MANAGER.add_message(session_id, "user", user_message)
            CONVERSATION_MANAGER.add_message(session_id, "assistant", response)
            
            return {
                "session_id": session_id,
                "response": response,
                "timestamp": datetime.utcnow().isoformat()
            }
        finally:
            db.close()
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@app.get("/api/chat/history")
async def get_chat_history(session_id: str):
    """Get conversation history for a session"""
    if not CONVERSATION_MANAGER:
        raise HTTPException(status_code=503, detail="ChatBot service not initialized")
    
    history = CONVERSATION_MANAGER.get_history(session_id)
    return {
        "session_id": session_id,
        "messages": history,
        "message_count": len(history)
    }


@app.post("/api/chat/clear")
async def clear_chat_session(request: Dict):
    """Clear conversation history for a session"""
    if not CONVERSATION_MANAGER:
        raise HTTPException(status_code=503, detail="ChatBot service not initialized")
    
    session_id = request.get("session_id")
    if session_id and session_id in CONVERSATION_MANAGER.conversations:
        del CONVERSATION_MANAGER.conversations[session_id]
    
    return {"status": "cleared", "session_id": session_id}


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    db = SessionLocal()
    try:
        user_count = db.query(func.count(UserProfile.id)).scalar()
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database_ready": user_count > 0,
            "chatbot_ready": CHATBOT is not None
        }
    finally:
        db.close()




# ==================== DASHBOARD API ====================

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Get high-level dashboard statistics"""
    if not DUMMY_DATA:
        return {"error": "System not initialized"}
    
    # Count users by status
    status_breakdown = {}
    for user in DUMMY_DATA["users"]:
        status = user.status.value
        status_breakdown[status] = status_breakdown.get(status, 0) + 1
    
    # Risk summary
    severity_breakdown = {}
    for flag in RISK_FLAGS:
        sev = flag.severity.value
        severity_breakdown[sev] = severity_breakdown.get(sev, 0) + 1
    
    # Action summary
    action_status_breakdown = {}
    for action in ACTION_RECOMMENDATIONS:
        status = action.status.value
        action_status_breakdown[status] = action_status_breakdown.get(status, 0) + 1
    
    # Recovery potential
    recovery_potential = sum([a.estimated_recovery_value for a in ACTION_RECOMMENDATIONS])
    avg_recovery_per_action = recovery_potential / len(ACTION_RECOMMENDATIONS) if ACTION_RECOMMENDATIONS else 0
    
    return {
        "total_users": len(DUMMY_DATA["users"]),
        "user_status_breakdown": status_breakdown,
        "total_risk_flags": len(RISK_FLAGS),
        "risk_severity_breakdown": severity_breakdown,
        "total_actions": len(ACTION_RECOMMENDATIONS),
        "action_status_breakdown": action_status_breakdown,
        "total_recovery_potential": f"${recovery_potential:.0f}",
        "avg_recovery_value_per_action": f"${avg_recovery_per_action:.0f}"
    }


@app.get("/api/risk-flags")
async def get_risk_flags(
    flag_type: str = None,
    severity: str = None,
    limit: int = 100,
    offset: int = 0
):
    """Get detected risk flags with optional filtering"""
    if not RISK_FLAGS:
        return {"items": [], "total": 0}
    
    filtered = RISK_FLAGS
    
    if flag_type:
        filtered = [f for f in filtered if f.flag_type == flag_type]
    
    if severity:
        filtered = [f for f in filtered if f.severity.value == severity]
    
    total = len(filtered)
    items = filtered[offset:offset+limit]
    
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": [
            {
                "flag_id": f.flag_id,
                "user_id": f.user_id,
                "flag_type": f.flag_type,
                "severity": f.severity.value,
                "detected_at": f.detected_at.isoformat(),
                "description": f.description,
                "metadata": f.metadata
            }
            for f in items
        ]
    }


@app.get("/api/actions")
async def get_actions(
    status: str = None,
    priority: str = None,
    limit: int = 100,
    offset: int = 0
):
    """Get recommended actions with optional filtering"""
    if not ACTION_RECOMMENDATIONS:
        return {"items": [], "total": 0}
    
    filtered = ACTION_RECOMMENDATIONS
    
    if status:
        filtered = [a for a in filtered if a.status.value == status]
    
    if priority:
        filtered = [a for a in filtered if a.priority == priority]
    
    total = len(filtered)
    items = filtered[offset:offset+limit]
    
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": [
            {
                "action_id": a.action_id,
                "user_id": a.user_id,
                "risk_flag_id": a.risk_flag_id,
                "action_type": a.action_type,
                "status": a.status.value,
                "priority": a.priority,
                "reason": a.reason,
                "estimated_recovery_value": f"${a.estimated_recovery_value:.2f}",
                "created_at": a.created_at.isoformat()
            }
            for a in items
        ]
    }


@app.post("/api/actions/{action_id}/approve")
async def approve_action(action_id: str):
    """Approve a pending action"""
    for action in ACTION_RECOMMENDATIONS:
        if action.action_id == action_id and action.status == ActionStatus.PENDING:
            action.status = ActionStatus.APPROVED
            return {
                "success": True,
                "message": f"Action {action_id} approved",
                "action": {
                    "action_id": action.action_id,
                    "status": action.status.value
                }
            }
    
    return {"success": False, "error": "Action not found or already processed"}


@app.post("/api/actions/{action_id}/execute")
async def execute_action(action_id: str):
    """Execute an approved action"""
    for action in ACTION_RECOMMENDATIONS:
        if action.action_id == action_id and action.status in [ActionStatus.PENDING, ActionStatus.APPROVED]:
            action.status = ActionStatus.EXECUTED
            action.executed_at = datetime.utcnow()
            return {
                "success": True,
                "message": f"Action {action_id} executed",
                "action": {
                    "action_id": action.action_id,
                    "status": action.status.value,
                    "executed_at": action.executed_at.isoformat()
                }
            }
    
    return {"success": False, "error": "Action not found or already executed"}


@app.get("/api/users/{user_id}")
async def get_user_details(user_id: str):
    """Get detailed user profile with related data"""
    if not DUMMY_DATA:
        return {"error": "System not initialized"}
    
    user = next((u for u in DUMMY_DATA["users"] if u.user_id == user_id), None)
    if not user:
        return {"error": "User not found"}
    
    # Get user's wallet
    wallet = next((w for w in DUMMY_DATA["wallets"] if w.user_id == user_id), None)
    
    # Get user's campaign
    campaign = next((c for c in DUMMY_DATA["campaigns"] if c.user_id == user_id), None)
    
    # Get user's tickets
    tickets = [t for t in DUMMY_DATA["tickets"] if t.user_id == user_id]
    
    # Get user's risk flags
    flags = [f for f in RISK_FLAGS if f.user_id == user_id]
    
    # Get user's actions
    actions = [a for a in ACTION_RECOMMENDATIONS if a.user_id == user_id]
    
    return {
        "user": user.to_dict(),
        "wallet": wallet.to_dict() if wallet else None,
        "campaign": campaign.to_dict() if campaign else None,
        "tickets": [t.to_dict() for t in tickets],
        "risk_flags": [f.to_dict() for f in flags],
        "actions": [
            {
                "action_id": a.action_id,
                "action_type": a.action_type,
                "status": a.status.value,
                "priority": a.priority,
                "reason": a.reason,
                "estimated_recovery_value": a.estimated_recovery_value
            }
            for a in actions
        ]
    }


@app.get("/api/scenarios")
async def get_scenario_breakdown():
    """Get breakdown of recovery scenarios"""
    if not RISK_FLAGS:
        return {"scenarios": {}}
    
    scenarios = {}
    for flag in RISK_FLAGS:
        flag_type = flag.flag_type
        if flag_type not in scenarios:
            scenarios[flag_type] = {
                "type": flag_type,
                "count": 0,
                "total_recovery_potential": 0,
                "severity_breakdown": {}
            }
        
        scenarios[flag_type]["count"] += 1
        scenarios[flag_type]["severity_breakdown"][flag.severity.value] = \
            scenarios[flag_type]["severity_breakdown"].get(flag.severity.value, 0) + 1
        
        # Get related actions
        related_actions = [a for a in ACTION_RECOMMENDATIONS if a.risk_flag_id == flag.flag_id]
        scenarios[flag_type]["total_recovery_potential"] += sum([a.estimated_recovery_value for a in related_actions])
    
    return {
        "scenarios": {
            k: {**v, "total_recovery_potential": f"${v['total_recovery_potential']:.0f}"}
            for k, v in scenarios.items()
        }
    }


# ==================== CHATBOT API ====================

@app.post("/api/chat")
async def chat(request: Dict):
    """
    Natural language chat interface to RUD system
    Supports multi-turn conversations with context awareness
    """
    if not CHATBOT or not CONVERSATION_MANAGER:
        raise HTTPException(status_code=503, detail="ChatBot service not initialized. Please set GROQ_API_KEY environment variable.")
    
    try:
        user_message = request.get("message", "")
        session_id = request.get("session_id") or str(uuid.uuid4())
        
        if not user_message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        # Get conversation history
        history = CONVERSATION_MANAGER.get_history(session_id)
        
        # Prepare context data
        context_data = {
            "dashboard_stats": await get_dashboard_stats(),
            "risk_summary": {
                "total": len(RISK_FLAGS),
                "by_type": {}
            }
        }
        
        # Summarize risks by type
        for flag in RISK_FLAGS:
            flag_type = flag.flag_type
            context_data["risk_summary"]["by_type"][flag_type] = \
                context_data["risk_summary"]["by_type"].get(flag_type, 0) + 1
        
        # Define data functions for the chatbot
        def get_user_profile(user_id: str):
            """Get user profile from the system"""
            user = next((u for u in DUMMY_DATA["users"] if u.user_id == user_id), None)
            if not user:
                return {"error": f"User {user_id} not found"}
            
            wallet = next((w for w in DUMMY_DATA["wallets"] if w.user_id == user_id), None)
            campaign = next((c for c in DUMMY_DATA["campaigns"] if c.user_id == user_id), None)
            tickets = [t for t in DUMMY_DATA["tickets"] if t.user_id == user_id]
            flags = [f for f in RISK_FLAGS if f.user_id == user_id]
            actions = [a for a in ACTION_RECOMMENDATIONS if a.user_id == user_id]
            
            return {
                "user": {
                    "user_id": user.user_id,
                    "email": user.email,
                    "status": user.status.value,
                    "high_value_score": user.high_value_score,
                    "lifetime_value": user.lifetime_value,
                    "creation_date": user.creation_date.isoformat()
                },
                "wallet": wallet.to_dict() if wallet else None,
                "campaign": campaign.to_dict() if campaign else None,
                "tickets": [{"id": t.ticket_id, "category": t.category, "status": t.status, "created": t.created_at.isoformat()} for t in tickets],
                "risk_flags": [{"id": f.flag_id, "type": f.flag_type, "severity": f.severity.value, "description": f.description} for f in flags],
                "actions": [{"id": a.action_id, "type": a.action_type, "status": a.status.value, "recovery_value": a.estimated_recovery_value} for a in actions]
            }
        
        def get_risk_flags(flag_type: str = None, severity: str = None):
            """Get risk flags from the system"""
            flags = RISK_FLAGS if RISK_FLAGS else []
            
            if flag_type:
                flags = [f for f in flags if f.flag_type == flag_type]
            
            if severity:
                flags = [f for f in flags if f.severity.value == severity]
            
            return {
                "total": len(flags),
                "flags": [
                    {
                        "user_id": f.user_id,
                        "type": f.flag_type,
                        "severity": f.severity.value,
                        "description": f.description
                    }
                    for f in flags[:50]  # Return up to 50
                ]
            }
        
        def get_recovery_actions(status: str = None):
            """Get recovery actions from the system"""
            actions = ACTION_RECOMMENDATIONS if ACTION_RECOMMENDATIONS else []
            
            if status:
                actions = [a for a in actions if a.status.value == status]
            
            return {
                "total": len(actions),
                "actions": [
                    {
                        "user_id": a.user_id,
                        "type": a.action_type,
                        "status": a.status.value,
                        "recovery_value": a.estimated_recovery_value,
                        "reason": a.reason
                    }
                    for a in actions[:50]  # Return up to 50
                ]
            }
        
        # Process message with chatbot and provide data functions
        response = CHATBOT.process_query(
            user_message=user_message,
            context_data=context_data,
            conversation_history=history,
            data_functions={
                "get_user_profile": get_user_profile,
                "get_risk_flags": get_risk_flags,
                "get_recovery_actions": get_recovery_actions
            }
        )
        
        # Store messages in conversation history
        CONVERSATION_MANAGER.add_message(session_id, "user", user_message)
        CONVERSATION_MANAGER.add_message(session_id, "assistant", response)
        
        return {
            "session_id": session_id,
            "response": response,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@app.get("/api/chat/history")
async def get_chat_history(session_id: str):
    """Get conversation history for a session"""
    if not CONVERSATION_MANAGER:
        raise HTTPException(status_code=503, detail="ChatBot service not initialized")
    
    history = CONVERSATION_MANAGER.get_history(session_id)
    return {
        "session_id": session_id,
        "messages": history,
        "message_count": len(history)
    }


@app.post("/api/chat/clear")
async def clear_chat_session(request: Dict):
    """Clear conversation history for a session"""
    if not CONVERSATION_MANAGER:
        raise HTTPException(status_code=503, detail="ChatBot service not initialized")
    
    session_id = request.get("session_id")
    if session_id and session_id in CONVERSATION_MANAGER.conversations:
        del CONVERSATION_MANAGER.conversations[session_id]
    
    return {"status": "cleared", "session_id": session_id}


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "demo_ready": DUMMY_DATA is not None,
        "chatbot_ready": CHATBOT is not None
    }


# ==================== SERVE FRONTEND ====================

# Serve frontend static files (CSS, JS, etc) from root
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_dir):
    try:
        # Mount frontend files at root level so CSS/JS load correctly
        app.mount("", StaticFiles(directory=frontend_dir, html=True), name="frontend")
    except:
        # Fallback if mounting fails
        pass


@app.get("/", include_in_schema=False)
async def serve_index():
    """Serve the dashboard HTML"""
    index_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")
    return {"message": "RUD Demo API running. Use /api/* endpoints"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
