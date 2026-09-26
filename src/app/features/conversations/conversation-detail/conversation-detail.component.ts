import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { debounceTime, finalize } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import {
  DataTableComponent,
  RowDetailSection,
  TableColumn,
} from '../../../shared/ui/data-table/data-table.component';
import { ConversationsService } from '../data-access/conversations.service';
import {
  CHAT_ROLE_BADGE,
  CHAT_ROLE_LABELS,
  ConversationDetailDto,
  ConversationEpisodeDto,
  ConversationMessageDto,
  DecisionRecordDto,
} from '../data-access/conversation.models';

type ConversationTab = 'messages' | 'decisions';

/** One conversation: its summary plus the transcript and decision trail, each paged. */
@Component({
  selector: 'app-conversation-detail',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, RouterLink, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './conversation-detail.component.html',
})
export class ConversationDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly conversationsService = inject(ConversationsService);

  private readonly conversationId = this.route.snapshot.paramMap.get('id')!;

  /** Large pages: these are audit listings, read top-to-bottom rather than browsed. */
  private readonly pageSize = 50;

  readonly detail = signal<ConversationDetailDto | null>(null);
  readonly loadingDetail = signal(true);
  readonly detailError = signal<string | null>(null);

  readonly activeTab = signal<ConversationTab>('messages');
  /** Ignores the reset cut and shows the whole audit trail on both tabs. */
  readonly includeBeforeReset = signal(false);
  /** Selected episode, or null for every episode. Applies to both tabs. */
  readonly episode = signal<number | null>(null);
  /** Active message search, mirroring `textControl` once debounced. Messages tab only. */
  readonly text = signal('');
  /** Decisions are fetched the first time their tab is opened. */
  private decisionsLoaded = false;

  /** Search box over the message text; the API matches it as a fragment. */
  readonly textControl = new FormControl('', { nonNullable: true });

  readonly episodes = signal<ConversationEpisodeDto[]>([]);

  /**
   * Options of the episode filter. The episode index ignores the reset cut, so an
   * episode that ended below it is flagged as archived — picking it lifts the cut.
   */
  readonly episodeOptions = computed(() => {
    const cut = this.detail()?.conversation.resetAfterTurn ?? 0;
    return this.episodes().map((e) => ({
      episode: e.episode,
      label:
        `Episodio ${e.episode} · turnos ${e.firstTurnNumber}–${e.lastTurnNumber}` +
        (e.lastTurnNumber <= cut ? ' (archivado)' : ''),
    }));
  });

  readonly messages = this.conversationsService.messages;
  readonly messagesPaging = this.conversationsService.messagesPaging;
  readonly messagesLoading = this.conversationsService.messagesLoading;
  readonly messagesError = this.conversationsService.messagesError;

  /** Transcript by message id, to show a decision's message under it. */
  readonly messageIndex = this.conversationsService.messageIndex;

  readonly decisions = this.conversationsService.decisions;
  readonly decisionsPaging = this.conversationsService.decisionsPaging;
  readonly decisionsLoading = this.conversationsService.decisionsLoading;
  readonly decisionsError = this.conversationsService.decisionsError;

  readonly messageColumns: readonly TableColumn<ConversationMessageDto>[] = [
    {
      header: 'Episodio',
      value: (m) => m.episode,
      class: 'text-end w-1',
      cellFn: (m) => this.focusEpisode(m),
      cellFnTitle: 'Ver todos los mensajes de este episodio',
    },
    { header: 'Turno', value: (m) => m.turnNumber, class: 'text-end w-1' },
    {
      header: 'Autor',
      value: (m) => CHAT_ROLE_LABELS[m.role] ?? m.role,
      badgeClass: (m) => CHAT_ROLE_BADGE[m.role] ?? 'badge',
    },
    { header: 'Mensaje', value: (m) => m.text, class: 'cell-wrap' },
    {
      header: 'Fecha',
      value: (m) => this.formatDate(m.createdAtUtc),
      class: 'text-secondary text-nowrap',
    },
  ];

  /**
   * The trail is wide, so the identity of a row comes first — when it happened and
   * which episode/turn it belongs to — and the headers of those two are abbreviated so
   * they take no more room than the numbers under them. What does not fit a column at
   * all (the message and the tool calls) hangs off the row instead: see `decisionDetail`.
   */
  readonly decisionColumns: readonly TableColumn<DecisionRecordDto>[] = [
    {
      header: 'Fecha',
      value: (d) => this.formatDate(d.createdAtUtc),
      class: 'text-secondary text-nowrap',
    },
    { header: 'Epi', value: (d) => d.episode, class: 'text-end w-1' },
    { header: 'T', value: (d) => d.turnNumber, class: 'text-end w-1' },
    { header: 'Contribuidor', value: (d) => d.contributor, class: 'text-nowrap' },
    {
      header: 'Transición',
      value: (d) => `${d.sourceState ?? '—'} → ${d.targetState ?? '—'}`,
      class: 'text-nowrap',
    },
    { header: 'Intención', value: (d) => d.intent ?? '—' },
    { header: 'Categoría', value: (d) => d.categoryCode ?? '—' },
    {
      header: 'Confianza',
      value: (d) => (d.confidence == null ? '—' : d.confidence.toFixed(2)),
      class: 'text-end',
    },
    { header: 'Ruta', value: (d) => d.route ?? '—' },
    { header: 'Resultado', value: (d) => d.resultKind ?? '—' },
  ];

  readonly messageKey = (m: ConversationMessageDto): string => m.id;
  readonly decisionKey = (d: DecisionRecordDto): string => d.id;

  readonly messageRowClass = (m: ConversationMessageDto, index: number): string =>
    this.episodeRowClass(m.episode, this.messages()[index - 1]?.episode);
  readonly decisionRowClass = (d: DecisionRecordDto, index: number): string =>
    this.episodeRowClass(d.episode, this.decisions()[index - 1]?.episode);

  constructor() {
    this.conversationsService
      .getById(this.conversationId)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (detail) => this.detail.set(detail),
        error: () => this.detailError.set('No se pudo cargar la conversación.'),
      });

    this.conversationsService.episodeCatalog(this.conversationId).subscribe({
      next: (episodes) => this.episodes.set(episodes),
      error: () => {
        /* non-critical: without the index the episode filter stays hidden */
      },
    });

    // Reads the control instead of the emitted value: a search cleared by hand (the
    // episode link does that) may still have a keystroke in flight behind the debounce.
    this.textControl.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(() => this.applyText(this.textControl.value.trim()));

    this.loadMessages(1);
  }

  selectTab(tab: ConversationTab): void {
    this.activeTab.set(tab);
    if (tab === 'decisions' && !this.decisionsLoaded) {
      // The trail names the message it resolved by id only, so index the transcript
      // alongside it — once per conversation, whatever page of the trail is on screen.
      this.conversationsService.indexMessages(this.conversationId);
      this.loadDecisions(1);
    }
  }

  /** Flipping the reset cut invalidates both listings, so reload what has been fetched. */
  toggleIncludeBeforeReset(include: boolean): void {
    this.includeBeforeReset.set(include);
    this.reloadTabs();
  }

  /**
   * `''` is the "every episode" option; the API numbers episodes from 1. Picking a
   * concrete episode also lifts the reset cut: `episode` composes with that cut instead
   * of replacing it, so an episode that ended below it would otherwise come back empty.
   * Going back to every episode leaves the switch as it is — it may have been set by hand.
   */
  selectEpisode(value: string): void {
    const episode = value === '' ? null : Number(value);
    this.episode.set(episode);
    if (episode !== null) {
      this.includeBeforeReset.set(true);
    }
    this.reloadTabs();
  }

  /**
   * A search spans the whole conversation by default: it lifts the reset cut and drops
   * the episode narrowing, so no match stays hidden behind filters the operator set for
   * a different purpose. Clearing the box leaves that widening in place — like the
   * episode filter, the switch may have been set by hand.
   */
  private applyText(text: string): void {
    if (text === this.text()) return;
    this.text.set(text);

    let widened = false;
    if (text !== '') {
      if (!this.includeBeforeReset()) {
        this.includeBeforeReset.set(true);
        widened = true;
      }
      if (this.episode() !== null) {
        this.episode.set(null);
        widened = true;
      }
    }

    // Only the transcript takes `text`; the decision trail moves solely with the widening.
    if (widened) {
      this.reloadTabs();
    } else {
      this.loadMessages(1);
    }
  }

  /**
   * Episode link on a message row: drops the search and shows that episode whole, which
   * is what an operator wants after finding the message they were looking for.
   */
  focusEpisode(message: ConversationMessageDto): void {
    this.textControl.setValue('', { emitEvent: false });
    this.text.set('');
    this.episode.set(message.episode);
    this.includeBeforeReset.set(true);
    this.reloadTabs();
  }

  loadMessages(page: number): void {
    this.conversationsService.listMessages(this.conversationId, page, this.pageSize, {
      ...this.filters(),
      text: this.text() || undefined,
    });
  }

  loadDecisions(page: number): void {
    this.decisionsLoaded = true;
    this.conversationsService.listDecisions(
      this.conversationId,
      page,
      this.pageSize,
      this.filters(),
    );
  }

  private filters(): { includeBeforeReset: boolean; episode: number | null } {
    return { includeBeforeReset: this.includeBeforeReset(), episode: this.episode() };
  }

  /** Both listings share the filters, so reload the transcript and whatever else is loaded. */
  private reloadTabs(): void {
    this.loadMessages(1);
    if (this.decisionsLoaded) {
      this.loadDecisions(1);
    }
  }

  /** Pretty-prints Domi's redacted session state; it has no contract the panel can rely on. */
  sessionStateJson(state: unknown): string {
    return JSON.stringify(state, null, 2);
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString('es');
  }

  /**
   * Bands the rows by episode instead of by parity: consecutive episodes alternate
   * between the plain and the striped background, and the first row of an episode
   * carries a divider. `previous` is undefined on the first row of a page, where the
   * table's own top edge is already the boundary.
   */
  private episodeRowClass(episode: number, previous: number | undefined): string {
    const classes = episode % 2 === 0 ? ['row-episode-alt'] : [];
    if (previous !== undefined && previous !== episode) {
      classes.push('row-episode-start');
    }
    return classes.join(' ');
  }

  /**
   * What hangs under a decision row across the whole table: the message it resolved —
   * the trail stores only its id, so it is read from the transcript index — and the
   * upstream calls it made, as a table of their own. Each block only shows up when
   * there is something to show, so a bare decision stays a single row.
   */
  readonly decisionDetail = (d: DecisionRecordDto): RowDetailSection[] => {
    const sections: RowDetailSection[] = [];

    const message = this.messageIndex().get(d.messageId);
    if (message) {
      sections.push({
        label: 'Mensaje',
        values: [
          {
            text: CHAT_ROLE_LABELS[message.role] ?? message.role,
            badgeClass: CHAT_ROLE_BADGE[message.role] ?? 'badge',
          },
          { text: message.text },
        ],
      });
    }

    if (d.toolCalls?.length) {
      sections.push({
        label: 'Herramientas',
        table: {
          head: ['Método', 'Estado', 'Endpoint'],
          body: d.toolCalls.map((t) => [
            { text: this.httpMethod(t.endpoint), badgeClass: 'badge bg-secondary-lt' },
            { text: t.outcome, badgeClass: this.statusBadge(t.outcome) },
            { text: this.endpointPath(t.endpoint), mono: true },
          ]),
        },
      });
    }

    return sections;
  };

  /**
   * Domi records a tool call as `"{método} {url}"` and its outcome as the HTTP status,
   * so the table reads like a request log: the verb, the status tinted by its class
   * (2xx green, 4xx amber, 5xx red) and the path. `tool` is that same path without the
   * query string, so it is left out rather than repeated in a column of its own.
   */
  private httpMethod(endpoint: string): string {
    const space = endpoint.indexOf(' ');
    return space > 0 ? endpoint.slice(0, space) : '—';
  }

  /**
   * Path and query of a tool call. The origin is Domi's own API on every row, so it is
   * dropped; an endpoint that does not parse as a URL goes through untouched.
   */
  private endpointPath(endpoint: string): string {
    const space = endpoint.indexOf(' ');
    const url = space > 0 ? endpoint.slice(space + 1) : endpoint;
    try {
      const parsed = new URL(url);
      return parsed.pathname + parsed.search;
    } catch {
      return url;
    }
  }

  private statusBadge(outcome: string): string {
    const status = Number(outcome);
    if (!Number.isFinite(status)) return 'badge bg-secondary-lt';
    if (status >= 500) return 'badge bg-red-lt';
    if (status >= 400) return 'badge bg-yellow-lt';
    if (status >= 300) return 'badge bg-azure-lt';
    if (status >= 200) return 'badge bg-green-lt';
    return 'badge bg-secondary-lt';
  }
}
