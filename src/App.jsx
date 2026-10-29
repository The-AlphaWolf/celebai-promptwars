import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';

import Navbar from './components/Navbar';
import EventHeader from './components/EventHeader';
import PlannerTabs from './components/PlannerTabs';
import BudgetPlanner from './components/BudgetPlanner';
import TimelinePlanner from './components/TimelinePlanner';
import VendorChecklist from './components/VendorChecklist';
import IdeaGenerator from './components/IdeaGenerator';

import { generatePlan } from './domain/planner';
import { getPresetIntake, presetLabel } from './domain/presets';
import { checkAiStatus, createPlan, sendChat } from './services/api';
import { usePersistentPlan } from './hooks/usePersistentPlan';
import { celebrate } from './utils/celebrate';
import { DEFAULT_THEME, themeName } from './config/themes';
import './App.css';

// Rarely used panels are split out of the main bundle.
const ChatPanel = lazy(() => import('./components/ChatPanel'));
const IntakeFormModal = lazy(() => import('./components/IntakeFormModal'));

const THEME_KEY = 'celebai_theme';
const WELCOME = {
  role: 'model',
  text: 'Hi! I can rebalance your budget, resize for a new headcount, move the date, flag risks and suggest ideas. Try a suggestion below.',
};

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export default function App() {
  const [plan, setPlan] = usePersistentPlan(() => generatePlan(getPresetIntake('wedding')));
  const [activeTab, setActiveTab] = useState('budget');
  const [theme, setTheme] = useState(readTheme);
  const [aiStatus, setAiStatus] = useState('checking');
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [today] = useState(() => new Date());

  useEffect(() => {
    checkAiStatus().then(setAiStatus);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Theme still applies for this session.
    }
  }, [theme]);

  const notify = useCallback((message, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const updatePlan = (field, label) => (value) => {
    setPlan((current) => ({ ...current, [field]: value }));
    notify(`${label} updated.`);
  };

  const handleLoadSample = (eventType) => {
    setPlan(generatePlan(getPresetIntake(eventType)));
    setMessages([WELCOME]);
    notify(`Loaded the ${presetLabel(eventType).toLowerCase()} sample.`, 'info');
  };

  const handleGeneratePlan = async (intake) => {
    setIsBusy(true);
    try {
      const result = await createPlan(intake);
      setPlan(result.plan);
      setMessages([WELCOME]);
      setIsIntakeOpen(false);
      setActiveTab('budget');
      notify(result.notice || (result.source === 'gemini' ? 'Plan built with Gemini and the planning engine.' : 'Plan built by the planning engine.'), result.notice ? 'info' : 'success');
      celebrate();
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendMessage = async (text) => {
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setIsBusy(true);
    try {
      const result = await sendChat(plan, text);
      setMessages((prev) => [...prev, { role: 'model', text: result.reply, plan: result.plan, source: result.source, notice: result.notice }]);
    } finally {
      setIsBusy(false);
    }
  };

  const handleApplyPlan = (messageIndex) => {
    const proposal = messages[messageIndex]?.plan;
    if (!proposal) return;
    setPlan(proposal);
    setMessages((prev) => prev.map((message, index) => (index === messageIndex ? { ...message, applied: true } : message)));
    notify('Assistant changes applied to your plan.');
  };

  const handleAskForIdeas = () => {
    setIsChatOpen(true);
    handleSendMessage('More ideas for my theme');
  };

  const handleExportPdf = async () => {
    try {
      const { exportPlanToPdf } = await import('./utils/exportPdf');
      exportPlanToPdf(plan);
      notify('PDF downloaded.');
    } catch {
      notify('Could not create the PDF. Please try again.', 'danger');
    }
  };

  const handleSelectTheme = (id) => {
    setTheme(id);
    notify(`Theme: ${themeName(id)}.`, 'info');
  };

  const panels = {
    budget: <BudgetPlanner plan={plan} onUpdateBudget={updatePlan('budgetItems', 'Budget')} />,
    timeline: <TimelinePlanner plan={plan} today={today} onUpdateTimeline={updatePlan('timeline', 'Timeline')} />,
    vendors: <VendorChecklist plan={plan} onUpdateVendors={updatePlan('vendors', 'Vendor list')} />,
    ideas: <IdeaGenerator plan={plan} onUpdateIdeas={updatePlan('creativeIdeas', 'Ideas')} onAskForIdeas={handleAskForIdeas} isBusy={isBusy} />,
  };

  return (
    <div className={`celebai-app ${isChatOpen ? 'chat-open' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <Navbar
        currentEventType={plan.eventType}
        onLoadSample={handleLoadSample}
        aiStatus={aiStatus}
        onExportPdf={handleExportPdf}
        isBusy={isBusy}
        currentTheme={theme}
        onSelectTheme={handleSelectTheme}
      />

      <output className="toast-region" aria-live="polite">
        {toast && (
          <div className={`notification-toast toast-${toast.type}`}>
            <Sparkles size={14} aria-hidden="true" />
            <span>{toast.message}</span>
          </div>
        )}
      </output>

      <main className="app-container" id="main-content" tabIndex={-1}>
        <EventHeader plan={plan} today={today} onOpenIntake={() => setIsIntakeOpen(true)} onOpenChat={() => setIsChatOpen(true)} isBusy={isBusy} />

        <div className="tabs-container glass-panel">
          <PlannerTabs plan={plan} activeTab={activeTab} onChange={setActiveTab} />
          <button
            type="button"
            className={`btn-chat-toggle ${isChatOpen ? 'chat-is-active' : ''}`}
            onClick={() => setIsChatOpen((open) => !open)}
            aria-expanded={isChatOpen}
          >
            <MessageSquare size={16} aria-hidden="true" />
            <span>Assistant</span>
          </button>
        </div>

        <div className="tab-view-content" role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} tabIndex={0}>
          {panels[activeTab]}
        </div>
      </main>

      <Suspense fallback={null}>
        {isChatOpen && (
          <ChatPanel
            plan={plan}
            messages={messages}
            onSendMessage={handleSendMessage}
            onApplyPlan={handleApplyPlan}
            onClose={() => setIsChatOpen(false)}
            isBusy={isBusy}
            aiStatus={aiStatus}
          />
        )}
        {isIntakeOpen && <IntakeFormModal onClose={() => setIsIntakeOpen(false)} onGenerate={handleGeneratePlan} isGenerating={isBusy} />}
      </Suspense>

      {!isChatOpen && (
        <button type="button" className="floating-ai-trigger" onClick={() => setIsChatOpen(true)} aria-label="Ask CelebAI">
          <Sparkles size={20} className="float-icon" aria-hidden="true" />
          <span className="float-label" aria-hidden="true">Ask CelebAI</span>
        </button>
      )}
    </div>
  );
}
