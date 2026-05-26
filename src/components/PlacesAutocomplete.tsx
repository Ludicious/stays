'use client';

import { useRef } from 'react';
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

export default function PlacesAutocomplete({
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
      types: ['establishment'],
    },
    debounce: 300,
    // Use the externally controlled value if provided
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
