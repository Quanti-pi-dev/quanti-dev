'use client';

// ─── AI Settings Page ─────────────────────────────────────────
// Unified view: API keys + model assignments together per provider.
//
// API routes (via Platform Config store):
//   GET  /api/admin/config/category/ai   — load all AI config entries
//   PUT  /api/admin/config/:key          — upsert a config key

import { useEffect, useState, useCallback, useRef } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Spinner, ErrorBanner } from '@/components/page-shell';
import {
  Key, Eye, EyeOff, Save, CheckCircle2, AlertCircle,
  Zap, Bot, Sparkles, BookOpen, ClipboardList,
  ChevronDown, ExternalLink,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface ConfigEntry {
  key: string;
  value: unknown;
  category: string;
  description?: string;
}

// ─── Provider definitions ─────────────────────────────────────

interface ProviderDef {
  id: string;
  label: string;
  apiKeyConfigKey: string;
  placeholder: string;
  hint: string;
  tokenUrl: string;
  tokenUrlLabel: string;
  accent: string;
  badgeCls: string;
  iconBg: string;
  models: string[];
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    apiKeyConfigKey: 'ai_api_key_openai',
    placeholder: 'sk-proj-...',
    hint: 'Get your key from',
    tokenUrl: 'https://platform.openai.com/api-keys',
    tokenUrlLabel: 'platform.openai.com',
    accent: 'emerald',
    badgeCls: 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400',
    iconBg:   'bg-emerald-950/50 border-emerald-800/60 text-emerald-400',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    apiKeyConfigKey: 'ai_api_key_anthropic',
    placeholder: 'sk-ant-...',
    hint: 'Get your key from',
    tokenUrl: 'https://console.anthropic.com/settings/keys',
    tokenUrlLabel: 'console.anthropic.com',
    accent: 'orange',
    badgeCls: 'bg-orange-950/60 border-orange-800/60 text-orange-400',
    iconBg:   'bg-orange-950/50 border-orange-800/60 text-orange-400',
    models: [
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'claude-haiku-3-5',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ],
  },
  {
    id: 'google',
    label: 'Google',
    apiKeyConfigKey: 'ai_api_key_google',
    placeholder: 'AIza...',
    hint: 'Get your key from',
    tokenUrl: 'https://aistudio.google.com/apikey',
    tokenUrlLabel: 'aistudio.google.com',
    accent: 'sky',
    badgeCls: 'bg-sky-950/60 border-sky-800/60 text-sky-400',
    iconBg:   'bg-sky-950/50 border-sky-800/60 text-sky-400',
    models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    apiKeyConfigKey: 'ai_api_key_nvidia',
    placeholder: 'nvapi-...',
    hint: 'Get your key from',
    tokenUrl: 'https://build.nvidia.com/models',
    tokenUrlLabel: 'build.nvidia.com',
    accent: 'green',
    badgeCls: 'bg-green-950/60 border-green-800/60 text-green-400',
    iconBg:   'bg-green-950/50 border-green-800/60 text-green-400',
    models: [
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'deepseek-ai/deepseek-r1',
      'meta/llama-3.3-70b-instruct',
      'mistralai/mistral-large-2-instruct',
      'moonshotai/kimi-k2.6',
      'qwen/qwen2.5-72b-instruct',
    ],
  },
  {
    id: 'freellmapi',
    label: 'FreeLLMAPI (Proxy)',
    apiKeyConfigKey: 'ai_api_key_freellmapi',
    placeholder: 'freellmapi-...',
    hint: 'Unified key from your self-hosted proxy —',
    tokenUrl: 'http://localhost:3001',
    tokenUrlLabel: 'open dashboard via SSH tunnel',
    accent: 'violet',
    badgeCls: 'bg-violet-950/60 border-violet-800/60 text-violet-400',
    iconBg:   'bg-violet-950/50 border-violet-800/60 text-violet-400',
    models: [
      'free/auto',
      'free/gemini-2.5-flash',
      'free/llama-3.3-70b',
      'free/qwen-2.5-72b',
      'free/deepseek-v3',
      'free/mistral-large',
    ],
  },
];

// ─── Feature definitions ──────────────────────────────────────

interface FeatureDef {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  accent: string;
}

