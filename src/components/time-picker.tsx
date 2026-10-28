'use client';
import { useId, useState } from 'react';
import { Select } from './select';

export function TimePicker({
  name,
  label,
  required = false,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  const id = useId();
  const [hour, setHour] = useState(''),
    [minute, setMinute] = useState('00');
  return (
    <fieldset className="time-picker" aria-labelledby={id}>
      <legend id={id}>{label}</legend>
      <div className="time-picker-controls">
        <Select
          name={`${name}Hour`}
          value={hour}
          onValueChange={setHour}
          required={required}
          aria-label={`${label}: hora`}
        >
          <option value="">Hora</option>
          {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
            <option value={h} key={h}>
              {h}
            </option>
          ))}
        </Select>
        <span aria-hidden="true">:</span>
        <Select
          name={`${name}Minute`}
          value={minute}
          onValueChange={setMinute}
          required={required}
          aria-label={`${label}: minutos`}
        >
          {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
            <option value={m} key={m}>
              {m}
            </option>
          ))}
        </Select>
      </div>
      <input type="hidden" name={name} value={hour ? `${hour}:${minute}` : ''} />
    </fieldset>
  );
}
