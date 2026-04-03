"""
FastAPI Backend for RUD Demo
Provides API endpoints for the operator dashboard
"""
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Optional, Any
from sqlalchemy import func
import os
import uuid
import json
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

from database import SessionLocal, init_db
from models import UserProfile, Wallet, RiskFlag, SupportTicket, RecoveryAction, Campaign, ActionExecutionLog
from agent import query_agent

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

ADMIN_EMAIL = "admin@cisinlabs.com"
ADMIN_PASSWORD = "cisin@321!"
ACTIVE_TOKENS = set()


def _mock_integration_payloads(action_type: str, user_id: Optional[str], reason: Optional[str]) -> Dict[str, Any]:
    """Demo-only payloads that would be webhooks / CRM / email in production."""
    uid = user_id or "cohort-wide"
    r = reason or f"RUD playbook: {action_type}"
    return {
        "email": {
            "provider": "mock_sendgrid",
            "to": "vip-recovery@rud-demo.local",
            "template_id": "retention_escalation",
            "merge_fields": {"user_id": uid, "action_type": action_type},
        },
        "jira": {
            "project_key": "RUD",
            "issue_type": "Task",
            "summary": f"{action_type.replace('_', ' ').title()} — {uid}",
            "description": r,
            "labels": ["rud-demo", action_type],
        },
        "crm": {
            "provider": "mock_salesforce",
            "object": "Account",
            "external_id_field": f"rud_user_{uid}",
            "updates": {"Recovery_Status__c": action_type, "Last_RUD_Action__c": datetime.utcnow().isoformat()},
        },
    }


# ==================== PYDANTIC MODELS ====================

class ChatRequest(BaseModel):
    """Request model for chat endpoint"""
    query: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "How many critical risk flags are there?"
            }
        }


class ChatResponse(BaseModel):
    """Response model for chat endpoint"""
    success: bool
    query: str
    response: str
    sql_query: Optional[str] = None
    row_count: Optional[int] = None
    error: Optional[str] = None
    playbook_id: Optional[str] = None


class SimulateActionRequest(BaseModel):
    action_type: str
    user_id: Optional[str] = None
    reason: Optional[str] = None


class SimulateActionResponse(BaseModel):
    success: bool
    log_id: str
    mocks: Dict[str, Any]
    message: str = "Simulated — external systems not called in demo mode."


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    user: Optional[str] = None
    error: Optional[str] = None


def require_auth(x_auth_token: Optional[str] = Header(None)):
    """Simple token-based auth for the demo dashboard."""
    if not x_auth_token or x_auth_token not in ACTIVE_TOKENS:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return x_auth_token

@app.on_event("startup")
async def startup_event():
    """Initialize the demo system with database"""
    # Initialize database
    init_db()
    print("✅ Database initialized!")
    
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


# ==================== AGENTIC CHAT API ====================

@app.post("/api/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Demo login endpoint for the dashboard."""
    if request.email == ADMIN_EMAIL and request.password == ADMIN_PASSWORD:
        token = str(uuid.uuid4())
        ACTIVE_TOKENS.add(token)
        return LoginResponse(success=True, token=token, user=ADMIN_EMAIL)

    return LoginResponse(success=False, error="Invalid email or password")


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, _: str = Depends(require_auth)):
    """Chat endpoint for natural language queries about the database
    
    Example queries:
    - "How many users are in onboarding stage?"
    - "What are the critical risk flags?"
    - "Show me high-value users with inactivity risks"
    - "Which recovery actions have the highest estimated value?"
    """
    try:
        result = query_agent(request.query, session_token=_)
        
        return ChatResponse(
            success=result.get("success", False),
            query=result.get("query", request.query),
            response=result.get("response", result.get("error", "No response")),
            sql_query=result.get("sql_query"),
            row_count=result.get("row_count"),
            error=result.get("error") if not result.get("success") else None,
            playbook_id=result.get("playbook_id"),
        )
    except Exception as e:
        return ChatResponse(
            success=False,
            query=request.query,
            response="An error occurred while processing your query",
            error=str(e)
        )


@app.post("/api/chat/simulate", response_model=SimulateActionResponse)
async def chat_simulate_action(request: SimulateActionRequest, _: str = Depends(require_auth)):
    """Record a simulated execute (email / Jira / CRM shaped payloads) — demo audit trail."""
    log_id = str(uuid.uuid4())
    mocks = _mock_integration_payloads(request.action_type, request.user_id, request.reason)
    db = SessionLocal()
    try:
        row = ActionExecutionLog(
            id=log_id,
            user_id=request.user_id,
            action_type=request.action_type,
            source="chat_simulate",
            request_summary=(request.reason or "")[:2000],
            payload_json=json.dumps(mocks, default=str),
        )
        db.add(row)
        db.commit()
        return SimulateActionResponse(success=True, log_id=log_id, mocks=mocks)
    finally:
        db.close()


# ==================== DASHBOARD API ====================

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(_: str = Depends(require_auth)):
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
    offset: int = 0,
    _: str = Depends(require_auth)
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
    offset: int = 0,
    _: str = Depends(require_auth)
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
async def approve_action(action_id: str, _: str = Depends(require_auth)):
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
async def execute_action(action_id: str, _: str = Depends(require_auth)):
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
async def get_user_details(user_id: str, _: str = Depends(require_auth)):
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
async def get_scenario_breakdown(_: str = Depends(require_auth)):
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


# ==================== HEALTH CHECK ====================

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    db = SessionLocal()
    try:
        user_count = db.query(func.count(UserProfile.id)).scalar()
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database_ready": user_count > 0
        }
    finally:
        db.close()


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
