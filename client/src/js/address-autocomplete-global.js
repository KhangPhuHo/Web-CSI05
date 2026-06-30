export function setupGlobalAddressAutocomplete(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const autocomplete = new google.maps.places.Autocomplete(input, {
    types: ["geocode"],
    componentRestrictions: { country: [] } // tất cả quốc gia
  });
}
