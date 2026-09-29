import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatPaginatorHarness } from '@angular/material/paginator/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatSortHarness, MatSortHeaderHarness } from '@angular/material/sort/testing';
import { MatTableDataSource } from '@angular/material/table';
import { MatTableHarness } from '@angular/material/table/testing';
import { By } from '@angular/platform-browser';
import { MaterialTableComponent } from './material-table.component';
import { materialElement } from './material.spec-helpers';

describe('MaterialTableComponent', () => {
  let fixture: ComponentFixture<MaterialTableComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MaterialTableComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }
    ] });
    fixture = TestBed.createComponent(MaterialTableComponent);
    fixture.detectChanges();
  });
  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    http.expectNone(() => true);
    http.verify();
  });

  const loader = () => TestbedHarnessEnvironment.loader(fixture);
  const root = (): HTMLElement => fixture.nativeElement;
  const table = () => loader().getHarness(MatTableHarness);
  const paginator = () => loader().getHarness(MatPaginatorHarness);
  const filter = () => loader().getHarness(MatInputHarness);
  const header = (label: string) => loader().getHarness(MatSortHeaderHarness.with({ label }));
  const button = (text: string) => loader().getHarness(MatButtonHarness.with({ text }));
  async function cells(column: 'id' | 'label' | 'minutes'): Promise<string[]> {
    const columns = await (await table()).getCellTextByColumnName();
    return columns[column].text;
  }

  it('renders a labelled, scoped three-column table and all 15 distinct rows across pages', async () => {
    const sort = await loader().getHarness(MatSortHarness);
    expect(await Promise.all((await sort.getSortHeaders()).map(item => item.getLabel())))
      .toEqual(['ID', 'Label', 'Minutes']);
    expect(await (await sort.getActiveHeader())?.getLabel()).toBe('ID');
    expect(await (await header('ID')).getSortDirection()).toBe('asc');
    expect(root().querySelector('caption')?.textContent).toBe('Fictional readings · complete local dataset');
    expect(Array.from(root().querySelectorAll('th'), node => node.getAttribute('scope')))
      .toEqual(['col', 'col', 'col']);
    expect(root().querySelector('mat-label')?.textContent).toBe('Filter local readings');
    expect(root().querySelector('mat-paginator')?.getAttribute('aria-label')).toBe('Local readings pagination');
    const page = await paginator();
    expect(await page.getPageSize()).toBe(5);
    const ids: string[] = [];
    for (const range of ['1 – 5 of 15', '6 – 10 of 15', '11 – 15 of 15']) {
      expect(await page.getRangeLabel()).toBe(range);
      ids.push(...await cells('id'));
      await page.goToNextPage();
    }
    expect(ids).toEqual(Array.from({ length: 15 }, (_, index) => String(index + 1)));
    expect(await page.isNextPageDisabled()).toBeTrue();
  });

  it('sorts all numeric minutes before paging and returns from page two to page one', async () => {
    const page = await paginator();
    await page.goToNextPage();
    const minutes = await header('Minutes');
    await minutes.click();
    expect(await page.getRangeLabel()).toBe('1 – 5 of 15');
    expect(await cells('minutes')).toEqual(['2', '5', '9', '10', '12']);
    expect(await cells('id')).toEqual(['6', '11', '7', '13', '2']);
    await page.goToNextPage();
    expect(await cells('minutes')).toEqual(['15', '20', '25', '30', '35']);
    await minutes.click();
    expect(await minutes.getSortDirection()).toBe('desc');
    expect(await page.getRangeLabel()).toBe('1 – 5 of 15');
    expect(await cells('minutes')).toEqual(['120', '100', '60', '50', '45']);
  });

  it('sorts labels ascending and descending, then restores original ID order on clear', async () => {
    const label = await header('Label');
    await label.click();
    expect(await cells('label')).toEqual(['Aurora watch', 'Binary sketch', 'Comet watch', 'Dawn watch', 'Eclipse notes']);
    await label.click();
    expect(await cells('label')).toEqual(['Zenith scan', 'Orbit notes', 'Nebula map', 'Meteor watch', 'Lunar sketch']);
    await (await paginator()).goToNextPage();
    await label.click();
    expect(await label.getSortDirection()).toBe('');
    expect(await (await paginator()).getRangeLabel()).toBe('1 – 5 of 15');
    expect(await cells('id')).toEqual(['1', '2', '3', '4', '5']);
    expect(root().querySelector('[data-table-sort-notice]')?.textContent)
      .toBe('Sorting cleared. Original ID order restored.');
  });

  it('sorts numeric IDs rather than lexically ordered strings', async () => {
    await (await header('ID')).click();
    expect(await cells('id')).toEqual(['15', '14', '13', '12', '11']);
    await (await header('ID')).click();
    await (await header('ID')).click();
    expect(await (await header('ID')).getSortDirection()).toBe('asc');
    expect(await cells('id')).toEqual(['1', '2', '3', '4', '5']);
  });

  it('trims case-insensitive input and counts matches across the complete dataset', async () => {
    const page = await paginator();
    await page.goToNextPage();
    await (await filter()).setValue('  WATCH  ');
    expect(await page.getRangeLabel()).toBe('1 – 5 of 6');
    expect(await cells('id')).toEqual(['2', '6', '7', '11', '13']);
    await page.goToNextPage();
    expect(await cells('id')).toEqual(['15']);
    await (await header('Minutes')).click();
    await (await header('Minutes')).click();
    expect(await page.getRangeLabel()).toBe('1 – 5 of 6');
    expect(await cells('minutes')).toEqual(['50', '12', '10', '9', '5']);
    await (await filter()).setValue('120');
    expect(await page.getRangeLabel()).toBe('1 – 1 of 1');
    expect(await cells('label')).toEqual(['Eclipse notes']);
    await (await filter()).setValue('14');
    expect(await cells('label')).toEqual(['Ion scan']);
  });

  it('caps programmatic input as well as native typing and treats whitespace as no filter', async () => {
    const input = await filter();
    expect(await (await input.host()).getAttribute('maxlength')).toBe('80');
    // MatInputHarness.setValue writes the original value again after input events.
    // Exercise the normalization boundary without that final event-free overwrite.
    const host = await input.host();
    await host.setInputValue(' '.repeat(80) + 'watch');
    await host.dispatchEvent('input');
    expect(await input.getValue()).toBe(' '.repeat(80));
    await host.sendKeys('watch');
    expect(await input.getValue()).toBe(' '.repeat(80));
    expect(await (await paginator()).getRangeLabel()).toBe('1 – 5 of 15');
  });

  it('shows an honest empty result and clears the filter while preserving size and sort', async () => {
    const page = await paginator();
    await page.setPageSize(10);
    await (await header('Minutes')).click();
    await page.goToNextPage();
    await (await filter()).setValue('not-a-reading');
    expect((await (await table()).getRows()).length).toBe(0);
    const emptyRow = await (await table()).getNoDataRow();
    if (!emptyRow) throw new Error('Expected the empty readings row');
    expect(await (await emptyRow.host()).text()).toContain('No matching readings.');
    expect(await page.getRangeLabel()).toBe('0 of 0');
    expect(await page.isNextPageDisabled()).toBeTrue();
    expect(await page.isPreviousPageDisabled()).toBeTrue();
    await (await button('Clear table filter')).click();
    expect(await (await filter()).getValue()).toBe('');
    expect(await page.getRangeLabel()).toBe('1 – 10 of 15');
    expect(await page.getPageSize()).toBe(10);
    expect(await (await header('Minutes')).getSortDirection()).toBe('asc');
    expect((await cells('minutes')).slice(0, 5)).toEqual(['2', '5', '9', '10', '12']);
    await page.goToNextPage();
    await (await button('Clear table filter')).click();
    expect(await page.getRangeLabel()).toBe('1 – 10 of 15');
  });

  it('offers only sizes 5 and 10 and resets filter, sort, size and page index', async () => {
    const select = await loader().getHarness(MatSelectHarness);
    await select.open();
    expect(await Promise.all((await select.getOptions()).map(option => option.getText()))).toEqual(['5', '10']);
    await select.close();
    const page = await paginator();
    await page.setPageSize(10);
    await (await header('Label')).click();
    await (await header('Label')).click();
    await page.goToNextPage();
    await (await button('Reset local table')).click();
    expect(await page.getRangeLabel()).toBe('1 – 5 of 15');
    expect(await page.getPageSize()).toBe(5);
    expect(await (await header('ID')).getSortDirection()).toBe('asc');
    expect(await cells('id')).toEqual(['1', '2', '3', '4', '5']);
    await (await filter()).setValue('watch');
    await page.goToNextPage();
    await (await button('Reset local table')).click();
    expect(await (await filter()).getValue()).toBe('');
    expect(await page.getRangeLabel()).toBe('1 – 5 of 15');
  });

  it('supports Enter on a focused sort button and announces sorting through one inline channel', async () => {
    const announce = spyOn(LiveAnnouncer.prototype, 'announce').and.resolveTo();
    const snack = spyOn(TestBed.inject(MatSnackBar), 'open').and.callThrough();
    const trigger = materialElement(root(), '[mat-sort-header="minutes"] [role="button"]');
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    expect(await (await header('Minutes')).getSortDirection()).toBe('asc');
    expect(document.activeElement).toBe(trigger);
    const notice = materialElement(root(), '[data-table-sort-notice]');
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.textContent).toBe('Sorted by Minutes ascending.');
    expect(root().querySelector('[mat-sort-header="minutes"]')?.getAttribute('aria-sort')).toBe('ascending');
    await (await header('Minutes')).click();
    expect(notice.textContent).toBe('Sorted by Minutes descending.');
    expect(announce).not.toHaveBeenCalled();
    expect(snack).not.toHaveBeenCalled();
  });

  it('restores the default sort if a non-allowlisted header is supplied', async () => {
    const sort = fixture.debugElement.query(By.directive(MatSort)).injector.get(MatSort);
    sort.sort({ id: 'unexpected', start: 'desc', disableClear: false });
    expect(await (await header('ID')).getSortDirection()).toBe('asc');
    expect(await cells('id')).toEqual(['1', '2', '3', '4', '5']);
  });

  it('keeps all interactions local and recreates the initial table without storage', async () => {
    const reads = spyOn(Storage.prototype, 'getItem');
    const writes = spyOn(Storage.prototype, 'setItem');
    await (await filter()).setValue('watch');
    await (await header('Minutes')).click();
    await (await paginator()).setPageSize(10);
    fixture.destroy();
    fixture = TestBed.createComponent(MaterialTableComponent);
    fixture.detectChanges();
    expect(await (await filter()).getValue()).toBe('');
    expect(await (await paginator()).getRangeLabel()).toBe('1 – 5 of 15');
    expect(await cells('id')).toEqual(['1', '2', '3', '4', '5']);
    expect(reads).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });

  it('safely disconnects from both the table and owner destruction paths', async () => {
    await table();
    const disconnect = spyOn(MatTableDataSource.prototype, 'disconnect').and.callThrough();
    expect(() => fixture.destroy()).not.toThrow();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it('disconnects an eagerly created data source even before its table renders', () => {
    fixture.destroy();
    const disconnect = spyOn(MatTableDataSource.prototype, 'disconnect').and.callThrough();
    fixture = TestBed.createComponent(MaterialTableComponent);
    fixture.destroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
