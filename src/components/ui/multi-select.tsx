
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverPortal,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
  placeholder?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  className,
  placeholder = "Select...",
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  const handleUnselect = (item: string) => {
    onChange(selected.filter((i) => i !== item));
  };

  const handleSelect = (option: string) => {
    if (selected.includes(option)) {
      handleUnselect(option);
    } else {
      onChange([...selected, option]);
    }
  };

  const filteredOptions = options.filter(option =>
    option && option.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleClearAll = () => {
    onChange([]);
    setSearchValue("");
  };

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between text-left font-normal",
              selected.length > 0 ? "h-auto min-h-10" : "h-10",
              className
            )}
          >
            <div className="flex gap-1 flex-wrap max-w-full">
              {selected.length > 0 ? (
                selected.map((item) => (
                  <Badge
                    variant="secondary"
                    key={item}
                    className="mr-1 mb-1"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUnselect(item);
                    }}
                  >
                    {item}
                    <button
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleUnselect(item);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverPortal>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[9999]" sideOffset={5}>
          <div className="flex flex-col">
            {/* Search Input */}
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Input
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="border-0 focus-visible:ring-0 shadow-none"
              />
            </div>

            {/* Options List */}
            <div className="max-h-60 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No results found.
                </div>
              ) : (
                <div className="p-1">
                  {filteredOptions.map((option) => {
                    const isSelected = selected.includes(option);
                    return (
                      <div
                        key={option}
                        className={cn(
                          "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                          isSelected && "bg-accent"
                        )}
                        onClick={() => handleSelect(option)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {option}
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Clear All Option */}
              {selected.length > 0 && (
                <div className="border-t p-1">
                  <div
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-destructive hover:text-destructive-foreground text-destructive justify-center font-medium"
                    onClick={handleClearAll}
                  >
                    Clear all
                  </div>
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
        </PopoverPortal>
      </Popover>
    </div>
  );
}
