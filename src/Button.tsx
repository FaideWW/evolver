import { JSX, ParentComponent } from "solid-js";

export interface ButtonProps {
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
  disabled?: boolean;
  class?: string;
}

export const Button: ParentComponent<ButtonProps> = (props) => {
  return (
    <button
      onClick={(e) => props.onClick?.(e)}
      disabled={props.disabled}
      class={`bg-slate-700 px-4 py-2 border border-slate-500 disabled:bg-gray-500 disabled:border-gray-300 hover:enabled:bg-blue-600 active:enabled:bg-blue-700 ${
        props.class ?? ""
      }`}
    >
      {props.children}
    </button>
  );
};
