export type NonOptionalProps<TObject extends Record<string, any>, TKeys extends keyof TObject> = {
	[K in keyof Omit<TObject, TKeys>]: TObject[K];
} & {
	[K in keyof Pick<TObject, TKeys>]-?: Exclude<TObject[K], null>;
};
