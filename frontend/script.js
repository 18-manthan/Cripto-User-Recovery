// ===== API BASE URL =====
// Use the same host as this page (run backend with `python main.py` → open http://localhost:8000).
// Override for split hosting: <script>window.RUD_API_BASE='https://your-api.example.com'</script> before this file.
const API_BASE = (typeof window !== 'undefined' && window.RUD_API_BASE)
    ? `${String(window.RUD_API_BASE).replace(/\/$/, '')}/api`
    : `${window.location.origin}/api`;
const AUTH_TOKEN_KEY = 'rud_admin_token';
const CLIENT_AUTH_TOKEN_KEY = 'rud_client_token';

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
let isChatInitialized = false;
let uiMode = 'admin'; // 'admin' | 'client'

// ===== LOGIN (CRYPTO) BACKDROP ANIMATION =====
let authCanvasState = {
    canvas: null,
    ctx: null,
    rafId: 0,
    running: false,
    dpr: 1,
    w: 0,
    h: 0,
    particles: [],
    lastT: 0,
    reducedMotion: false,
};

function prefersReducedMotion() {
    return typeof window !== 'undefined'
        && window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isLoginVisible() {
    const el = document.getElementById('login-screen');
    return Boolean(el && !el.classList.contains('auth-hidden'));
}

function initAuthBackdrop() {
    const canvas = document.getElementById('auth-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    authCanvasState.canvas = canvas;
    authCanvasState.ctx = ctx;
    authCanvasState.reducedMotion = prefersReducedMotion();

    window.addEventListener('resize', resizeAuthBackdrop, { passive: true });
    resizeAuthBackdrop();
    seedAuthParticles();

    if (isLoginVisible()) startAuthBackdrop();
}

function resizeAuthBackdrop() {
    const { canvas } = authCanvasState;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    authCanvasState.dpr = dpr;
    authCanvasState.w = Math.max(1, Math.floor(rect.width));
    authCanvasState.h = Math.max(1, Math.floor(rect.height));

    canvas.width = Math.floor(authCanvasState.w * dpr);
    canvas.height = Math.floor(authCanvasState.h * dpr);
}

function seedAuthParticles() {
    const { w, h } = authCanvasState;
    if (!w || !h) return;

    const area = w * h;
    // Dense "blockchain graph" nodes (no coins).
    const nodeCount = Math.round(clamp(area / 26000, 18, 46));

    const nodes = Array.from({ length: nodeCount }).map(() => ({
        kind: 'node',
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 2.8 + Math.random() * 3.2,
        hue: 185 + Math.random() * 18,
        alpha: 0.62 + Math.random() * 0.28,
    }));
    authCanvasState.particles = nodes;
}

function startAuthBackdrop() {
    if (authCanvasState.running) return;
    authCanvasState.running = true;
    authCanvasState.lastT = performance.now();
    authCanvasState.rafId = requestAnimationFrame(tickAuthBackdrop);
}

function stopAuthBackdrop() {
    authCanvasState.running = false;
    if (authCanvasState.rafId) cancelAnimationFrame(authCanvasState.rafId);
    authCanvasState.rafId = 0;
}

function tickAuthBackdrop(t) {
    if (!authCanvasState.running) return;

    if (!isLoginVisible()) {
        stopAuthBackdrop();
        return;
    }

    const dt = Math.min(40, Math.max(0, t - (authCanvasState.lastT || t)));
    authCanvasState.lastT = t;

    drawAuthBackdrop(dt);

    if (authCanvasState.reducedMotion) {
        stopAuthBackdrop();
        return;
    }

    authCanvasState.rafId = requestAnimationFrame(tickAuthBackdrop);
}

function drawAuthBackdrop(dtMs) {
    const { ctx, w, h, dpr, particles } = authCanvasState;
    if (!ctx || !w || !h) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const dt = dtMs;
    const nodes = particles.filter(p => p.kind === 'node');

    for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const pad = 30;
        if (p.x < -pad) p.x = w + pad;
        if (p.x > w + pad) p.x = -pad;
        if (p.y < -pad) p.y = h + pad;
        if (p.y > h + pad) p.y = -pad;
    }

    const vg = ctx.createRadialGradient(
        w * 0.35, h * 0.25, 10,
        w * 0.5, h * 0.4, Math.max(w, h) * 0.8
    );
    vg.addColorStop(0, 'rgba(20, 241, 149, 0.08)');
    vg.addColorStop(0.45, 'rgba(34, 211, 238, 0.06)');
    vg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    const maxDist = Math.max(170, Math.min(300, Math.min(w, h) * 0.30));
    ctx.lineWidth = 3.5;
    for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d = Math.hypot(dx, dy);
            if (d > maxDist) continue;
            const k = 1 - d / maxDist;
            // Darker + bolder edges (still fades with distance).
            ctx.strokeStyle = `rgba(28, 120, 150, ${0.26 * k})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
    }

    for (const n of nodes) {
        // Bigger nodes with a soft glow ring so the graph reads clearly.
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3.2);
        glow.addColorStop(0, `hsla(${n.hue} 96% 72% / ${Math.min(1, n.alpha + 0.10)})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 3.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `hsla(${n.hue} 96% 74% / ${n.alpha})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ===== LIST PAGINATION (Users / Risks / Actions) =====
const listPagination = {
    risks: { page: 1, pageSize: 10 },
    actions: { page: 1, pageSize: 10 },
    users: { page: 1, pageSize: 10 },
};

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function getPaged(items, key) {
    const cfg = listPagination[key];
    const total = Array.isArray(items) ? items.length : 0;
    const pageSize = clamp(Number(cfg.pageSize) || 10, 5, 100);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = clamp(Number(cfg.page) || 1, 1, totalPages);
    cfg.page = page;
    cfg.pageSize = pageSize;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return { page, pageSize, total, totalPages, items: (items || []).slice(start, end) };
}

function setListPage(key, page) {
    if (!listPagination[key]) return;
    listPagination[key].page = page;
    if (key === 'risks') renderRiskFlags();
    else if (key === 'actions') renderActions();
    else if (key === 'users') renderUsers();
}

function setListPageSize(key, pageSize) {
    if (!listPagination[key]) return;
    listPagination[key].pageSize = pageSize;
    listPagination[key].page = 1;
    setListPage(key, 1);
}

function resetListPage(key) {
    if (!listPagination[key]) return;
    listPagination[key].page = 1;
}

function renderListPagination({ key, mountId, total, page, totalPages, pageSize }) {
    const mount = document.getElementById(mountId);
    if (!mount) return;
    if (!total) {
        mount.innerHTML = '';
        return;
    }

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    const sizeOptions = [10, 25, 50, 100];
    mount.innerHTML = `
        <div class="list-pagination-inner">
            <div class="list-pagination-info">
                Showing <strong>${start}-${end}</strong> of <strong>${total}</strong>
            </div>
            <div class="list-pagination-controls">
                <button class="list-pagination-btn" type="button"
                    onclick="setListPage('${key}', 1)" ${page <= 1 ? 'disabled' : ''}>First</button>
                <button class="list-pagination-btn" type="button"
                    onclick="setListPage('${key}', ${page - 1})" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
                <span class="list-pagination-page">Page <strong>${page}</strong> / ${totalPages}</span>
                <button class="list-pagination-btn" type="button"
                    onclick="setListPage('${key}', ${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Next →</button>
                <button class="list-pagination-btn" type="button"
                    onclick="setListPage('${key}', ${totalPages})" ${page >= totalPages ? 'disabled' : ''}>Last</button>
                <label class="list-pagination-size">
                    <span>Rows</span>
                    <select class="list-pagination-select" onchange="setListPageSize('${key}', this.value)">
                        ${sizeOptions
                            .map((n) => `<option value="${n}" ${Number(pageSize) === n ? 'selected' : ''}>${n}</option>`)
                            .join('')}
                    </select>
                </label>
            </div>
        </div>
    `;
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Demo Dashboard loading...');

    setupAuth();
    setupClientAuth();
    setupNavigation();
    setupFilters();
    setupChatInterface();
    initAuthBackdrop();

    if (isClientAuthenticated()) {
        showClientApp();
        renderPortfolio();
    } else if (isAuthenticated()) {
        showApp();
        await initializeApp();
    } else {
        showLogin();
    }
});

function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function isAuthenticated() {
    return Boolean(getAuthToken());
}

function showLogin(errorMessage = '') {
    document.getElementById('login-screen')?.classList.remove('auth-hidden');
    document.getElementById('app-shell')?.classList.add('app-hidden');
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.textContent = errorMessage;
    setLoginMode('admin');
    if (authCanvasState.canvas) startAuthBackdrop();
}

function showApp() {
    uiMode = 'admin';
    document.getElementById('login-screen')?.classList.add('auth-hidden');
    document.getElementById('app-shell')?.classList.remove('app-hidden');
    stopAuthBackdrop();

    // Restore admin navigation visibility.
    document.querySelectorAll('.nav-item').forEach((item) => {
        if (item.dataset.section === 'portfolio' || item.dataset.section === 'integrations') item.style.display = 'none';
        else item.style.display = '';
    });

    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    document.getElementById('overview')?.classList.add('active');

    // Ensure header widgets are visible on default admin landing (Overview).
    const statsSection = document.getElementById('stats-section');
    const healthStatus = document.querySelector('.health-status');
    if (statsSection) statsSection.style.display = '';
    if (healthStatus) healthStatus.style.display = '';

    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    document.querySelector('.nav-item[data-section="overview"]')?.classList.add('active');
}

function clearSession() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
}

function setupAuth() {
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');

    loginForm?.addEventListener('submit', handleLogin);
    logoutBtn?.addEventListener('click', handleLogout);
}

async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('login-email')?.value.trim() || '';
    const password = document.getElementById('login-password')?.value || '';
    const errorEl = document.getElementById('login-error');
    const submitBtn = event.currentTarget.querySelector('button[type="submit"]');

    if (errorEl) errorEl.textContent = '';
    if (submitBtn) submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (!response.ok || !data.success || !data.token) {
            throw new Error(data.error || 'Login failed');
        }

        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        showApp();
        await initializeApp();
    } catch (error) {
        if (errorEl) errorEl.textContent = error.message || 'Login failed';
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function handleLogout() {
    localStorage.removeItem(CLIENT_AUTH_TOKEN_KEY);
    clearSession();
    showLogin();
}

function getClientAuthToken() {
    return localStorage.getItem(CLIENT_AUTH_TOKEN_KEY) || '';
}

function isClientAuthenticated() {
    return Boolean(getClientAuthToken());
}

function setLoginMode(mode) {
    const adminBtn = document.getElementById('login-as-admin');
    const clientBtn = document.getElementById('login-as-client');
    const adminForm = document.getElementById('login-form');
    const clientForm = document.getElementById('client-login-form');
    const clientErrorEl = document.getElementById('client-login-error');

    if (!adminBtn || !clientBtn || !adminForm || !clientForm) return;

    if (clientErrorEl) clientErrorEl.textContent = '';

    if (mode === 'client') {
        adminBtn.classList.remove('active');
        clientBtn.classList.add('active');
        adminForm.style.display = 'none';
        clientForm.style.display = '';
        clientBtn.setAttribute('aria-selected', 'true');
        adminBtn.setAttribute('aria-selected', 'false');
    } else {
        clientBtn.classList.remove('active');
        adminBtn.classList.add('active');
        clientForm.style.display = 'none';
        adminForm.style.display = '';
        adminBtn.setAttribute('aria-selected', 'true');
        clientBtn.setAttribute('aria-selected', 'false');
    }
}

function showClientApp() {
    uiMode = 'client';
    document.getElementById('login-screen')?.classList.add('auth-hidden');
    document.getElementById('app-shell')?.classList.remove('app-hidden');
    stopAuthBackdrop();

    // Client demo mode does not load backend dashboard stats/health.
    // Remove the initial "Initializing..." UI so it doesn't look stuck.
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');
    indicator?.classList.remove('loading');
    indicator?.classList.add('healthy');
    if (text) text.textContent = 'Client Demo Ready';

    // Hide top header widgets (stats grid + health banner) in client mode.
    hideTopHeaderWidgets();

    // Show only client nav items (Portfolio + Integrations).
    document.querySelectorAll('.nav-item').forEach((item) => {
        if (item.dataset.section === 'portfolio' || item.dataset.section === 'integrations') item.style.display = '';
        else item.style.display = 'none';
    });

    // Activate default portfolio panel.
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    document.getElementById('portfolio')?.classList.add('active');

    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    document.querySelector('.nav-item[data-section="portfolio"]')?.classList.add('active');
}

function setupClientAuth() {
    const clientForm = document.getElementById('client-login-form');
    const clientErrorEl = document.getElementById('client-login-error');
    const loginAsAdminBtn = document.getElementById('login-as-admin');
    const loginAsClientBtn = document.getElementById('login-as-client');

    loginAsAdminBtn?.addEventListener('click', () => setLoginMode('admin'));
    loginAsClientBtn?.addEventListener('click', () => setLoginMode('client'));

    clientForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        if (clientErrorEl) clientErrorEl.textContent = '';

        const email = document.getElementById('client-login-email')?.value.trim() || '';
        const password = document.getElementById('client-login-password')?.value || '';

        // Demo-only client auth (no backend).
        if (email === 'client@demo.com' && password === 'demo') {
            localStorage.setItem(CLIENT_AUTH_TOKEN_KEY, String(Math.random()).slice(2));
            setLoginMode('client');
            showClientApp();
            renderPortfolio();
        } else {
            if (clientErrorEl) clientErrorEl.textContent = 'Invalid client credentials. Use client@demo.com / demo.';
        }
    });
}

async function initializeApp() {
    await loadDashboardData();
    renderOverview();
    updateHealthStatus();
}

async function apiFetch(url, options = {}) {
    const headers = {
        ...(options.headers || {})
    };

    const token = getAuthToken();
    if (token) {
        headers['X-Auth-Token'] = token;
    }

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        clearSession();
        showLogin('Your session has ended. Please sign in again.');
        throw new Error('Unauthorized');
    }

    return response;
}

// ===== NAVIGATION =====
function setupNavigation() {
    function applyHeaderVisibilityForSection(section) {
        const statsSection = document.getElementById('stats-section');
        const healthStatus = document.querySelector('.health-status');

        // Client mode: keep header widgets hidden for a cleaner demo experience.
        if (uiMode === 'client') {
            if (statsSection) statsSection.style.display = 'none';
            if (healthStatus) healthStatus.style.display = 'none';
            return;
        }

        // Hide top header widgets only on the Users screen (cleaner UX for profile browsing).
        if (section === 'users') {
            if (statsSection) statsSection.style.display = 'none';
            if (healthStatus) healthStatus.style.display = 'none';
        } else {
            if (statsSection) statsSection.style.display = '';
            if (healthStatus) healthStatus.style.display = '';
        }
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            
            item.classList.add('active');
            const section = item.dataset.section;
            document.getElementById(section).classList.add('active');

            applyHeaderVisibilityForSection(section);
            
            // Render section content
            if (section === 'overview') renderOverview();
            else if (section === 'risks') renderRiskFlags();
            else if (section === 'actions') renderActions();
            else if (section === 'scenarios') renderScenarios();
            else if (section === 'users') renderUsers();
            else if (section === 'portfolio') renderPortfolio();
            else if (section === 'integrations') renderIntegrations();
            else if (section === 'chat') renderChat();
        });
    });
}

function renderIntegrations() {
    // Client-only panel, but harmless in admin too.
    hideTopHeaderWidgets();
    renderConnectorSyncLog();
    renderConnectorsDemo();
}

// Render chat panel when switched to
function renderChat() {
    // Chat interface is already rendered in HTML, just set up event listeners
    const chatInput = document.getElementById('chat-input');
    if (chatInput && chatInput.value === '') {
        chatInput.focus();
    }
}

// ===== DATA LOADING =====
async function loadDashboardData() {
    try {
        // Avoid leaving widgets in their initial "loading" state forever.
        appState.stats = appState.stats || {
            total_users: 0,
            total_risk_flags: 0,
            total_actions: 0,
            total_recovery_potential: 0,
            avg_recovery_value_per_action: 0,
            user_status_breakdown: {},
            risk_severity_breakdown: {},
            action_status_breakdown: {},
        };
        appState.riskFlags = appState.riskFlags || [];
        appState.filteredRisks = appState.filteredRisks || appState.riskFlags;
        appState.actions = appState.actions || [];
        appState.filteredActions = appState.filteredActions || appState.actions;
        appState.scenarios = appState.scenarios || {};

        renderStats();

        // Load all data in parallel
        const [statsRes, risksRes, actionsRes, scenariosRes] = await Promise.all([
            apiFetch(`${API_BASE}/dashboard/stats`),
            apiFetch(`${API_BASE}/risk-flags?limit=1000`),
            apiFetch(`${API_BASE}/actions?limit=1000`),
            apiFetch(`${API_BASE}/scenarios`)
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
        appState.stats = appState.stats || {
            total_users: 0,
            total_risk_flags: 0,
            total_actions: 0,
            total_recovery_potential: 0,
            avg_recovery_value_per_action: 0,
            user_status_breakdown: {},
            risk_severity_breakdown: {},
            action_status_breakdown: {},
        };
        appState.riskFlags = [];
        appState.filteredRisks = [];
        appState.actions = [];
        appState.filteredActions = [];
        appState.scenarios = {};
        renderStats();
    }
}

function loadUsers() {
    // Demo: derive user ids from available events
    const uniqueUsers = new Set();
    appState.riskFlags.forEach(flag => uniqueUsers.add(flag.user_id));
    appState.actions.forEach(action => uniqueUsers.add(action.user_id));
    appState.users = Array.from(uniqueUsers);
    appState.filteredUsers = Array.from(uniqueUsers);
    resetListPage('users');
}

async function updateHealthStatus() {
    try {
        const response = await apiFetch(`${API_BASE}/health`);
        const data = await response.json();
        
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');
        
        indicator.classList.remove('loading');
        indicator.classList.add('healthy');
        text.textContent = 'System Ready';
        
    } catch (error) {
        console.error('Health check failed:', error);
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');
        indicator?.classList.remove('loading');
        indicator?.classList.add('healthy');
        if (text) text.textContent = 'System Ready (demo)';
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
    showTopHeaderWidgets();
    renderUserStatusChart();
    renderSeverityChart();
    renderRecoveryMetrics();
    renderActionSummary();
}

function hideTopHeaderWidgets() {
    const statsSection = document.getElementById('stats-section');
    const healthStatus = document.querySelector('.health-status');
    if (statsSection) statsSection.style.display = 'none';
    if (healthStatus) healthStatus.style.display = 'none';
}

function showTopHeaderWidgets() {
    const statsSection = document.getElementById('stats-section');
    const healthStatus = document.querySelector('.health-status');
    if (statsSection) statsSection.style.display = '';
    if (healthStatus) healthStatus.style.display = '';
}

function renderUserStatusChart() {
    const container = document.getElementById('user-status-chart');
    const data = appState.stats?.user_status_breakdown || {};
    
    let html = '<div style="padding: 1rem;">';
    for (const [status, count] of Object.entries(data)) {
        const percentage = (count / appState.stats.total_users * 100).toFixed(1);
        html += `
            <div style="margin-bottom: 1.5rem;">
                <div style="display: grid; grid-template-columns: 150px 1fr 120px; gap: 1rem; align-items: center; margin-bottom: 0.7rem;">
                    <span style="text-transform: capitalize; font-weight: 600; color: var(--primary);">${status}</span>
                    <div style="height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${percentage}%; background: var(--primary); border-radius: 4px; box-shadow: 0 0 8px rgba(0, 255, 65, 0.4);"></div>
                    </div>
                    <span style="text-align: right; font-weight: 600; color: var(--text-secondary);">${count} (${percentage}%)</span>
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
        critical: '#ff0040',
        high: '#ff006e',
        medium: '#00d9ff',
        low: '#00ff41'
    };
    
    let html = '<div style="padding: 1rem;">';
    for (const severity of severityOrder) {
        const count = data[severity] || 0;
        const total = appState.stats.total_risk_flags;
        const percentage = total > 0 ? (count / total * 100).toFixed(1) : 0;
        
        html += `
            <div style="margin-bottom: 1.5rem;">
                <div style="display: grid; grid-template-columns: 100px 1fr 120px; gap: 1rem; align-items: center; margin-bottom: 0.7rem;">
                    <span style="text-transform: capitalize; font-weight: 600; color: ${colorMap[severity]};">${severity}</span>
                    <div style="height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${percentage}%; background: ${colorMap[severity]}; border-radius: 4px; box-shadow: 0 0 8px ${colorMap[severity]}40;"></div>
                    </div>
                    <span style="text-align: right; font-weight: 600; color: var(--text-secondary);">${count} flags</span>
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
    showTopHeaderWidgets();
    const container = document.getElementById('risk-flags-list');
    const paginationMountId = 'risk-flags-pagination';
    
    if (appState.filteredRisks.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div>No risk flags found</div>';
        document.getElementById(paginationMountId).innerHTML = '';
        return;
    }
    
    const paged = getPaged(appState.filteredRisks, 'risks');
    container.innerHTML = paged.items.map(flag => `
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

    renderListPagination({
        key: 'risks',
        mountId: paginationMountId,
        total: paged.total,
        page: paged.page,
        totalPages: paged.totalPages,
        pageSize: paged.pageSize,
    });
}

// ===== ACTIONS RENDERING =====
function renderActions() {
    showTopHeaderWidgets();
    const container = document.getElementById('actions-list');
    const paginationMountId = 'actions-pagination';
    
    if (appState.filteredActions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div>No actions found</div>';
        document.getElementById(paginationMountId).innerHTML = '';
        return;
    }
    
    const paged = getPaged(appState.filteredActions, 'actions');
    container.innerHTML = paged.items.map(action => `
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

    renderListPagination({
        key: 'actions',
        mountId: paginationMountId,
        total: paged.total,
        page: paged.page,
        totalPages: paged.totalPages,
        pageSize: paged.pageSize,
    });
}

// ===== SCENARIOS RENDERING =====
function renderScenarios() {
    showTopHeaderWidgets();
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
let inlineExpandedUserId = null;
const inlineUserProfileCache = {};

function safeDomId(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildUserProfileInlineHtml(data) {
    const user = data.user || {};
    const wallet = data.wallet || null;

    const escape = (t) => escapeHtml(String(t ?? ''));

    let html = `
        <div class="user-profile-inline-sections">
            <div class="user-profile-inline-title">
                ${escapeHtml(user.name || user.id || 'User')}
            </div>
            
            <div class="user-detail-section">
                <h3>Profile</h3>
                <div class="detail-row"><span class="detail-label">User ID:</span><span class="detail-value">${escapeHtml(user.id || '')}</span></div>
                <div class="detail-row"><span class="detail-label">Email:</span><span class="detail-value">${escapeHtml(user.email || '')}</span></div>
                <div class="detail-row"><span class="detail-label">Lifecycle Stage:</span><span class="detail-value">${escapeHtml(user.lifecycle_stage || '')}</span></div>
                <div class="detail-row"><span class="detail-label">Country:</span><span class="detail-value">${escapeHtml(user.country || '')}</span></div>
                <div class="detail-row"><span class="detail-label">Acquisition Source:</span><span class="detail-value">${escapeHtml(user.acquisition_source || '')}</span></div>
                <div class="detail-row"><span class="detail-label">Estimated LTV:</span><span class="detail-value">$${Number(user.estimated_ltv || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                <div class="detail-row"><span class="detail-label">Last Active:</span><span class="detail-value">${user.last_activity_at ? escapeHtml(new Date(user.last_activity_at).toLocaleDateString()) : 'N/A'}</span></div>
            </div>
    `;

    if (wallet) {
        html += `
            <div class="user-detail-section">
                <h3>Wallet</h3>
                <div class="detail-row"><span class="detail-label">Blockchain:</span><span class="detail-value">${escapeHtml(wallet.blockchain || '')}</span></div>
                <div class="detail-row"><span class="detail-label">Balance:</span><span class="detail-value">$${wallet.balance_usd ? escapeHtml(Number(wallet.balance_usd).toLocaleString()) : '0'}</span></div>
                <div class="detail-row"><span class="detail-label">Activity Score:</span><span class="detail-value">${Number(wallet.activity_score || 0).toFixed(1)}/100</span></div>
                <div class="detail-row"><span class="detail-label">Transactions:</span><span class="detail-value">${wallet.transaction_count || 0}</span></div>
                <div class="detail-row"><span class="detail-label">Wallet Age:</span><span class="detail-value">${wallet.wallet_age_days || 0} days</span></div>
            </div>
        `;
    }

    const tickets = Array.isArray(data.tickets) ? data.tickets : [];
    const riskFlags = Array.isArray(data.risk_flags) ? data.risk_flags : [];
    const actions = Array.isArray(data.recovery_actions) ? data.recovery_actions : [];

    if (tickets.length) {
        html += `
            <div class="user-detail-section">
                <h3>Support Tickets (${tickets.length})</h3>
                ${tickets.map((ticket) => `
                    <div style="margin-bottom: 0.9rem; padding: 0.85rem; background: var(--bg-alt); border-radius: 6px;">
                        <div style="margin-bottom: 0.5rem;">
                            <strong>${escapeHtml(ticket.subject || '')}</strong>
                            <span class="badge status-${escapeHtml(ticket.status || '')}" style="margin-left: 0.5rem;">${escapeHtml(ticket.status || '')}</span>
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">
                            Category: ${escapeHtml(ticket.category || '')} | Priority: ${escapeHtml(ticket.priority || '')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    if (riskFlags.length) {
        html += `
            <div class="user-detail-section">
                <h3>Risk Flags (${riskFlags.length})</h3>
                ${riskFlags.map((flag) => `
                    <div style="margin-bottom: 0.9rem; padding: 0.85rem; background: var(--bg-alt); border-radius: 6px;">
                        <div style="margin-bottom: 0.5rem;">
                            <strong>${escapeHtml(flag.type || '')}</strong>
                            <span class="badge severity-${escapeHtml(flag.severity || '')}" style="margin-left: 0.5rem;">${escapeHtml(flag.severity || '')}</span>
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">${escapeHtml(flag.description || '')}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    if (actions.length) {
        html += `
            <div class="user-detail-section">
                <h3>Recovery Actions (${actions.length})</h3>
                ${actions.map((action) => `
                    <div style="margin-bottom: 0.9rem; padding: 0.85rem; background: var(--bg-alt); border-radius: 6px;">
                        <div style="margin-bottom: 0.5rem;">
                            <strong>${escapeHtml(action.type || '')}</strong>
                            <span class="badge status-${escapeHtml(action.status || '')}" style="margin-left: 0.5rem;">${escapeHtml(action.status || '')}</span>
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                            Recovery Value: $${Number(action.recovery_value || 0).toLocaleString()}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    html += `</div>`;
    return html;
}

async function toggleInlineUserProfile(userId) {
    if (inlineExpandedUserId === userId) {
        inlineExpandedUserId = null;
        renderUsers();
        return;
    }

    inlineExpandedUserId = userId;
    renderUsers();

    const panel = document.getElementById(`user-profile-inline-${safeDomId(userId)}`);
    if (panel) panel.innerHTML = `<div class="loading-inline">Loading profile...</div>`;

    if (inlineUserProfileCache[userId]) {
        if (panel) panel.innerHTML = inlineUserProfileCache[userId];
        return;
    }

    try {
        const response = await apiFetch(`${API_BASE}/users/${userId}`);
        if (response.error) throw new Error(response.error || 'User not found');

        const html = buildUserProfileInlineHtml(response);
        inlineUserProfileCache[userId] = html;
        if (panel) panel.innerHTML = html;
    } catch (error) {
        console.error('Error loading inline user profile:', error);
        if (panel) panel.innerHTML = `<div class="empty-state">Could not load profile.</div>`;
    }
}

function renderUsers() {
    hideTopHeaderWidgets();
    const container = document.getElementById('users-list');
    const paginationMountId = 'users-pagination';
    
    if (appState.filteredUsers.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div>No users found</div>';
        document.getElementById(paginationMountId).innerHTML = '';
        return;
    }
    
    const paged = getPaged(appState.filteredUsers, 'users');
    container.innerHTML = paged.items.map(userId => {
        const risks = appState.riskFlags.filter(f => f.user_id === userId);
        const actions = appState.actions.filter(a => a.user_id === userId);
        const expanded = inlineExpandedUserId === userId;
        
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
                    <button class="${expanded ? 'btn-secondary' : 'btn-primary'}" onclick="toggleInlineUserProfile('${userId}')">
                        ${expanded ? 'Hide Profile' : 'Open Profile'}
                    </button>
                </div>

                <div
                    id="user-profile-inline-${safeDomId(userId)}"
                    class="user-profile-inline"
                    style="display:${expanded ? 'block' : 'none'};"
                ></div>
            </div>
        `;
    }).join('');

    renderListPagination({
        key: 'users',
        mountId: paginationMountId,
        total: paged.total,
        page: paged.page,
        totalPages: paged.totalPages,
        pageSize: paged.pageSize,
    });
}

// ===== CLIENT PORTFOLIO (demo-only UI) =====
const CLIENT_TRACKED_COINS_KEY = 'rud_client_tracked_coins';
// Always-tracked platform coin (must exist in CLIENT_COIN_LIBRARY + CLIENT_DEMO_HOLDINGS)
const PORTFOLIO_PLATFORM_COIN = 'RGCIS';

function getTrackedCoins() {
    try {
        const raw = localStorage.getItem(CLIENT_TRACKED_COINS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!Array.isArray(parsed)) throw new Error('bad');
        const known = new Set(getKnownClientCoinSymbols());
        const clean = parsed
            .map((c) => String(c))
            .filter(Boolean)
            .filter((sym) => known.has(sym));
        if (!clean.includes(PORTFOLIO_PLATFORM_COIN)) clean.unshift(PORTFOLIO_PLATFORM_COIN);
        return Array.from(new Set(clean));
    } catch (e) {
        return [PORTFOLIO_PLATFORM_COIN, 'BTC', 'ETH', 'USDC'];
    }
}

function setTrackedCoins(coins) {
    const known = new Set(getKnownClientCoinSymbols());
    const withPlatform = Array.from(
        new Set([PORTFOLIO_PLATFORM_COIN, ...(coins || [])].map((c) => String(c)).filter((sym) => known.has(sym)))
    );
    localStorage.setItem(CLIENT_TRACKED_COINS_KEY, JSON.stringify(withPlatform));
}

const CLIENT_COIN_LIBRARY = [
    { symbol: 'RGCIS', name: 'RGCIS Recovery Coin', color: '#14f195' },
    { symbol: 'BTC', name: 'Bitcoin', color: '#fbbf24' },
    { symbol: 'ETH', name: 'Ethereum', color: '#8be8f6' },
    { symbol: 'SOL', name: 'Solana', color: '#34d399' },
    { symbol: 'USDC', name: 'USD Coin', color: '#60a5fa' },
    { symbol: 'LINK', name: 'Chainlink', color: '#a78bfa' },
];

function getKnownClientCoinSymbols() {
    return CLIENT_COIN_LIBRARY.map((c) => c.symbol);
}

const CLIENT_DEMO_HOLDINGS = [
    { symbol: 'RGCIS', qty: 1200, avgPrice: 1.20, currentPrice: 1.65, change24h: 4.3 },
    { symbol: 'BTC', qty: 0.42, avgPrice: 56000, currentPrice: 64500, change24h: -0.7 },
    { symbol: 'ETH', qty: 18.7, avgPrice: 2800, currentPrice: 3230, change24h: 1.9 },
    { symbol: 'USDC', qty: 25000, avgPrice: 1.0, currentPrice: 1.0, change24h: 0.0 },
    { symbol: 'SOL', qty: 640, avgPrice: 120, currentPrice: 135, change24h: 3.1 },
    { symbol: 'LINK', qty: 2200, avgPrice: 12.4, currentPrice: 15.1, change24h: -1.4 },
];

const CLIENT_PORTFOLIO_HOLDINGS_KEY = 'rud_client_portfolio_holdings';
const CLIENT_BOTS_KEY = 'rud_client_bots';
const CLIENT_BOT_EVENTS_KEY = 'rud_client_bot_events';
const CLIENT_BOT_FORM_ASSETS_KEY = 'rud_client_bot_form_assets';

let clientBotIntervals = {}; // botId -> intervalId
let clientBotExpandedPanels = {}; // botId -> boolean
let clientBotsRestored = false;
let clientBotUiBound = false;
let clientBotEditingId = null;

function resetClientDemo() {
    const ok = confirm('Reset demo data? This will restore the original portfolio holdings and clear bots + bot activity + connector logs.');
    if (!ok) return;

    Object.values(clientBotIntervals).forEach((intervalId) => {
        try {
            clearInterval(intervalId);
        } catch (e) {
            // ignore
        }
    });

    clientBotIntervals = {};
    clientBotExpandedPanels = {};
    clientBotsRestored = false;
    clientBotEditingId = null;

    localStorage.removeItem(CLIENT_PORTFOLIO_HOLDINGS_KEY);
    localStorage.removeItem(CLIENT_BOTS_KEY);
    localStorage.removeItem(CLIENT_BOT_EVENTS_KEY);
    localStorage.removeItem(CLIENT_BOT_FORM_ASSETS_KEY);
    localStorage.removeItem(CLIENT_CONNECTOR_STATE_KEY);
    localStorage.removeItem(CLIENT_CONNECTOR_SYNC_LOG_KEY);

    renderPortfolio();
    renderBotsUI();
    renderBotActivityUI();
    renderConnectorsDemo();
    renderConnectorSyncLog();
}

// ===== Connectors (Demo-only UI) =====
const CLIENT_CONNECTOR_STATE_KEY = 'rud_client_connectors';
const CLIENT_CONNECTOR_SYNC_LOG_KEY = 'rud_client_connector_sync_log';
const CLIENT_CONNECTORS = [
    {
        id: 'coinbase',
        name: 'Coinbase',
        description: 'Connect exchange account (demo only).',
        placeholder: 'Paste API key (demo)'
    },
    {
        id: 'yahoo',
        name: 'Yahoo Finance',
        description: 'Pull market price snapshots (demo only).',
        placeholder: 'Paste API key (demo)'
    },
    {
        id: 'etherscan',
        name: 'Etherscan / Block Explorer',
        description: 'Enrich wallet activity (demo only).',
        placeholder: 'Paste API key (demo)'
    },
];

function getConnectorSyncLog() {
    try {
        const raw = localStorage.getItem(CLIENT_CONNECTOR_SYNC_LOG_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed)) return parsed;
    } catch (e) {
        // ignore
    }
    const empty = [];
    localStorage.setItem(CLIENT_CONNECTOR_SYNC_LOG_KEY, JSON.stringify(empty));
    return empty;
}

function setConnectorSyncLog(log) {
    localStorage.setItem(CLIENT_CONNECTOR_SYNC_LOG_KEY, JSON.stringify(log || []));
}

function appendConnectorSyncLogItem(item) {
    const log = getConnectorSyncLog();
    log.push(item);
    const trimmed = log.slice(Math.max(0, log.length - 40));
    setConnectorSyncLog(trimmed);
}

function clearConnectorSyncLog() {
    setConnectorSyncLog([]);
    renderConnectorSyncLog();
}

function renderConnectorSyncLog() {
    const mount = document.getElementById('connector-sync-log');
    const subtitle = document.getElementById('connector-sync-subtitle');
    if (!mount) return;

    const log = getConnectorSyncLog().slice().reverse();
    if (!log.length) {
        mount.innerHTML = `
            <div class="connector-sync-item">
                <div class="connector-sync-item-body">No sync runs yet. Click “Sync all (demo)” or run sync on a connector.</div>
            </div>
        `;
        if (subtitle) subtitle.textContent = 'Connect a provider, then run a demo sync.';
        return;
    }

    if (subtitle) {
        const last = log[0]?.time ? new Date(log[0].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        subtitle.textContent = last ? `Last sync run: ${last}` : 'Sync runs are recorded below.';
    }

    mount.innerHTML = log.map((item) => {
        const t = item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return `
            <div class="connector-sync-item">
                <div class="connector-sync-item-top">
                    <div class="connector-sync-item-title">${escapeHtml(item.title || 'Sync run')}</div>
                    <div class="connector-sync-item-meta">${escapeHtml(t)}</div>
                </div>
                <div class="connector-sync-item-body">${escapeHtml(item.body || '')}</div>
            </div>
        `;
    }).join('');
}

function applyDemoPriceRefreshFromConnector(intensity = 'medium') {
    // Make Yahoo sync feel tangible by refreshing prices + 24h changes.
    const holdings = getClientPortfolioHoldings();
    const symbols = holdings.map((h) => h.symbol);
    simulateMarketPrices(holdings, symbols, intensity);
    setClientPortfolioHoldings(holdings);
}

function runConnectorSync(connectorId) {
    const connector = CLIENT_CONNECTORS.find((c) => c.id === connectorId);
    if (!connector) return;

    const state = getClientConnectorState();
    const s = state[connectorId] || { connected: false };
    if (!s.connected) {
        alert(`Please connect ${connector.name} first (demo).`);
        return;
    }

    // Mock results for storytelling.
    const now = new Date().toISOString();
    const results = (() => {
        if (connectorId === 'yahoo') {
            applyDemoPriceRefreshFromConnector('medium');
            return {
                title: `Synced ${connector.name}`,
                body: `Fetched ${60 + Math.floor(Math.random() * 80)} market price snapshots. Updated portfolio pricing + 24h change view (demo).`
            };
        }
        if (connectorId === 'coinbase') {
            return {
                title: `Synced ${connector.name}`,
                body: `Imported ${1 + Math.floor(Math.random() * 3)} exchange account(s), ${2 + Math.floor(Math.random() * 5)} wallet(s), and ${120 + Math.floor(Math.random() * 280)} transactions (demo).`
            };
        }
        if (connectorId === 'etherscan') {
            return {
                title: `Synced ${connector.name}`,
                body: `Enriched ${20 + Math.floor(Math.random() * 80)} on-chain events and flagged ${1 + Math.floor(Math.random() * 5)} anomalies for review (demo).`
            };
        }
        return {
            title: `Synced ${connector.name}`,
            body: `Sync completed successfully (demo).`
        };
    })();

    state[connectorId] = { ...s, lastSyncAt: now };
    setClientConnectorState(state);

    appendConnectorSyncLogItem({ time: now, title: results.title, body: results.body, connectorId });
    renderConnectorSyncLog();
    renderConnectorsDemo();
    // If we updated prices, refresh portfolio view when user returns.
    renderPortfolio();
}

function runAllConnectorSync() {
    const state = getClientConnectorState();
    const connected = CLIENT_CONNECTORS.filter((c) => state[c.id]?.connected);
    if (!connected.length) {
        alert('Connect at least one provider first (demo).');
        return;
    }
    connected.forEach((c) => runConnectorSync(c.id));
}

function getClientConnectorState() {
    try {
        const raw = localStorage.getItem(CLIENT_CONNECTOR_STATE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {
        // ignore
    }
    const empty = {};
    localStorage.setItem(CLIENT_CONNECTOR_STATE_KEY, JSON.stringify(empty));
    return empty;
}

function setClientConnectorState(state) {
    localStorage.setItem(CLIENT_CONNECTOR_STATE_KEY, JSON.stringify(state || {}));
}

function toggleClientDemoConnector(connectorId) {
    const connector = CLIENT_CONNECTORS.find((c) => c.id === connectorId);
    if (!connector) return;

    const state = getClientConnectorState();
    const current = state[connectorId] || { connected: false };

    if (current.connected) {
        state[connectorId] = { ...current, connected: false };
        setClientConnectorState(state);
        renderConnectorSyncLog();
        renderConnectorsDemo();
        return;
    }

    const input = document.getElementById(`connector-input-${connectorId}`);
    const apiKey = input?.value ? String(input.value).trim() : '';
    if (!apiKey) {
        alert(`Please enter an API key for ${connector.name} (demo).`);
        return;
    }

    state[connectorId] = {
        connected: true,
        apiKey,
        connectedAt: new Date().toISOString(),
        lastSyncAt: null
    };
    setClientConnectorState(state);
    renderConnectorSyncLog();
    renderConnectorsDemo();
}

function renderConnectorsDemo() {
    const mount = document.getElementById('portfolio-connectors-list');
    if (!mount) return;

    const state = getClientConnectorState();
    mount.innerHTML = CLIENT_CONNECTORS.map((c) => {
        const s = state[c.id] || { connected: false, apiKey: '' };
        const connected = !!s.connected;
        const statusText = connected ? 'Connected (demo)' : 'Not connected';
        const statusClass = connected ? 'connector-status-pill--connected' : '';
        const btnText = connected ? 'Disconnect' : 'Connect';
        const btnClass = connected ? 'btn-secondary' : 'btn-primary';
        const connectedAt = s.connectedAt ? new Date(s.connectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const lastSyncAt = s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        return `
            <div class="connector-card">
                <div class="connector-row">
                    <div style="min-width: 220px;">
                        <h4 style="margin:0 0 0.35rem 0;">${escapeHtml(c.name)}</h4>
                        <div style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.3;">${escapeHtml(c.description)}</div>
                    </div>
                    <div>
                        <div class="connector-status-pill ${statusClass}">
                            ${escapeHtml(statusText)}${connectedAt ? ` · ${escapeHtml(connectedAt)}` : ''}
                        </div>
                    </div>
                </div>

                <div class="connector-row" style="margin-top: 0.75rem;">
                    <div class="connector-input">
                        <input
                            id="connector-input-${c.id}"
                            type="password"
                            placeholder="${escapeHtml(c.placeholder)}"
                            value="${escapeHtml(s.apiKey || '')}"
                            ${connected ? 'disabled' : ''}
                        />
                    </div>
                    <div class="connector-btn-row">
                        <button type="button" class="${btnClass}" onclick="toggleClientDemoConnector('${c.id}')">${btnText}</button>
                        <button type="button" class="btn-secondary" onclick="runConnectorSync('${c.id}')" ${connected ? '' : 'disabled'}>Sync now</button>
                    </div>
                </div>

                <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.6rem;">
                    Demo note: connector wiring is UI only; data is still simulated.${lastSyncAt ? ` Last sync: ${escapeHtml(lastSyncAt)}` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function getClientPortfolioHoldings() {
    try {
        const raw = localStorage.getItem(CLIENT_PORTFOLIO_HOLDINGS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                const known = new Set(getKnownClientCoinSymbols());
                const normalized = parsed
                    .filter((h) => h && known.has(h.symbol))
                    .map((h) => {
                        const priceNow = Number(h.currentPrice || 0);
                        if (h.price24hAgo === undefined || h.price24hAgo === null) {
                            const change = Number(h.change24h || 0);
                            const denom = 1 + (change / 100);
                            const base = denom !== 0 ? priceNow / denom : priceNow;
                            return { ...h, price24hAgo: base };
                        }
                        return h;
                    });
                // Persist normalized fields so future reads are consistent.
                setClientPortfolioHoldings(normalized);
                return normalized;
            }
        }
    } catch (e) {
        // ignore
    }
    const known = new Set(getKnownClientCoinSymbols());
    const seeded = CLIENT_DEMO_HOLDINGS.filter((h) => known.has(h.symbol)).map((h) => {
        const priceNow = Number(h.currentPrice || 0);
        const change = Number(h.change24h || 0);
        const denom = 1 + (change / 100);
        const base = denom !== 0 ? priceNow / denom : priceNow;
        return { ...h, price24hAgo: base };
    });
    localStorage.setItem(CLIENT_PORTFOLIO_HOLDINGS_KEY, JSON.stringify(seeded));
    return seeded;
}

function setClientPortfolioHoldings(holdings) {
    localStorage.setItem(CLIENT_PORTFOLIO_HOLDINGS_KEY, JSON.stringify(holdings || []));
}

function getClientBotState() {
    try {
        const raw = localStorage.getItem(CLIENT_BOTS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return normalizeBots(parsed);
        }
    } catch (e) {
        // ignore
    }
    const empty = [];
    localStorage.setItem(CLIENT_BOTS_KEY, JSON.stringify(empty));
    return empty;
}

function setClientBotState(bots) {
    localStorage.setItem(CLIENT_BOTS_KEY, JSON.stringify(bots || []));
}

function normalizeBots(bots) {
    const cleaned = (bots || []).filter(Boolean).map((b) => {
        const id = b.id || generateId('bot');
        const createdAt = b.createdAt || new Date().toISOString();
        const status = b.status || b.state || 'draft';
        const state = ['draft', 'running', 'paused', 'stopped'].includes(status) ? status : 'stopped';

        return {
            id,
            name: String(b.name || 'Bot'),
            // USDC is treated as cash; exclude it from tradable assets.
            assets: Array.isArray(b.assets) ? b.assets.filter((s) => String(s) !== 'USDC') : [],
            mode: b.mode || 'both',
            strategy: b.strategy || 'both',
            intensity: b.intensity || 'medium',
            tradeSizeMode: b.tradeSizeMode || 'fixed_usd',
            tradeSizeValue: Number(b.tradeSizeValue || 500),
            intervalMs: Number(b.intervalMs || (b.intensity === 'high' ? 5000 : b.intensity === 'low' ? 30000 : 10000)),
            minUsdc: Number(b.minUsdc ?? 250),
            maxExposurePct: Number(b.maxExposurePct ?? 45),
            state,
            createdAt,
            lastEventAt: b.lastEventAt || null,
            stats: b.stats && typeof b.stats === 'object'
                ? b.stats
                : { trades: 0, realizedPnlUsd: 0, wins: 0, losses: 0 },
            positions: b.positions && typeof b.positions === 'object' ? b.positions : {}, // symbol -> { qty, avgCost }
        };
    });

    // Persist normalized state so it stays consistent.
    setClientBotState(cleaned);
    return cleaned;
}

function getClientBotEvents() {
    try {
        const raw = localStorage.getItem(CLIENT_BOT_EVENTS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        // ignore
    }
    const empty = [];
    localStorage.setItem(CLIENT_BOT_EVENTS_KEY, JSON.stringify(empty));
    return empty;
}

function setClientBotEvents(events) {
    localStorage.setItem(CLIENT_BOT_EVENTS_KEY, JSON.stringify(events || []));
}

function generateId(prefix) {
    return `${prefix}_${Date.now()}_${String(Math.random()).slice(2, 8)}`;
}

function formatUSD(n) {
    const num = Number(n || 0);
    return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatSignedUSD(n) {
    const num = Number(n || 0);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function renderPortfolio() {
    const holdingsTbody = document.getElementById('portfolio-holdings-tbody');
    const trackList = document.getElementById('portfolio-track-list');
    const summaryEl = document.getElementById('portfolio-summary');
    const tipsEl = document.getElementById('portfolio-track-tips');

    if (!holdingsTbody || !trackList || !summaryEl) return;

    const trackedCoins = getTrackedCoins();
    const trackedSet = new Set(trackedCoins);

    const holdingsState = getClientPortfolioHoldings();
    const holdings = holdingsState.map((h) => {
        const value = h.qty * h.currentPrice;
        const tracked = trackedSet.has(h.symbol);
        return { ...h, value, tracked };
    }).sort((a, b) => b.value - a.value);

    const totalValue = holdings.reduce((s, h) => s + h.value, 0);
    const trackedValue = holdings.filter((h) => h.tracked).reduce((s, h) => s + h.value, 0);
    const trackedCount = trackedCoins.length;

    summaryEl.innerHTML = `
        <div class="portfolio-summary-grid">
            <div class="portfolio-summary-item">
                <div class="portfolio-summary-label">Total Portfolio Value</div>
                <div class="portfolio-summary-value">${formatUSD(totalValue)}</div>
            </div>
            <div class="portfolio-summary-item">
                <div class="portfolio-summary-label">Tracked Value</div>
                <div class="portfolio-summary-value">${formatUSD(trackedValue)}</div>
            </div>
            <div class="portfolio-summary-item">
                <div class="portfolio-summary-label">Coins Tracked</div>
                <div class="portfolio-summary-value">${trackedCount}</div>
            </div>
        </div>
    `;

    holdingsTbody.innerHTML = holdings.map((h) => {
        const coin = CLIENT_COIN_LIBRARY.find((c) => c.symbol === h.symbol);
        const badge = h.tracked
            ? `<span class="coin-pill coin-pill--tracked" style="border-color:${coin?.color || '#14f195'};">Tracked</span>`
            : `<span class="coin-pill coin-pill--nottracked">Watch</span>`;
        const changeClass = h.change24h > 0 ? 'pos' : h.change24h < 0 ? 'neg' : 'flat';
        const changeText = `${h.change24h > 0 ? '+' : ''}${h.change24h.toFixed(2)}%`;
        return `
            <tr>
                <td>
                    <div class="portfolio-coin-cell">
                        <span class="coin-dot" style="background:${coin?.color || '#8be8f6'}"></span>
                        <span class="portfolio-coin-symbol">${h.symbol}</span>
                        ${badge}
                    </div>
                </td>
                <td>${typeof h.qty === 'number' ? h.qty.toLocaleString(undefined, { maximumFractionDigits: 6 }) : h.qty}</td>
                <td>${formatUSD(h.currentPrice)}</td>
                <td><strong>${formatUSD(h.value)}</strong></td>
                <td class="portfolio-change ${changeClass}">${changeText}</td>
            </tr>
        `;
    }).join('');

    if (tipsEl) {
        tipsEl.innerHTML = `<p class="portfolio-note">Platform coin <strong>${PORTFOLIO_PLATFORM_COIN}</strong> is always tracked. Toggle others to change what you highlight in the dashboard.</p>`;
    }

    trackList.innerHTML = CLIENT_COIN_LIBRARY.map((coin) => {
        const isPlatform = coin.symbol === PORTFOLIO_PLATFORM_COIN;
        const checked = trackedSet.has(coin.symbol);
        return `
            <label class="portfolio-coin-track">
                <input
                    type="checkbox"
                    ${checked ? 'checked' : ''}
                    ${isPlatform ? 'disabled' : ''}
                    onchange="onPortfolioTrackToggle('${coin.symbol}', this.checked)"
                />
                <span class="portfolio-coin-track-label">
                    <span class="coin-dot" style="background:${coin.color};"></span>
                    ${coin.symbol} <span class="portfolio-coin-track-name">(${coin.name})</span>
                </span>
            </label>
        `;
    }).join('');

    // Keep bot form in sync with tracked coins.
    renderBotAssetsSelector(trackedCoins);
    renderBotsUI();
    renderBotActivityUI();
    restoreRunningBotsFromStorage();
    renderConnectorsDemo();

    if (!clientBotUiBound) {
        clientBotUiBound = true;
        document.getElementById('bot-create-btn')?.addEventListener('click', () => createClientBotFromForm());
        document.getElementById('bot-simulate-one-btn')?.addEventListener('click', () => simulateBotOneCyclePreview());
        document.getElementById('bot-cancel-edit-btn')?.addEventListener('click', () => cancelBotEdit());
    }
}

function onPortfolioTrackToggle(symbol, checked) {
    const tracked = getTrackedCoins();
    const set = new Set(tracked);
    if (symbol === PORTFOLIO_PLATFORM_COIN) return; // always tracked
    if (checked) set.add(symbol);
    else set.delete(symbol);
    setTrackedCoins(Array.from(set));
    renderPortfolio();
}

function getBotFormAssetsSelection() {
    const raw = localStorage.getItem(CLIENT_BOT_FORM_ASSETS_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
    } catch (e) {
        // ignore
    }
    return [];
}

function setBotFormAssetsSelection(coins) {
    localStorage.setItem(CLIENT_BOT_FORM_ASSETS_KEY, JSON.stringify(coins || []));
}

function onBotAssetToggle(symbol, checked) {
    const selected = new Set(getBotFormAssetsSelection());
    if (checked) selected.add(String(symbol));
    else selected.delete(String(symbol));
    setBotFormAssetsSelection(Array.from(selected));
}

function renderBotAssetsSelector(trackedCoins) {
    const container = document.getElementById('bot-assets-select');
    if (!container) return;

    // USDC is treated as cash; hide it from tradable assets.
    const coins = Array.from(new Set((trackedCoins || []).map((c) => String(c)).filter(Boolean))).filter((c) => c !== 'USDC');
    const stored = new Set(getBotFormAssetsSelection());
    // Default: select all tracked coins when nothing stored yet.
    if (stored.size === 0) coins.forEach((c) => stored.add(c));

    container.innerHTML = coins
        .sort((a, b) => (a === PORTFOLIO_PLATFORM_COIN ? -1 : 1) - (b === PORTFOLIO_PLATFORM_COIN ? -1 : 1))
        .map((symbol) => {
            const coin = CLIENT_COIN_LIBRARY.find((c) => c.symbol === symbol);
            const checked = stored.has(symbol);
            return `
                <label class="portfolio-coin-track">
                    <input
                        type="checkbox"
                        ${checked ? 'checked' : ''}
                        onchange="onBotAssetToggle('${symbol}', this.checked)"
                    />
                    <span class="portfolio-coin-track-label">
                        <span class="coin-dot" style="background:${coin?.color || '#8be8f6'}"></span>
                        ${symbol} <span class="portfolio-coin-track-name">(${coin?.name || 'Asset'})</span>
                    </span>
                </label>
            `;
        })
        .join('');

    setBotFormAssetsSelection(coins.filter((c) => stored.has(c)));
}

function getClientHoldingsBySymbol(holdings, symbol) {
    return holdings.find((h) => h.symbol === symbol);
}

function intensityToIntervalMs(intensity) {
    if (intensity === 'low') return 5000;
    if (intensity === 'high') return 1500;
    return 2500; // medium
}

function intensityToUsd(intensity) {
    if (intensity === 'low') return 250;
    if (intensity === 'high') return 1000;
    return 500; // medium
}

function intensityToVolMultiplier(intensity) {
    if (intensity === 'low') return 0.75;
    if (intensity === 'high') return 1.45;
    return 1; // medium
}

const PRICE_VOL_BY_SYMBOL = {
    // Volatility per bot tick (demo-only; not real time units).
    RGCIS: 0.025,
    BTC: 0.0045,
    ETH: 0.008,
    SOL: 0.018,
    USDC: 0.00025,
    LINK: 0.014
};

function clampPrice(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

function randn() {
    // Box–Muller transform (approx normal distribution).
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function simulateMarketPrices(holdings, symbolsToUpdate, intensity) {
    const set = new Set(symbolsToUpdate || []);
    const volMult = intensityToVolMultiplier(intensity);

    holdings.forEach((h) => {
        if (!set.has(h.symbol)) return;

        const priceNow = Number(h.currentPrice || 0);
        if (!priceNow || priceNow <= 0) return;

        // Baseline price used to recompute "24h change".
        if (h.price24hAgo === undefined || h.price24hAgo === null) {
            h.price24hAgo = priceNow;
        }

        const baseVol = PRICE_VOL_BY_SYMBOL[h.symbol] ?? 0.01;
        const vol = baseVol * volMult;

        // Small drift + random shock.
        const drift = (Math.random() - 0.5) * vol * 0.35;
        const shock = randn() * vol * 0.75;
        let newPrice = priceNow * (1 + drift + shock);

        if (h.symbol === 'USDC') {
            newPrice = clampPrice(newPrice, 0.993, 1.007);
        } else {
            newPrice = Math.max(newPrice, priceNow * 0.7); // avoid extreme drops in demo
            newPrice = Math.min(newPrice, priceNow * 1.45); // avoid extreme pumps in demo
        }

        h.currentPrice = newPrice;
        const baseline = Number(h.price24hAgo || priceNow);
        const changePct = baseline ? ((newPrice / baseline) - 1) * 100 : 0;
        h.change24h = Number.isFinite(changePct) ? changePct : 0;
    });

    return holdings;
}

function chooseAction(bot, holding) {
    const mode = bot.mode;
    if (mode === 'buy') return 'buy';
    if (mode === 'sell') return 'sell';

    // DCA: consistent buy-side accumulation (demo expectation).
    if (bot.strategy === 'dca') return 'buy';

    // "Both" strategy means Threshold or DCA (demo-only).
    const effectiveStrategy = bot.strategy === 'both'
        ? (Math.random() < 0.5 ? 'threshold' : 'dca')
        : bot.strategy;

    if (effectiveStrategy === 'threshold') {
        // Threshold-like behavior: follow the demo 24h direction.
        return (holding?.change24h || 0) >= 0 ? 'buy' : 'sell';
    }

    if (effectiveStrategy === 'dca') {
        return 'buy';
    }

    // Optional momentum strategy (kept for demo flexibility).
    if (effectiveStrategy === 'momentum') {
        return (holding?.change24h || 0) >= 0 ? 'buy' : 'sell';
    }

    return Math.random() < 0.5 ? 'buy' : 'sell';
}

function buildReason(bot, action, symbol, holding) {
    const ch = Number(holding?.change24h || 0);
    const chText = `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`;
    const strategy = bot.strategy || 'both';
    if (strategy === 'threshold') {
        return `${action.toUpperCase()} ${symbol} — Threshold (${chText})`;
    }
    if (strategy === 'dca') {
        return `${action.toUpperCase()} ${symbol} — DCA scheduled buy`;
    }
    if (strategy === 'momentum') {
        return `${action.toUpperCase()} ${symbol} — Momentum bias (${chText})`;
    }
    return `${action.toUpperCase()} ${symbol} — Mixed strategy (${chText})`;
}

function appendClientBotEvent(event) {
    const events = getClientBotEvents();
    events.push(event);
    // Keep last 200 events.
    const trimmed = events.slice(Math.max(0, events.length - 200));
    setClientBotEvents(trimmed);
}

function renderBotsUI() {
    const mount = document.getElementById('portfolio-bots-list');
    if (!mount) return;
    const bots = getClientBotState();

    if (bots.length === 0) {
        mount.innerHTML = `
            <div class="empty-state" style="padding: 1rem;">
                <div class="empty-state-icon">🤖</div>
                No bots created yet.
            </div>
        `;
        return;
    }

    mount.innerHTML = bots
        .slice()
        .sort((a, b) => (b.lastEventAt || b.createdAt).localeCompare(a.lastEventAt || a.createdAt))
        .map((bot) => {
            const expanded = !!clientBotExpandedPanels[bot.id];
            const assetsCount = Array.isArray(bot.assets) ? bot.assets.length : 0;
            const state = bot.state || bot.status || 'stopped';
            const statusPill = state === 'running'
                ? '<span class="portfolio-bot-pill portfolio-bot-pill--running">Running</span>'
                : state === 'paused'
                    ? '<span class="portfolio-bot-pill portfolio-bot-pill--stopped">Paused</span>'
                    : state === 'draft'
                        ? '<span class="portfolio-bot-pill portfolio-bot-pill--stopped">Draft</span>'
                        : '<span class="portfolio-bot-pill portfolio-bot-pill--stopped">Stopped</span>';
            const modeLabel = bot.mode === 'both' ? 'Buy/Sell' : bot.mode.charAt(0).toUpperCase() + bot.mode.slice(1);
            const strategyLabel = bot.strategy === 'both'
                ? 'Both (Threshold / DCA)'
                : bot.strategy === 'dca'
                    ? 'DCA'
                    : bot.strategy === 'threshold'
                        ? 'Threshold'
                        : bot.strategy.charAt(0).toUpperCase() + bot.strategy.slice(1);
            const intensityLabel = bot.intensity ? bot.intensity.charAt(0).toUpperCase() + bot.intensity.slice(1) : 'Medium';
            const last = bot.lastEventAt ? new Date(bot.lastEventAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
            const trades = Number(bot.stats?.trades || 0);
            const pnl = Number(bot.stats?.realizedPnlUsd || 0);
            return `
                <div class="portfolio-bot-card">
                    <h5>${escapeHtml(bot.name || 'Bot')} ${statusPill}</h5>
                    <div class="portfolio-bot-meta">
                        Mode: <strong>${escapeHtml(modeLabel)}</strong> · Strategy: <strong>${escapeHtml(strategyLabel)}</strong> · Intensity: <strong>${escapeHtml(intensityLabel)}</strong>
                        <div style="margin-top: 0.35rem; color: var(--text-secondary);">
                            Assets: <strong>${assetsCount}</strong> · Trades: <strong>${trades}</strong> · Realized P/L: <strong>${formatSignedUSD(pnl)}</strong> · Last: <strong>${escapeHtml(String(last))}</strong>
                        </div>
                    </div>
                    <div class="portfolio-bot-actions">
                        ${
                            state === 'running'
                                ? `<button type="button" class="btn-secondary" onclick="pauseClientBot('${bot.id}')">Pause</button>
                                   <button type="button" class="btn-secondary" onclick="stopClientBot('${bot.id}')">Stop</button>`
                                : `<button type="button" class="btn-primary" onclick="startClientBot('${bot.id}')">Start</button>`
                        }
                        <button type="button" class="btn-secondary" onclick="toggleClientBotActivityPanel('${bot.id}')">
                            ${expanded ? 'Hide' : 'Open'} Activity
                        </button>
                        <button type="button" class="btn-secondary" onclick="beginEditClientBot('${bot.id}')">Edit</button>
                        <button type="button" class="btn-secondary" onclick="cloneClientBot('${bot.id}')">Clone</button>
                        <button type="button" class="btn-danger" onclick="deleteClientBot('${bot.id}')">Delete</button>
                    </div>

                    <div class="portfolio-bot-panel-activity" id="portfolio-bot-activity-panel-${bot.id}" style="display:${expanded ? 'block' : 'none'};">
                        ${expanded ? renderClientBotActivityItems(getClientBotEventsForBot(bot.id)) : ''}
                    </div>
                </div>
            `;
        })
        .join('');
}

function renderBotActivityUI() {
    const mount = document.getElementById('portfolio-bot-activity');
    if (!mount) return;
    const events = getClientBotEvents();
    if (!events.length) {
        mount.innerHTML = `
            <div class="portfolio-bot-activity-item">
                No bot activity yet. Start a bot or click “Simulate One Cycle”.
            </div>
        `;
        return;
    }

    const recent = events.slice().reverse().slice(0, 12);
    mount.innerHTML = recent.map((e) => {
        const sign = e.qtyDelta > 0 ? '+' : '';
        const type = e.type ? String(e.type).toUpperCase() : 'TRADE';
        return `
            <div class="portfolio-bot-activity-item">
                <div class="portfolio-bot-activity-top">
                    <div><span class="portfolio-bot-activity-type">${escapeHtml(type)}</span> · <strong>${escapeHtml(e.symbol)}</strong></div>
                    <div style="color: var(--text-secondary); font-size: 0.85rem;">${escapeHtml(
                        new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    )}</div>
                </div>
                <div style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4;">
                    Bot: <strong>${escapeHtml(e.botName)}</strong><br/>
                    Qty Δ: <strong>${sign}${Number(e.qtyDelta).toLocaleString(undefined, { maximumFractionDigits: 6 })}</strong> @ ${formatUSD(e.price)}<br/>
                    USD impact: <strong>${formatSignedUSD(e.usdValue)}</strong><br/>
                    ${e.reason ? `Reason: ${escapeHtml(e.reason)}` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function getClientBotEventsForBot(botId, limit = 8) {
    const events = getClientBotEvents().filter((e) => e.botId === botId);
    // Show newest first.
    return events.slice().reverse().slice(0, limit);
}

function renderClientBotActivityItems(events) {
    if (!events || events.length === 0) {
        return `
            <div class="portfolio-bot-activity-item">
                No bot activity yet.
            </div>
        `;
    }

    return events.map((e) => {
        const sign = e.qtyDelta > 0 ? '+' : '';
        const type = e.type ? String(e.type).toUpperCase() : 'TRADE';
        return `
            <div class="portfolio-bot-activity-item">
                <div class="portfolio-bot-activity-top">
                    <div><span class="portfolio-bot-activity-type">${escapeHtml(type)}</span> · <strong>${escapeHtml(e.symbol)}</strong></div>
                    <div style="color: var(--text-secondary); font-size: 0.85rem;">${escapeHtml(
                        new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    )}</div>
                </div>
                <div style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4;">
                    Bot: <strong>${escapeHtml(e.botName)}</strong><br/>
                    Qty Δ: <strong>${sign}${Number(e.qtyDelta).toLocaleString(undefined, { maximumFractionDigits: 6 })}</strong> @ ${formatUSD(e.price)}<br/>
                    USD impact: <strong>${formatSignedUSD(e.usdValue)}</strong><br/>
                    ${e.reason ? `Reason: ${escapeHtml(e.reason)}` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function updateClientBotActivityPanel(botId) {
    const panel = document.getElementById(`portfolio-bot-activity-panel-${botId}`);
    if (!panel) return;
    panel.innerHTML = renderClientBotActivityItems(getClientBotEventsForBot(botId));
}

function toggleClientBotActivityPanel(botId) {
    clientBotExpandedPanels[botId] = !clientBotExpandedPanels[botId];
    renderBotsUI(); // re-render for button text + visibility state
    if (clientBotExpandedPanels[botId]) {
        updateClientBotActivityPanel(botId);
    }
}

function deleteClientBot(botId) {
    const bots = getClientBotState();
    const bot = bots.find((b) => b.id === botId);
    const name = bot?.name || 'bot';

    const ok = confirm(`Delete "${name}"? This will stop the demo bot and remove its activity from the UI.`);
    if (!ok) return;

    if (clientBotIntervals[botId]) {
        clearInterval(clientBotIntervals[botId]);
        delete clientBotIntervals[botId];
    }

    // Remove bot + its events; keep holdings as-is (demo effect remains).
    const remainingBots = bots.filter((b) => b.id !== botId);
    setClientBotState(remainingBots);

    const remainingEvents = getClientBotEvents().filter((e) => e.botId !== botId);
    setClientBotEvents(remainingEvents);

    delete clientBotExpandedPanels[botId];

    renderBotsUI();
    renderBotActivityUI();
    renderPortfolio();
}

function restoreRunningBotsFromStorage() {
    if (clientBotsRestored) return;
    clientBotsRestored = true;

    const bots = getClientBotState();
    bots.forEach((bot) => {
        if ((bot.state || bot.status) === 'running') {
            startClientBot(bot.id, true);
        }
    });
}

function startClientBot(botId, silent = false) {
    const bots = getClientBotState();
    const bot = bots.find((b) => b.id === botId);
    if (!bot) return;

    if (bot.state !== 'running') {
        bot.state = 'running';
        setClientBotState(bots);
    }

    if (!silent) {
        simulateBotTick(botId);
        // Make sure the activity pane updates even if portfolio re-render is skipped.
        renderBotActivityUI();
    }

    if (clientBotIntervals[botId]) return;
    const intervalMs = Number(bot.intervalMs || 10000);
    clientBotIntervals[botId] = setInterval(() => simulateBotTick(botId), intervalMs);
    renderBotsUI();
}

function pauseClientBot(botId) {
    const bots = getClientBotState();
    const bot = bots.find((b) => b.id === botId);
    if (!bot) return;

    bot.state = 'paused';
    setClientBotState(bots);

    if (clientBotIntervals[botId]) {
        clearInterval(clientBotIntervals[botId]);
        delete clientBotIntervals[botId];
    }
    renderBotsUI();
}

function stopClientBot(botId) {
    const bots = getClientBotState();
    const bot = bots.find((b) => b.id === botId);
    if (!bot) return;

    bot.state = 'stopped';
    setClientBotState(bots);

    if (clientBotIntervals[botId]) {
        clearInterval(clientBotIntervals[botId]);
        delete clientBotIntervals[botId];
    }
    renderBotsUI();
}

function simulateBotTick(botId) {
    const bots = getClientBotState();
    const bot = bots.find((b) => b.id === botId);
    if (!bot || bot.state !== 'running') return;

    const holdings = getClientPortfolioHoldings();
    const trackedCoins = getTrackedCoins();
    const assets = Array.isArray(bot.assets) && bot.assets.length > 0 ? bot.assets : trackedCoins;
    const holdingsSymbols = new Set(holdings.map((h) => h.symbol));
    const actionableSymbols = assets.filter((s) => holdingsSymbols.has(s));
    if (!actionableSymbols.length) return;

    // Update market prices first, so decisions look live.
    simulateMarketPrices(holdings, actionableSymbols, bot.intensity);

    const symbol = actionableSymbols[Math.floor(Math.random() * actionableSymbols.length)];
    if (symbol === 'USDC') return; // USDC is cash; not tradable
    const holding = getClientHoldingsBySymbol(holdings, symbol);
    if (!holding) return;

    const action = chooseAction(bot, holding);
    const currentPrice = Number(holding.currentPrice || 0);
    if (!currentPrice || currentPrice <= 0) return;

    // Demo fees + slippage for realism.
    const feePercent = bot.intensity === 'high' ? 0.004 : bot.intensity === 'low' ? 0.0025 : 0.003;
    const slipPct = bot.intensity === 'high' ? 0.0015 : bot.intensity === 'low' ? 0.0008 : 0.001;
    const effectivePrice = action === 'buy'
        ? currentPrice * (1 + slipPct)
        : currentPrice * (1 - slipPct);

    // Cash is USDC (demo realism).
    const usdc = getClientHoldingsBySymbol(holdings, 'USDC');
    const usdcQty = Number(usdc?.qty || 0);
    const minUsdc = Number(bot.minUsdc ?? 250);

    // Trade sizing.
    const tradeSizeMode = bot.tradeSizeMode || 'fixed_usd';
    const tradeSizeValue = Number(bot.tradeSizeValue || 500);
    const percent = clamp(tradeSizeValue, 1, 100) / 100;

    let usdTarget = 0;
    if (tradeSizeMode === 'percent') {
        usdTarget = action === 'buy'
            ? usdcQty * percent
            : Number(holding.qty || 0) * effectivePrice * percent;
    } else {
        usdTarget = Math.max(1, tradeSizeValue);
    }

    // Guards (min balance and max exposure).
    const totalValue = holdings.reduce((s, h) => s + Number(h.qty || 0) * Number(h.currentPrice || 0), 0);
    const maxExposurePct = clamp(Number(bot.maxExposurePct ?? 45), 5, 100) / 100;
    const holdingValue = Number(holding.qty || 0) * Number(holding.currentPrice || 0);
    const maxAllowed = totalValue * maxExposurePct;

    if (action === 'buy') {
        if (usdcQty < minUsdc) {
            appendClientBotEvent({
                id: generateId('evt'),
                botId,
                botName: bot.name || 'Bot',
                time: new Date().toISOString(),
                type: 'skip',
                symbol,
                qtyDelta: 0,
                price: effectivePrice,
                usdValue: 0,
                reason: `SKIP — USDC below minimum (${formatUSD(usdcQty)} < ${formatUSD(minUsdc)})`,
            });
            renderBotActivityUI();
            return;
        }
        if (holdingValue >= maxAllowed) {
            appendClientBotEvent({
                id: generateId('evt'),
                botId,
                botName: bot.name || 'Bot',
                time: new Date().toISOString(),
                type: 'skip',
                symbol,
                qtyDelta: 0,
                price: effectivePrice,
                usdValue: 0,
                reason: `SKIP — max exposure reached for ${symbol} (${formatUSD(holdingValue)} ≥ ${formatUSD(maxAllowed)})`,
            });
            renderBotActivityUI();
            return;
        }
        usdTarget = Math.min(usdTarget, Math.max(0, usdcQty - minUsdc));
        if (usdTarget <= 1) {
            appendClientBotEvent({
                id: generateId('evt'),
                botId,
                botName: bot.name || 'Bot',
                time: new Date().toISOString(),
                type: 'skip',
                symbol,
                qtyDelta: 0,
                price: effectivePrice,
                usdValue: 0,
                reason: `SKIP — not enough free USDC after minimum balance`,
            });
            renderBotActivityUI();
            return;
        }
    }

    let qtyDelta = 0;
    let usdImpactSigned = 0;
    if (action === 'buy') {
        const qtyToBuy = usdTarget / effectivePrice;
        const qtyAfterFee = qtyToBuy * (1 - feePercent);
        qtyDelta = qtyAfterFee;
        holding.qty = Number(holding.qty || 0) + qtyDelta;
        if (usdc) usdc.qty = Math.max(0, usdcQty - usdTarget);
        usdImpactSigned = usdTarget; // BUY spend (demo)

        // Update bot virtual position cost basis.
        const pos = bot.positions?.[symbol] || { qty: 0, avgCost: 0 };
        const prevQty = Number(pos.qty || 0);
        const newQty = prevQty + qtyDelta;
        const prevCost = prevQty * Number(pos.avgCost || 0);
        const addCost = qtyDelta * effectivePrice;
        bot.positions = bot.positions || {};
        bot.positions[symbol] = { qty: newQty, avgCost: newQty > 0 ? (prevCost + addCost) / newQty : 0 };
    } else {
        const sellable = Number(holding.qty || 0);
        const qtyDesired = usdTarget / effectivePrice;
        const sellQty = Math.min(sellable, qtyDesired);
        if (sellQty <= 0) return;
        qtyDelta = -sellQty;
        holding.qty = Math.max(0, sellable - sellQty);
        const usdReceived = sellQty * effectivePrice * (1 - feePercent);
        if (usdc) usdc.qty = usdcQty + usdReceived;
        usdImpactSigned = -usdReceived; // SELL impact

        // Realized P/L for demo analytics using virtual avg cost.
        const pos = bot.positions?.[symbol] || { qty: 0, avgCost: effectivePrice };
        const avgCost = Number(pos.avgCost || effectivePrice);
        const realized = (effectivePrice - avgCost) * sellQty;
        bot.stats = bot.stats || { trades: 0, realizedPnlUsd: 0, wins: 0, losses: 0 };
        bot.stats.realizedPnlUsd = Number(bot.stats.realizedPnlUsd || 0) + realized;
        if (realized >= 0) bot.stats.wins = Number(bot.stats.wins || 0) + 1;
        else bot.stats.losses = Number(bot.stats.losses || 0) + 1;
        // Reduce virtual position qty.
        const remainingQty = Math.max(0, Number(pos.qty || 0) - sellQty);
        bot.positions = bot.positions || {};
        bot.positions[symbol] = { qty: remainingQty, avgCost: remainingQty > 0 ? avgCost : 0 };
    }

    bot.stats = bot.stats || { trades: 0, realizedPnlUsd: 0, wins: 0, losses: 0 };
    bot.stats.trades = Number(bot.stats.trades || 0) + 1;

    setClientPortfolioHoldings(holdings);

    const event = {
        id: generateId('evt'),
        botId,
        botName: bot.name || 'Bot',
        time: new Date().toISOString(),
        type: action,
        symbol,
        qtyDelta,
        price: effectivePrice,
        usdValue: usdImpactSigned,
        reason: buildReason(bot, action, symbol, holding),
    };
    appendClientBotEvent(event);

    bot.lastEventAt = event.time;
    setClientBotState(bots);

    if (clientBotExpandedPanels[botId]) {
        updateClientBotActivityPanel(botId);
    }

    renderBotActivityUI();
    renderPortfolio();
}

function getBotConfigFromForm() {
    const name = (document.getElementById('bot-name')?.value || 'Your Friend').trim() || 'Your Friend';
    const mode = document.getElementById('bot-mode')?.value || 'both';
    const strategy = document.getElementById('bot-strategy')?.value || 'both';
    const intensity = document.getElementById('bot-intensity')?.value || 'medium';
    const tradeSizeMode = document.getElementById('bot-trade-size-mode')?.value || 'fixed_usd';
    const tradeSizeValue = Number(document.getElementById('bot-trade-size')?.value || 500);
    const intervalMs = Number(document.getElementById('bot-interval')?.value || 10000);
    const minUsdc = Number(document.getElementById('bot-min-usdc')?.value || 250);
    const maxExposurePct = Number(document.getElementById('bot-max-exposure')?.value || 45);

    const selectedAssets = getBotFormAssetsSelection();
    return { name, mode, strategy, intensity, tradeSizeMode, tradeSizeValue, intervalMs, minUsdc, maxExposurePct, assets: selectedAssets };
}

function createClientBotFromForm() {
    const cfg = getBotConfigFromForm();
    if (!cfg.assets || cfg.assets.length === 0) {
        alert('Please select at least one asset from the tracked list.');
        return;
    }
    const bots = getClientBotState();
    const now = new Date().toISOString();

    if (clientBotEditingId) {
        const bot = bots.find((b) => b.id === clientBotEditingId);
        if (!bot) {
            clientBotEditingId = null;
        } else if (bot.state === 'running') {
            alert('Pause/Stop the bot before editing.');
            return;
        } else {
            Object.assign(bot, {
                name: cfg.name,
                assets: cfg.assets,
                mode: cfg.mode,
                strategy: cfg.strategy,
                intensity: cfg.intensity,
                tradeSizeMode: cfg.tradeSizeMode,
                tradeSizeValue: cfg.tradeSizeValue,
                intervalMs: cfg.intervalMs,
                minUsdc: cfg.minUsdc,
                maxExposurePct: cfg.maxExposurePct,
            });
            setClientBotState(bots);
            finishBotEditMode();
            renderBotsUI();
            renderBotActivityUI();
            return;
        }
    }

    const newBot = {
        id: generateId('bot'),
        name: cfg.name,
        assets: cfg.assets,
        mode: cfg.mode,
        strategy: cfg.strategy,
        intensity: cfg.intensity,
        tradeSizeMode: cfg.tradeSizeMode,
        tradeSizeValue: cfg.tradeSizeValue,
        intervalMs: cfg.intervalMs,
        minUsdc: cfg.minUsdc,
        maxExposurePct: cfg.maxExposurePct,
        state: 'draft',
        createdAt: now,
        lastEventAt: null,
        stats: { trades: 0, realizedPnlUsd: 0, wins: 0, losses: 0 },
        positions: {},
    };
    bots.push(newBot);
    setClientBotState(bots);
    renderBotsUI();
    renderBotActivityUI();
}

function beginEditClientBot(botId) {
    const bots = getClientBotState();
    const bot = bots.find((b) => b.id === botId);
    if (!bot) return;
    if (bot.state === 'running') {
        alert('Pause/Stop the bot before editing.');
        return;
    }
    clientBotEditingId = botId;

    document.getElementById('bot-name').value = bot.name || '';
    document.getElementById('bot-mode').value = bot.mode || 'both';
    document.getElementById('bot-strategy').value = bot.strategy || 'both';
    document.getElementById('bot-intensity').value = bot.intensity || 'medium';
    document.getElementById('bot-trade-size-mode').value = bot.tradeSizeMode || 'fixed_usd';
    document.getElementById('bot-trade-size').value = String(Number(bot.tradeSizeValue || 500));
    document.getElementById('bot-interval').value = String(Number(bot.intervalMs || 10000));
    document.getElementById('bot-min-usdc').value = String(Number(bot.minUsdc ?? 250));
    document.getElementById('bot-max-exposure').value = String(Number(bot.maxExposurePct ?? 45));

    // Assets selection
    setBotFormAssetsSelection(Array.isArray(bot.assets) ? bot.assets : []);
    renderBotAssetsSelector(getTrackedCoins());

    const createBtn = document.getElementById('bot-create-btn');
    const cancelBtn = document.getElementById('bot-cancel-edit-btn');
    if (createBtn) createBtn.textContent = 'Save Bot';
    if (cancelBtn) cancelBtn.style.display = '';
}

function finishBotEditMode() {
    clientBotEditingId = null;
    const createBtn = document.getElementById('bot-create-btn');
    const cancelBtn = document.getElementById('bot-cancel-edit-btn');
    if (createBtn) createBtn.textContent = 'Create Bot';
    if (cancelBtn) cancelBtn.style.display = 'none';
}

function cancelBotEdit() {
    finishBotEditMode();
    // Keep assets selector consistent.
    renderBotAssetsSelector(getTrackedCoins());
}

function cloneClientBot(botId) {
    const bots = getClientBotState();
    const bot = bots.find((b) => b.id === botId);
    if (!bot) return;
    const copy = JSON.parse(JSON.stringify(bot));
    copy.id = generateId('bot');
    copy.name = `${bot.name || 'Bot'} (copy)`;
    copy.state = 'draft';
    copy.createdAt = new Date().toISOString();
    copy.lastEventAt = null;
    copy.stats = { trades: 0, realizedPnlUsd: 0, wins: 0, losses: 0 };
    copy.positions = {};
    bots.push(copy);
    setClientBotState(bots);
    renderBotsUI();
}

function simulateBotOneCyclePreview() {
    const cfg = getBotConfigFromForm();
    if (!cfg.assets || cfg.assets.length === 0) {
        alert('Please select at least one asset from the tracked list.');
        return;
    }

    const holdings = getClientPortfolioHoldings();
    const holdingsSymbols = new Set(holdings.map((h) => h.symbol));
    const actionableSymbols = (cfg.assets || []).filter((s) => holdingsSymbols.has(s));
    if (!actionableSymbols.length) return;

    // Update market prices first for realism.
    simulateMarketPrices(holdings, actionableSymbols, cfg.intensity);

    const symbol = actionableSymbols[Math.floor(Math.random() * actionableSymbols.length)];
    if (symbol === 'USDC') return; // USDC is cash; not tradable
    const holding = getClientHoldingsBySymbol(holdings, symbol);
    if (!holding) return;

    const action = chooseAction(cfg, holding);
    const currentPrice = Number(holding.currentPrice || 0);
    if (!currentPrice || currentPrice <= 0) return;

    const feePercent = cfg.intensity === 'high' ? 0.004 : cfg.intensity === 'low' ? 0.0025 : 0.003;
    const slipPct = cfg.intensity === 'high' ? 0.0015 : cfg.intensity === 'low' ? 0.0008 : 0.001;
    const effectivePrice = action === 'buy'
        ? currentPrice * (1 + slipPct)
        : currentPrice * (1 - slipPct);

    const usdc = getClientHoldingsBySymbol(holdings, 'USDC');
    const usdcQty = Number(usdc?.qty || 0);
    const minUsdc = Number(cfg.minUsdc ?? 250);

    const tradeSizeMode = cfg.tradeSizeMode || 'fixed_usd';
    const tradeSizeValue = Number(cfg.tradeSizeValue || 500);
    const percent = clamp(tradeSizeValue, 1, 100) / 100;

    let usdTarget = 0;
    if (tradeSizeMode === 'percent') {
        usdTarget = action === 'buy'
            ? usdcQty * percent
            : Number(holding.qty || 0) * effectivePrice * percent;
    } else {
        usdTarget = Math.max(1, tradeSizeValue);
    }

    if (action === 'buy') {
        if (usdcQty < minUsdc) {
            appendClientBotEvent({
                id: generateId('evt'),
                botId: 'preview',
                botName: `${cfg.name} (preview)`,
                time: new Date().toISOString(),
                type: 'skip',
                symbol,
                qtyDelta: 0,
                price: effectivePrice,
                usdValue: 0,
                reason: `SKIP — USDC below minimum (${formatUSD(usdcQty)} < ${formatUSD(minUsdc)})`,
            });
            renderBotActivityUI();
            return;
        }
        usdTarget = Math.min(usdTarget, Math.max(0, usdcQty - minUsdc));
        if (usdTarget <= 1) {
            appendClientBotEvent({
                id: generateId('evt'),
                botId: 'preview',
                botName: `${cfg.name} (preview)`,
                time: new Date().toISOString(),
                type: 'skip',
                symbol,
                qtyDelta: 0,
                price: effectivePrice,
                usdValue: 0,
                reason: `SKIP — not enough free USDC after minimum balance`,
            });
            renderBotActivityUI();
            return;
        }
    }

    let qtyDelta = 0;
    let usdImpactSigned = 0;
    if (action === 'buy') {
        const qtyToBuy = usdTarget / effectivePrice;
        const qtyAfterFee = qtyToBuy * (1 - feePercent);
        qtyDelta = qtyAfterFee;
        holding.qty = Number(holding.qty || 0) + qtyDelta;
        if (usdc) usdc.qty = Math.max(0, usdcQty - usdTarget);
        usdImpactSigned = usdTarget;
    } else {
        const sellable = Number(holding.qty || 0);
        const qtyDesired = usdTarget / effectivePrice;
        const sellQty = Math.min(sellable, qtyDesired);
        if (sellQty <= 0) return;
        qtyDelta = -sellQty;
        holding.qty = Math.max(0, sellable - sellQty);
        const usdReceived = sellQty * effectivePrice * (1 - feePercent);
        if (usdc) usdc.qty = usdcQty + usdReceived;
        usdImpactSigned = -usdReceived;
    }
    setClientPortfolioHoldings(holdings);

    const event = {
        id: generateId('evt'),
        botId: 'preview',
        botName: `${cfg.name} (preview)`,
        time: new Date().toISOString(),
        type: action,
        symbol,
        qtyDelta,
        price: effectivePrice,
        usdValue: usdImpactSigned,
        reason: buildReason(cfg, action, symbol, holding),
    };
    appendClientBotEvent(event);

    renderBotActivityUI();
    renderPortfolio();
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
    
    resetListPage('risks');
    renderRiskFlags();
}

function filterActions() {
    const statusFilter = document.getElementById('action-status-filter')?.value || '';
    const priorityFilter = document.getElementById('action-priority-filter')?.value || '';
    
    appState.filteredActions = appState.actions.filter(action => {
        return (!statusFilter || action.status === statusFilter) &&
               (!priorityFilter || action.priority === priorityFilter);
    });
    
    resetListPage('actions');
    renderActions();
}

function filterUsers() {
    const searchTerm = document.getElementById('user-search')?.value.toLowerCase() || '';
    
    appState.filteredUsers = Array.from(new Set(appState.riskFlags.map(f => f.user_id))).filter(userId =>
        userId.toLowerCase().includes(searchTerm)
    );
    
    resetListPage('users');
    renderUsers();
}

// ===== ACTIONS =====
async function approveAction(actionId) {
    try {
        const response = await apiFetch(`${API_BASE}/actions/${actionId}/approve`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Action approved');
            loadDashboardData();
        }
    } catch (error) {
        console.error('Error approving action:', error);

    }
}

async function executeAction(actionId) {
    try {
        const response = await apiFetch(`${API_BASE}/actions/${actionId}/execute`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Action executed');
            loadDashboardData();
        }
    } catch (error) {
        console.error('Error executing action:', error);

    }
}

async function viewUserDetail(userId) {
    try {
        const response = await apiFetch(`${API_BASE}/users/${userId}`);
        const data = await response.json();
        
        if (data.error) {
            showError('User not found');
            return;
        }
        
        const modal = document.getElementById('user-modal');
        const content = document.getElementById('user-detail-content');
        
        const user = data.user;
        const wallet = data.wallet;
        
        let html = `
            <h2>${user.name}</h2>
            
            <div class="user-detail-section">
                <h3>Profile Information</h3>
                <div class="detail-row"><span class="detail-label">User ID:</span><span class="detail-value">${user.id}</span></div>
                <div class="detail-row"><span class="detail-label">Email:</span><span class="detail-value">${user.email}</span></div>
                <div class="detail-row"><span class="detail-label">Lifecycle Stage:</span><span class="detail-value">${user.lifecycle_stage}</span></div>
                <div class="detail-row"><span class="detail-label">Country:</span><span class="detail-value">${user.country}</span></div>
                <div class="detail-row"><span class="detail-label">Acquisition Source:</span><span class="detail-value">${user.acquisition_source}</span></div>
                <div class="detail-row"><span class="detail-label">Estimated LTV:</span><span class="detail-value">$${(user.estimated_ltv || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                <div class="detail-row"><span class="detail-label">Account Created:</span><span class="detail-value">${new Date(user.first_seen_at).toLocaleDateString()}</span></div>
                <div class="detail-row"><span class="detail-label">Last Active:</span><span class="detail-value">${user.last_activity_at ? new Date(user.last_activity_at).toLocaleDateString() : 'N/A'}</span></div>
            </div>
        `;
        
        if (wallet) {
            html += `
                <div class="user-detail-section">
                    <h3>Wallet Information</h3>
                    <div class="detail-row"><span class="detail-label">Blockchain:</span><span class="detail-value">${wallet.blockchain}</span></div>
                    <div class="detail-row"><span class="detail-label">Balance:</span><span class="detail-value">$${wallet.balance_usd ? wallet.balance_usd.toLocaleString() : '0'}</span></div>
                    <div class="detail-row"><span class="detail-label">Activity Score:</span><span class="detail-value">${(wallet.activity_score || 0).toFixed(1)}/100</span></div>
                    <div class="detail-row"><span class="detail-label">Transactions:</span><span class="detail-value">${wallet.transaction_count || 0}</span></div>
                    <div class="detail-row"><span class="detail-label">Wallet Age:</span><span class="detail-value">${wallet.wallet_age_days || 0} days</span></div>
                </div>
            `;
        }
        
        if (data.tickets && data.tickets.length > 0) {
            html += `
                <div class="user-detail-section">
                    <h3>Support Tickets (${data.tickets.length})</h3>
                    ${data.tickets.map(ticket => `
                        <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 6px;">
                            <div style="margin-bottom: 0.5rem;">
                                <strong>${ticket.subject}</strong>
                                <span class="badge status-${ticket.status}" style="margin-left: 0.5rem;">${ticket.status}</span>
                            </div>
                            <div style="font-size: 0.9rem; color: var(--text-secondary);">Category: ${ticket.category} | Priority: ${ticket.priority}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (data.risk_flags && data.risk_flags.length > 0) {
            html += `
                <div class="user-detail-section">
                    <h3>Risk Flags (${data.risk_flags.length})</h3>
                    ${data.risk_flags.map(flag => `
                        <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 6px;">
                            <div style="margin-bottom: 0.5rem;">
                                <strong>${flag.type}</strong>
                                <span class="badge severity-${flag.severity}" style="margin-left: 0.5rem;">${flag.severity}</span>
                            </div>
                            <div style="font-size: 0.9rem; color: var(--text-secondary);">${flag.description}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (data.recovery_actions && data.recovery_actions.length > 0) {
            html += `
                <div class="user-detail-section">
                    <h3>Recovery Actions (${data.recovery_actions.length})</h3>
                    ${data.recovery_actions.map(action => `
                        <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 6px;">
                            <div style="margin-bottom: 0.5rem;">
                                <strong>${action.type}</strong>
                                <span class="badge status-${action.status}" style="margin-left: 0.5rem;">${action.status}</span>
                            </div>
                            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Recovery Value: $${(action.recovery_value || 0).toLocaleString()}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        content.innerHTML = html;
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Error loading user details:', error);
    
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

// ===== MODALS (user detail + simulate preview) =====
function closeSimulateActionModal() {
    const modal = document.getElementById('simulate-action-modal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function openSimulateActionModal({ mocks, logId, act }) {
    const modal = document.getElementById('simulate-action-modal');
    const bodyEl = document.getElementById('simulate-modal-body');
    const introEl = document.getElementById('simulate-modal-intro');
    const titleEl = document.getElementById('simulate-modal-title');
    const preEl = document.getElementById('simulate-modal-raw-pre');
    if (!modal || !bodyEl || !introEl || !titleEl || !preEl) return;

    const actionLabel = titleCaseActionType(act.action_type);
    const uid = act.user_id ? String(act.user_id) : '';
    titleEl.textContent = `Preview: ${actionLabel}`;

    const logShort = logId ? String(logId).slice(0, 8) : '';
    const line2 = uid
        ? `Below is what those integrations <em>might</em> look like for <strong>${escapeHtml(actionLabel)}</strong> on <strong>${escapeHtml(uid)}</strong>.`
        : `Below is what those integrations <em>might</em> look like for <strong>${escapeHtml(actionLabel)}</strong> on this workflow.`;
    introEl.innerHTML = [
        'This is a <strong>demo-only</strong> preview: nothing was actually sent to email, Jira, or a CRM.',
        line2,
        logShort
            ? `We still write one row to the demo log so you can trace it (<code>${escapeHtml(logShort)}…</code>).`
            : '',
    ]
        .filter(Boolean)
        .join(' ');

    bodyEl.innerHTML = '';
    bodyEl.appendChild(buildSimulateCards(mocks));
    preEl.textContent = JSON.stringify(mocks, null, 2);

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function titleCaseActionType(type) {
    return String(type || 'action')
        .split('_')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

function titleCaseWords(str) {
    return String(str)
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

document.addEventListener('click', (e) => {
    const userModal = document.getElementById('user-modal');
    const simModal = document.getElementById('simulate-action-modal');
    if (e.target === userModal) {
        userModal.classList.remove('active');
    }
    if (simModal && e.target === simModal) {
        closeSimulateActionModal();
    }
    if (e.target.classList.contains('modal-close')) {
        if (userModal.contains(e.target)) {
            userModal.classList.remove('active');
        }
        if (simModal && simModal.contains(e.target)) {
            closeSimulateActionModal();
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const simModal = document.getElementById('simulate-action-modal');
    if (simModal?.classList.contains('active')) {
        closeSimulateActionModal();
        return;
    }
    const userModal = document.getElementById('user-modal');
    if (userModal?.classList.contains('active')) {
        userModal.classList.remove('active');
    }
});


// ===== AI CHAT FUNCTIONALITY =====

function setupChatInterface() {
    if (isChatInitialized) return;

    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    
    if (!chatInput || !sendBtn) return;
    
    // Send on button click
    sendBtn.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (message) {
            sendChatMessage(message);
            chatInput.value = '';
            chatInput.focus();
        }
    });
    
    // Send on Enter key
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const message = chatInput.value.trim();
            if (message) {
                sendChatMessage(message);
                chatInput.value = '';
            }
        }
    });

    isChatInitialized = true;
}

function formatInsightBold(text) {
    if (!text) return '';
    const parts = String(text).split(/\*\*/);
    return parts.map((p, i) => (i % 2 === 1 ? `<strong>${escapeHtml(p)}</strong>` : escapeHtml(p))).join('');
}

function humanizeSimKey(k) {
    const s = String(k);
    if (s.endsWith('__c')) {
        const base = s.slice(0, -3).replace(/_/g, ' ');
        return `${titleCaseWords(base)} (custom CRM field)`;
    }
    return titleCaseWords(s.replace(/_/g, ' '));
}

/** Nested key–value blocks inside a simulate channel card (no innerHTML). */
function fillSimulateCardBody(bodyEl, obj) {
    if (!obj || typeof obj !== 'object') return;
    Object.entries(obj).forEach(([k, v]) => {
        const row = document.createElement('div');
        row.className = 'chat-sim-row';
        const label = document.createElement('span');
        label.className = 'chat-sim-field-label';
        label.textContent = humanizeSimKey(k);
        const valWrap = document.createElement('div');
        valWrap.className = 'chat-sim-field-value';
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            const sub = document.createElement('div');
            sub.className = 'chat-sim-subblock';
            fillSimulateCardBody(sub, v);
            valWrap.appendChild(sub);
        } else if (Array.isArray(v)) {
            valWrap.classList.add('chat-sim-tags');
            valWrap.textContent = v.join(' · ');
        } else {
            valWrap.textContent = v == null ? '—' : String(v);
        }
        row.appendChild(label);
        row.appendChild(valWrap);
        bodyEl.appendChild(row);
    });
}

/** Card grid: Email / Jira / CRM from mock payload. */
function buildSimulateCards(mocks) {
    const grid = document.createElement('div');
    grid.className = 'chat-sim-grid';
    const channels = [
        { key: 'email', title: 'Email', icon: '✉' },
        { key: 'jira', title: 'Jira', icon: '◆' },
        { key: 'crm', title: 'CRM', icon: '◇' },
    ];
    channels.forEach(({ key, title, icon }) => {
        const data = mocks[key];
        if (!data || typeof data !== 'object') return;
        const card = document.createElement('div');
        card.className = 'chat-sim-card';
        const head = document.createElement('div');
        head.className = 'chat-sim-card-head';
        const ic = document.createElement('span');
        ic.className = 'chat-sim-card-icon';
        ic.setAttribute('aria-hidden', 'true');
        ic.textContent = icon;
        const tt = document.createElement('span');
        tt.textContent = title;
        head.appendChild(ic);
        head.appendChild(tt);
        const body = document.createElement('div');
        body.className = 'chat-sim-card-body';
        fillSimulateCardBody(body, data);
        card.appendChild(head);
        card.appendChild(body);
        grid.appendChild(card);
    });
    return grid;
}

async function runChatSimulate(act) {
    const messagesContainer = document.getElementById('chat-messages');
    try {
        const res = await apiFetch(`${API_BASE}/chat/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action_type: act.action_type,
                user_id: act.user_id || null,
                reason: act.reason || null,
            }),
        });
        const j = await res.json();
        if (!res.ok || !j.success) {
            throw new Error(j.detail || j.message || 'Simulate failed');
        }
        openSimulateActionModal({ mocks: j.mocks, logId: j.log_id, act });
    } catch (e) {
        console.error(e);
        messagesContainer.appendChild(createChatMessage('error', `Simulate error: ${e.message}`));
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

async function sendChatMessage(userQuery) {
    const messagesContainer = document.getElementById('chat-messages');
    
    // Add user message to display
    const userMessageDiv = createChatMessage('user', userQuery);
    messagesContainer.appendChild(userMessageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Show typing indicator
    const typingDiv = createChatMessage('bot', '...', true);
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        // Send to backend
        const response = await apiFetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: userQuery })
        });
        
        const data = await response.json();
        
        // Remove typing indicator
        typingDiv.remove();
        
        if (data.success) {
            // Create bot message container
            const botMessageDiv = document.createElement('div');
            botMessageDiv.className = 'chat-message bot';
            if (data.playbook_id) {
                botMessageDiv.classList.add('chat-message-playbook');
            }

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            
            let fullContent = '';
            let responseData = null;
            try {
                responseData = JSON.parse(data.response);
            } catch (e) {
                responseData = null;
            }

            if (responseData) {
                if (responseData.data !== undefined) {
                    if (data.playbook_id) {
                        const title = escapeHtml(data.playbook_id.replace(/_/g, ' '));
                        fullContent += `<div class="chat-answer-playbook">`;
                        fullContent += `<header class="chat-playbook-header"><span class="chat-playbook-kicker">Verified playbook</span><h3 class="chat-playbook-title">${title}</h3><p class="chat-playbook-sub">Straight from your demo database: a short summary plus the matching rows. We skip an extra AI “story” on top so you can trust what you see.</p></header>`;
                    } else if (String(responseData.text || '').trim()) {
                        fullContent += `<p class="chat-response-context">${escapeHtml(responseData.text)}</p>`;
                    }
                    if (Array.isArray(responseData.insights) && responseData.insights.length > 0) {
                        fullContent += '<div class="chat-insights-card"><div class="chat-insights-label">Key facts</div><ul class="chat-insights">';
                        responseData.insights.forEach(ins => {
                            fullContent += `<li>${formatInsightBold(ins)}</li>`;
                        });
                        fullContent += '</ul></div>';
                    }
                    if (Array.isArray(responseData.data) && responseData.data.length > 0) {
                        fullContent += `<div class="chat-table-card"><div class="chat-table-label">Data</div>`;
                        fullContent += formatJsonResponse(responseData.data, data.row_count || 0);
                        fullContent += '</div>';
                    }
                    if (data.playbook_id) {
                        fullContent += '</div>';
                    }
                } else if (Array.isArray(responseData)) {
                    if (data.context) {
                        fullContent += `<p class="chat-response-context">${escapeHtml(data.context)}</p>`;
                    }
                    fullContent += formatJsonResponse(responseData, data.row_count || 0);
                } else {
                    if (data.context) {
                        fullContent += `<p class="chat-response-context">${escapeHtml(data.context)}</p>`;
                    }
                    fullContent += formatJsonResponse(responseData, data.row_count || 0);
                }
            } else {
                fullContent += `<p class="chat-response-text">${escapeHtml(data.response)}</p>`;
            }

            contentDiv.innerHTML = fullContent;

            if (responseData && Array.isArray(responseData.suggested_actions) && responseData.suggested_actions.length > 0) {
                const simWrap = document.createElement('div');
                simWrap.className = 'chat-suggested-actions';
                const hint = document.createElement('p');
                hint.className = 'chat-sim-hint';
                hint.innerHTML =
                    '<strong>Suggested next steps</strong> — tap a button to open a <em>preview window</em> with mock Email, Jira, and CRM payloads (nothing is sent for real). Each run is logged in the demo; raw JSON lives at the bottom of that window.';
                const pickerRow = document.createElement('div');
                pickerRow.className = 'chat-sim-picker-row';

                const select = document.createElement('select');
                select.className = 'chat-sim-select';
                select.setAttribute('aria-label', 'Select a suggested next step');

                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = 'Choose an action…';
                placeholder.selected = true;
                placeholder.disabled = true;
                select.appendChild(placeholder);

                responseData.suggested_actions.forEach((act, idx) => {
                    const opt = document.createElement('option');
                    opt.value = String(idx);
                    const label = titleCaseActionType(act.action_type);
                    opt.textContent = `${label}${act.user_id ? ` · ${act.user_id}` : ''}`;
                    select.appendChild(opt);
                });

                const goBtn = document.createElement('button');
                goBtn.type = 'button';
                goBtn.className = 'chat-sim-btn chat-sim-go';
                goBtn.textContent = 'Preview';
                goBtn.disabled = true;

                const updateBtn = () => {
                    goBtn.disabled = !select.value;
                    const idx = Number(select.value);
                    const act = Number.isFinite(idx) ? responseData.suggested_actions[idx] : null;
                    goBtn.title = act
                        ? `Simulate ${act.action_type}${act.reason ? ': ' + act.reason : ''}`
                        : 'Select an action first';
                };
                select.addEventListener('change', updateBtn);

                goBtn.addEventListener('click', () => {
                    const idx = Number(select.value);
                    if (!Number.isFinite(idx)) return;
                    const act = responseData.suggested_actions[idx];
                    if (!act) return;
                    runChatSimulate(act);
                });

                pickerRow.appendChild(select);
                pickerRow.appendChild(goBtn);
                simWrap.appendChild(hint);
                simWrap.appendChild(pickerRow);
                contentDiv.appendChild(simWrap);
            }

            botMessageDiv.appendChild(contentDiv);

            if (data.sql_query) {
                const det = document.createElement('details');
                det.className = 'chat-sql-details';
                const sum = document.createElement('summary');
                sum.textContent = '📋 Generated SQL';
                det.appendChild(sum);
                const pre = document.createElement('pre');
                pre.className = 'chat-sql-pre';
                pre.textContent = data.sql_query;
                det.appendChild(pre);
                botMessageDiv.appendChild(det);
            }

            messagesContainer.appendChild(botMessageDiv);
        } else {
            const errRaw = data.error || 'Unknown error';
            const errText = errRaw.startsWith('Error:') ? errRaw : `Error: ${errRaw}`;
            const errorDiv = createChatMessage('error', errText);
            messagesContainer.appendChild(errorDiv);
        }
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        console.error('Chat error:', error);
        typingDiv.remove();
        
        const errorDiv = createChatMessage('error', `Connection error: ${error.message}`);
        messagesContainer.appendChild(errorDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function formatJsonResponse(data, rowCount) {
    if (!Array.isArray(data) || data.length === 0) {
        return `<p class="chat-response-text">No results found</p>`;
    }
    
    // Check if it's a single count/aggregate result
    if (data.length === 1 && Object.keys(data[0]).length === 1) {
        const key = Object.keys(data[0])[0];
        const value = data[0][key];
        return `<p class="chat-response-text"><strong>Result:</strong> ${formatValue(value)}</p>`;
    }
    
    // For small result sets (≤5 rows), show as table
    if (data.length <= 5) {
        return formatAsTable(data);
    }
    
    // For larger result sets (>5 rows), show summary with pagination
    return formatAsSummary(data, rowCount);
}

function formatAsTable(data) {
    if (!data || data.length === 0) return '';
    
    const keys = Object.keys(data[0]);
    
    let html = '<div class="chat-response-table-wrapper"><table class="chat-response-table"><thead><tr>';
    
    // Header
    keys.forEach(key => {
        html += `<th>${escapeHtml(key)}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Rows - show all rows for data <= 5
    data.forEach(row => {
        html += '<tr>';
        keys.forEach(key => {
            const value = formatValue(row[key]);
            html += `<td>${escapeHtml(value)}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    
    return html;
}

function formatAsSummary(data, rowCount) {
    if (!data || data.length === 0) return '';
    
    const keys = Object.keys(data[0]);
    const itemsPerPage = 5;
    const totalPages = Math.ceil(data.length / itemsPerPage);
    
    // Store pagination data globally for this response
    const paginationId = 'pagination_' + Date.now();
    window.chatPagination = window.chatPagination || {};
    window.chatPagination[paginationId] = {
        data: data,
        keys: keys,
        currentPage: 1,
        itemsPerPage: itemsPerPage,
        totalPages: totalPages,
        totalRecords: rowCount
    };
    
    let html = `<p class="chat-response-summary"><strong>Found ${rowCount} record(s)</strong></p>`;
    
    // Initial table with first page
    const startIdx = 0;
    const endIdx = Math.min(itemsPerPage, data.length);
    const pageData = data.slice(startIdx, endIdx);
    
    html += `<div class="chat-response-pagination-info">Showing ${startIdx + 1}-${endIdx} of ${rowCount} records</div>`;
    
    // Show table for current page
    html += `<div class="chat-response-table-wrapper" id="table-${paginationId}"><table class="chat-response-table"><thead><tr>`;
    
    keys.forEach(key => {
        html += `<th>${escapeHtml(key)}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    pageData.forEach(row => {
        html += '<tr>';
        keys.forEach(key => {
            const value = formatValue(row[key]);
            const truncated = value.length > 50 ? value.substring(0, 47) + '...' : value;
            html += `<td title="${escapeHtml(value)}">${escapeHtml(truncated)}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    
    // Pagination controls
    if (totalPages > 1) {
        html += `<div class="chat-response-pagination">`;
        
        // Previous button
        html += `<button class="chat-pagination-btn" onclick="goToChatPage('${paginationId}', 0)" ${totalPages <= 1 ? 'disabled' : ''}>← Previous</button>`;
        
        // Page info
        html += `<span class="chat-pagination-info"><span id="current-page-${paginationId}">1</span>/${totalPages}</span>`;
        
        // Next button
        html += `<button class="chat-pagination-btn" onclick="goToChatPage('${paginationId}', 2)">Next →</button>`;
        
        // Show all button
        html += `<button class="chat-pagination-btn chat-pagination-btn-primary" onclick="showAllChatResults('${paginationId}')">Show All ${rowCount}</button>`;
        
        html += `</div>`;
    }
    
    return html;
}

function goToChatPage(paginationId, direction) {
    const pagination = window.chatPagination[paginationId];
    if (!pagination) return;
    
    let newPage = pagination.currentPage;
    if (direction === 0) {
        newPage = Math.max(1, newPage - 1);
    } else if (direction === 2) {
        newPage = Math.min(pagination.totalPages, newPage + 1);
    }
    
    if (newPage === pagination.currentPage) return;
    
    pagination.currentPage = newPage;
    const startIdx = (newPage - 1) * pagination.itemsPerPage;
    const endIdx = Math.min(startIdx + pagination.itemsPerPage, pagination.data.length);
    const pageData = pagination.data.slice(startIdx, endIdx);
    
    // Update table
    const tableWrapper = document.getElementById('table-' + paginationId);
    let html = `<table class="chat-response-table"><thead><tr>`;
    
    pagination.keys.forEach(key => {
        html += `<th>${escapeHtml(key)}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    pageData.forEach(row => {
        html += '<tr>';
        pagination.keys.forEach(key => {
            const value = formatValue(row[key]);
            const truncated = value.length > 50 ? value.substring(0, 47) + '...' : value;
            html += `<td title="${escapeHtml(value)}">${escapeHtml(truncated)}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    tableWrapper.innerHTML = html;
    
    // Update page info
    document.getElementById('current-page-' + paginationId).textContent = newPage;
    
    // Update pagination text
    const paginationInfoEl = tableWrapper.parentElement.querySelector('.chat-response-pagination-info');
    if (paginationInfoEl) {
        paginationInfoEl.textContent = `Showing ${startIdx + 1}-${endIdx} of ${pagination.totalRecords} records`;
    }
    
    // Scroll to table
    tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showAllChatResults(paginationId) {
    const pagination = window.chatPagination[paginationId];
    if (!pagination) return;
    
    // Update table to show all
    const tableWrapper = document.getElementById('table-' + paginationId);
    let html = `<table class="chat-response-table"><thead><tr>`;
    
    pagination.keys.forEach(key => {
        html += `<th>${escapeHtml(key)}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    pagination.data.forEach(row => {
        html += '<tr>';
        pagination.keys.forEach(key => {
            const value = formatValue(row[key]);
            const truncated = value.length > 50 ? value.substring(0, 47) + '...' : value;
            html += `<td title="${escapeHtml(value)}">${escapeHtml(truncated)}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    tableWrapper.innerHTML = html;
    
    // Hide pagination controls
    const paginationControls = tableWrapper.parentElement.querySelector('.chat-response-pagination');
    if (paginationControls) {
        paginationControls.style.display = 'none';
    }
    
    // Update info
    const paginationInfoEl = tableWrapper.parentElement.querySelector('.chat-response-pagination-info');
    if (paginationInfoEl) {
        paginationInfoEl.textContent = `Showing all ${pagination.totalRecords} records`;
    }
}

function formatValue(value) {
    if (value === null || value === undefined) {
        return '—';
    }
    if (typeof value === 'number') {
        // Format currency if it looks like money
        if (value > 1000 && value.toString().includes('.')) {
            return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        }
        return value.toLocaleString();
    }
    if (typeof value === 'boolean') {
        return value ? '✓' : '✗';
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}

function createChatMessage(role, content, isTyping = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}${isTyping ? ' typing' : ''}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (isTyping) {
        contentDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    } else if (typeof content === 'string') {
        // Check if content looks like HTML (starts with <)
        if (content.trim().startsWith('<')) {
            contentDiv.innerHTML = content;
        } else {
            contentDiv.textContent = content;
        }
    } else {
        contentDiv.textContent = String(content);
    }
    
    messageDiv.appendChild(contentDiv);
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    messageDiv.appendChild(timeDiv);
    
    return messageDiv;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
