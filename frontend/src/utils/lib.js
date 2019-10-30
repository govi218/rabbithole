/**
 * Library functions and utilities.
 * 
 * Pure functions only!
 */

export function create_id() {
  return Math.random().toString(36).substr(2, 10);
};

export function get_website_with_url(websites, url) {
  for (let i = 0; i < websites.length; i++) {
    if (websites[i].url === url) return websites[i];
  }
  return {};
}