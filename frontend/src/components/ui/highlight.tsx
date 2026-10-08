/** Wraps case-insensitive matches of `term` in <mark>, without ever interpreting `text` as HTML. */
export function Highlight({ text, term }: { text: string; term: string }) {
  const needle = term.trim();
  if (needle.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  return (
    <>
      {text.split(pattern).map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className="rounded-sm bg-transparent font-semibold text-accent">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
