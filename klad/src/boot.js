/* Phase 1 probe. Replaces the static "BLOCKED" markup so that a passing
   result is visible in the page rather than only in a response header.
   Deliberately has no imports: this tests the CSP, not the module graph. */

const probe = document.getElementById('probe');

if (probe) {
  probe.classList.remove('blocked');
  probe.classList.add('running');
  probe.textContent =
    'RUNNING. The module executed, so /klad/ has script-src while the apex does not.';
}
