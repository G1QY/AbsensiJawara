import { useState } from 'react';

export type GoogleLocationPickerLocation = {
  address: string;
  latitude: string;
  longitude: string;
};

export default function GoogleLocationPicker({
  title,
  address = '',
  latitude = '',
  longitude = '',
  onChange,
}: {
  title?: string;
  address?: string;
  latitude?: string | number;
  longitude?: string | number;
  onChange: (location: GoogleLocationPickerLocation) => void;
}) {
  const [localAddress, setLocalAddress] = useState(String(address ?? ''));

  const update = (next: Partial<GoogleLocationPickerLocation>) => {
    const nextAddress = next.address ?? localAddress;
    const nextLatitude = next.latitude ?? String(latitude ?? '');
    const nextLongitude = next.longitude ?? String(longitude ?? '');

    setLocalAddress(nextAddress);
    onChange({
      address: nextAddress,
      latitude: nextLatitude,
      longitude: nextLongitude,
    });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          address: localAddress || 'Lokasi perangkat saat ini',
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        };

        setLocalAddress(next.address);
        onChange(next);
      },
      () => {
        setLocalAddress(localAddress || 'Lokasi perangkat saat ini');
      },
    );
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {title && <h4 className="text-sm font-semibold text-slate-800">{title}</h4>}

      <label className="block text-xs text-slate-600">
        Alamat / Nama Lokasi
        <input
          className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
          value={localAddress}
          onChange={(event) => update({ address: event.target.value })}
          placeholder="Masukkan alamat atau nama lokasi"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-600">
          Latitude
          <input
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
            value={String(latitude ?? '')}
            onChange={(event) => update({ latitude: event.target.value })}
            placeholder="-6.123456"
          />
        </label>

        <label className="block text-xs text-slate-600">
          Longitude
          <input
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
            value={String(longitude ?? '')}
            onChange={(event) => update({ longitude: event.target.value })}
            placeholder="106.123456"
          />
        </label>
      </div>

      <button
        type="button"
        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100"
        onClick={useCurrentLocation}
      >
        Gunakan lokasi perangkat
      </button>
    </div>
  );
}
