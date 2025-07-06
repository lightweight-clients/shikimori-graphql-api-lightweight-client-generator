type Primitive = string | number | boolean | symbol | null | undefined | bigint;

type OmitTypename<T> = Omit<T, '__typename'>;

// Enforce at least one property
type AtLeastOne<T> = {
    [K in keyof T]: Pick<T, K>
}[keyof T] & Partial<T>;

// Main recursive logic
type MapToOne<T> = T extends Primitive
    ? 1
    : T extends Array<infer U>
        ? MapToOne<U>
        : T extends object
            ? AtLeastOne<{
                [K in keyof OmitTypename<T>]: MapToOne<T[K]>
            }>
            : never;

export type QueryResultDescription<T> = MapToOne<T>;
