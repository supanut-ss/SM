import { Select } from "../components/select";
import { cn } from "../lib/cn";

export interface BranchOption {
  id: string;
  name: string;
}

export interface BranchSwitcherProps {
  branches: BranchOption[];
  value: string;
  onChange: (branchId: string) => void;
  className?: string;
}

export function BranchSwitcher({ branches, value, onChange, className }: BranchSwitcherProps) {
  return (
    <Select
      aria-label="เลือกสาขา"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn("w-44", className)}
    >
      {branches.map((branch) => (
        <option key={branch.id} value={branch.id}>
          {branch.name}
        </option>
      ))}
    </Select>
  );
}
