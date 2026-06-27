'use client';

import { useEffect, useRef, useState } from 'react';
import usePlacesAutocomplete, { getDetails } from 'use-places-autocomplete';

export interface PlaceSelection {
  name: string;
  address: string;
  lat: number;
  lng: number;
  place_id: string;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
}

interface Props {
  onPlaceSelect: (place: PlaceSelection) => void;
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
}

/**
 * Returns true once the Google Maps Places library is actually present on
 * `window`. The Maps script is injected in layout.tsx with strategy
 * "afterInteractive", so on a cold load it may not be ready when this
 * component first mounts. usePlacesAutocomplete() throws if it runs before
 * the library exists, and on a fresh/uncached instance that throw repeats
 * across re-renders long enough to thrash the server. Gating the hook behind
 * this check removes the race entirely.
 */
function useMapsReady(): boolean {
  const [isReady, setIsReady] = useState(
    () => typeof window !== 'undefined' && !!window.google?.maps?.places,
  );

  useEffect(() => {
    if (isReady) return;

    let cancelled = false;
    const start = Date.now();

    const check = () => {
      if (cancelled) return;
      if (window.google?.maps?.places) {
        setIsReady(true);
        return;
      }
      // Give up after 15s so a genuinely-missing key doesn't poll forever.
      if (Date.now() - start > 15000) return;
      window.setTimeout(check, 150);
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [isReady]);

  return isReady;
}

/**
 * Outer guard. Until Maps is ready, render a plain, disabled input so the
 * hook-bearing inner component never mounts early. Once ready, mount the
 * real autocomplete. This is the load-order fix.
 */
export default function PlacesAutocomplete(props: Props) {
  const mapsReady = useMapsReady();

  if (!mapsReady) {
    return (
      <div className="autocomplete-wrap">
        <input
          type="text"
          className="form-input"
          value={props.value ?? ''}
          onChange={e => props.onChange?.(e.target.value)}
          disabled
          placeholder="Loading map data…"
          autoComplete="off"
        />
      </div>
    );
  }

  return <PlacesAutocompleteInner {...props} />;
}

/**
 * Inner component. Only ever mounted once Maps is confirmed loaded, so
 * usePlacesAutocomplete() is safe to call here.
 */
function PlacesAutocompleteInner({
  onPlaceSelect,
  value,
  onChange,
  placeholder = 'Search campground name…',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    ready,
    value: internalValue,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: ['us', 'ca'] },
      // No 'types' restriction — allows campgrounds, addresses, and free-form names
    },
    debounce: 300,
    defaultValue: value ?? '',
  });

  const displayValue = value !== undefined ? value : internalValue;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    onChange?.(e.target.value);
  };

  const handleSelect = async (placeId: string, description: string) => {
    setValue(description, false);
    onChange?.(description);
    clearSuggestions();

    try {
      const result = await getDetails({
        placeId,
        fields: [
          'name',
          'formatted_address',
          'geometry',
          'address_components',
          'formatted_phone_number',
          'website',
        ],
      }) as google.maps.places.PlaceResult;

      const components = result.address_components ?? [];
      const get = (type: string, nameType: 'long_name' | 'short_name' = 'long_name') =>
        components.find(c => c.types.includes(type))?.[nameType] ?? null;

      const city  = get('locality') ?? get('sublocality') ?? get('administrative_area_level_2');
      const state = get('administrative_area_level_1', 'short_name');
      const lat   = result.geometry?.location?.lat() ?? 0;
      const lng   = result.geometry?.location?.lng() ?? 0;

      onPlaceSelect({
        name:      result.name ?? description,
        address:   result.formatted_address ?? '',
        lat,
        lng,
        place_id:  placeId,
        phone:     result.formatted_phone_number ?? null,
        website:   result.website ?? null,
        city,
        state,
      });
    } catch (err) {
      console.error('[PlacesAutocomplete] getDetails failed:', err);
    }
  };

  return (
    <div className="autocomplete-wrap">
      <input
        ref={inputRef}
        type="text"
        className="form-input"
        value={displayValue}
        onChange={handleInput}
        disabled={!ready}
        placeholder={ready ? placeholder : 'Loading map data…'}
        autoComplete="off"
        onKeyDown={e => {
          if (e.key === 'Escape') clearSuggestions();
        }}
      />
      {status === 'OK' && data.length > 0 && (
        <ul className="autocomplete-dropdown" role="listbox">
          {data.map(({ place_id, structured_formatting }) => (
            <li
              key={place_id}
              role="option"
              tabIndex={0}
              className="autocomplete-item"
              onClick={() => handleSelect(place_id, structured_formatting.main_text)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSelect(place_id, structured_formatting.main_text);
                }
              }}
            >
              <div className="ac-main">{structured_formatting.main_text}</div>
              {structured_formatting.secondary_text && (
                <div className="ac-second">{structured_formatting.secondary_text}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
