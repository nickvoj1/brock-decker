import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RoleSelectorProps {
  selectedRoles: string[];
  onRolesChange: (roles: string[]) => void;
}

interface RoleCategory {
  label: string;
  roles: { value: string; label: string }[];
}

const roleCategories: RoleCategory[] = [
  {
    label: "HR & Recruiting",
    roles: [
      { value: "Recruiter", label: "Recruiter" },
      { value: "Talent Acquisition", label: "Talent Acquisition" },
      { value: "HR Manager", label: "HR Manager" },
      { value: "Human Resources", label: "Human Resources" },
      { value: "Hiring Manager", label: "Hiring Manager" },
      { value: "Head of Talent", label: "Head of Talent" },
      { value: "People Operations", label: "People Operations" },
      { value: "HR Director", label: "HR Director" },
      { value: "Talent Partner", label: "Talent Partner" },
      { value: "HR Business Partner", label: "HR Business Partner" },
    ],
  },
  {
    label: "Senior Leadership",
    roles: [
      { value: "CEO", label: "CEO" },
      { value: "Chief Executive", label: "Chief Executive" },
      { value: "CTO", label: "CTO" },
      { value: "CFO", label: "CFO" },
      { value: "COO", label: "COO" },
      { value: "CIO", label: "CIO" },
      { value: "Managing Director", label: "Managing Director" },
      { value: "Managing Partner", label: "Managing Partner" },
      { value: "Senior Partner", label: "Senior Partner" },
      { value: "Equity Partner", label: "Equity Partner" },
      { value: "VP", label: "VP / Vice President" },
      { value: "SVP", label: "SVP / Senior VP" },
      { value: "EVP", label: "EVP / Executive VP" },
      { value: "Director", label: "Director" },
      { value: "Partner", label: "Partner" },
      { value: "Principal", label: "Principal" },
      { value: "Founder", label: "Founder / Co-Founder" },
    ],
  },
  {
    label: "Legal & Compliance",
    roles: [
      { value: "General Counsel", label: "General Counsel" },
      { value: "Chief Legal Officer", label: "Chief Legal Officer (CLO)" },
      { value: "Legal Director", label: "Legal Director" },
      { value: "Head of Legal", label: "Head of Legal" },
      { value: "Legal Counsel", label: "Legal Counsel" },
      { value: "Counsel", label: "Counsel" },
      { value: "Legal Partner", label: "Legal Partner" },
      { value: "Attorney", label: "Attorney" },
      { value: "Lawyer", label: "Lawyer" },
      { value: "Compliance", label: "Compliance Officer" },
      { value: "Regulatory", label: "Regulatory Affairs" },
    ],
  },
  {
    label: "Finance & Investment",
    roles: [
      { value: "Investment Manager", label: "Investment Manager" },
      { value: "Portfolio Manager", label: "Portfolio Manager" },
      { value: "Fund Manager", label: "Fund Manager" },
      { value: "Finance Director", label: "Finance Director" },
      { value: "Finance Manager", label: "Finance Manager" },
      { value: "Investment Director", label: "Investment Director" },
      { value: "Head of Investments", label: "Head of Investments" },
      { value: "Investor Relations", label: "Investor Relations" },
      { value: "Fundraising", label: "Fundraising" },
    ],
  },
  {
    label: "Strategy & Operations",
    roles: [
      { value: "Corporate Development", label: "Corporate Development" },
      { value: "Business Development", label: "Business Development" },
      { value: "Strategy", label: "Strategy" },
      { value: "Operations", label: "Operations" },
    ],
  },
  {
    label: "Technology",
    roles: [
      { value: "Engineering Manager", label: "Engineering Manager" },
      { value: "Head of Engineering", label: "Head of Engineering" },
      { value: "VP Engineering", label: "VP Engineering" },
      { value: "Tech Lead", label: "Tech Lead" },
      { value: "IT Director", label: "IT Director" },
    ],
  },
];

export function RoleSelector({ selectedRoles, onRolesChange }: RoleSelectorProps) {
  const [open, setOpen] = useState(false);

  const toggleRole = (roleValue: string) => {
    if (selectedRoles.includes(roleValue)) {
      onRolesChange(selectedRoles.filter((r) => r !== roleValue));
    } else {
      onRolesChange([...selectedRoles, roleValue]);
    }
  };

  const toggleCategory = (category: RoleCategory) => {
    const categoryValues = category.roles.map((r) => r.value);
    const allSelected = categoryValues.every((v) => selectedRoles.includes(v));
    
    if (allSelected) {
      onRolesChange(selectedRoles.filter((r) => !categoryValues.includes(r)));
    } else {
      const newRoles = [...selectedRoles];
      categoryValues.forEach((v) => {
        if (!newRoles.includes(v)) {
          newRoles.push(v);
        }
      });
      onRolesChange(newRoles);
    }
  };

  const removeRole = (roleValue: string) => {
    onRolesChange(selectedRoles.filter((r) => r !== roleValue));
  };

  const getRoleLabel = (value: string): string => {
    for (const category of roleCategories) {
      const role = category.roles.find((r) => r.value === value);
      if (role) return role.label;
    }
    return value;
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedRoles.length === 0
              ? "Select target roles..."
              : `${selectedRoles.length} role${selectedRoles.length > 1 ? "s" : ""} selected`}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0 bg-background border z-50" align="start">
          <ScrollArea className="h-[300px]">
            <div className="p-4 space-y-4">
              {roleCategories.map((category) => {
                const categoryValues = category.roles.map((r) => r.value);
                const allSelected = categoryValues.every((v) =>
                  selectedRoles.includes(v)
                );
                const someSelected = categoryValues.some((v) =>
                  selectedRoles.includes(v)
                );

                return (
                  <div key={category.label} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category.label}`}
                        checked={allSelected}
                        ref={(el) => {
                          if (el) {
                            (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = 
                              someSelected && !allSelected;
                          }
                        }}
                        onCheckedChange={() => toggleCategory(category)}
                      />
                      <Label
                        htmlFor={`category-${category.label}`}
                        className="font-semibold text-sm cursor-pointer"
                      >
                        {category.label}
                      </Label>
                    </div>
                    <div className="ml-6 grid grid-cols-2 gap-2">
                      {category.roles.map((role) => (
                        <div key={role.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`role-${role.value}`}
                            checked={selectedRoles.includes(role.value)}
                            onCheckedChange={() => toggleRole(role.value)}
                          />
                          <Label
                            htmlFor={`role-${role.value}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {role.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {selectedRoles.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {selectedRoles.map((role) => (
              <Badge key={role} variant="secondary" className="text-xs">
                {getRoleLabel(role)}
                <button
                  type="button"
                  className="ml-1 hover:text-destructive"
                  onClick={() => removeRole(role)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRolesChange([])}
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3 mr-1" />
            Clear all roles
          </Button>
        </div>
      )}
    </div>
  );
}
