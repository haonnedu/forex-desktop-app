import React, { useState, useEffect, useRef } from "react";
import SymbolSelector from "./SymbolSelector";
import ChartView from "./ChartView";
import TradeControls from "./TradeControls";
import * as XLSX from "xlsx";
import "./App.css";

function App() {
  const [symbol, setSymbol] = useState(null);
  const [candles, setCandles] = useState([]);
  const [orders, setOrders] = useState([]); // lưu lệnh mô phỏng
  const [visibleCount, setVisibleCount] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lotSize, setLotSize] = useState(1); // mặc định 1 lot
  const [isStopped, setIsStopped] = useState(false);

  const [startDate, setStartDate] = useState("2024-06-01");
  const [startHour, setStartHour] = useState("09:00");
  const [timeframe, setTimeframe] = useState("M15"); // nếu bạn cho phép chọn
  const [confirmedDate, setConfirmedDate] = useState(startDate);
  const [confirmedHour, setConfirmedHour] = useState(startHour);
  const [sl, setSl] = useState(null);
  const [tp, setTp] = useState(null);

  // Move useRef hooks to top level
  const prevParams = useRef({
    symbol,
    confirmedDate: "2024-06-01",
    confirmedHour: "09:00",
    timeframe: "M15",
  });
  const prevVisibleCount = useRef(1);
  const prevCandles = useRef([]);

  useEffect(() => {
    if (!symbol || !confirmedDate || !confirmedHour) return;
    if (confirmedDate.length < 10 || confirmedHour.length < 5) return;

    let lastVisibleTime = null;
    if (candles.length && visibleCount > 0) {
      const lastVisibleCandle = candles[visibleCount - 1];
      if (lastVisibleCandle && lastVisibleCandle.time) {
        lastVisibleTime = lastVisibleCandle.time;
      }
    }

    const params = new URLSearchParams({
      symbol,
      timeframe,
      startDate: confirmedDate,
      startHour: confirmedHour,
    });

    fetch(`http://localhost:5000/candles?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setCandles(data);
        // If only timeframe changed, preserve visible time range
        if (
          prevParams.current.symbol === symbol &&
          prevParams.current.confirmedDate === confirmedDate &&
          prevParams.current.confirmedHour === confirmedHour &&
          prevParams.current.timeframe !== timeframe &&
          lastVisibleTime &&
          data.length
        ) {
          const idx = data.findIndex((c) => c.time >= lastVisibleTime);
          setVisibleCount(idx === -1 ? 1 : idx + 1);
        } else {
          setVisibleCount(1); // For symbol/date/hour change, start from first candle
        }
        prevParams.current = {
          symbol,
          confirmedDate,
          confirmedHour,
          timeframe,
        };
        prevVisibleCount.current = visibleCount;
        prevCandles.current = candles;
      });
  }, [symbol, confirmedDate, confirmedHour, timeframe]);

  const getLastPrice = () => {
    const lastCandle = candles.slice(0, visibleCount).at(-1);
    return lastCandle?.close || 0;
  };

  const handleBuy = () => {
    const price = getLastPrice();
    const time = new Date().toISOString();
    const newOrder = {
      type: "buy",
      symbol,
      price,
      time,
      lot: parseFloat(lotSize),
      isClosed: false,
      sl: sl ?? null,
      tp: tp ?? null,
      candleIndex: visibleCount - 1, // mark the candle where order is opened
    };
    setOrders([...orders, newOrder]);
  };

  const handleSell = () => {
    const price = getLastPrice();
    const time = new Date().toISOString();
    const newOrder = {
      type: "sell",
      symbol,
      price,
      time,
      lot: parseFloat(lotSize), // ✅ thêm dòng này
      isClosed: false,
      sl: sl ?? null,
      tp: tp ?? null,
      candleIndex: visibleCount - 1, // mark the candle where order is opened
    };
    setOrders([...orders, newOrder]);
  };

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev < candles.length) return prev + 1;
        setIsPlaying(false);
        return prev;
      });
    }, 1000); // mỗi 1s hiển thị 1 nến

    return () => clearInterval(interval);
  }, [isPlaying, candles]);

  useEffect(() => {
    if (!candles.length || visibleCount === 0) return;
    const currentCandle = candles[visibleCount - 1];
    if (!currentCandle) return;

    let shouldPause = false;

    setOrders((prevOrders) => {
      return prevOrders.map((order) => {
        if (order.isClosed) return order;
        if (order.symbol !== symbol) return order;
        // Only check for SL/TP after the entry candle
        if (
          typeof order.candleIndex !== "number" ||
          visibleCount - 1 <= order.candleIndex
        )
          return order;
        let hit = null;
        // Only trigger TP/SL if in correct direction
        if (order.type === "buy") {
          // SL must be below entry, TP must be above entry
          if (
            order.sl != null &&
            order.sl < order.price &&
            currentCandle.low <= order.sl
          )
            hit = "SL";
          if (
            order.tp != null &&
            order.tp > order.price &&
            currentCandle.high >= order.tp
          )
            hit = hit || "TP";
        } else if (order.type === "sell") {
          // SL must be above entry, TP must be below entry
          if (
            order.sl != null &&
            order.sl > order.price &&
            currentCandle.high >= order.sl
          )
            hit = "SL";
          if (
            order.tp != null &&
            order.tp < order.price &&
            currentCandle.low <= order.tp
          )
            hit = hit || "TP";
        }
        if (hit) {
          shouldPause = true;
          const exitPrice = hit === "TP" ? order.tp : order.sl;
          const priceDiff =
            order.type === "buy"
              ? exitPrice - order.price
              : order.price - exitPrice;
          let contractSize = 100000;
          if (order.symbol === "XAUUSD") contractSize = 100;
          const pnl = priceDiff * order.lot * contractSize;
          return {
            ...order,
            exitPrice,
            exitTime: new Date().toISOString(),
            isClosed: true,
            pnl: parseFloat(pnl.toFixed(2)) || 0,
            closeReason: hit,
          };
        }
        return order;
      });
    });

    if (shouldPause && isPlaying) {
      setIsPlaying(false);
      setIsStopped(true);
    }
  }, [visibleCount, candles, symbol, isPlaying]);
  function PlaybackControls({ onNext, onPlayPause, isPlaying, isStopped }) {
    return (
      <div style={{ marginTop: "20px" }}>
        <button onClick={onNext} disabled={isStopped}>
          Next Candle
        </button>
        <button
          onClick={onPlayPause}
          style={{ marginLeft: "10px" }}
          disabled={isStopped}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>
    );
  }
  const handleCloseOrder = (index) => {
    const price = getLastPrice();
    setOrders((prevOrders) => {
      const updated = [...prevOrders];
      const order = updated[index];
      if (order.isClosed || !price || !order.price || !order.lot)
        return updated;

      const priceDiff =
        order.type === "buy" ? price - order.price : order.price - price;

      let contractSize = 100000; // chuẩn forex
      if (order.symbol === "XAUUSD") contractSize = 100; // vàng

      const pnl = priceDiff * order.lot * contractSize;

      updated[index] = {
        ...order,
        exitPrice: price,
        exitTime: new Date().toISOString(),
        isClosed: true,
        pnl: parseFloat(pnl.toFixed(2)) || 0,
        closeReason: "Manual",
      };

      return updated;
    });
  };

  // Export to Excel function
  function exportOrdersToExcel(orders) {
    if (!orders.length) return;
    const wsData = [
      [
        "#",
        "Symbol",
        "Type",
        "Entry Price",
        "Exit Price",
        "Status",
        "PnL",
        "Close Reason",
      ],
      ...orders.map((o, i) => [
        i + 1,
        o.symbol,
        o.type.toUpperCase(),
        o.price,
        o.exitPrice || "-",
        o.isClosed ? "Closed" : "Open",
        o.pnl ?? "-",
        o.closeReason || "-",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    XLSX.writeFile(wb, `orders_${y}${m}${d}.xlsx`);
  }

  return (
    <div className="backtest-container">
      <div className="logo-title">
        <img
          src="https://ui-avatars.com/api/?name=FX&background=1976d2&color=fff&rounded=true&size=96"
          alt="Logo"
        />
        <h1>Backtest Hao Nguyen</h1>
      </div>
      <div className="section">
        <SymbolSelector onSelect={setSymbol} />
      </div>
      {candles.length > 0 && (
        <>
          <div className="section">
            <ChartView data={candles.slice(0, visibleCount)} orders={orders} />
          </div>
          <div className="section">
            <div className="input-row">
              <label>
                Ngày bắt đầu:
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onBlur={() => setConfirmedDate(startDate)}
                />
              </label>
              <label>
                Giờ bắt đầu:
                <input
                  type="time"
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  onBlur={() => setConfirmedHour(startHour)}
                />
              </label>
              <label>
                Khung thời gian:
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                >
                  <option value="M1">M1</option>
                  <option value="M5">M5</option>
                  <option value="M15">M15</option>
                  <option value="H1">H1</option>
                  <option value="D1">D1</option>
                </select>
              </label>
            </div>
            <PlaybackControls
              onNext={() => {
                if (visibleCount < candles.length && !isStopped) {
                  setVisibleCount(visibleCount + 1);
                }
              }}
              onPlayPause={() => {
                if (!isStopped) setIsPlaying((prev) => !prev);
              }}
              isPlaying={isPlaying}
              isStopped={isStopped}
            />
            {isStopped && (
              <div style={{ color: "red", fontWeight: "bold", marginTop: 10 }}>
                Simulation stopped due to TP/SL being hit.
              </div>
            )}
          </div>
          <div className="section">
            <div className="input-row">
              <div className="input-group">
                <label>
                  Lot size:
                  <input
                    type="number"
                    value={lotSize}
                    step="0.01"
                    min="0.01"
                    onChange={(e) => setLotSize(parseFloat(e.target.value))}
                  />
                </label>
                <label>
                  SL:
                  <input
                    type="number"
                    value={sl}
                    onChange={(e) => setSl(parseFloat(e.target.value))}
                  />
                </label>
                <label>
                  TP:
                  <input
                    type="number"
                    value={tp}
                    onChange={(e) => setTp(parseFloat(e.target.value))}
                  />
                </label>
                <div className="button-group">
                  <TradeControls onBuy={handleBuy} onSell={handleSell} />
                </div>
              </div>
            </div>
          </div>
          <div className="section">
            <h3>Lệnh mô phỏng:</h3>
            <button
              style={{ marginBottom: 12 }}
              onClick={() => exportOrdersToExcel(orders)}
            >
              Export to Excel
            </button>
            <div className="table-wrapper">
              <table className="orders-table" border="1" cellPadding={6}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Symbol</th>
                    <th>Loại</th>
                    <th>Giá vào</th>
                    <th>Giá ra</th>
                    <th>Trạng thái</th>
                    <th>Lời/Lỗ</th>
                    <th>Lý do đóng</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => (
                    <tr
                      key={i}
                      className={i % 2 === 0 ? "even-row" : "odd-row"}
                    >
                      <td>{i + 1}</td>
                      <td>{o.symbol}</td>
                      <td>{o.type.toUpperCase()}</td>
                      <td>{o.price}</td>
                      <td>{o.exitPrice || "-"}</td>
                      <td>{o.isClosed ? "Closed" : "Open"}</td>
                      <td>{o.pnl ?? "-"}</td>
                      <td>{o.closeReason || "-"}</td>
                      <td>
                        {!o.isClosed && (
                          <button
                            className="close-btn"
                            onClick={() => handleCloseOrder(i)}
                          >
                            Đóng
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <h4>
        Tổng PnL:{" "}
        {orders
          .filter((o) => o.isClosed)
          .reduce((acc, o) => acc + (o.pnl || 0), 0)
          .toFixed(2)}
      </h4>
    </div>
  );
}

export default App;
