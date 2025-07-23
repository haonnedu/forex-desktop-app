import React, { useEffect, useState } from "react";

function SymbolSelector({ onSelect }) {
  const [symbols, setSymbols] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/symbols")
      .then((res) => res.json())
      .then((data) => setSymbols(data));
  }, []);

  return (
    <select onChange={(e) => onSelect(e.target.value)}>
      <option value="">-- Chọn Symbol --</option>
      {symbols.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

export default SymbolSelector;
