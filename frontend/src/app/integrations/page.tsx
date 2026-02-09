'use client';

import * as React from 'react';
import {
  Building2,
  Mail,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Activity,
} from 'lucide-react';
import { Skeleton } from '@/components/shared/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
} from '@/components/ui/toast';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types & mock data
// ---------------------------------------------------------------------------

type IntegrationId = 'hubspot' | 'email' | 'sms';
type SyncStatus = 'success' | 'error';

interface IntegrationTile {
  id: IntegrationId;
  name: string;
  icon: React.ElementType;
  brandBg: string;
  status: 'connected' | 'disconnected';
  lastSync: string;
}

const INTEGRATIONS: IntegrationTile[] = [
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    icon: Building2,
    brandBg: 'bg-orange-500/15',
    status: 'connected',
    lastSync: '2024-01-15T14:32:00Z',
  },
  {
    id: 'email',
    name: 'Email Inbox',
    icon: Mail,
    brandBg: 'bg-blue-500/15',
    status: 'connected',
    lastSync: '2024-01-15T14:30:00Z',
  },
  {
    id: 'sms',
    name: 'SMS Provider',
    icon: MessageSquare,
    brandBg: 'bg-emerald-500/15',
    status: 'disconnected',
    lastSync: '2024-01-14T09:00:00Z',
  },
];

interface SyncLogEntry {
  id: string;
  action: string;
  status: SyncStatus;
  timestamp: string;
  durationMs: number;
  details?: string;
}

const MOCK_SYNC_LOG: SyncLogEntry[] = [
  { id: '1', action: 'Contacts sync', status: 'success', timestamp: '2024-01-15T14:32:00Z', durationMs: 2400 },
  { id: '2', action: 'Activities sync', status: 'success', timestamp: '2024-01-15T14:30:00Z', durationMs: 1800 },
  { id: '3', action: 'Deals sync', status: 'error', timestamp: '2024-01-15T14:28:00Z', durationMs: 500, details: 'Rate limit exceeded' },
  { id: '4', action: 'Contacts sync', status: 'success', timestamp: '2024-01-15T12:00:00Z', durationMs: 2100 },
  { id: '5', action: 'Email sync', status: 'error', timestamp: '2024-01-15T11:45:00Z', durationMs: 100, details: 'Connection timeout' },
];

