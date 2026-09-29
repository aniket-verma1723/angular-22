export interface FictionalPerson {
  readonly id: string;
  readonly name: string;
}

export const PEOPLE_COUNT = 1000;
export const PERSON_ROW_HEIGHT = 48;

/** Complete, bounded, deliberately fictional data; never a remote users page. */
export const FICTIONAL_PEOPLE: readonly FictionalPerson[] = Object.freeze(
  Array.from({ length: PEOPLE_COUNT }, (_, index) => Object.freeze({
    id: `lab-person-${index + 1}`,
    name: `Fictional person ${String(index + 1).padStart(4, '0')}`
  }))
);
