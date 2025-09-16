
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "./scroll-area"

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
  const handleSelect = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("w-full justify-between h-auto", className, selected.length > 0 && "h-auto")}
        >
          <div className="flex gap-1 flex-wrap">
            {selected.length > 0 ? (
              selected.map((item) => (
                <Badge
                  variant="secondary"
                  key={item}
                  className="mr-1 mb-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(item);
                  }}
                >
                  {item}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <DropdownMenu open>
            <DropdownMenuContent className="w-full border-none shadow-none">
                <ScrollArea className="h-60">
                    {options.map((option) => (
                        <DropdownMenuCheckboxItem
                            key={option}
                            checked={selected.includes(option)}
                            onCheckedChange={() => handleSelect(option)}
                        >
                            {option}
                        </DropdownMenuCheckboxItem>
                    ))}
                </ScrollArea>
                {selected.length > 0 && (
                    <DropdownMenuItem
                        onSelect={() => onChange([])}
                        className="text-red-500 focus:text-red-500"
                    >
                        Clear all
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
      </PopoverContent>
    </Popover>
  );
}
