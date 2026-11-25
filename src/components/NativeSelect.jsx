import { ChevronDown } from "lucide-react";
import "../styles/native-select.css";

export default function NativeSelect({ children, ...props }) {
  return (
    <span className="native-select">
      <select {...props}>{children}</select>
      <ChevronDown className="native-select__chevron" aria-hidden="true" focusable="false" />
    </span>
  );
}
