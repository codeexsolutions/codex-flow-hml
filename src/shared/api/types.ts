export type ApiEnvelope<T> = {
  data?: T[];
};

/** Extrai a lista do envelope, tolerando resposta ausente ou malformada. */
export const unwrapList = <T>(payload: unknown): T[] => {
  const list = (payload as ApiEnvelope<T> | undefined)?.data;
  return Array.isArray(list) ? list : [];
};
