export const STORAGE = Symbol('STORAGE');

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
}

/**
 * Object-storage abstraction (S3-compatible). Issues short-TTL presigned PUT
 * URLs scoped to a key/content-type/size so the client uploads directly to S3
 * and the backend never proxies bytes (Phase 6 §5).
 */
export interface StoragePort {
  presignUpload(params: {
    key: string;
    mime: string;
    maxSize: number;
  }): Promise<PresignedUpload>;
  headObject(key: string): Promise<{ size: number; mime: string } | null>;
  publicUrl(key: string): string;
}
