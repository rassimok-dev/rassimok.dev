/* Engine ticks: the game updates in fixed 1/120 s steps, and a time is the
   number of play-phase steps. MIN_CLEAR_TICKS mirrors the API's floor. */
const KLAD_TICKS = {
  PER_SECOND: 120,
  MIN_CLEAR_TICKS: 600,
  format(ticks) {
    const hundredths = Math.floor(ticks * 100 / KLAD_TICKS.PER_SECOND);
    const minutes = Math.floor(hundredths / 6000);
    const seconds = Math.floor(hundredths / 100) % 60;
    const rest = hundredths % 100;
    return minutes + ':' + String(seconds).padStart(2, '0') + '.' + String(rest).padStart(2, '0');
  },
};
if (typeof module !== 'undefined') module.exports = KLAD_TICKS;
