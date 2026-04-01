// ===== API BASE URL =====
const API_BASE = 'http://localhost:8000/api';

// ===== STATE =====
let appState = {
    stats: null,
    riskFlags: [],
    actions: [],
    scenarios: null,
    users: [],
    filteredRisks: [],
    filteredActions: [],
    filteredUsers: []
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 RUD Demo Dashboard loading...');
    
    // Setup navigation
    setupNavigation();
    
    // Setup filters
    setupFilters();
    
    // Load data
    await loadDashboardData();
    
    // Render initial view
    renderOverview();
    
    // Update status
    updateHealthStatus();
});

// ===== NAVIGATION =====
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            
            item.classList.add('active');
            const section = item.dataset.section;
            document.getElementById(section).classList.add('active');
            
            // Render section content
            if (section === 'overview') renderOverview();
            else if (section === 'risks') renderRiskFlags();
            else if (section === 'actions') renderActions();
            else if (section === 'scenarios') renderScenarios();
            else if (section === 'users') renderUsers();
        });
    });
}

// ===== DATA LOADING =====
async function loadDashboardData() {
    try {
        // Load all data in parallel
        const [statsRes, risksRes, actionsRes, scenariosRes] = await Promise.all([
            fetch(`${API_BASE}/dashboard/stats`),
            fetch(`${API_BASE}/risk-flags?limit=1000`),
            fetch(`${API_BASE}/actions?limit=1000`),
            fetch(`${API_BASE}/scenarios`)
        ]);
        
        appState.stats = await statsRes.json();
        const risksData = await risksRes.json();
        const actionsData = await actionsRes.json();
        appState.scenarios = await scenariosRes.json();
        
        appState.riskFlags = risksData.items || [];
        appState.filteredRisks = appState.riskFlags;
        
        appState.actions = actionsData.items || [];
        appState.filteredActions = appState.actions;
        
        // Load users (simulate from risk flags for now)
        loadUsers();
        
        console.log('✅ Data loaded successfully');
        renderStats();
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showError('Failed to load dashboard data');
    }
}

function loadUsers() {
    // We'll load users on demand in the users section
    // For now, create a placeholder
    appState.users = [];
}

async function updateHealthStatus() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');
        
        indicator.classList.remove('loading');
        indicator.classList.add('healthy');
        text.textContent = 'System Ready';
        
    } catch (error) {
        console.error('Health check failed:', error);
    }
}

// ===== STATS RENDERING =====
function renderStats() {
    if (!appState.stats) return;
    
    const statsSection = document.getElementById('stats-section');
    
    const stats = [
        {
            title: 'Total Users',
            value: appState.stats.total_users,
            label: 'Active + Inactive'
        },
        {
            title: 'Risk Flags Detected',
            value: appState.stats.total_risk_flags,
            label: 'Recovery Opportunities'
        },
        {
            title: 'Actions Recommended',
            value: appState.stats.total_actions,
            label: 'Pending Execution'
        },
        {
            title: 'Recovery Potential',
            value: appState.stats.total_recovery_potential,
            label: 'Estimated Total Value'
        }
    ];
    
    statsSection.innerHTML = stats.map(stat => `
        <div class="stat-card">
            <h3>${stat.title}</h3>
            <div class="value">${stat.value}</div>
            <div class="label">${stat.label}</div>
        </div>
    `).join('');
}

// ===== OVERVIEW RENDERING =====
function renderOverview() {
    renderUserStatusChart();
    renderSeverityChart();
    renderRecoveryMetrics();
    renderActionSummary();
}

