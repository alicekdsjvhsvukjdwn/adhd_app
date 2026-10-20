// Types minimaux de Cloudflare Workers (évite une dépendance de plus).
declare interface KVNamespace {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix?: string; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}
