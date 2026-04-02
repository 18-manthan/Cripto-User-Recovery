"""
AI Chatbot Module - Natural Language Interface to RUD System
Uses Groq API for intelligent query processing and analysis with function calling
"""
from groq import Groq
from typing import List, Dict, Optional, Any
import os
import json
from datetime import datetime
import re


class ChatBot:
    """Conversational AI interface for RUD system with function calling support"""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize chatbot with Groq API"""
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY environment variable not set")
        
        self.client = Groq(api_key=self.api_key)
        self.conversation_history = []
        
        # Define available tools/functions
        self.tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_user_profile",
                    "description": "Get detailed profile for a specific user including risks, actions, and engagement",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "user_id": {
                                "type": "string",
                                "description": "The unique user ID (e.g., user_onboarding_000)"
                            }
                        },
                        "required": ["user_id"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_risk_flags",
                    "description": "Get risk flags with optional filtering",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "flag_type": {
                                "type": "string",
                                "enum": ["onboarding_delay", "inactivity", "unresolved_support", "abandoned"]
                            },
                            "severity": {
                                "type": "string",
                                "enum": ["critical", "high", "medium", "low"]
                            }
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_recovery_actions",
                    "description": "Get recovery actions with filtering",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "status": {
                                "type": "string",
                                "enum": ["pending", "approved", "executed"]
                            }
                        }
                    }
                }
            }
        ]
        
        self.system_prompt = """You are an AI assistant for the RUD (High-Value User Recovery Engine) system.

IMPORTANT: You have access to real data functions. When users ask for:
- Specific user profiles: Use get_user_profile()
- Lists of risky users: Use get_risk_flags()  
- Recovery actions: Use get_recovery_actions()

DO NOT make assumptions or provide hypothetical data. Call functions to get actual data.
Always provide real numbers and facts from the system data.

Help users understand their user recovery opportunities and recommend actions."""
    
    def process_query(self, user_message: str, context_data: Dict = None, 
                     conversation_history: List = None, 
                     data_functions: Dict = None) -> str:
        """Process query with function calling support"""
        
        if conversation_history is None:
            conversation_history = []
        
        messages = []
        for msg in conversation_history:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })
        
        messages.append({"role": "user", "content": user_message})
        
        # First call with tools
        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": self.system_prompt}] + messages,
            tools=self.tools,
            temperature=0.7,
            max_tokens=1024,
        )
        
        # Handle tool calls
        if response.choices[0].message.tool_calls:
            messages.append({"role": "assistant", "content": response.choices[0].message.content or ""})
            
            # Execute tool calls
            for tool_call in response.choices[0].message.tool_calls:
                func_name = tool_call.function.name
                func_args = json.loads(tool_call.function.arguments)
                
                result = None
                if data_functions and func_name in data_functions:
                    try:
                        result = data_functions[func_name](**func_args)
                    except Exception as e:
                        result = {"error": str(e)}
                
                messages.append({
                    "role": "user",
                    "content": f"Result from {func_name}: {json.dumps(result, default=str)[:2000]}"
                })
            
            # Second call with results
            follow_up = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "system", "content": self.system_prompt}] + messages,
                temperature=0.7,
                max_tokens=1024,
            )
            return follow_up.choices[0].message.content
        
        return response.choices[0].message.content


class ConversationManager:
    """Manages multi-turn conversations with context"""
    
    def __init__(self):
        self.conversations = {}  # session_id -> conversation
    
    def create_session(self, session_id: str) -> Dict:
        """Create a new conversation session"""
        self.conversations[session_id] = {
            "created_at": datetime.utcnow().isoformat(),
            "messages": [],
            "context": {}
        }
        return self.conversations[session_id]
    
    def add_message(self, session_id: str, role: str, content: str):
        """Add a message to conversation history"""
        if session_id not in self.conversations:
            self.create_session(session_id)
        
        self.conversations[session_id]["messages"].append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def get_history(self, session_id: str) -> List[Dict]:
        """Get conversation history for a session"""
        if session_id in self.conversations:
            return self.conversations[session_id]["messages"]
        return []
    
    def update_context(self, session_id: str, context_data: Dict):
        """Update conversation context"""
        if session_id not in self.conversations:
            self.create_session(session_id)
        
        self.conversations[session_id]["context"].update(context_data)
    
    def get_context(self, session_id: str) -> Dict:
        """Get conversation context"""
        if session_id in self.conversations:
            return self.conversations[session_id]["context"]
        return {}
