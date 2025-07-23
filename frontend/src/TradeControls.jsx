import React from "react";

function TradeControls({ onBuy, onSell }) {
  return (
    <div className="trade-controls-row">
      <button className="buy-btn" onClick={onBuy}>
        Buy
      </button>
      <button className="sell-btn" onClick={onSell}>
        Sell
      </button>
    </div>
  );
}

export default TradeControls;
