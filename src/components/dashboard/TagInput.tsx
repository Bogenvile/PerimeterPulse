import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  readonly?: boolean;
}

export function TagInput({ tags, onChange, suggestions = [], readonly = false }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = suggestions.filter(
    (s) => s.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(s),
  );

  function addTag(tag: string) {
    const clean = tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (clean && !tags.includes(clean) && clean.length <= 32) {
      onChange([...tags, clean]);
    }
    setInputValue("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
          readonly && "opacity-60 pointer-events-none",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span
            key={tag + i}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {tag}
            {!readonly && (
              <button
                onClick={(e) => { e.stopPropagation(); removeTag(i); }}
                className="hover:bg-primary/20 rounded-full p-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        ))}
        {!readonly && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? "Add tag..." : ""}
            className="flex-1 min-w-[60px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        )}
        {!readonly && inputValue.trim() && (
          <button
            onClick={() => addTag(inputValue)}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>

      {showSuggestions && !readonly && filteredSuggestions.length > 0 && inputValue.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          {filteredSuggestions.slice(0, 5).map((s) => (
            <button
              key={s}
              onClick={() => addTag(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}