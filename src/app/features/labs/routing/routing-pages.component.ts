import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

@Component({ selector: 'app-routing-matched', template: `<h2>canMatch admitted this route</h2><p>Disable matching above, leave and try again. A guard is local navigation UX, never authorization.</p>` })
export class MatchedLabComponent {}

@Component({ selector: 'app-routing-recipe', template: `<h2>Validated recipe: {{ topic() }}</h2><p>Only recipe/signals and recipe/di match. Extra segments or matrix parameters use local wildcard recovery.</p>` })
export class RecipeLabComponent {
  protected readonly topic = toSignal(inject(ActivatedRoute).paramMap.pipe(map(params => params.get('topic'))), { initialValue: null });
}

@Component({
  selector: 'app-routing-recovery', imports: [RouterLink],
  template: `<h2>Local route recovery</h2><p role="status">{{ reason() }}</p><a routerLink="/labs/routing/workspace/1">Retry notebook 1</a><p>Restore permissions and choose Immediate above before retrying a deliberate failure.</p>`
})
export class RoutingRecoveryComponent {
  protected readonly reason = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((params): string => {
    switch (params.get('reason')) {
      case 'permission': return 'canActivateChild returned a redirect.';
      case 'match': return 'canMatch returned a redirect.';
      case 'invalid': return 'Invalid notebook ID: use a canonical positive safe integer.';
      case 'resolver': return 'Resolver failed or fixture was missing; no HTTP was sent.';
      default: return 'Unknown local URL. The wildcard stays inside this lab.';
    }
  })), { initialValue: 'Local recovery' });
}

@Component({ selector: 'app-routing-help', template: `<h2>Named outlet help</h2><p>This help route coexists with the primary notebook. Close help above to remove only the named outlet; the notebook instance is retained.</p>` })
export class RoutingHelpComponent {}
