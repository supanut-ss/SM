import { Select } from "../components/select";

export interface BranchOption {
  id: string;
  name: string;
}

export interface BranchSwitcherProps {
  branches: BranchOption[];
  value: string;
  onChange: (branchId: string) => void;
}

export function BranchSwitcher({ branches, value, onChange }: BranchSwitcherProps) {
  return (
    <Select
      aria-label="เลือกสาขา"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-44"
    >
      {branches.map((branch) => (
        <option key={branch.id} value={branch.id}>
          {branch.name}
        </option>
      ))}
    </Select>
  );
}
