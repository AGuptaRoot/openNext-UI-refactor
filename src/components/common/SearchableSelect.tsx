import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';

export interface SearchableSelectOption {
  label: string;
  value: string;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  onAddOption?: (newVal: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  allowClear?: boolean;
  className?: string;
  id?: string;
  name?: string;
  emptyLabel?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options = [],
  value = '',
  onChange,
  onAddOption,
  placeholder = 'Select an option…',
  disabled = false,
  readOnly = false,
  required = false,
  allowClear = true,
  className = '',
  id,
  name,
  emptyLabel = 'No matching options',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const isInteractive = !disabled && !readOnly;

  // Selected option or fallback for values not present in options (e.g. stored values)
  const selectedOption = useMemo<SearchableSelectOption | null>(() => {
    if (!value) return null;
    const match = options.find((opt) => opt.value === value);
    if (match) return match;
    return { label: value, value };
  }, [options, value]);

  // Filter options based on search query
  const trimmedSearch = search.trim();
  const filteredOptions = useMemo(() => {
    if (!trimmedSearch) return options;
    const lower = trimmedSearch.toLowerCase();
    return options.filter((opt) => {
      const label = (opt.label || opt.value || '').toLowerCase();
      const val = (opt.value || '').toLowerCase();
      return label.includes(lower) || val.includes(lower);
    });
  }, [options, trimmedSearch]);

  // Check if search query matches any option exactly (case-insensitive)
  const hasExactMatch = useMemo(() => {
    if (!trimmedSearch) return false;
    const lower = trimmedSearch.toLowerCase();
    return options.some(
      (opt) => (opt.value || '').toLowerCase() === lower || (opt.label || '').toLowerCase() === lower
    );
  }, [options, trimmedSearch]);

  // Can we show the "+ Add" option?
  const canAddOption = Boolean(onAddOption && trimmedSearch && !hasExactMatch);

  // Total navigable items in the listbox
  const totalNavigable = filteredOptions.length + (canAddOption ? 1 : 0);

  // When search query changes, reset highlighted index to 0 (top match)
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
    }
  }, [search, isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.querySelector(
        `[data-nav-index="${highlightedIndex}"]`
      ) as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // Close on outside click and commit search if typed
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const s = search.trim();
        if (s) {
          const match = options.find(
            (opt) =>
              (opt.value || '').toLowerCase() === s.toLowerCase() ||
              (opt.label || '').toLowerCase() === s.toLowerCase()
          );
          if (match) {
            onChange(match.value);
          } else if (onAddOption) {
            onAddOption(s);
          } else {
            onChange(s);
          }
        }
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, search, options, onAddOption, onChange]);

  const handleSelectOption = (optValue: string) => {
    onChange(optValue);
    setSearch('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleAdd = (textToAdd: string) => {
    if (!textToAdd) return;
    if (onAddOption) {
      onAddOption(textToAdd);
    } else {
      onChange(textToAdd);
    }
    setSearch('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isInteractive) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
        setSearch('');
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalNavigable > 0) {
        setHighlightedIndex((prev) => (prev + 1 < totalNavigable ? prev + 1 : 0));
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalNavigable > 0) {
        setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : totalNavigable - 1));
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();

      if (totalNavigable === 0) {
        if (canAddOption) {
          handleAdd(trimmedSearch);
        }
        return;
      }

      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelectOption(filteredOptions[highlightedIndex].value);
      } else if (canAddOption && highlightedIndex === filteredOptions.length) {
        handleAdd(trimmedSearch);
      } else if (filteredOptions.length === 1) {
        handleSelectOption(filteredOptions[0].value);
      } else if (canAddOption) {
        handleAdd(trimmedSearch);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearch('');
      setHighlightedIndex(-1);
      return;
    }

    if (e.key === 'Tab') {
      const s = trimmedSearch;
      if (s) {
        const match = options.find(
          (opt) =>
            (opt.value || '').toLowerCase() === s.toLowerCase() ||
            (opt.label || '').toLowerCase() === s.toLowerCase()
        );
        if (match) {
          handleSelectOption(match.value);
        } else if (canAddOption) {
          handleAdd(s);
        } else {
          onChange(s);
        }
      }
      setIsOpen(false);
      setSearch('');
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden input for native form validation */}
      {required ? (
        <input
          id={id ? `${id}-hidden` : undefined}
          name={name ? `${name}_required` : undefined}
          tabIndex={-1}
          className="sr-only"
          value={value}
          required
          readOnly
          aria-hidden
        />
      ) : null}

      {/* Main Combobox Input Surface */}
      <div
        className={`group flex items-center h-9 w-full rounded-lg border bg-white dark:bg-zinc-900 px-2.5 transition-colors ${
          !isInteractive
            ? 'opacity-60 bg-zinc-50 dark:bg-zinc-950 cursor-not-allowed border-zinc-200 dark:border-zinc-800'
            : isOpen
            ? 'border-blue-500 ring-1 ring-blue-500'
            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
        }`}
        onClick={() => {
          if (isInteractive && !isOpen) {
            setSearch(selectedOption ? selectedOption.label : value || '');
            setIsOpen(true);
            inputRef.current?.focus();
            inputRef.current?.select();
          }
        }}
      >
        <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0 mr-2 pointer-events-none" aria-hidden />

        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          disabled={disabled}
          readOnly={readOnly}
          value={isOpen ? search : selectedOption ? selectedOption.label : value || ''}
          onChange={(e) => {
            if (!isOpen) setIsOpen(true);
            setSearch(e.target.value);
          }}
          onFocus={() => {
            if (isInteractive) {
              setSearch(selectedOption ? selectedOption.label : value || '');
              setIsOpen(true);
              inputRef.current?.select();
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed cursor-pointer"
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {allowClear && Boolean(value) && isInteractive && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            disabled={!isInteractive}
            onClick={(e) => {
              e.stopPropagation();
              if (isInteractive) {
                setIsOpen((prev) => !prev);
                if (!isOpen) {
                  inputRef.current?.focus();
                }
              }
            }}
            className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-150 ${
                isOpen ? 'rotate-180 text-blue-500' : ''
              }`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {/* Floating Dropdown Menu */}
      {isOpen && isInteractive && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg py-1"
        >
          {filteredOptions.length === 0 && !canAddOption && (
            <div className="px-3 py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
              {trimmedSearch ? `${emptyLabel} for "${trimmedSearch}"` : emptyLabel}
            </div>
          )}

          {filteredOptions.map((opt, index) => {
            const isSelected = opt.value === value;
            const isHighlighted = index === highlightedIndex;
            return (
              <div
                key={opt.value}
                role="option"
                data-nav-index={index}
                aria-selected={isSelected}
                onClick={() => handleSelectOption(opt.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer select-none transition-colors ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium'
                    : isHighlighted
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <span className="truncate">{opt.label || opt.value}</span>
                {isSelected && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
                )}
              </div>
            );
          })}

          {/* Add Option Item when user typed something not in list */}
          {canAddOption && (
            <div
              role="option"
              data-nav-index={filteredOptions.length}
              aria-selected={highlightedIndex === filteredOptions.length}
              onClick={() => handleAdd(trimmedSearch)}
              onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
              className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer select-none border-t border-zinc-100 dark:border-zinc-800 transition-colors ${
                highlightedIndex === filteredOptions.length
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                  : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-zinc-800'
              } font-medium`}
            >
              <Plus className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
              <span className="truncate">Add &ldquo;<strong>{trimmedSearch}</strong>&rdquo;</span>
              <span className="ml-auto text-[10px] text-zinc-400 font-normal shrink-0">(Save to Settings)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
