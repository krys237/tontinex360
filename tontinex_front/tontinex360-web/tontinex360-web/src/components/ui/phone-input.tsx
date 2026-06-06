"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  COUNTRIES, DEFAULT_COUNTRY, type Country,
  splitPhone, buildPhone,
} from "@/lib/utils/countries";

interface PhoneInputProps {
  /** Valeur en format E.164 (+237690123456) */
  value: string;
  /** Renvoie la valeur normalisée E.164 */
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Champ téléphone avec sélecteur d'indicatif pays.
 *
 * - La valeur exposée est toujours en format E.164 sans espaces (+237690123456)
 * - Le placeholder est l'exemple du pays sélectionné
 * - Si l'utilisateur recolle un numéro qui commence par +XXX, le pays s'aligne
 */
export function PhoneInput({
  value, onChange, required, disabled, className = "", id,
}: PhoneInputProps) {
  const initial = splitPhone(value || DEFAULT_COUNTRY.dial);
  const [country, setCountry] = useState<Country>(initial.country);
  const [local, setLocal] = useState<string>(initial.local);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync interne si la valeur externe change (ex: reset)
  useEffect(() => {
    if (!value) {
      setLocal("");
      return;
    }
    const split = splitPhone(value);
    if (split.country.code !== country.code) setCountry(split.country);
    if (split.local !== local) setLocal(split.local);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Fermer le dropdown au clic à l'extérieur
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const emit = (c: Country, l: string) => {
    onChange(buildPhone(c, l));
  };

  const handleLocalChange = (raw: string) => {
    // Si l'utilisateur colle un numéro commençant par +, on resplit
    if (raw.trim().startsWith("+")) {
      const split = splitPhone(raw.trim());
      setCountry(split.country);
      setLocal(split.local);
      emit(split.country, split.local);
      return;
    }
    const cleaned = raw.replace(/[^\d\s-]/g, "");
    setLocal(cleaned);
    emit(country, cleaned);
  };

  const selectCountry = (c: Country) => {
    setCountry(c);
    setOpen(false);
    emit(c, local);
  };

  return (
    <div ref={wrapperRef} className={`relative flex items-stretch ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2.5 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-sm hover:bg-gray-100 disabled:opacity-50"
      >
        <span className="text-base leading-none">{country.flag}</span>
        <span className="font-medium text-gray-700">{country.dial}</span>
        <ChevronDown size={12} className="text-gray-400" />
      </button>

      <input
        id={id}
        type="tel"
        inputMode="tel"
        value={local}
        onChange={e => handleLocalChange(e.target.value)}
        placeholder={country.example}
        required={required}
        disabled={disabled}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
      />

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {COUNTRIES.map(c => (
            <button
              key={c.code}
              type="button"
              onClick={() => selectCountry(c)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 ${
                c.code === country.code ? "bg-[#F1F8E8]" : ""
              }`}
            >
              <span className="text-base">{c.flag}</span>
              <span className="flex-1 text-sm text-gray-700">{c.name}</span>
              <span className="text-xs text-gray-400">{c.dial}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
