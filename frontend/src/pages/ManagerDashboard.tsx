import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, UserX, User, Monitor, Bell, Settings,
         LogOut, ChevronRight } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { getAttendance, getStats, getWeeklyStats, getStatsByRange } from '../api/api';

const DAYS = ['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','CN'];

interface Stats { today: number; total: number; absent: number; rate: number; }
interface WeeklyPoint { label: string; count: number; }
interface Record { user_id: string; name: string; department: string; position: string; timestamp: string; }

const MOCK_WEEKLY: WeeklyPoint[] = DAYS.map((d, i) => ({ label: d, count: [22,25,21,28,24,18,10][i] }));
// const MONTHS_VN = ['Th1','Th2','Th3','Th4','Th5','Th6'];
// const MOCK_MONTHLY = MONTHS_VN.map((m, i) => ({
//   m, current: [30,38,35,50,42,55][i], target: [40,40,40,45,45,50][i]
// }));

interface RangePoint { date: string; label: string; count: number; }

const initials = (n: string) => n.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();
const AV = ['bg-blue-600','bg-sky-500','bg-violet-600','bg-emerald-600','bg-rose-500'];
const avCol = (id: string) => AV[id.charCodeAt(id.length - 1) % AV.length];
const timeStr = (ts: string) => ts.includes(' ') ? ts.split(' ')[1].slice(0,5) : ts;

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 shadow-xl rounded-xl px-3 py-2 text-xs">
      <p className="text-slate-400 mb-0.5">{label}</p>
      <p className="font-bold text-slate-900">{payload[0].value} người</p>
    </div>
  );
};

