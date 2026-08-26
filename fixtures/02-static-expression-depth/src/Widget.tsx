interface WidgetProps {
  active: boolean;
  condition: boolean;
  open: boolean;
}

function getModalClass(open: boolean): string {
  return open ? 'modal-open' : 'modal-closed';
}

export function Widget({ active, condition, open }: WidgetProps) {
  return (
    <div>
      <span className={"badge-wrap"}>Badge</span>
      <span className={`nav`}>Nav</span>
      <div className={active ? "hero active" : "hero"}>Hero</div>
      <div className={condition && "flag"}>Flag</div>
      <div className={open ? "modal" : getModalClass(open)}>Modal</div>
    </div>
  );
}
