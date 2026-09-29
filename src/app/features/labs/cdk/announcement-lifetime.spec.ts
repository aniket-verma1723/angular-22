import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { LIVE_ANNOUNCER_ELEMENT_TOKEN, LiveAnnouncer } from '@angular/cdk/a11y';
import { Clipboard } from '@angular/cdk/clipboard';
import { labButton } from './cdk-lab.spec-helpers';
import { UtilitiesExperimentComponent } from './utilities-experiment.component';

describe('CDK lab announcement lifetime', () => {
  it('cancels the real announcer delayed write when the owning experiment is destroyed', fakeAsync(() => {
    const liveElement = document.createElement('div');
    const clipboard = jasmine.createSpyObj<Clipboard>('Clipboard', ['copy']);
    clipboard.copy.and.returnValue(true);
    TestBed.configureTestingModule({
      imports: [UtilitiesExperimentComponent],
      providers: [{ provide: Clipboard, useValue: clipboard }]
    }).overrideComponent(UtilitiesExperimentComponent, {
      set: { providers: [LiveAnnouncer, { provide: LIVE_ANNOUNCER_ELEMENT_TOKEN, useValue: liveElement }] }
    });
    const fixture = TestBed.createComponent(UtilitiesExperimentComponent);
    fixture.autoDetectChanges();
    TestBed.tick();
    tick(16); // flush the autosize directive's initial fake animation frame
    const root: HTMLElement = fixture.nativeElement;
    labButton(root, 'Copy public product link').click();
    expect(clipboard.copy).toHaveBeenCalledTimes(1);
    expect(liveElement.textContent).toBe('');
    fixture.destroy();
    tick(100); // CDK 22.1.8's documented announcement delay, never a real pending timer
    expect(liveElement.textContent).toBe('');
  }));
});
