export function SearchBox({
  value,
  onChange,
  autoFocus = false,
  placeholder = 'Search vocabulary...',
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="search-bar">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label="搜索单词"
        autoComplete="off"
        spellCheck={false}
      />
      {value && (
        <button className="search-clear" onClick={() => onChange('')} aria-label="清空搜索">
          ×
        </button>
      )}
    </div>
  );
}
