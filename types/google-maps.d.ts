// Ambient types for the Google Maps Places Autocomplete widget, loaded via a
// <script> tag injected at runtime (see app/dashboard/page.tsx and
// app/admin/page.tsx) rather than an npm package — hence no generated types.
// Covers only the subset those two files actually call.

interface GoogleAddressComponent {
  long_name: string
  short_name: string
  types: string[]
}

interface GooglePlaceResult {
  address_components?: GoogleAddressComponent[]
  formatted_address?: string
}

interface GoogleAutocomplete {
  addListener(eventName: 'place_changed', handler: () => void): void
  getPlace(): GooglePlaceResult
}

interface Window {
  google?: {
    maps: {
      places: {
        Autocomplete: new (input: HTMLInputElement, options?: { fields?: string[] }) => GoogleAutocomplete
      }
    }
  }
}
