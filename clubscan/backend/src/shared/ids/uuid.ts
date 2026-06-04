import { v7 as uuidv7 } from 'uuid';

/**
 * Time-ordered UUID v7 generation, used for all primary keys.
 * Generated in the application layer so IDs are known before persistence
 * (enables emitting domain events that reference the new aggregate id).
 */
export function newId(): string {
  return uuidv7();
}