const FEATURES: FeatureDef[] = [
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

// ─── Helpers ─────────────────────────────────────────────────

function valToStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

const NVIDIA_PREFIXES = ['deepseek', 'mistral', 'meta/', 'nvidia/', 'moonshot', 'qwen', 'microsoft/', 'nv-', 'nemotron', 'llama'];

function detectProvider(model: string): string | null {
  if (!model) return null;
  const m = model.toLowerCase();
  if (m.startsWith('free/')) return 'freellmapi';
  if (m.startsWith('gpt') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return 'openai';
  if (m.startsWith('claude')) return 'anthropic';
  if (m.startsWith('gemini')) return 'google';
  if (m.includes('/') || NVIDIA_PREFIXES.some(p => m.startsWith(p))) return 'nvidia';
  return null;
}

const ACCENT_ICON: Record<string, string> = {
  violet:  'text-violet-400 bg-violet-950/50 border-violet-800/60',
  amber:   'text-amber-400 bg-amber-950/50 border-amber-800/60',
  sky:     'text-sky-400 bg-sky-950/50 border-sky-800/60',
  emerald: 'text-emerald-400 bg-emerald-950/50 border-emerald-800/60',
};

// ─── Provider Row ─────────────────────────────────────────────
// Compact row with inline API key input.

function ProviderRow({
  provider,
  apiKeyValue,
  onSaveKey,
  saving,
  featureCount,
}: {
  provider: ProviderDef;
  apiKeyValue: string;
  onSaveKey: (key: string, val: string) => Promise<void>;
  saving: boolean;
  featureCount: number;
}) {
  const [draft, setDraft] = useState(apiKeyValue);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(apiKeyValue); }, [apiKeyValue]);

  const isDirty = draft !== apiKeyValue;
  const isSet = apiKeyValue.length > 0;

  const handleSave = async () => {
    await onSaveKey(provider.apiKeyConfigKey, draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 transition-all hover:border-zinc-700 group">
      {/* Top row: label + status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${provider.iconBg}`}>
            <Key size={14} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{provider.label}</h3>
              {isSet ? (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded-full font-medium">
                  <CheckCircle2 size={9} /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-zinc-600 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-full font-medium">
                  <AlertCircle size={9} /> Not set
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {provider.models.length} models
              {featureCount > 0 && <span className="text-zinc-600"> · Powering {featureCount} feature{featureCount > 1 ? 's' : ''}</span>}
              {' · '}
              <a href={provider.tokenUrl} target="_blank" rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 inline-flex items-center gap-0.5 transition-colors">
                Get key <ExternalLink size={9} />
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* API Key Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id={`api-key-${provider.id}`}
            type={show ? 'text' : 'password'}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={provider.placeholder}
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
          {saving ? '…' : saved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Feature Assignment Card ──────────────────────────────────
// Clean card with a grouped <select> dropdown instead of
// repeating every model from every provider.

function FeatureAssignmentCard({
  feature,
  currentModel,
  onSave,
  saving,
  apiKeyStatus,
}: {
  feature: FeatureDef;
  currentModel: string;
  onSave: (key: string, val: string) => Promise<void>;
  saving: boolean;
  apiKeyStatus: Record<string, boolean>;
}) {
  const [draft, setDraft] = useState(currentModel);
  const [customMode, setCustomMode] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(currentModel); }, [currentModel]);

  // Check if current draft is a known model
  const isKnownModel = PROVIDERS.some(p => p.models.includes(draft));
  useEffect(() => {
    if (draft && !isKnownModel) setCustomMode(true);
  }, [draft, isKnownModel]);

  const isDirty = draft !== currentModel;
  const Icon = feature.icon;
  const accent = feature.accent;

  const handleSave = async () => {
    await onSave(feature.key, draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resolvedProvider = detectProvider(draft);
  const providerDef = PROVIDERS.find(p => p.id === resolvedProvider);
  const hasKey = resolvedProvider ? (apiKeyStatus[resolvedProvider] ?? false) : true;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 transition-all hover:border-zinc-700">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${ACCENT_ICON[accent]}`}>
          <Icon size={16} />
        </div>

        {/* Label + desc */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">{feature.label}</h3>
          <p className="text-[11px] text-zinc-500">{feature.description}</p>
        </div>

        {/* Provider badge */}
        {providerDef && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium inline-flex items-center gap-1 shrink-0 ${providerDef.badgeCls}`}>
            {hasKey ? <CheckCircle2 size={9} /> : <AlertCircle size={9} />}
            {providerDef.label}
          </span>
        )}
      </div>

      {/* Model selector + save */}
      <div className="mt-3 flex gap-2">
        {customMode ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="e.g. llama-3.1-70b-instruct"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono
                       placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
          />
        ) : (
          <div className="relative flex-1">
            <select
              value={draft}
              onChange={e => {
                if (e.target.value === '__custom__') {
                  setCustomMode(true);
                  setTimeout(() => inputRef.current?.focus(), 50);
                } else {
                  setDraft(e.target.value);
                }
              }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 pr-9 text-sm text-white font-mono
                         appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500 transition cursor-pointer"
            >
              <option value="" className="text-zinc-500">Select a model…</option>
              {PROVIDERS.map(p => (
                <optgroup key={p.id} label={`${p.label}${apiKeyStatus[p.id] ? ' ✓' : ''}`}>
                  {p.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="Other">
                <option value="__custom__">Enter custom model ID…</option>
              </optgroup>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
        )}

        {customMode && (
          <button
            onClick={() => { setCustomMode(false); if (!draft) setDraft(currentModel); }}
            className="px-3 py-2 rounded-lg text-xs font-medium transition
                       bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 shrink-0"
          >
            List
          </button>
        )}

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

      {/* Warning if selected provider has no key */}
      {resolvedProvider && !hasKey && (
        <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-800/40 rounded-xl px-3 py-2.5 mt-3">
          <AlertCircle size={13} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-300/80 leading-relaxed">
            {providerDef?.label ?? resolvedProvider} API key is not configured. Add it above for this model to work.
          </p>
        </div>
      )}
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
    ...PROVIDERS.map(p => p.apiKeyConfigKey),
    ...FEATURES.map(f => f.key),
  ];

  const fetchConfig = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: ConfigEntry[] }>('/api/admin/config/category/ai');
      const entries = res.data.data;
      const map: Record<string, string> = {};
      entries.forEach(e => { map[e.key] = valToStr(e.value); });
      setConfigMap(map);
    } catch {
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
        description: '',
      });
      setConfigMap(prev => ({ ...prev, [key]: value }));
    } catch {
      setGlobalError(`Failed to save ${key}.`);
    } finally { setSavingKey(null); }
  };

  // Build a lookup: provider → isSet
  const apiKeyStatus: Record<string, boolean> = {};
  PROVIDERS.forEach(p => {
    apiKeyStatus[p.id] = (configMap[p.apiKeyConfigKey] ?? '').length > 0;
  });

  // Count features per provider
  const providerFeatureCounts: Record<string, number> = {};
  PROVIDERS.forEach(p => { providerFeatureCounts[p.id] = 0; });
  FEATURES.forEach(f => {
    const model = configMap[f.key] ?? '';
    const prov = detectProvider(model);
    if (prov && providerFeatureCounts[prov] !== undefined) {
      providerFeatureCounts[prov]!++;
    }
  });

  return (
    <PageShell
      title="AI Settings"
      subtitle="Configure API keys and choose which models power each feature"
    >
      {globalError && <ErrorBanner message={globalError} />}
      {error && <ErrorBanner message={error} />}

      {loading ? <Spinner /> : (
        <div className="max-w-3xl space-y-10">

          {/* ── Section 1: Providers & API Keys ── */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl bg-violet-950/50 border border-violet-800/60 flex items-center justify-center">
                <Key size={15} className="text-violet-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Providers & API Keys</h2>
                <p className="text-xs text-zinc-500">Connect your AI providers. Features below will use whichever key matches their selected model.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PROVIDERS.map(provider => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  apiKeyValue={configMap[provider.apiKeyConfigKey] ?? ''}
                  onSaveKey={handleSave}
                  saving={savingKey === provider.apiKeyConfigKey}
                  featureCount={providerFeatureCounts[provider.id] ?? 0}
                />
              ))}
            </div>
          </section>

          {/* ── Section 2: Feature → Model Assignment ── */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl bg-amber-950/50 border border-amber-800/60 flex items-center justify-center">
                <Sparkles size={15} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Feature → Model Assignment</h2>
                <p className="text-xs text-zinc-500">
                  Pick which model powers each AI feature. The matching provider&apos;s API key is used automatically.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FEATURES.map(feature => (
                <FeatureAssignmentCard
                  key={feature.key}
                  feature={feature}
                  currentModel={configMap[feature.key] ?? ''}
                  onSave={handleSave}
                  saving={savingKey === feature.key}
                  apiKeyStatus={apiKeyStatus}
                />
              ))}
            </div>
          </section>

          {/* ── Info banner ── */}
          <div className="flex items-start gap-3 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
            <Zap size={14} className="text-violet-400 mt-0.5 shrink-0" />
            <p className="text-xs text-zinc-500 leading-relaxed">
              When you select a model for a feature, the system automatically uses the matching provider&apos;s API key.
              For example, selecting <span className="font-mono text-zinc-400">claude-sonnet-4-5</span> routes
              to the Anthropic key. Changes take effect immediately—no restart required.
            </p>
          </div>

        </div>
      )}
    </PageShell>
  );
}
