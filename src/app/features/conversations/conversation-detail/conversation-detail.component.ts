import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
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
  imports: [PageHeaderComponent, DataTableComponent, RouterLink],
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
  /** Decisions are fetched the first time their tab is opened. */
  private decisionsLoaded = false;

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

  readonly decisions = this.conversationsService.decisions;
  readonly decisionsPaging = this.conversationsService.decisionsPaging;
  readonly decisionsLoading = this.conversationsService.decisionsLoading;
  readonly decisionsError = this.conversationsService.decisionsError;

  readonly messageColumns: readonly TableColumn<ConversationMessageDto>[] = [
    { header: 'Episodio', value: (m) => m.episode, class: 'text-end w-1' },
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

  readonly decisionColumns: readonly TableColumn<DecisionRecordDto>[] = [
    { header: 'Episodio', value: (d) => d.episode, class: 'text-end w-1' },
    { header: 'Turno', value: (d) => d.turnNumber, class: 'text-end w-1' },
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
    { header: 'Herramientas', value: (d) => this.formatToolCalls(d), class: 'cell-wrap' },
    {
      header: 'Fecha',
      value: (d) => this.formatDate(d.createdAtUtc),
      class: 'text-secondary text-nowrap',
    },
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

    this.loadMessages(1);
  }

  selectTab(tab: ConversationTab): void {
    this.activeTab.set(tab);
    if (tab === 'decisions' && !this.decisionsLoaded) {
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

  loadMessages(page: number): void {
    this.conversationsService.listMessages(this.conversationId, page, this.pageSize, this.filters());
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

  private formatToolCalls(d: DecisionRecordDto): string {
    if (!d.toolCalls?.length) return '—';
    return d.toolCalls.map((t) => `${t.tool} · ${t.outcome}`).join(', ');
  }
}
