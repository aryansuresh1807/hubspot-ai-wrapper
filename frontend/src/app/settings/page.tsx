'use client';

import * as React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  useSettingsStore,
  type DraftTone,
  type EmailFrequency,
  type UrgencyLevel,
  type RelationshipStatus,
  type DateFormat,
} from '@/lib/store/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
} from '@/components/ui/toast';
import { StatusChip } from '@/components/shared/status-chip';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Check, LogOut } from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRAFT_TONES: { value: DraftTone; label: string }[] = [
  { value: 'formal', label: 'Formal' },
  { value: 'concise', label: 'Concise' },
  { value: 'warm', label: 'Warm' },
];

const EMAIL_FREQUENCIES: { value: EmailFrequency; label: string }[] = [
  { value: 'immediate', label: 'Immediate' },
  { value: 'daily', label: 'Daily Digest' },
  { value: 'weekly', label: 'Weekly Digest' },
];

const URGENCY_OPTIONS: { value: UrgencyLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const RELATIONSHIP_OPTIONS: RelationshipStatus[] = [
  'Active',
  'Warm',
  'Cooling',
  'Dormant',
  'At-Risk',
];

const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
];

const TIME_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'UTC',
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage(): React.ReactElement {
  const settings = useSettingsStore((s) => s.settings);
  const setSetting = useSettingsStore((s) => s.setSetting);
  const save = useSettingsStore((s) => s.save);
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);
  const isDirty = useSettingsStore((s) => s.isDirty);
  const { signOut, user } = useAuth();
  const queryClient = useQueryClient();

  const [resetDialogOpen, setResetDialogOpen] = React.useState(false);

  const handleSignOut = React.useCallback(() => {
    queryClient.removeQueries({ queryKey: ['dashboardState'] });
    signOut();
  }, [queryClient, signOut]);
  const [savedFeedback, setSavedFeedback] = React.useState(false);
  const [toast, setToast] = React.useState<{
    open: boolean;
    variant: 'success' | 'default';
    title: string;
    description?: string;
  }>({ open: false, variant: 'default', title: '' });

  const dirty = isDirty();

  const showToast = (title: string, description?: string) => {
    setToast({ open: true, variant: 'success', title, description });
  };

  const handleSave = () => {
    save();
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
    showToast('Settings saved', 'Your preferences have been updated.');
  };

  const handleResetConfirm = () => {
    resetToDefaults();
    setResetDialogOpen(false);
    showToast('Reset to defaults', 'All settings have been restored.');
  };

  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  return (
    <ProtectedRoute>
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize your CRM experience
        </p>
      </header>

      {/* AI Processing Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Processing Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Auto-process notes</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically extract contacts and details from pasted notes when you send for processing.
              </p>
            </div>
            <Switch
              checked={settings.autoProcessNotes}
              onCheckedChange={(v) => setSetting('autoProcessNotes', v === true)}
            />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Show confidence scores</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Display confidence percentages next to AI-extracted fields so you can spot low-confidence values.
              </p>
            </div>
            <Switch
              checked={settings.showConfidenceScores}
              onCheckedChange={(v) => setSetting('showConfidenceScores', v === true)}
            />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Auto-suggest touch dates</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Show AI-recommended follow-up dates based on context and past activity.
              </p>
            </div>
            <Switch
              checked={settings.autoSuggestTouchDates}
              onCheckedChange={(v) => setSetting('autoSuggestTouchDates', v === true)}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Default draft tone</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              Preferred tone for AI-generated follow-up drafts (Formal, Concise, or Warm).
            </p>
            <Select
              value={settings.defaultDraftTone}
              onValueChange={(v) => setSetting('defaultDraftTone', v as DraftTone)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DRAFT_TONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Email notifications</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receive email when activities are processed or need review.
              </p>
            </div>
            <Switch
              checked={settings.emailNotifications}
              onCheckedChange={(v) => setSetting('emailNotifications', v === true)}
            />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Activity reminders</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get reminded about upcoming follow-ups and tasks.
              </p>
            </div>
            <Switch
              checked={settings.activityReminders}
              onCheckedChange={(v) => setSetting('activityReminders', v === true)}
            />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Processing alerts</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Notify when background processing fails or needs attention.
              </p>
            </div>
            <Switch
              checked={settings.processingAlerts}
              onCheckedChange={(v) => setSetting('processingAlerts', v === true)}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Email frequency</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              How often to send digest emails when using digest mode.
            </p>
            <Select
              value={settings.emailFrequency}
              onValueChange={(v) => setSetting('emailFrequency', v as EmailFrequency)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Default Values */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Values</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="defaultReminder" className="text-sm font-medium">
              Default reminder (days)
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              Number of days from today for new activity reminders when not specified.
            </p>
            <Input
              id="defaultReminder"
              type="number"
              min={1}
              max={365}
              value={settings.defaultReminderDays}
              onChange={(e) =>
                setSetting('defaultReminderDays', Math.max(1, Math.min(365, Number(e.target.value) || 1)))
              }
              className="w-24"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Default relationship status</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              Pre-selected status for new contacts when not set by extraction.
            </p>
            <Select
              value={settings.defaultRelationshipStatus}
              onValueChange={(v) => setSetting('defaultRelationshipStatus', v as RelationshipStatus)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <StatusChip status={s} size="sm" />
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Default urgency level</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              Default urgency for new activities (Low, Medium, High).
            </p>
            <Select
              value={settings.defaultUrgency}
              onValueChange={(v) => setSetting('defaultUrgency', v as UrgencyLevel)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {URGENCY_OPTIONS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Display Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Compact view</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use tighter spacing and smaller cards in lists and dashboard.
              </p>
            </div>
            <Switch
              checked={settings.compactView}
              onCheckedChange={(v) => setSetting('compactView', v === true)}
            />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Show opportunity indicators</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Display opportunity percentage bars on activity cards.
              </p>
            </div>
            <Switch
              checked={settings.showOpportunityIndicators}
              onCheckedChange={(v) => setSetting('showOpportunityIndicators', v === true)}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Date format</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              How dates are displayed across the app.
            </p>
            <Select
              value={settings.dateFormat}
              onValueChange={(v) => setSetting('dateFormat', v as DateFormat)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Time zone</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              Your time zone for timestamps and reminders.
            </p>
            <Select
              value={settings.timeZone}
              onValueChange={(v) => setSetting('timeZone', v)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_ZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={!dirty} className="gap-2">
          {savedFeedback ? (
            <Check className="h-4 w-4" />
          ) : null}
          {savedFeedback ? 'Saved!' : 'Save Settings'}
        </Button>
        <Button variant="secondary" onClick={() => setResetDialogOpen(true)}>
          Reset to Defaults
        </Button>
      </div>

      {/* Account / Sign out */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Signed in to your account. Sign out to end your session.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {(user?.user_metadata?.full_name || user?.email) && (
            <div className="text-sm">
              {user?.user_metadata?.full_name && (
                <p className="font-medium text-foreground">{user.user_metadata.full_name}</p>
              )}
              {user?.email && (
                <p className="text-muted-foreground">{user.email}</p>
              )}
            </div>
          )}
          <Button
            variant="outline"
            className="gap-2 text-status-at-risk border-status-at-risk/50 hover:bg-status-at-risk/10 hover:text-status-at-risk"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* Reset confirmation */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to defaults?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            All settings will be restored to their default values. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleResetConfirm}>
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