function renderUserStatusChart() {
    const container = document.getElementById('user-status-chart');
    const data = appState.stats?.user_status_breakdown || {};
    
    let html = '<div style="padding: 1rem;">';
    for (const [status, count] of Object.entries(data)) {
        const percentage = (count / appState.stats.total_users * 100).toFixed(1);
        html += `
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="text-transform: capitalize; font-weight: 500;">${status}</span>
                    <span>${count} (${percentage}%)</span>
                </div>
                <div style="height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; width: ${percentage}%; background: var(--primary); border-radius: 4px;"></div>
                </div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

function renderSeverityChart() {
    const container = document.getElementById('severity-chart');
    const data = appState.stats?.risk_severity_breakdown || {};
    
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    const colorMap = {
        critical: '#dc2626',
        high: '#ef4444',
        medium: '#f59e0b',
        low: '#10b981'
    };
    
    let html = '<div style="padding: 1rem;">';
    for (const severity of severityOrder) {
        const count = data[severity] || 0;
        const total = appState.stats.total_risk_flags;
        const percentage = total > 0 ? (count / total * 100).toFixed(1) : 0;
        
        html += `
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="text-transform: capitalize; font-weight: 500;">${severity}</span>
                    <span>${count} flags</span>
                </div>
                <div style="height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; width: ${percentage}%; background: ${colorMap[severity]}; border-radius: 4px;"></div>
                </div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

function renderRecoveryMetrics() {
    const potential = document.getElementById('recovery-potential');
    const avg = document.getElementById('avg-recovery');
    
    potential.textContent = appState.stats?.total_recovery_potential || '$0';
    avg.textContent = appState.stats?.avg_recovery_value_per_action || '$0';
}

function renderActionSummary() {
    const container = document.getElementById('action-summary');
    const data = appState.stats?.action_status_breakdown || {};
    
    const statusOrder = ['pending', 'approved', 'executed'];
    
    let html = '';
    for (const status of statusOrder) {
        const count = data[status] || 0;
        html += `
            <div class="action-summary-item">
                <span class="label">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                <span class="count">${count}</span>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ===== RISK FLAGS RENDERING =====
function renderRiskFlags() {
    const container = document.getElementById('risk-flags-list');
    
    if (appState.filteredRisks.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div>No risk flags found</div>';
        return;
    }
    
    container.innerHTML = appState.filteredRisks.map(flag => `
        <div class="list-item">
            <div class="list-item-header">
                <div class="list-item-title">
                    ${getInsightIcon(flag.flag_type)} ${flag.flag_type.replace(/_/g, ' ')}
                </div>
                <span class="badge severity-${flag.severity}">${flag.severity}</span>
            </div>
            <div class="list-item-meta">
                <div><strong>User:</strong> ${flag.user_id}</div>
                <div><strong>Detected:</strong> ${new Date(flag.detected_at).toLocaleDateString()}</div>
            </div>
            <div class="list-item-description">
                ${flag.description}
            </div>
            <div class="list-item-footer">
                <button class="btn-primary" onclick="viewUserDetail('${flag.user_id}')">
                    View User Profile
                </button>
            </div>
        </div>
    `).join('');
}

// ===== ACTIONS RENDERING =====
function renderActions() {
    const container = document.getElementById('actions-list');
    
    if (appState.filteredActions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div>No actions found</div>';
        return;
    }
    
    container.innerHTML = appState.filteredActions.map(action => `
        <div class="list-item">
            <div class="list-item-header">
                <div class="list-item-title">${action.action_type.replace(/_/g, ' ')}</div>
                <div style="display: flex; gap: 0.5rem;">
                    <span class="badge priority-${action.priority}">${action.priority}</span>
                    <span class="badge status-${action.status}">${action.status}</span>
                </div>
            </div>
            <div class="list-item-meta">
                <div><strong>User:</strong> ${action.user_id}</div>
                <div><strong>Created:</strong> ${new Date(action.created_at).toLocaleDateString()}</div>
            </div>
            <div class="list-item-description">
                ${action.reason}
            </div>
            <div class="list-item-footer">
                <div class="list-item-value">Value: ${action.estimated_recovery_value}</div>
                <div class="button-group">
                    ${action.status === 'pending' ? `
                        <button class="btn-primary" onclick="approveAction('${action.action_id}')">Approve</button>
                        <button class="btn-secondary" onclick="executeAction('${action.action_id}')">Execute</button>
                    ` : `
                        <button class="btn-secondary" disabled>${action.status}</button>
                    `}
                    <button class="btn-secondary" onclick="viewUserDetail('${action.user_id}')">View User</button>
                </div>
            </div>
        </div>
    `).join('');
}

// ===== SCENARIOS RENDERING =====
function renderScenarios() {
    const container = document.getElementById('scenarios-grid');
    const scenarios = appState.scenarios?.scenarios || {};
    
    if (Object.keys(scenarios).length === 0) {
        container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><div class="empty-state-icon">🎯</div>No scenarios detected</div>';
        return;
    }
    
    container.innerHTML = Object.entries(scenarios).map(([key, scenario]) => `
        <div class="scenario-card">
            <h4>${getScenarioEmoji(scenario.type)} ${scenario.type.replace(/_/g, ' ')}</h4>
            
            <div class="scenario-metric">
                <div class="scenario-metric-label">Total Users Affected</div>
                <div class="scenario-metric-value">${scenario.count}</div>
            </div>
            
            <div class="scenario-metric">
                <div class="scenario-metric-label">Recovery Potential</div>
                <div class="scenario-metric-value">${scenario.total_recovery_potential}</div>
            </div>
            
            <div class="scenario-metric">
                <div class="scenario-metric-label">Severity Distribution</div>
                <div style="display: grid; gap: 0.5rem; font-size: 0.85rem;">
                    ${Object.entries(scenario.severity_breakdown).map(([sev, count]) => 
                        `<div style="display: flex; justify-content: space-between;"><span>${sev}</span><strong>${count}</strong></div>`
                    ).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

// ===== USERS RENDERING =====
function renderUsers() {
    const container = document.getElementById('users-list');
    
    // Load user list from risk flags
    const uniqueUsers = new Set();
    appState.riskFlags.forEach(flag => uniqueUsers.add(flag.user_id));
    appState.filteredUsers = Array.from(uniqueUsers);
    
    if (appState.filteredUsers.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div>No users found</div>';
        return;
    }
    
    container.innerHTML = appState.filteredUsers.slice(0, 50).map(userId => {
        const risks = appState.riskFlags.filter(f => f.user_id === userId);
        const actions = appState.actions.filter(a => a.user_id === userId);
        
        return `
            <div class="list-item">
                <div class="list-item-header">
                    <div class="list-item-title">${userId}</div>
                </div>
                <div class="list-item-meta">
                    <div><strong>Risk Flags:</strong> ${risks.length}</div>
                    <div><strong>Actions:</strong> ${actions.length}</div>
                </div>
                <div class="list-item-footer">
                    <button class="btn-primary" onclick="viewUserDetail('${userId}')">View Details</button>
                </div>
            </div>
        `;
    }).join('');
}

// ===== FILTERS =====
function setupFilters() {
    document.getElementById('risk-type-filter')?.addEventListener('change', filterRisks);
    document.getElementById('risk-severity-filter')?.addEventListener('change', filterRisks);
    document.getElementById('action-status-filter')?.addEventListener('change', filterActions);
    document.getElementById('action-priority-filter')?.addEventListener('change', filterActions);
    document.getElementById('user-search')?.addEventListener('input', filterUsers);
}

function filterRisks() {
    const typeFilter = document.getElementById('risk-type-filter')?.value || '';
    const severityFilter = document.getElementById('risk-severity-filter')?.value || '';
    
    appState.filteredRisks = appState.riskFlags.filter(flag => {
        return (!typeFilter || flag.flag_type === typeFilter) &&
               (!severityFilter || flag.severity === severityFilter);
    });
    
    renderRiskFlags();
}

function filterActions() {
    const statusFilter = document.getElementById('action-status-filter')?.value || '';
    const priorityFilter = document.getElementById('action-priority-filter')?.value || '';
    
    appState.filteredActions = appState.actions.filter(action => {
        return (!statusFilter || action.status === statusFilter) &&
               (!priorityFilter || action.priority === priorityFilter);
    });
    
    renderActions();
}

function filterUsers() {
    const searchTerm = document.getElementById('user-search')?.value.toLowerCase() || '';
    
    appState.filteredUsers = Array.from(new Set(appState.riskFlags.map(f => f.user_id))).filter(userId =>
        userId.toLowerCase().includes(searchTerm)
    );
    
    renderUsers();
}

// ===== ACTIONS =====
async function approveAction(actionId) {
    try {
        const response = await fetch(`${API_BASE}/actions/${actionId}/approve`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Action approved');
            loadDashboardData();
        }
    } catch (error) {
        console.error('Error approving action:', error);
        showError('Failed to approve action');
    }
}

async function executeAction(actionId) {
    try {
        const response = await fetch(`${API_BASE}/actions/${actionId}/execute`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Action executed');
            loadDashboardData();
        }
    } catch (error) {
        console.error('Error executing action:', error);
        showError('Failed to execute action');
    }
}

async function viewUserDetail(userId) {
    try {
        const response = await fetch(`${API_BASE}/users/${userId}`);
        const data = await response.json();
        
        if (data.error) {
            showError('User not found');
            return;
        }
        
        const modal = document.getElementById('user-modal');
        const content = document.getElementById('user-detail-content');
        
        const user = data.user;
        const wallet = data.wallet;
        const campaign = data.campaign;
        
        let html = `
            <h2>${user.name}</h2>
            
            <div class="user-detail-section">
                <h3>Profile Information</h3>
                <div class="detail-row"><span class="detail-label">User ID:</span><span class="detail-value">${user.user_id}</span></div>
                <div class="detail-row"><span class="detail-label">Email:</span><span class="detail-value">${user.email}</span></div>
                <div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value">${user.status}</span></div>
                <div class="detail-row"><span class="detail-label">Country:</span><span class="detail-value">${user.country}</span></div>
                <div class="detail-row"><span class="detail-label">Acquisition Source:</span><span class="detail-value">${user.source}</span></div>
                <div class="detail-row"><span class="detail-label">High-Value Score:</span><span class="detail-value">${user.high_value_score.toFixed(1)}/100</span></div>
                <div class="detail-row"><span class="detail-label">Account Created:</span><span class="detail-value">${new Date(user.creation_date).toLocaleDateString()}</span></div>
                <div class="detail-row"><span class="detail-label">Last Active:</span><span class="detail-value">${new Date(user.last_active).toLocaleDateString()}</span></div>
            </div>
        `;
        
        if (wallet) {
            html += `
                <div class="user-detail-section">
                    <h3>Wallet Information</h3>
                    <div class="detail-row"><span class="detail-label">Blockchain:</span><span class="detail-value">${wallet.blockchain}</span></div>
                    <div class="detail-row"><span class="detail-label">Balance:</span><span class="detail-value">$${wallet.balance_usd.toLocaleString()}</span></div>
                    <div class="detail-row"><span class="detail-label">Transactions:</span><span class="detail-value">${wallet.transaction_count}</span></div>
                    <div class="detail-row"><span class="detail-label">Last Transaction:</span><span class="detail-value">${wallet.last_transaction ? new Date(wallet.last_transaction).toLocaleDateString() : 'N/A'}</span></div>
                </div>
            `;
        }
        
        if (campaign) {
            html += `
                <div class="user-detail-section">
                    <h3>Acquisition Campaign</h3>
                    <div class="detail-row"><span class="detail-label">Campaign:</span><span class="detail-value">${campaign.campaign_name}</span></div>
                    <div class="detail-row"><span class="detail-label">Channel:</span><span class="detail-value">${campaign.channel}</span></div>
                    <div class="detail-row"><span class="detail-label">CPA:</span><span class="detail-value">$${campaign.cpa.toFixed(2)}</span></div>
                </div>
            `;
        }
        
        if (data.risk_flags.length > 0) {
            html += `
                <div class="user-detail-section">
                    <h3>Risk Flags (${data.risk_flags.length})</h3>
                    ${data.risk_flags.map(flag => `
                        <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 6px;">
                            <div style="margin-bottom: 0.5rem;">
                                <strong>${flag.flag_type}</strong>
                                <span class="badge severity-${flag.severity}" style="margin-left: 0.5rem;">${flag.severity}</span>
                            </div>
                            <div style="font-size: 0.9rem; color: var(--text-secondary);">${flag.description}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (data.actions.length > 0) {
            html += `
                <div class="user-detail-section">
                    <h3>Recommended Actions (${data.actions.length})</h3>
                    ${data.actions.map(action => `
                        <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 6px;">
                            <div style="margin-bottom: 0.5rem;">
                                <strong>${action.action_type}</strong>
                                <span class="badge status-${action.status}" style="margin-left: 0.5rem;">${action.status}</span>
                            </div>
                            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">${action.reason}</div>
                            <div style="font-size: 0.85rem; color: var(--primary);">Potential: ${action.estimated_recovery_value}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        content.innerHTML = html;
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Error loading user details:', error);
        showError('Failed to load user details');
    }
}

// ===== HELPERS =====
function getInsightIcon(flagType) {
    const icons = {
        'onboarding_delay': '📝',
        'inactivity': '😴',
        'support_unresolved': '🆘',
        'abandoned': '👋'
    };
    return icons[flagType] || '⚠️';
}

function getScenarioEmoji(type) {
    const emojis = {
        'onboarding_delay': '📝',
        'inactivity': '😴',
        'support_unresolved': '🆘',
        'abandoned': '👋'
    };
    return emojis[type] || '🎯';
}

function showSuccess(message) {
    console.log('✅', message);
    alert(message);
}

function showError(message) {
    console.error('❌', message);
    alert('Error: ' + message);
}

// ===== MODAL CLOSE =====
document.addEventListener('click', (e) => {
    const modal = document.getElementById('user-modal');
    if (e.target === modal || e.target.classList.contains('modal-close')) {
        modal.classList.remove('active');
    }
});
