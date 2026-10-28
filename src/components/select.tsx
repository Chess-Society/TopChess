'use client';
import * as RadixSelect from '@radix-ui/react-select';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean };
type Props = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  children: ReactNode;
  'aria-label'?: string;
  id?: string;
};
/** Un único desplegable accesible para búsqueda, formularios y paneles. */
export function Select({ children, value, defaultValue, onValueChange, ...props }: Props) {
  const options: ReactElement<OptionProps>[] = [];
  function collect(nodes: ReactNode) {
    Children.forEach(nodes, (node) => {
      if (!isValidElement<OptionProps>(node)) return;
      if (node.type === 'option') options.push(node);
      else if (node.props.children) collect(node.props.children);
    });
  }
  collect(children);
  const first = options[0];
  const initial = defaultValue ?? String(first?.props.value ?? first?.props.children ?? '');
  // Radix reserva la cadena vacía para el placeholder; el formulario conserva el valor vacío.
  const map = (v: string) => (v === '' && !props.name ? '__all__' : v);
  return (
    <RadixSelect.Root
      name={props.name}
      required={props.required}
      disabled={props.disabled}
      value={value === undefined ? undefined : map(value)}
      defaultValue={value === undefined ? map(initial) : undefined}
      onValueChange={(v) => onValueChange?.(v === '__all__' ? '' : v)}
    >
      <RadixSelect.Trigger
        className="select-trigger"
        id={props.id}
        aria-label={props['aria-label']}
      >
        <RadixSelect.Value placeholder={first?.props.children || 'Selecciona una opción'} />
        <RadixSelect.Icon>
          <ChevronDown size={18} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          className="select-popup"
          position="popper"
          sideOffset={9}
          collisionPadding={12}
        >
          <RadixSelect.ScrollUpButton className="select-scroll">
            <ChevronUp size={17} />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport>
            {options
              .filter((o) => !props.name || String(o.props.value ?? o.props.children) !== '')
              .map((option, i) => {
                const v = map(String(option.props.value ?? option.props.children));
                return (
                  <RadixSelect.Item
                    className="select-option"
                    key={`${v}-${i}`}
                    value={v}
                    disabled={option.props.disabled}
                  >
                    <RadixSelect.ItemText>{option.props.children}</RadixSelect.ItemText>
                    <RadixSelect.ItemIndicator>
                      <Check size={15} />
                    </RadixSelect.ItemIndicator>
                  </RadixSelect.Item>
                );
              })}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="select-scroll">
            <ChevronDown size={17} />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
