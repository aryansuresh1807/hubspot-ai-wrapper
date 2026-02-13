'use client';

import * as React from 'react';
import { Suspense } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, X, Users, Search, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusChip, type RelationshipStatus } from '@/components/shared/status-chip';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
} from '@/components/ui/toast';
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  searchContacts,
  type Contact as ApiContact,
} from '@/lib/api';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const RELATIONSHIP_OPTIONS: RelationshipStatus[] = [
  'Active',
  'Warm',
  'Cooling',
  'Dormant',
  'At-Risk',
];

const MOCK_ACCOUNTS = [
  { id: 'a1', name: 'Acme Corp' },
  { id: 'a2', name: 'Globex Inc' },
  { id: 'a3', name: 'Wayne Industries' },
];

const MOCK_CONTACTS = [
  { id: 'c1', name: 'Jane Cooper' },
  { id: 'c2', name: 'Robert Fox' },
];

const MOCK_INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-+.()]*$/;

const DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Hooks & helpers
// ---------------------------------------------------------------------------

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

function validatePhone(phone: string): boolean {
  if (!phone.trim()) return true;
  return PHONE_REGEX.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

// ---------------------------------------------------------------------------
// Debounced autocomplete
// ---------------------------------------------------------------------------

function DebouncedAutocomplete<T extends { id: string }>({
  value,
  onChange,
  placeholder,
  options,
  getOptionLabel,
  onSelect,
  debounceMs = DEBOUNCE_MS,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: T[];
  getOptionLabel: (opt: T) => string;
  onSelect: (opt: T) => void;
  debounceMs?: number;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const debouncedQuery = useDebouncedValue(value, debounceMs);
  const ref = React.useRef<HTMLDivElement>(null);
  const filtered = React.useMemo(
    () =>
      !debouncedQuery.trim()
        ? options
        : options.filter((o) =>
            getOptionLabel(o).toLowerCase().includes(debouncedQuery.toLowerCase())
          ),
    [options, debouncedQuery, getOptionLabel]
  );
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <div ref={ref} className={cn('relative', className)}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {open && filtered.length > 0 && (
        <ul
          className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover py-1 shadow-soft-lg max-h-48 overflow-auto"
          role="listbox"
        >
          {filtered.slice(0, 8).map((opt) => (
            <li
              key={opt.id}
              role="option"
              aria-selected={false}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent"
              onClick={() => {
                onChange(getOptionLabel(opt));
                onSelect(opt);
                setOpen(false);
              }}
            >
              {getOptionLabel(opt)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact tab
// ---------------------------------------------------------------------------

function ContactTabContent(): React.ReactElement {
  const [contacts, setContacts] = React.useState<ApiContact[]>([]);
  const [isContactsLoading, setIsContactsLoading] = React.useState(true);
  const [contactError, setContactError] = React.useState<string | null>(null);
  const [searchInput, setSearchInput] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [jobTitle, setJobTitle] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [accountSearchDisplay, setAccountSearchDisplay] = React.useState('');
  const [relationshipStatus, setRelationshipStatus] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [contactSubmitLoading, setContactSubmitLoading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{
    open: boolean;
    variant: 'success' | 'error' | 'default';
    title: string;
    description?: string;
  }>({ open: false, variant: 'default', title: '' });

  const showToast = (variant: 'success' | 'error', title: string, description?: string) => {
    setToast({ open: true, variant, title, description });
  };

  const fetchContacts = React.useCallback(async (search?: string) => {
    try {
      const res = await getContacts(search);
      setContacts(res.contacts ?? []);
      setContactError(null);
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'Failed to load contacts');
      setContacts([]);
      showToast('error', 'Failed to load contacts', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setIsContactsLoading(false);
      setIsSearching(false);
    }
  }, []);

  const refreshContactList = React.useCallback(async () => {
    const q = searchInput.trim();
    if (q) {
      try {
        const list = await searchContacts(q);
        setContacts(list);
        setContactError(null);
      } catch {
        await fetchContacts();
      }
    } else {
      await fetchContacts();
    }
  }, [searchInput, fetchContacts]);

  React.useEffect(() => {
    setIsContactsLoading(true);
    fetchContacts();
  }, [fetchContacts]);

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 400);
  React.useEffect(() => {
    if (!debouncedSearch) {
      fetchContacts();
      return;
    }
    setIsSearching(true);
    searchContacts(debouncedSearch)
      .then((list) => {
        setContacts(list);
        setContactError(null);
      })
      .catch((err) => {
        showToast('error', 'Search failed', err instanceof Error ? err.message : 'Try again.');
      })
      .finally(() => setIsSearching(false));
  }, [debouncedSearch, fetchContacts]);

  const resetContactForm = () => {
    setEditingId(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setJobTitle('');
    setAccountId('');
    setAccountSearchDisplay('');
    setRelationshipStatus('');
    setNotes('');
    setErrors({});
  };

  const loadContactIntoForm = (c: ApiContact) => {
    setEditingId(c.id);
    setFirstName(c.first_name ?? '');
    setLastName(c.last_name ?? '');
    setEmail(c.email ?? '');
    setPhone('');
    setJobTitle('');
    setAccountId('');
    setAccountSearchDisplay('');
    setRelationshipStatus('');
    setNotes('');
    setErrors({});
  };

  const handleContactSubmit = async (e: React.FormEvent, _linkToActivity: boolean, addAnother: boolean) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = 'First name is required';
    if (!lastName.trim()) next.lastName = 'Last name is required';
    if (!email.trim()) next.email = 'Email is required';
    else if (!validateEmail(email)) next.email = 'Enter a valid email address';
    if (phone.trim() && !validatePhone(phone)) next.phone = 'Enter a valid phone number';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setContactSubmitLoading(true);
    try {
      if (editingId) {
        await updateContact(editingId, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          job_title: jobTitle.trim() || null,
          company_id: accountId || null,
          relationship_status: relationshipStatus || null,
          notes: notes.trim() || null,
        });
        showToast('success', 'Contact updated');
      } else {
        await createContact({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          job_title: jobTitle.trim() || null,
          company_id: accountId || null,
          relationship_status: relationshipStatus || null,
          notes: notes.trim() || null,
        });
        showToast('success', 'Contact created', addAnother ? 'Add another below.' : undefined);
      }
      await refreshContactList();
      resetContactForm();
      if (!addAnother && editingId) setEditingId(null);
    } catch (err) {
      showToast(
        'error',
        editingId ? 'Failed to update contact' : 'Failed to create contact',
        err instanceof Error ? err.message : 'Please try again.'
      );
    } finally {
      setContactSubmitLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteContact(id);
      showToast('success', 'Contact deleted');
      await refreshContactList();
      if (editingId === id) resetContactForm();
    } catch (err) {
      showToast('error', 'Failed to delete contact', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          placeholder="Search contacts by name or email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
          aria-label="Search contacts"
        />
        {(isContactsLoading || isSearching) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
        )}
      </div>

      {contactError && (
        <p className="text-sm text-status-at-risk" role="alert">
          {contactError}
        </p>
      )}

      {isContactsLoading && contacts.length === 0 ? (
        <div className="flex items-center justify-center py-12" aria-busy="true">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : contacts.length === 0 && !searchInput.trim() ? (
        <Card className="border-dashed">
          <CardContent className="p-0">
            <EmptyState
              icon={Users}
              title="No contacts found. Add a contact to get started."
              description="Create your first contact using the form below."
              action={{ label: 'Add contact', onClick: () => {} }}
            />
          </CardContent>
        </Card>
      ) : contacts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed'}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{c.email ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => loadContactIntoForm(c)}
                      disabled={contactSubmitLoading}
                      aria-label={`Edit ${c.first_name ?? ''} ${c.last_name ?? ''}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-status-at-risk hover:text-status-at-risk"
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId !== null}
                      aria-label={`Delete ${c.first_name ?? ''} ${c.last_name ?? ''}`}
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div>
        {/* Contact Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? 'Edit contact' : 'Contact details'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1"
                    error={!!errors.firstName}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-status-at-risk mt-1">{errors.firstName}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1"
                    error={!!errors.lastName}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-status-at-risk mt-1">{errors.lastName}</p>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  error={!!errors.email}
                />
                {errors.email && (
                  <p className="text-xs text-status-at-risk mt-1">{errors.email}</p>
                )}
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1"
                  error={!!errors.phone}
                />
                {errors.phone && (
                  <p className="text-xs text-status-at-risk mt-1">{errors.phone}</p>
                )}
              </div>
              <div>
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input
                  id="jobTitle"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Account</Label>
                <DebouncedAutocomplete
                  value={accountSearchDisplay || MOCK_ACCOUNTS.find((a) => a.id === accountId)?.name || ''}
                  onChange={(v) => {
                    setAccountSearchDisplay(v);
                    const acc = MOCK_ACCOUNTS.find((a) => a.name === v);
                    setAccountId(acc?.id ?? '');
                  }}
                  placeholder="Search accounts..."
                  options={MOCK_ACCOUNTS}
                  getOptionLabel={(a) => a.name}
                  onSelect={(a) => {
                    setAccountId(a.id);
                    setAccountSearchDisplay(a.name);
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Relationship Status</Label>
                <Select value={relationshipStatus} onValueChange={setRelationshipStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
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
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 min-h-[80px]"
                  placeholder="Add notes..."
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {editingId ? (
                  <>
                    <Button
                      type="button"
                      onClick={(e) => handleContactSubmit(e, false, false)}
                      disabled={contactSubmitLoading}
                    >
                      {contactSubmitLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Update Contact
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetContactForm}
                      disabled={contactSubmitLoading}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={(e) => handleContactSubmit(e, false, false)}
                      disabled={contactSubmitLoading}
                    >
                      {contactSubmitLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Create Contact
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={(e) => handleContactSubmit(e, false, true)}
                      disabled={contactSubmitLoading}
                    >
                      Create & Add Another
                    </Button>
                  </>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

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

// ---------------------------------------------------------------------------
// Account tab
// ---------------------------------------------------------------------------

function AccountTabContent(): React.ReactElement {
  const [companyName, setCompanyName] = React.useState('');
  const [domain, setDomain] = React.useState('');
  const [industry, setIndustry] = React.useState('');
  const [defaultContactId, setDefaultContactId] = React.useState('');
  const [defaultContactDisplay, setDefaultContactDisplay] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [suggestedIndustry, setSuggestedIndustry] = React.useState('');
  const [similarCompanies] = React.useState(['Acme Corp', 'Globex Inc', 'Initech']);
  const [accountSubmitLoading, setAccountSubmitLoading] = React.useState(false);
  const [toast, setToast] = React.useState<{
    open: boolean;
    variant: 'success' | 'error' | 'default';
    title: string;
    description?: string;
  }>({ open: false, variant: 'default', title: '' });

  const showToast = (variant: 'success' | 'error', title: string, description?: string) => {
    setToast({ open: true, variant, title, description });
  };

  const resetAccountForm = () => {
    setCompanyName('');
    setDomain('');
    setIndustry('');
    setDefaultContactId('');
    setDefaultContactDisplay('');
    setTags([]);
    setTagInput('');
    setErrors({});
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAccountSubmit = async (e: React.FormEvent, addAnother: boolean) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!companyName.trim()) next.companyName = 'Company name is required';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setAccountSubmitLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      showToast('success', 'Account created');
      resetAccountForm();
      if (addAnother) setSuggestedIndustry('');
    } catch {
      showToast('error', 'Failed to create account', 'Please try again.');
    }
    setAccountSubmitLoading(false);
  };

  React.useEffect(() => {
    if (companyName.trim().length >= 2) setSuggestedIndustry('Technology');
    else if (!companyName.trim()) setSuggestedIndustry('');
  }, [companyName]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1"
                error={!!errors.companyName}
              />
              {errors.companyName && (
                <p className="text-xs text-status-at-risk mt-1">{errors.companyName}</p>
              )}
            </div>
            <div>
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_INDUSTRIES.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default Contact</Label>
              <DebouncedAutocomplete
                value={defaultContactDisplay || MOCK_CONTACTS.find((c) => c.id === defaultContactId)?.name || ''}
                onChange={(v) => {
                  setDefaultContactDisplay(v);
                  const c = MOCK_CONTACTS.find((x) => x.name === v);
                  setDefaultContactId(c?.id ?? '');
                }}
                placeholder="Search contacts..."
                options={MOCK_CONTACTS}
                getOptionLabel={(c) => c.name}
                onSelect={(c) => {
                  setDefaultContactId(c.id);
                  setDefaultContactDisplay(c.name);
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {tags.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-sm"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(i)}
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                      aria-label={`Remove ${t}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <div className="flex gap-1 flex-1 min-w-[120px]">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Add tag..."
                    className="h-8"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addTag}>
                    Add
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={(e) => handleAccountSubmit(e, false)}
                disabled={accountSubmitLoading}
              >
                {accountSubmitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create Account
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={(e) => handleAccountSubmit(e, true)}
                disabled={accountSubmitLoading}
              >
                Create & Add Another
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* AI Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Suggestions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {suggestedIndustry && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
              <span className="text-sm">{suggestedIndustry}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIndustry(suggestedIndustry)}
              >
                Apply
              </Button>
            </div>
          )}
          <div>
            <p className="text-sm font-medium mb-2">Similar Companies</p>
            <ul className="space-y-1">
              {similarCompanies.map((name) => (
                <li key={name} className="text-sm text-muted-foreground">
                  {name}
                </li>
              ))}
            </ul>
          </div>
          {!suggestedIndustry && (
            <p className="text-sm text-muted-foreground">Suggestions appear after extraction or when available.</p>
          )}
        </CardContent>
      </Card>

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

// ---------------------------------------------------------------------------
// Page content (uses useSearchParams — must be inside Suspense)
// ---------------------------------------------------------------------------

function ContactsPageContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'account' ? 'account' : 'contact';

  const handleTabChange = React.useCallback(
    (value: string) => {
      router.replace(`/contacts?tab=${value}`, { scroll: false });
    },
    [router]
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create and manage contacts and accounts.
        </p>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
      >
        <TabsList>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        <TabsContent value="contact" className="mt-4">
          <ContactTabContent />
        </TabsContent>
        <TabsContent value="account" className="mt-4">
          <AccountTabContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (wraps content in Suspense for useSearchParams)
// ---------------------------------------------------------------------------

function ContactsPageFallback(): React.ReactElement {
  return (
    <div className="flex items-center justify-center min-h-[200px]" aria-busy="true">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
    </div>
  );
}

export default function ContactsPage(): React.ReactElement {
  return (
    <ProtectedRoute>
      <Suspense fallback={<ContactsPageFallback />}>
        <ContactsPageContent />
      </Suspense>
    </ProtectedRoute>
  );
}