const MOCK_LAST_ERROR = {
  message: 'Rate limit exceeded (429)',
  timestamp: '2024-01-15T14:28:00Z',
  stack: 'Error: Rate limit exceeded\n  at ApiClient.request (/app/lib/api.js:42:11)\n  at syncDeals (/app/jobs/sync.js:88:5)',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function IntegrationTileSkeleton() {
  return (
    <Card className="overflow-hidden shadow-card">
      <div className="p-6 flex items-center justify-center bg-muted/30">
        <Skeleton variant="circle" className="h-12 w-12" />
      </div>
      <CardContent className="p-4 space-y-3">
        <Skeleton variant="text" className="h-5 w-32" />
        <div className="flex items-center justify-between gap-2">
          <Skeleton variant="text" className="h-5 w-24 rounded-full" />
          <Skeleton variant="rectangle" className="h-9 w-20" />
        </div>
        <Skeleton variant="text" className="h-3 w-28" />
      </CardContent>
    </Card>
  );
}

export default function IntegrationsPage(): React.ReactElement {
  const [tilesLoading, setTilesLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setTilesLoading(false), 600);
    return () => clearTimeout(t);
  }, []);
  const [expandedSettings, setExpandedSettings] = React.useState<IntegrationId | null>(null);
  const [apiKeyVisible, setApiKeyVisible] = React.useState<Record<IntegrationId, boolean>>({
    hubspot: false,
    email: false,
    sms: false,
  });
  const [testLoading, setTestLoading] = React.useState<IntegrationId | null>(null);
  const [syncLogFilter, setSyncLogFilter] = React.useState<'all' | SyncStatus>('all');
  const [syncLogPage, setSyncLogPage] = React.useState(0);
  const [lastErrorOpen, setLastErrorOpen] = React.useState(false);
  const [stackExpanded, setStackExpanded] = React.useState(false);
  const [toast, setToast] = React.useState<{
    open: boolean;
    variant: 'success' | 'error' | 'default';
    title: string;
    description?: string;
  }>({ open: false, variant: 'default', title: '' });
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const showToast = (variant: 'success' | 'error', title: string, description?: string) => {
    setToast({ open: true, variant, title, description });
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast('success', 'Copied to clipboard');
    } catch {
      showToast('error', 'Failed to copy');
    }
  };

  const toggleApiKeyVisibility = (id: IntegrationId) => {
    setApiKeyVisible((p) => ({ ...p, [id]: !p[id] }));
  };

  const handleTestConnection = async (id: IntegrationId) => {
    setTestLoading(id);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      showToast('success', 'Connection successful', `${INTEGRATIONS.find((i) => i.id === id)?.name} is connected.`);
    } catch {
      showToast('error', 'Connection failed', 'Check your API key and try again.');
    }
    setTestLoading(null);
  };

  const handleRerunJob = () => {
    showToast('success', 'Job queued', 'Last job has been re-queued.');
  };

  const handleResendPayload = () => {
    showToast('success', 'Payload sent', 'Webhook payload has been resent.');
  };

  const filteredLog = React.useMemo(() => {
    const list = syncLogFilter === 'all' ? MOCK_SYNC_LOG : MOCK_SYNC_LOG.filter((e) => e.status === syncLogFilter);
    return list;
  }, [syncLogFilter]);

  const PAGE_SIZE = 3;
  const totalPages = Math.ceil(filteredLog.length / PAGE_SIZE) || 1;
  const paginatedLog = filteredLog.slice(syncLogPage * PAGE_SIZE, (syncLogPage + 1) * PAGE_SIZE);

  const mockApiKey = 'sk_live_••••••••••••••••••••••••';
  const mockWebhookUrl = 'https://api.example.com/webhooks/hubspot';

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage connected services and view sync status
        </p>
      </header>

      {/* Integration Tiles */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tilesLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <IntegrationTileSkeleton key={i} />
              ))}
            </>
          ) : (
            INTEGRATIONS.map((int) => {
              const Icon = int.icon;
              return (
                <Card key={int.id} className="overflow-hidden shadow-card">
                  <div className={cn('p-6 flex items-center justify-center', int.brandBg)}>
                    <Icon className="h-12 w-12 text-foreground/80" />
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <p className="font-semibold">{int.name}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          int.status === 'connected'
                            ? 'bg-status-warm/15 text-status-warm'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {int.status === 'connected' ? 'Connected' : 'Disconnected'}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setExpandedSettings(expandedSettings === int.id ? null : int.id)
                        }
                      >
                        Configure
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last sync: {formatTimestamp(int.lastSync)}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {/* Connection Settings (collapsible per integration) */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Connection Settings</h2>
        <div className="space-y-2">
          {INTEGRATIONS.map((int) => {
            const isExpanded = expandedSettings === int.id;
            return (
              <Card key={int.id}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedSettings(isExpanded ? null : int.id)}
                >
                  <CardTitle className="text-base font-medium">{int.name}</CardTitle>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {isExpanded && (
                  <CardContent className="pt-0 pb-4 space-y-4 border-t">
                    <div className="pt-4 space-y-2">
                      <Label>API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          type={apiKeyVisible[int.id] ? 'text' : 'password'}
                          value={mockApiKey}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => toggleApiKeyVisibility(int.id)}
                          aria-label={apiKeyVisible[int.id] ? 'Hide' : 'Show'}
                        >
                          {apiKeyVisible[int.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(mockApiKey, `api-${int.id}`)}
                          aria-label="Copy"
                        >
                          {copiedId === `api-${int.id}` ? (
                            <Check className="h-4 w-4 text-status-warm" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Webhook URL</Label>
                      <div className="flex gap-2">
                        <Input
                          value={mockWebhookUrl}
                          readOnly
                          className="font-mono text-sm bg-muted/50"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(mockWebhookUrl, `webhook-${int.id}`)}
                          aria-label="Copy"
                        >
                          {copiedId === `webhook-${int.id}` ? (
                            <Check className="h-4 w-4 text-status-warm" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => handleTestConnection(int.id)}
                        disabled={testLoading !== null}
                        className="gap-2"
                      >
                        {testLoading === int.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Test Connection
                      </Button>
                      {int.status === 'connected' && (
                        <span className="flex items-center gap-1.5 text-sm text-status-warm">
                          <span className="h-2 w-2 rounded-full bg-status-warm" />
                          Active
                        </span>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Troubleshooting */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Troubleshooting</h2>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleRerunJob}>
                Re-run Last Job
              </Button>
              <Button
                variant="outline"
                onClick={() => setLastErrorOpen(!lastErrorOpen)}
              >
                {lastErrorOpen ? 'Hide Last Error' : 'View Last Error'}
              </Button>
              <Button variant="outline" onClick={handleResendPayload}>
                Resend Payload
              </Button>
            </div>
            {lastErrorOpen && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-status-at-risk shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-status-at-risk">{MOCK_LAST_ERROR.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimestamp(MOCK_LAST_ERROR.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          `${MOCK_LAST_ERROR.message}\n${MOCK_LAST_ERROR.stack}`,
                          'error'
                        )
                      }
                    >
                      Copy Error
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setLastErrorOpen(false)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                    onClick={() => setStackExpanded(!stackExpanded)}
                  >
                    {stackExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Stack trace
                  </button>
                  {stackExpanded && (
                    <pre className="mt-2 p-3 rounded bg-muted text-xs overflow-auto max-h-32">
                      {MOCK_LAST_ERROR.stack}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Sync Log */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Sync Log</h2>
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center gap-4 p-4 border-b">
              <Label className="text-sm">Filter</Label>
              <Select
                value={syncLogFilter}
                onValueChange={(v) => {
                  setSyncLogFilter(v as 'all' | SyncStatus);
                  setSyncLogPage(0);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filteredLog.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No sync activities yet."
                description="Sync events will appear here once your integrations run."
                className="py-10"
              />
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="md:hidden space-y-3 p-4">
                  {paginatedLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-border bg-card p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{entry.action}</span>
                        <span
                          className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                            entry.status === 'success'
                              ? 'bg-status-warm/15 text-status-warm'
                              : 'bg-status-at-risk/15 text-status-at-risk'
                          )}
                        >
                          {entry.status === 'success' ? 'Success' : 'Error'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(entry.timestamp)} · {formatDuration(entry.durationMs)}
                      </p>
                      {entry.details && (
                        <p className="text-xs text-muted-foreground truncate" title={entry.details}>
                          {entry.details}
                        </p>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 mt-1">
                        View Details
                      </Button>
                    </div>
                  ))}
                </div>
                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Action</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Timestamp</th>
                        <th className="text-left p-3 font-medium">Duration</th>
                        <th className="text-left p-3 font-medium w-24" />
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLog.map((entry) => (
                        <tr key={entry.id} className="border-b last:border-0">
                          <td className="p-3">{entry.action}</td>
                          <td className="p-3">
                            <span
                              className={cn(
                                'text-xs font-medium px-2 py-0.5 rounded-full',
                                entry.status === 'success'
                                  ? 'bg-status-warm/15 text-status-warm'
                                  : 'bg-status-at-risk/15 text-status-at-risk'
                              )}
                            >
                              {entry.status === 'success' ? 'Success' : 'Error'}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {formatTimestamp(entry.timestamp)}
                          </td>
                          <td className="p-3">{formatDuration(entry.durationMs)}</td>
                          <td className="p-3">
                            <Button variant="ghost" size="sm" className="h-8">
                              View Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-t">
              <p className="text-xs text-muted-foreground">
                Showing {syncLogPage * PAGE_SIZE + 1}–{Math.min((syncLogPage + 1) * PAGE_SIZE, filteredLog.length)} of {filteredLog.length}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={syncLogPage === 0}
                  onClick={() => setSyncLogPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={syncLogPage >= totalPages - 1}
                  onClick={() => setSyncLogPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <Toast
        open={toast.open}
        onOpenChange={(open) => !open && setToast((p) => ({ ...p, open: false }))}
        variant={toast.variant}
      >
        <ToastTitle>{toast.title}</ToastTitle>
        {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
        <ToastClose />
      </Toast>
    </div>
  );
}
