'use client';

// ─── AI Settings Page ─────────────────────────────────────────
// Manage API keys (OpenAI, Anthropic, Google, etc.) and configure
// which AI models are used for each platform feature.
//
// API routes (via Platform Config store):
//   GET  /api/admin/config/category/ai   — load all AI config entries
//   PUT  /api/admin/config/:key          — upsert a config key

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Spinner, ErrorBanner } from '@/components/page-shell';
import {
  Key, Brain, Eye, EyeOff, Save, CheckCircle2, AlertCircle,
  Zap, Bot, Sparkles, BookOpen, ClipboardList,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface ConfigEntry {
  key: string;
  value: unknown;
  category: string;
  description?: string;
}

// ─── Model options ────────────────────────────────────────────

const MODEL_OPTIONS: Record<string, { label: string; models: string[] }> = {
  openai: {
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  anthropic: {
    label: 'Anthropic',
    models: [
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'claude-haiku-3-5',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ],
  },
  google: {
    label: 'Google',
    models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
};

// Feature → config key mapping
const FEATURE_MODEL_KEYS: {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  accent: string;
}[] = [
  {
    key: 'ai_model_tutor',
    label: 'AI Tutor',
    description: 'Conversational tutoring and doubt-solving',
    icon: Bot,
    accent: 'violet',
  },
  {
    key: 'ai_model_flashcard_gen',
    label: 'Flashcard Generation',
    description: 'Automated flashcard creation from topics',
    icon: Sparkles,
    accent: 'amber',
  },
  {
    key: 'ai_model_explanation',
    label: 'Explanation Engine',
    description: 'Step-by-step answer explanations',
    icon: BookOpen,
    accent: 'sky',
  },
  {
    key: 'ai_model_quiz_gen',
    label: 'Quiz Generator',
    description: 'Adaptive quiz and MCQ generation',
    icon: ClipboardList,
    accent: 'emerald',
  },
];

// Provider → config key
const API_KEY_CONFIGS: {
  provider: string;
  key: string;
  label: string;
  placeholder: string;
  hint: string;
  accentColor: string;
  badgeColor: string;
}[] = [
  {
    provider: 'openai',
    key: 'ai_api_key_openai',
    label: 'OpenAI API Key',
    placeholder: 'sk-proj-...',
    hint: 'Used for GPT models. Get yours at platform.openai.com',
    accentColor: 'emerald',
    badgeColor: 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400',
  },
  {
    provider: 'anthropic',
    key: 'ai_api_key_anthropic',
    label: 'Anthropic API Key',
    placeholder: 'sk-ant-...',
    hint: 'Used for Claude models. Get yours at console.anthropic.com',
    accentColor: 'orange',
    badgeColor: 'bg-orange-950/60 border-orange-800/60 text-orange-400',
  },
  {
    provider: 'google',
    key: 'ai_api_key_google',
    label: 'Google AI API Key',
    placeholder: 'AIza...',
    hint: 'Used for Gemini models. Get yours at aistudio.google.com',
    accentColor: 'sky',
    badgeColor: 'bg-sky-950/60 border-sky-800/60 text-sky-400',
  },
  {
    provider: 'nvidia',
    key: 'ai_api_key_nvidia',
    label: 'NVIDIA NIM API Key',
    placeholder: 'nvapi-...',
    hint: 'Used for NVIDIA-hosted models via NIM. Get yours at build.nvidia.com',
    accentColor: 'green',
    badgeColor: 'bg-green-950/60 border-green-800/60 text-green-400',
  },
];

// ─── Helpers ─────────────────────────────────────────────────

function valToStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

const ACCENT_RING: Record<string, string> = {
  violet: 'focus:ring-violet-500',
  amber:  'focus:ring-amber-500',
  sky:    'focus:ring-sky-500',
  emerald:'focus:ring-emerald-500',
};

const ACCENT_ICON: Record<string, string> = {
  violet: 'text-violet-400 bg-violet-950/50 border-violet-800/60',
  amber:  'text-amber-400 bg-amber-950/50 border-amber-800/60',
  sky:    'text-sky-400 bg-sky-950/50 border-sky-800/60',
  emerald:'text-emerald-400 bg-emerald-950/50 border-emerald-800/60',
};

// ─── API Key Row ──────────────────────────────────────────────

function ApiKeyRow({
  config,
  currentValue,
  onSave,
  saving,
}: {
  config: typeof API_KEY_CONFIGS[0];
  currentValue: string;
  onSave: (key: string, val: string) => Promise<void>;
  saving: boolean;
}) {
  const [draft, setDraft] = useState(currentValue);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync when currentValue changes from parent
  useEffect(() => { setDraft(currentValue); }, [currentValue]);

  const isDirty = draft !== currentValue;

  const handleSave = async () => {
    await onSave(config.key, draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isSet = currentValue.length > 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 transition-all hover:border-zinc-700">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-white">{config.label}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${config.badgeColor}`}>
              {config.provider.toUpperCase()}
            </span>
            {isSet && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 size={11} /> Configured
              </span>
            )}
            {!isSet && (
              <span className="flex items-center gap-1 text-xs text-zinc-600">
                <AlertCircle size={11} /> Not set
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500">{config.hint}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id={`api-key-${config.provider}`}
            type={show ? 'text' : 'password'}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={config.placeholder}
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 pr-10 text-sm text-white font-mono
                       placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
            title={show ? 'Hide key' : 'Show key'}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition
                     bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Model Selector Row ───────────────────────────────────────

function ModelSelectorRow({
  feature,
  currentValue,
  onSave,
  saving,
}: {
  feature: typeof FEATURE_MODEL_KEYS[0];
  currentValue: string;
  onSave: (key: string, val: string) => Promise<void>;
  saving: boolean;
}) {
  const [draft, setDraft] = useState(currentValue);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(currentValue); }, [currentValue]);

  const isDirty = draft !== currentValue;
  const Icon = feature.icon;
  const accent = feature.accent;

  const handleSave = async () => {
    await onSave(feature.key, draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Detect provider from model string
  const detectProvider = (model: string) => {
    if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
    if (model.startsWith('claude')) return 'anthropic';
    if (model.startsWith('gemini')) return 'google';
    return null;
  };

  const activeProvider = detectProvider(draft);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 transition-all hover:border-zinc-700">
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${ACCENT_ICON[accent]}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">{feature.label}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{feature.description}</p>
        </div>
        {draft && (
          <span className="text-xs font-mono text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-lg shrink-0">
            {draft || 'Not set'}
          </span>
        )}
      </div>

      {/* Provider tabs */}
      <div className="space-y-2">
        {Object.entries(MODEL_OPTIONS).map(([providerKey, { label, models }]) => (
          <div key={providerKey}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1.5 px-1">{label}</p>
            <div className="flex flex-wrap gap-1.5">
              {models.map(model => {
                const isActive = draft === model;
                return (
                  <button
                    key={model}
                    onClick={() => setDraft(model)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all border ${
                      isActive
                        ? `bg-violet-600/20 border-violet-500/60 text-violet-300`
                        : 'bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    {model}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Custom model input */}
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1.5 px-1">Custom model ID</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="e.g. llama-3.1-70b-instruct"
              className={`flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono
                         placeholder:text-zinc-600 focus:outline-none focus:ring-2 ${ACCENT_RING[accent]} transition`}
            />
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition
                         bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
              {saving ? '…' : saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function AiSettingsPage() {
  const [configMap, setConfigMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState('');

  // All the config keys we care about
  const allKeys = [
    ...API_KEY_CONFIGS.map(c => c.key),
    ...FEATURE_MODEL_KEYS.map(f => f.key),
  ];

  const fetchConfig = useCallback(async () => {
    setLoading(true); setError('');
    try {
      // Try category endpoint first, fall back to full list
      const res = await adminApi.get<{ data: ConfigEntry[] }>('/api/admin/config/category/ai');
      const entries = res.data.data;
      const map: Record<string, string> = {};
      entries.forEach(e => { map[e.key] = valToStr(e.value); });
      setConfigMap(map);
    } catch {
      // Fallback: load everything and filter client-side
      try {
        const res = await adminApi.get<{ data: ConfigEntry[] }>('/api/admin/config');
        const map: Record<string, string> = {};
        res.data.data
          .filter(e => allKeys.includes(e.key))
          .forEach(e => { map[e.key] = valToStr(e.value); });
        setConfigMap(map);
      } catch {
        setError('Failed to load AI settings.');
      }
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void fetchConfig(); }, [fetchConfig]);

  const handleSave = async (key: string, value: string) => {
    setSavingKey(key); setGlobalError('');
    try {
      await adminApi.put(`/api/admin/config/${key}`, {
        value,
        category: 'ai',
        description: [...API_KEY_CONFIGS, ...FEATURE_MODEL_KEYS.map(f => ({
          key: f.key, hint: f.description,
        }))].find(c => c.key === key)?.['hint' as keyof object] ?? '',
      });
      setConfigMap(prev => ({ ...prev, [key]: value }));
    } catch {
      setGlobalError(`Failed to save ${key}.`);
    } finally { setSavingKey(null); }
  };

  return (
    <PageShell
      title="AI Settings"
      subtitle="API keys and model configuration for AI-powered features"
    >
      {globalError && <ErrorBanner message={globalError} />}
      {error && <ErrorBanner message={error} />}

      {loading ? <Spinner /> : (
        <div className="max-w-3xl space-y-10">

          {/* ── Section: API Keys ── */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl bg-violet-950/50 border border-violet-800/60 flex items-center justify-center">
                <Key size={15} className="text-violet-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">API Keys</h2>
                <p className="text-xs text-zinc-500">Stored securely as encrypted platform config entries</p>
              </div>
            </div>

            <div className="space-y-3">
              {API_KEY_CONFIGS.map(cfg => (
                <ApiKeyRow
                  key={cfg.key}
                  config={cfg}
                  currentValue={configMap[cfg.key] ?? ''}
                  onSave={handleSave}
                  saving={savingKey === cfg.key}
                />
              ))}
            </div>
          </section>

          {/* ── Section: Model Assignment ── */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl bg-amber-950/50 border border-amber-800/60 flex items-center justify-center">
                <Brain size={15} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Model Assignment</h2>
                <p className="text-xs text-zinc-500">Choose which AI model powers each platform feature</p>
              </div>
            </div>

            <div className="space-y-4">
              {FEATURE_MODEL_KEYS.map(feature => (
                <ModelSelectorRow
                  key={feature.key}
                  feature={feature}
                  currentValue={configMap[feature.key] ?? ''}
                  onSave={handleSave}
                  saving={savingKey === feature.key}
                />
              ))}
            </div>
          </section>

          {/* ── Info banner ── */}
          <div className="flex items-start gap-3 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
            <Zap size={14} className="text-violet-400 mt-0.5 shrink-0" />
            <p className="text-xs text-zinc-500 leading-relaxed">
              API keys are stored as platform config entries with the <span className="font-mono text-zinc-400">ai</span> category.
              They are accessible only to admin-role requests. Model selections take effect immediately—no restart required.
            </p>
          </div>

        </div>
      )}
    </PageShell>
  );
}
