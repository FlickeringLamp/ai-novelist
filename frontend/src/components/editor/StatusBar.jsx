const StatusBar =({ charCount })=> {

  return (
    <div
      className="bg-theme-black h-full flex items-center justify-between px-4 text-sm text-theme-gray5 border-t border-theme-gray3"
    >
      <div className="flex items-center gap-4">
        <span>总字符数: {charCount}</span>
      </div>
    </div>
  );
}

export default StatusBar;
