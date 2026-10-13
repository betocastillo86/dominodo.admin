import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ModelCallDto } from '../data-access/conversation.models';

/** A completion fenced as markdown, the way a model wraps JSON it was asked to emit. */
const FENCED = /^```(?:json)?\s*([\s\S]*?)\s*```$/;

/**
 * Re-indents a model answer that is JSON — Domi's reasoning steps answer with an object on a
 * single line, unreadable as stored — and unwraps the markdown fence a model may put around
 * it. Anything that does not parse goes through untouched: it is prose, and prose is already
 * readable.
 */
function prettyPrint(text: string): string {
  const unfenced = FENCED.exec(text.trim())?.[1] ?? text.trim();
  if (!unfenced.startsWith('{') && !unfenced.startsWith('[')) {
    return text;
  }
  try {
    return JSON.stringify(JSON.parse(unfenced), null, 2);
  } catch {
    return text;
  }
}

/**
 * One chat completion or embedding behind a decision, in full: what was asked and what came
 * back. Opened from the "Modelos" tab of a decision row, which can only show the heading of
 * each call. Read-only — it closes and changes nothing.
 */
@Component({
  selector: 'app-model-call-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './model-call-modal.component.html',
})
export class ModelCallModalComponent {
  readonly activeModal = inject(NgbActiveModal);

  /**
   * The call on screen, with its text already laid out. The template reads every field off
   * this one object: the prompt and the answer are long enough to need formatting, and
   * deriving them separately would let the heading of a call and its body come from two
   * different reads.
   */
  readonly view = signal<ModelCallDto | null>(null);

  /**
   * The call to inspect. A setter rather than an `input()` because the opener assigns it
   * imperatively through the modal's `componentInstance`, and the formatting then runs once
   * instead of on every change detection.
   */
  set call(value: ModelCallDto) {
    this.view.set({
      ...value,
      prompt: value.prompt?.trim() ?? '',
      completion: value.completion ? prettyPrint(value.completion) : null,
    });
  }
}
