export const APP_MODES = Object.freeze({
  PREP: 'prep',
  OPERATIONAL: 'operational',
  POST: 'post',
});

export function isValidAppMode(value) {
  return Object.values(APP_MODES).includes(value);
}