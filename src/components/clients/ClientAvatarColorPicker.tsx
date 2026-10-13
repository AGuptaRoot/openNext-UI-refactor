import React from 'react';
import {
  CLIENT_AVATAR_COLOR_PRESETS,
  DEFAULT_CLIENT_AVATAR_COLOR,
  isValidClientAvatarColor,
  resolveClientAvatarColor,
} from '../../utils/clientAvatar';

interface ClientAvatarColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  label?: string;
}

export const ClientAvatarColorPicker: React.FC<ClientAvatarColorPickerProps> = ({
  value,
  onChange,
  disabled = false,
  label = 'Avatar color',
}) => {
  const current = resolveClientAvatarColor(value);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {CLIENT_AVATAR_COLOR_PRESETS.map((preset) => {
          const selected = current === resolveClientAvatarColor(preset.value);
          return (
            <button
              key={preset.value}
              type="button"
              title={preset.label}
              disabled={disabled}
              onClick={() => onChange(preset.value)}
              className={`h-8 w-8 cursor-pointer rounded-lg border-2 transition-transform disabled:cursor-not-allowed disabled:opacity-50 ${
                selected ? 'scale-105 border-zinc-950' : 'border-white ring-1 ring-zinc-200 hover:scale-105'
              }`}
              style={{ backgroundColor: preset.value }}
              aria-label={`Avatar color ${preset.label}`}
            />
          );
        })}
        <label
          className={`inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-2 text-[11px] font-semibold text-zinc-700 ${
            disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-zinc-50'
          }`}
        >
          Custom
          <input
            type="color"
            disabled={disabled}
            value={current}
            onChange={(event) => onChange(event.target.value)}
            className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed"
          />
        </label>
        {value && value !== DEFAULT_CLIENT_AVATAR_COLOR ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(DEFAULT_CLIENT_AVATAR_COLOR)}
            className="h-8 cursor-pointer rounded-lg border border-zinc-300 bg-white px-2.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            Reset
          </button>
        ) : null}
      </div>
      <p className="m-0 text-[11px] text-zinc-500">
        Used for the letter avatar when no logo/photo is set
        {isValidClientAvatarColor(value) ? ` · ${current}` : ''}.
      </p>
    </div>
  );
};
