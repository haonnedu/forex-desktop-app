from datetime import datetime

from flask import Flask, jsonify, request
import MetaTrader5 as mt5
import time
from flask_cors import CORS
app = Flask(__name__)
CORS(app)

# Khởi tạo MT5 khi app khởi động
mt5_initialized = mt5.initialize()
if not mt5_initialized:
    print("❌ MT5 init failed:", mt5.last_error())

@app.route('/symbols')
def get_symbols():
    if not mt5_initialized:
        return jsonify({"error": "MT5 not initialized"}), 500

    all_symbols = mt5.symbols_get()
    tradable = []

    for s in all_symbols:
        if s.visible and s.trade_mode == mt5.SYMBOL_TRADE_MODE_FULL:
            tradable.append(s.name)

    return jsonify(tradable)
from datetime import datetime
from datetime import datetime, timedelta
from flask import Flask, jsonify, request
import MetaTrader5 as mt5
import time
@app.route('/candles')
def get_candles():
    symbol = request.args.get("symbol", "").strip()
    timeframe = request.args.get("timeframe", "H1")
    start_date = request.args.get("startDate", "")
    start_hour = request.args.get("startHour", "")

    if not mt5_initialized:
        return jsonify({"error": "MT5 not initialized"}), 500

    if not mt5.symbol_select(symbol, True):
        return jsonify({"error": f"Can't select symbol '{symbol}'"}), 400

    tf_map = {
        "M1": mt5.TIMEFRAME_M1,
        "M5": mt5.TIMEFRAME_M5,
        "M15": mt5.TIMEFRAME_M15,
        "H1": mt5.TIMEFRAME_H1,
        "D1": mt5.TIMEFRAME_D1
    }
    tf = tf_map.get(timeframe.upper(), mt5.TIMEFRAME_H1)

    # Parse datetime bắt đầu
    try:
        if start_date and start_hour:
            dt_str = f"{start_date} {start_hour}"
            from_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
        else:
            from_dt = datetime.now()
    except Exception as e:
        return jsonify({"error": f"Invalid start datetime: {e}"}), 400

    # Tính số lượng nến cần fetch từ from_dt đến hiện tại
    now = datetime.now()
    diff_minutes = int((now - from_dt).total_seconds() / 60)

    tf_step = {
        mt5.TIMEFRAME_M1: 1,
        mt5.TIMEFRAME_M5: 5,
        mt5.TIMEFRAME_M15: 15,
        mt5.TIMEFRAME_H1: 60,
        mt5.TIMEFRAME_D1: 1440
    }.get(tf, 60)

    count = diff_minutes // tf_step
    print(f"[⏳] Fetching {count} candles for {symbol} from {from_dt}")

    # Lấy toàn bộ dữ liệu từ POS=0 và lọc theo from_dt
    raw_rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
    if raw_rates is None:
        return jsonify({"error": f"No candle data found for {symbol}"}), 400

    from_ts = int(from_dt.timestamp())
    rates = [r for r in raw_rates if r['time'] >= from_ts]

    candles = [
        {
            "time": int(r['time']),
            "timestamp": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(r['time'])),
            "open": float(r['open']),
            "high": float(r['high']),
            "low": float(r['low']),
            "close": float(r['close']),
            "volume": int(r['tick_volume'])
        }
        for r in rates
    ]

    return jsonify(candles)



if __name__ == '__main__':
    app.run(port=5000)
