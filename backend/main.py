"""
FastAPI Backend for RUD Demo
Provides API endpoints for the operator dashboard
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from datetime import datetime
from typing import List, Dict
import os

from dummy_data import initialize_dummy_data
from orchestration import AnalysisEngine, ActionRecommender
from models import ActionStatus

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

# Initialize dummy data on startup
DUMMY_DATA = None
RISK_FLAGS = None
ACTION_RECOMMENDATIONS = None

@app.on_event("startup")
async def startup_event():
    """Initialize the demo system with dummy data"""
    global DUMMY_DATA, RISK_FLAGS, ACTION_RECOMMENDATIONS
    
    DUMMY_DATA = initialize_dummy_data()
    
    # Run analysis
    analysis_engine = AnalysisEngine(
        users=DUMMY_DATA["users"],
        wallets=DUMMY_DATA["wallets"],
        campaigns=DUMMY_DATA["campaigns"],
        tickets=DUMMY_DATA["tickets"]
    )
    
    RISK_FLAGS = analysis_engine.detect_all_risks()
    
    # Generate recommendations
    recommender = ActionRecommender(
        users=DUMMY_DATA["users"],
        tickets=DUMMY_DATA["tickets"]
    )
    
    ACTION_RECOMMENDATIONS = recommender.recommend_actions(RISK_FLAGS)
    
    print(f"✅ RUD Demo initialized!")
    print(f"   Users: {len(DUMMY_DATA['users'])}")
    print(f"   Risk flags detected: {len(RISK_FLAGS)}")
    print(f"   Actions recommended: {len(ACTION_RECOMMENDATIONS)}")


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


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "demo_ready": DUMMY_DATA is not None
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
