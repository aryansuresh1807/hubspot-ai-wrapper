'use client';

import * as React from 'react';
import { Phone, Mail, UserCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ContactRecentNote {
  date: string;
  text: string;
}

export interface ContactPreviewContact {
  name: string;
  phone?: string;
  email?: string;
  recentNotes: ContactRecentNote[];
}

export interface ContactPreviewProps {
  contact: ContactPreviewContact | null | undefined;
  onViewAllNotes?: () => void;
  className?: string;
}

function formatNoteDate(value: string): string {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return value;
  }
}

const EmptyState = ({ className }: { className?: string }) => (
  <Card className={cn('flex flex-col items-center justify-center min-h-[200px]', className)}>
    <CardContent className="flex flex-col items-center justify-center gap-2 p-8 text-center">
      <UserCircle className="h-12 w-12 text-muted-foreground/60" aria-hidden />
      <p className="text-sm font-medium text-muted-foreground">No contact selected</p>
    </CardContent>
  </Card>
);

const ContactPreview = React.forwardRef<HTMLDivElement, ContactPreviewProps>(
  ({ contact, onViewAllNotes, className }, ref) => {
    if (contact == null) {
      return <EmptyState className={className} />;
    }

    const recentNotes = contact.recentNotes?.slice(0, 3) ?? [];
    const hasNotes = recentNotes.length > 0;

    return (
      <Card ref={ref} className={cn('overflow-hidden', className)}>
        <CardHeader className="pb-3">
          <h2 className="text-xl font-bold leading-tight tracking-tight text-foreground">
            {contact.name}
          </h2>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 pt-0">
          {/* Contact info */}
          <div className="flex flex-col gap-2">
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="h-4 w-4 shrink-0" aria-hidden />
                <span>{contact.phone}</span>
              </a>
            )}
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4 shrink-0" aria-hidden />
                <span>{contact.email}</span>
              </a>
            )}
            {!contact.phone && !contact.email && (
              <p className="text-sm text-muted-foreground">No contact info</p>
            )}
          </div>

          {/* Recent Notes */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">Recent Notes</h3>
            {hasNotes ? (
              <>
                <ul className="flex flex-col gap-4">
                  {recentNotes.map((note, index) => (
                    <li key={index} className="flex flex-col gap-1">
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={note.date}
                      >
                        {formatNoteDate(note.date)}
                      </time>
                      <p className="text-sm text-foreground line-clamp-2">
                        {note.text || '—'}
                      </p>
                    </li>
                  ))}
                </ul>
                {onViewAllNotes && (
                  <button
                    type="button"
                    onClick={onViewAllNotes}
                    className="text-sm font-medium text-primary hover:underline underline-offset-2 w-fit"
                  >
                    View All
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No recent notes</p>
            )}
          </section>
        </CardContent>
      </Card>
    );
  }
);
ContactPreview.displayName = 'ContactPreview';

export { ContactPreview };
