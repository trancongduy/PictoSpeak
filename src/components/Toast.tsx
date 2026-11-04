export function Toast({ msg }: { msg: string }) {
  return (
    <div className="toast" role="status">
      {msg}
    </div>
  );
}