export default function ManagerDashboard() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]         = useState<'overview'|'history'>('overview');
  const [stats, setStats]     = useState<Stats>({ today:0, total:0, absent:0, rate:0 });
  const [weekly, setWeekly]   = useState<WeeklyPoint[]>(MOCK_WEEKLY);
  const [records, setRecords] = useState<Record[]>([]);
  const [date, setDate]       = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoad]    = useState(false);
  const [attLoad, setAttLoad] = useState(false);

  // State cho dữ liệu bar chart theo khoảng thời gian
  const [rangeData, setRangeData] = useState<RangePoint[]>([]);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeEnd, setRangeEnd] = useState(() =>
    new Date().toISOString().split('T')[0]
  );
  const [rangeStart, setRangeStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6); // hôm nay là ngày thứ 7, lùi 6 ngày
    return d.toISOString().split('T')[0];
  });

  // Xác định hiển thị trục X theo ngày hay tháng
  const isMonthView = (() => {
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    return (end.getTime() - start.getTime()) / (1000*60*60*24) > 31;
  })();

  // Xử lý dữ liệu cho trục X
  const chartData = isMonthView
    ? (() => {
        // Gom nhóm theo tháng
        const map = new Map();
        rangeData.forEach(item => {
          const month = item.date.slice(0,7); // yyyy-mm
          if (!map.has(month)) map.set(month, 0);
          map.set(month, map.get(month) + item.count);
        });
        return Array.from(map.entries()).map(([m, count]) => ({ label: m.split('-')[1] + '/' + m.split('-')[0].slice(2), count }));
      })()
    : rangeData.map(item => ({ label: item.date.slice(8,10) + '/' + item.date.slice(5,7), count: item.count }));

  // Fetch dữ liệu khi đổi khoảng
  useEffect(() => {
    setRangeLoading(true);
    getStatsByRange(rangeStart, rangeEnd)
      .then(res => setRangeData(res.data.data || []))
      .catch(() => setRangeData([]))
      .finally(() => setRangeLoading(false));
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    setLoad(true);
    Promise.all([getStats(), getWeeklyStats()])
      .then(([s, w]) => { setStats(s.data); setWeekly(w.data.data ?? MOCK_WEEKLY); })
      .catch(() => {})
      .finally(() => setLoad(false));
  }, []);

  const fetchAtt = useCallback(async () => {
    setAttLoad(true);
    try { const r = await getAttendance(date); setRecords(r.data.records ?? []); }
    catch { setRecords([]); }
    finally { setAttLoad(false); }
  }, [date]);

  useEffect(() => { if (tab === 'history') fetchAtt(); }, [tab, fetchAtt]);

  const STAT_CARDS = [
    { icon: <Users size={18} />, label: 'TỔNG NHÂN VIÊN',   val: stats.total.toLocaleString(),
      sub: '+2%', subColor: 'text-green-600', color: 'text-blue-600', bg: 'bg-blue-50' },
    { icon: <TrendingUp size={18} />, label: 'TỶ LỆ ĐI LÀM HÔM NAY', val: `${stats.rate}%`,
      sub: `Mục tiêu 95%`, subColor: 'text-blue-500', color: 'text-green-600', bg: 'bg-green-50' },
    { icon: <User size={18} />, label: 'SỐ NHÂN VIÊN ĐI LÀM HÔM NAY', val: stats.today.toLocaleString(),
      sub: 'Đã điểm danh', subColor: 'text-blue-600', color: 'text-blue-700', bg: 'bg-blue-50' },
    { icon: <UserX size={18} />, label: 'VẮNG HÔM NAY',    val: String(stats.absent),
      sub: 'Chú ý', subColor: 'text-orange-500', color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-['DM_Sans']">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 px-6 py-3.5
                         flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-8">
          <span className="text-sm font-black text-slate-950">FaceAttend</span>
          <nav className="flex items-center gap-1">
            {(['overview','history'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all
                        ${tab === t
                          ? 'text-blue-700 border-b-2 border-blue-700 bg-transparent rounded-none'
                          : 'text-slate-500 hover:text-slate-900'}`}>
                {t === 'overview' ? 'Tổng quan' : 'Lịch sử điểm danh'}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/register')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95
                             text-white text-xs font-bold rounded-xl transition-all
                             shadow-sm shadow-blue-200">
            Đăng ký khuôn mặt
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg
                             hover:bg-slate-100 text-slate-500 transition-colors">
            <Bell size={16} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg
                             hover:bg-slate-100 text-slate-500 transition-colors">
            <Settings size={16} />
          </button>
          <button onClick={logout}
                  className="flex items-center gap-1.5 text-xs text-red-500 font-semibold
                             hover:bg-red-50 px-3 py-2 rounded-lg transition-all">
            <LogOut size={13} /> Đăng xuất
          </button>
          <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center
                          text-[11px] font-bold text-white cursor-pointer">
            {username?.[0]?.toUpperCase() ?? 'A'}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* ── TAB: Overview ── */}
        {tab === 'overview' && (
          <>
            {/* Heading + time filter */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-black text-slate-950">Tổng quan hệ thống</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Giám sát và phân tích điểm danh sinh trắc học theo thời gian thực.
                </p>
              </div>
              {/* <div className="flex items-center gap-2 bg-white border border-slate-200
                              rounded-xl p-1 text-xs font-semibold">
                <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg">24 giờ qua</button>
                <button className="px-3 py-1.5 text-slate-500 hover:bg-slate-50 rounded-lg">7 ngày</button>
              </div> */}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-4">
              {STAT_CARDS.map(({ icon, label, val, sub, subColor, color, bg }) => (
                <div key={label}
                     className="bg-white border border-slate-100 rounded-3xl p-5
                                shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-9 h-9 rounded-xl ${bg} ${color}
                                    flex items-center justify-center`}>
                      {icon}
                    </div>
                    <span className={`text-[10px] font-bold ${subColor}`}>{sub}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 tracking-widest uppercase mb-1">
                    {label}
                  </p>
                  <p className="text-3xl font-black text-slate-950">{val}</p>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid gap-4">

              {/* Bar chart theo khoảng thời gian */}
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="text-base font-bold text-slate-950">Thống kê điểm danh theo khoảng</h3>
                    <p className="text-xs text-slate-400">Tổng số lượt điểm danh {isMonthView ? 'theo tháng' : 'theo ngày'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="date" value={rangeStart} max={rangeEnd}
                      onChange={e => setRangeStart(e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700" />
                    <span className="text-slate-400 text-xs">-</span>
                    <input type="date" value={rangeEnd} min={rangeStart}
                      onChange={e => setRangeEnd(e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700" />
                  </div>
                </div>
                <div className="mt-4">
                  {rangeLoading ? (
                    <div className="h-48 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} barSize={18}
                                margin={{ top:4, right:4, left:-28, bottom:0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                        <XAxis dataKey="label"
                               tick={{ fill:'#94a3b8', fontSize:11, fontFamily:'DM Sans' }}
                               axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill:'#94a3b8', fontSize:11, fontFamily:'DM Sans' }}
                               axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="count" fill="#3b82f6" radius={[6,6,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Recent table */}
            <RecentTable avCol={avCol} />
          </>
        )}

        {/* ── TAB: History ── */}
        {tab === 'history' && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <h1 className="text-xl font-black text-slate-950 mr-auto">
                Lịch sử điểm danh
              </h1>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                     className="bg-white border border-slate-200 rounded-xl px-4 py-2
                                text-sm text-slate-700 outline-none focus:border-blue-500
                                focus:ring-2 focus:ring-blue-100 transition-all" />
              <button onClick={fetchAtt}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white
                                 text-sm font-semibold rounded-xl transition-all">
                Tải lại
              </button>
            </div>
            <HistoryTable records={records} loading={attLoad} avCol={avCol} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub components ─────────────────────────── */

function RecentTable({ avCol }: { avCol: (id:string)=>string }) {
  const [rows, setRows] = useState<Record[]>([]);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    setLoad(true);
    getAttendance(new Date().toISOString().split('T')[0])
      .then(r => setRows((r.data.records ?? []).slice(0, 5)))
      .catch(() => setRows([]))
      .finally(() => setLoad(false));
  }, []);

  return (
    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-950">Lịch sử điểm danh gần đây</h3>
          <p className="text-xs text-slate-400">Nhật ký xác thực mới nhất trên toàn hệ thống</p>
        </div>
        <button className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-0.5">
          Xem tất cả <ChevronRight size={12} />
        </button>
      </div>
      <HistoryTable records={rows} loading={load} avCol={avCol} compact />
    </div>
  );
}

function HistoryTable({ records, loading, avCol, compact = false }:
  { records: Record[]; loading: boolean; avCol:(id:string)=>string; compact?: boolean }) {

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!records.length) return (
    <div className="flex flex-col items-center py-16 text-slate-300">
      <Users size={32} className="mb-3" />
      <p className="text-sm text-slate-400">Chưa có dữ liệu điểm danh</p>
    </div>
  );

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50">
          {['Mã NV','Họ tên','Phòng ban','Chức vụ','Thời gian'].map(h => (
            <th key={h} className="px-6 py-3 text-left text-[10px] font-semibold
                                   text-slate-400 tracking-widest uppercase">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {records.map((r, i) => (
          <tr key={r.user_id}
              className={`border-t border-slate-50 hover:bg-blue-50/40 transition-colors
                          ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
            <td className="px-6 py-4 text-blue-700 font-bold text-xs">{r.user_id}</td>
            <td className="px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-full ${avCol(r.user_id)}
                                flex items-center justify-center text-[9px]
                                font-bold text-white flex-shrink-0`}>
                  {initials(r.name)}
                </div>
                <span className="font-semibold text-slate-900">{r.name}</span>
              </div>
            </td>
            <td className="px-6 py-4 text-slate-500">{r.department}</td>
            <td className="px-6 py-4 text-slate-500">{r.position}</td>
            <td className="px-6 py-4 text-slate-400 tabular-nums font-mono text-xs">
              {timeStr(r.timestamp)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}