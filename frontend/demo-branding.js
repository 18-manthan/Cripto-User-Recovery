/**
 * Demo branding — single source of truth for Phase 1 repositioning.
 * Internal IDs (data-section, API fields) stay unchanged; only user-facing copy.
 */
window.DEMO_BRANDING = {
    productName: 'Investor Intelligence Platform',
    tagline: 'Transparency, automation, and performance for investors and partners',
    headerSubtitle: 'Unified operations for investor engagement, portfolio visibility, and workflow automation',

    login: {
        adminLabel: 'Operations',
        investorLabel: 'Investor',
        adminPlaceholder: 'admin@cisinlabs.com',
        investorPlaceholder: 'client@demo.com',
        adminSubmit: 'Sign In',
        investorSubmit: 'Enter Investor Portal',
        investorHelp: 'Demo credentials: client@demo.com / demo',
    },

    nav: {
        overview: 'Executive Overview',
        crmPipeline: 'CRM Pipeline',
        marketing: 'Marketing',
        opsIntegrations: 'Integration Hub',
        risks: 'Alerts & Opportunities',
        actions: 'Workflows',
        users: 'Investors',
        investorDashboard: 'Dashboard',
        portfolio: 'Portfolio',
        documents: 'Documents',
        integrations: 'Integrations',
        investorChat: 'Investor Assistant',
        chat: 'AI Assistant',
    },

    stats: {
        totalUsers: { title: 'Total Investors', label: 'Active + Inactive' },
        riskFlags: { title: 'Alerts Detected', label: 'Engagement Opportunities' },
        actions: { title: 'Workflows Queued', label: 'Pending Execution' },
        pipeline: { title: 'Pipeline Value', label: 'Estimated Total Value' },
    },

    sections: {
        overview: 'Executive Overview',
        userStatusChart: 'Investor Status Distribution',
        severityChart: 'Alert Severity Breakdown',
        pipelineValue: 'Pipeline Value',
        pipelineFull: 'Estimated Full Value',
        pipelineAvg: 'Avg Per Workflow',
        actionSummary: 'Workflow Summary',
        risks: 'Alerts & Opportunities',
        allAlertTypes: 'All Alert Types',
        abandonedUsers: 'Abandoned Investors',
        workflows: 'Workflow Automation',
        workflowBuilderHelp: 'Define trigger → action → channel rules. Saved workflows are demo-only (localStorage).',
        crmTitle: 'CRM Pipeline',
        crmHelp: 'Track leads and investors from first touch through active engagement — demo kanban with stage moves.',
        marketingTitle: 'Marketing & Lead Generation',
        marketingHelp: 'Capture leads, monitor campaigns, and track SEO performance — demo data with CRM handoff.',
        opsIntegrationsTitle: 'Integration Hub',
        opsIntegrationsHelp: 'Connect CRM, marketing, and support systems — UI-only demo with sync logging.',
        investors: 'Investor Directory',
        investorSearch: 'Search by investor ID or email...',
        investorDashboard: 'Investor Dashboard',
        investorDashboardHelp: 'Your portfolio at a glance — allocation, performance, and recent updates.',
        documents: 'Documents & Reports',
        documentsHelp: 'Statements, performance reports, and compliance documents — demo downloads only.',
        investorChatTitle: 'Investor Assistant',
        investorChatHelp: 'Ask about your portfolio, allocation, performance, documents, or connected accounts — instant demo answers, no backend required.',
        portfolio: 'Investor Portfolio',
        portfolioHelp: 'Holdings across funds, public markets, and cash — illustrative only, no live trading.',
        integrations: 'Connected Accounts',
        integrationsHelp: 'Link banking, CRM, documents, and market data — UI-only demo connectors.',
        chatTitle: 'Operations AI Assistant',
        chatHelp: 'Ask in plain language — the assistant stays close to your demo data and understands investor operations, alerts, and workflows. Verified SQL templates are used when possible; otherwise the model drafts a query for this database.',
        chatWelcome: 'Hello — I\'m your operations assistant. I\'ll keep things courteous and focused on investor intelligence: portfolios, activity, alerts, and what your team might do next.',
        chatWelcomeExamples: 'Try, for example: "How many critical alerts are there?" or "Show me high-value inactive investors."',
        chatWelcomeTip: 'Tip: Named demo investors (such as demo_elena_highvalue_withdrawal) can open a playbook with optional next-step buttons — those are preview-only mockups, not live email, tickets, or CRM changes.',
        chatPlaceholder: 'Ask about investors, alerts, or workflows — in your own words…',
        simulateTitle: 'Integration preview (demo)',
    },

    terminology: {
        recoveryPotential: 'Pipeline Value',
        recoveryValue: 'Estimated Impact',
        recoveryActions: 'Workflow Actions',
        riskFlags: 'Alerts',
        totalUsersAffected: 'Investors Affected',
        platformCoin: 'RGCIS Platform Token',
        listItemValue: 'Impact',
    },
};

