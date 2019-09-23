/**
 * Library functions and utilities.
 * 
 * Pure functions only!
 */

export function create_id() {
  return Math.random().toString(36).substr(2, 10);
};
