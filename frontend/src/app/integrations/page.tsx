'use client';

import * as React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  Building2,
  Mail,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  Activity,
} from 'lucide-react';
import { Skeleton } from '@/components/shared/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
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
import { disconnectGmail, getGmailConnectUrl, getGmailStatus } from '@/lib/api/integrations';

// ---------------------------------------------------------------------------
// Types & mock data
// ---------------------------------------------------------------------------

type IntegrationId = 'hubspot' | 'email';
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
// Page (cache loaded state across navigation)
// ---------------------------------------------------------------------------

let integrationsLoadedOnce = false;

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
  const [tilesLoading, setTilesLoading] = React.useState(!integrationsLoadedOnce);
  React.useEffect(() => {
    if (integrationsLoadedOnce) {
      setTilesLoading(false);
      return;
    }
    const t = setTimeout(() => {
      integrationsLoadedOnce = true;
      setTilesLoading(false);
    }, 600);
    return () => clearTimeout(t);
  }, []);
  const [expandedSettings, setExpandedSettings] = React.useState<IntegrationId | null>(null);
  const [testLoading, setTestLoading] = React.useState<IntegrationId | null>(null);
  const [syncLogFilter, setSyncLogFilter] = React.useState<'all' | SyncStatus>('all');
  const [syncLogPage, setSyncLogPage] = React.useState(0);
  const [toast, setToast] = React.useState<{
    open: boolean;
    variant: 'success' | 'error' | 'default';
    title: string;
    description?: string;
  }>({ open: false, variant: 'default', title: '' });
  const [gmailStatus, setGmailStatus] = React.useState<{
    connected: boolean | null;
    email: string | null;
    last_connected_at: string | null;
  }>({ connected: null, email: null, last_connected_at: null });
  const gmailConnected = gmailStatus.connected;
  const [gmailActionLoading, setGmailActionLoading] = React.useState(false);

  const showToast = (variant: 'success' | 'error', title: string, description?: string) => {
    setToast({ open: true, variant, title, description });
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

  // Fetch Gmail status on mount so the Email Inbox tile shows correct status
  React.useEffect(() => {
    let cancelled = false;
    getGmailStatus()
      .then((data) => {
        if (!cancelled) {
          setGmailStatus({
            connected: data.connected,
            email: data.connected && data.email ? data.email : null,
            last_connected_at: data.connected && data.last_connected_at ? data.last_connected_at : null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setGmailStatus({ connected: false, email: null, last_connected_at: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-fetch Gmail status when user expands the Email Inbox section (e.g. after connecting)
  React.useEffect(() => {
    if (expandedSettings !== 'email') return;
    let cancelled = false;
    getGmailStatus()
      .then((data) => {
        if (!cancelled) {
          setGmailStatus({
            connected: data.connected,
            email: data.connected && data.email ? data.email : null,
            last_connected_at: data.connected && data.last_connected_at ? data.last_connected_at : null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setGmailStatus({ connected: false, email: null, last_connected_at: null });
      });
    return () => {
      cancelled = true;
    };
  }, [expandedSettings]);

  const handleConnectGmail = async () => {
    setGmailActionLoading(true);
    try {
      const { url } = await getGmailConnectUrl();
      window.location.href = url;
    } catch {
      showToast('error', 'Failed to start Gmail connection');
      setGmailActionLoading(false);
    }
  };

  const handleDisconnectGmail = async () => {
    setGmailActionLoading(true);
    try {
      await disconnectGmail();
      setGmailStatus({ connected: false, email: null, last_connected_at: null });
      showToast('success', 'Gmail disconnected');
    } catch {
      showToast('error', 'Failed to disconnect Gmail');
    } finally {
      setGmailActionLoading(false);
    }
  };

  const filteredLog = React.useMemo(() => {
    const list = syncLogFilter === 'all' ? MOCK_SYNC_LOG : MOCK_SYNC_LOG.filter((e) => e.status === syncLogFilter);
    return list;
  }, [syncLogFilter]);

  const PAGE_SIZE = 3;
  const totalPages = Math.ceil(filteredLog.length / PAGE_SIZE) || 1;
  const paginatedLog = filteredLog.slice(syncLogPage * PAGE_SIZE, (syncLogPage + 1) * PAGE_SIZE);

  return (
    <ProtectedRoute>
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
              const isEmail = int.id === 'email';
              const tileStatus =
                isEmail && gmailConnected !== null
                  ? gmailConnected
                    ? 'connected'
                    : 'disconnected'
                  : int.status;
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
                          tileStatus === 'connected'
                            ? 'bg-status-warm/15 text-status-warm'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {isEmail && gmailConnected === null
                          ? 'Checking…'
                          : tileStatus === 'connected'
                            ? 'Connected'
                            : 'Disconnected'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isEmail
                        ? gmailStatus.last_connected_at
                          ? `Last connected: ${formatTimestamp(gmailStatus.last_connected_at)}`
                          : 'Last connected: —'
                        : `Last sync: ${formatTimestamp(int.lastSync)}`}
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
                    {int.id === 'email' && (
                      <div className={cn('flex flex-wrap items-center gap-3', 'pt-4')}>
                        {gmailConnected === null ? (
                          <span className="text-sm text-muted-foreground">Checking Gmail…</span>
                        ) : gmailConnected ? (
                          <>
                            <span className="flex items-center gap-1.5 text-sm text-status-warm">
                              <Check className="h-4 w-4" />
                              {gmailStatus.email
                                ? `Gmail connected: ${gmailStatus.email}`
                                : 'Gmail connected'}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleDisconnectGmail}
                              disabled={gmailActionLoading}
                              className="gap-2"
                            >
                              {gmailActionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                              Disconnect
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={handleConnectGmail}
                            disabled={gmailActionLoading}
                            className="gap-2"
                          >
                            {gmailActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Connect Gmail
                          </Button>
                        )}
                      </div>
                    )}
                    <div className={cn('flex items-center gap-3', (int.id === 'hubspot' || int.id === 'email') && 'pt-4')}>
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
                      {(int.id === 'email' ? gmailConnected : int.status === 'connected') && (
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
    </ProtectedRoute>
  );
}