function applyDemoBranding() {
    const b = window.DEMO_BRANDING;
    if (!b) return;

    document.title = b.productName;

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el && text) el.textContent = text;
    };

    const setHtml = (id, html) => {
        const el = document.getElementById(id);
        if (el && html) el.innerHTML = html;
    };

    // Login
    setText('brand-login-title', b.productName);
    setText('brand-login-tagline', b.tagline);
    setText('login-as-admin', b.login.adminLabel);
    setText('login-as-client', b.login.investorLabel);
    setText('brand-header-title', b.productName);
    setText('brand-header-subtitle', b.headerSubtitle);

    const loginEmail = document.getElementById('login-email');
    if (loginEmail) loginEmail.placeholder = b.login.adminPlaceholder;
    const clientEmail = document.getElementById('client-login-email');
    if (clientEmail) clientEmail.placeholder = b.login.investorPlaceholder;
    const clientSubmit = document.querySelector('#client-login-form .auth-submit');
    if (clientSubmit) clientSubmit.textContent = b.login.investorSubmit;
    const clientHelp = document.getElementById('brand-investor-help');
    if (clientHelp) {
        clientHelp.innerHTML = 'Demo credentials: <code>client@demo.com</code> / <code>demo</code>';
    }

    // Nav labels (preserve icons)
    const navMap = {
        overview: b.nav.overview,
        'crm-pipeline': b.nav.crmPipeline,
        marketing: b.nav.marketing,
        'ops-integrations': b.nav.opsIntegrations,
        risks: b.nav.risks,
        actions: b.nav.actions,
        users: b.nav.users,
        'investor-dashboard': b.nav.investorDashboard,
        portfolio: b.nav.portfolio,
        documents: b.nav.documents,
        integrations: b.nav.integrations,
        'investor-chat': b.nav.investorChat,
        chat: b.nav.chat,
    };
    document.querySelectorAll('.nav-item[data-section]').forEach((item) => {
        const section = item.getAttribute('data-section');
        const label = navMap[section];
        if (!label) return;
        const icon = item.querySelector('.icon');
        item.textContent = '';
        if (icon) item.appendChild(icon);
        item.appendChild(document.createTextNode(' ' + label));
    });

    // Section headings
    setText('section-overview-title', b.sections.overview);
    setText('section-user-status-chart', b.sections.userStatusChart);
    setText('section-severity-chart', b.sections.severityChart);
    setText('section-pipeline-value', b.sections.pipelineValue);
    setText('metric-pipeline-full', b.sections.pipelineFull);
    setText('metric-pipeline-avg', b.sections.pipelineAvg);
    setText('section-action-summary', b.sections.actionSummary);
    setText('section-crm-title', b.sections.crmTitle);
    setText('section-crm-help', b.sections.crmHelp);
    setText('section-marketing-title', b.sections.marketingTitle);
    setText('section-marketing-help', b.sections.marketingHelp);
    setText('section-ops-integrations-title', b.sections.opsIntegrationsTitle);
    setText('section-ops-integrations-help', b.sections.opsIntegrationsHelp);
    setText('section-risks-title', b.sections.risks);
    setText('section-workflows-title', b.sections.workflows);
    setText('section-workflow-builder-help', b.sections.workflowBuilderHelp);
    setText('section-investors-title', b.sections.investors);
    setText('section-investor-dashboard-title', b.sections.investorDashboard);
    setText('section-investor-dashboard-help', b.sections.investorDashboardHelp);
    setText('section-documents-title', b.sections.documents);
    setText('section-documents-help', b.sections.documentsHelp);
    setText('section-investor-chat-title', b.sections.investorChatTitle);
    setText('section-investor-chat-help', b.sections.investorChatHelp);
    setText('section-portfolio-title', b.sections.portfolio);
    setText('section-portfolio-help', b.sections.portfolioHelp);
    setText('section-integrations-title', b.sections.integrations);
    setText('section-integrations-help', b.sections.integrationsHelp);
    setText('section-chat-title', b.sections.chatTitle);
    setText('section-chat-help', b.sections.chatHelp);
    setText('simulate-modal-title', b.sections.simulateTitle);

    const userSearch = document.getElementById('user-search');
    if (userSearch) userSearch.placeholder = b.sections.investorSearch;

    const riskTypeFilter = document.getElementById('risk-type-filter');
    if (riskTypeFilter && riskTypeFilter.options[0]) {
        riskTypeFilter.options[0].textContent = b.sections.allAlertTypes;
    }
    const abandonedOpt = riskTypeFilter?.querySelector('option[value="abandoned"]');
    if (abandonedOpt) abandonedOpt.textContent = b.sections.abandonedUsers;

    const chatWelcome = document.getElementById('chat-welcome-msg');
    if (chatWelcome) {
        chatWelcome.innerHTML = `<p>👋 ${b.sections.chatWelcome}</p>
            <p class="message-time">${b.sections.chatWelcomeExamples}</p>
            <p class="chat-welcome-extra"><strong>Tip:</strong> ${b.sections.chatWelcomeTip.replace(/^Tip:\s*/i, '')}</p>`;
    }

    const chatInput = document.getElementById('chat-input');
    if (chatInput) chatInput.placeholder = b.sections.chatPlaceholder;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDemoBranding);
} else {
    applyDemoBranding();
}
