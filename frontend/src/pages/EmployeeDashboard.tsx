import { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import {
  MapPin, Wifi, RefreshCw, LogOut, CheckCircle2,
  XCircle, Clock, AlertCircle, Loader2, Camera,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { checkinFace } from '../api/api';

/* ─── Types ─── */
type CheckinStatus = 'idle' | 'locating' | 'scanning' | 'success' | 'already' | 'fail' | 'gps_fail';

interface CheckinResult {
  status: string;
  name?: string;
  department?: string;
  position?: string;
  timestamp?: string;
  reason?: string;
}

interface GpsState {
  lat: number | null;
  lng: number | null;
  error: string | null;
  loading: boolean;
}

/* ─── Helper ─── */
const initials = (n: string) =>
  n.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();

const fmtTime = (ts?: string) =>
  ts?.includes(' ') ? ts.split(' ')[1].slice(0, 5) : '--:--';

/* ─── Status config ─── */
const STATUS_CFG = {
  idle:      { color: 'text-slate-300',   label: 'Sẵn sàng quét'        },
  locating:  { color: 'text-blue-500',    label: 'Đang định vị GPS...'   },
  scanning:  { color: 'text-blue-600',    label: 'Đang nhận diện...'     },
  success:   { color: 'text-emerald-600', label: 'Chấm công thành công!' },
  already:   { color: 'text-amber-500',   label: 'Đã chấm công hôm nay' },
  fail:      { color: 'text-red-500',     label: 'Không nhận diện được'  },
  gps_fail:  { color: 'text-orange-500',  label: 'Ngoài khu vực'         },
} satisfies Record<CheckinStatus, { color: string; label: string }>;

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
export default function EmployeeDashboard() {
  const { username, userId, logout } = useAuth();

  const webcamRef    = useRef<Webcam>(null);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status,   setStatus]  = useState<CheckinStatus>('idle');
  const [result,   setResult]  = useState<CheckinResult | null>(null);
  const [active,   setActive]  = useState(false);
  const [camErr,   setCamErr]  = useState(false);
  const [time,     setTime]    = useState('');
  const [gps,      setGps]     = useState<GpsState>({
    lat: null, lng: null, error: null, loading: false,
  });

  /* ── Clock ── */
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setTime(
        `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')} · ` +
        `${n.getDate()}/${n.getMonth() + 1}/${n.getFullYear()}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Get GPS ── */
  const getGps = useCallback((): Promise<{ lat: number; lng: number } | null> => {
    return new Promise(resolve => {
      if (!navigator.geolocation) {
        setGps(g => ({ ...g, error: 'Thiết bị không hỗ trợ GPS', loading: false }));
        resolve(null); return;
      }
      setGps(g => ({ ...g, loading: true, error: null }));
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setGps({ lat, lng, error: null, loading: false });
          resolve({ lat, lng });
        },
        err => {
          const msg = err.code === 1
            ? 'Bạn chưa cấp quyền định vị'
            : 'Không lấy được vị trí';
          setGps({ lat: null, lng: null, error: msg, loading: false });
          resolve(null);
        },
        { timeout: 8000, maximumAge: 30_000 }
      );
    });
  }, []);

  /* ── Single scan attempt ── */
  const doScan = useCallback(async () => {
    if (!webcamRef.current) return;
    const src = webcamRef.current.getScreenshot();
    if (!src) return;

    setStatus('locating');
    const coords = await getGps();

    setStatus('scanning');
    try {
      const blob = await (await fetch(src)).blob();
      const fd = new FormData();
      fd.append('file', blob, 'face.jpg');
      if (coords) {
        fd.append('lat', String(coords.lat));
        fd.append('lng', String(coords.lng));
      }

      const res = await checkinFace(fd);
      const data: CheckinResult = res.data;
      setResult(data);

      if (data.status === 'success')         { setStatus('success'); }
      else if (data.status === 'already_checked') { setStatus('already'); }
      else if (data.reason?.includes('phạm vi'))  { setStatus('gps_fail'); }
      else if (data.reason?.includes('chưa được duyệt') ||
               data.reason?.includes('bị từ chối')) {
        setStatus('fail');
      }
      else { setStatus('fail'); }
    } catch {
      setStatus('fail');
      setResult({ status: 'error', reason: 'Lỗi kết nối máy chủ' });
    }
  }, [getGps]);

  /* ── Start / stop ── */
  const startScan = useCallback(() => {
    setActive(true);
    setResult(null);
    setStatus('scanning');
    doScan();
    intervalRef.current = setInterval(doScan, 4000);
  }, [doScan]);

  const stopScan = useCallback(() => {
    setActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  /* ── Auto-stop on success / already ── */
  useEffect(() => {
    if (status === 'success' || status === 'already') stopScan();
  }, [status, stopScan]);

  const reset = () => {
    stopScan();
    setStatus('idle');
    setResult(null);
  };

  const { color: statusColor, label: statusLabel } = STATUS_CFG[status];

  /* ══════ RENDER ══════ */
  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col font-['DM_Sans']">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 px-6 py-4
                         flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center
                          justify-center text-white text-[11px] font-bold">
            {username?.[0]?.toUpperCase() ?? 'NV'}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-none">{username}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Nhân viên · {userId}</p>
          </div>
        </div>

        <span className="text-sm text-slate-400 tabular-nums">{time}</span>

        <button onClick={logout}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500
                           hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg
                           transition-all">
          <LogOut size={14} /> Đăng xuất
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 gap-5 p-5 max-w-5xl mx-auto w-full">

        {/* ── Camera panel ── */}
        <div className="flex-[1.4] bg-[#0e1624] rounded-3xl relative overflow-hidden
                        shadow-2xl shadow-slate-900/20 flex flex-col min-h-[420px]">

          {/* Camera / error */}
          {camErr ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
              <Camera size={32} className="opacity-40" />
              <p className="text-sm">Camera không khả dụng</p>
            </div>
          ) : (
            <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg"
                    videoConstraints={{ width: 1280, height: 720, facingMode: 'user' }}
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                    onUserMediaError={() => setCamErr(true)} />
          )}

          {/* Scan frame */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-52 h-60">
              {[
                'top-0 left-0 border-t-2 border-l-2',
                'top-0 right-0 border-t-2 border-r-2',
                'bottom-0 left-0 border-b-2 border-l-2',
                'bottom-0 right-0 border-b-2 border-r-2',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-7 h-7 border-emerald-400 ${cls}`} />
              ))}
              {active && (
                <div className="absolute left-0 right-0 h-px animate-scan-laser"
                     style={{
                       background: 'linear-gradient(90deg,transparent,#10b981cc,#34d399ff,#10b981cc,transparent)',
                       boxShadow: '0 0 8px 2px rgba(52,211,153,0.5)',
                     }} />
              )}
            </div>
          </div>

          {/* GPS indicator badge */}
          <div className="absolute top-4 left-4 z-10">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full
                            backdrop-blur-sm text-xs font-semibold
                            ${gps.loading
                              ? 'bg-blue-600/80 text-white'
                              : gps.error
                                ? 'bg-red-500/80 text-white'
                                : gps.lat !== null
                                  ? 'bg-emerald-600/80 text-white'
                                  : 'bg-slate-700/60 text-slate-300'}`}>
              {gps.loading
                ? <Loader2 size={11} className="animate-spin" />
                : <MapPin size={11} />}
              {gps.loading  ? 'Đang định vị...'
               : gps.error  ? 'GPS lỗi'
               : gps.lat    ? `${gps.lat.toFixed(4)}, ${gps.lng!.toFixed(4)}`
               :               'Chưa có GPS'}
            </div>
          </div>

          {/* Start / Stop button */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10">
            {!active ? (
              <button onClick={startScan}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500
                                 text-white text-xs font-semibold px-7 py-3 rounded-full
                                 shadow-lg shadow-emerald-900/40 transition-all active:scale-95">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" opacity=".2"/>
                  <circle cx="12" cy="12" r="4"/>
                </svg>
                Bắt đầu chấm công
              </button>
            ) : (
              <button onClick={stopScan}
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20
                                 border border-white/20 text-white text-xs font-semibold
                                 px-7 py-3 rounded-full backdrop-blur-sm transition-all">
                Dừng
              </button>
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="w-88 flex flex-col gap-4">

          {/* Status card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex-1">
            <p className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-3">
              Trạng thái
            </p>

            {/* Status heading */}
            <h2 className={`text-2xl font-extrabold mb-5 transition-colors leading-tight ${statusColor}`}>
              {statusLabel}
            </h2>

            {/* GPS info row */}
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin size={13} className={gps.lat ? 'text-emerald-500' : 'text-slate-300'} />
              <span className="text-xs text-slate-400">
                {gps.loading  ? 'Đang lấy vị trí...'
                 : gps.error  ? gps.error
                 : gps.lat    ? 'Đã xác định vị trí'
                 :              'Chưa lấy vị trí'}
              </span>
            </div>

            {/* AI online indicator */}
            <div className="flex items-center gap-1.5 mb-5">
              <Wifi size={13} className="text-green-500" />
              <span className="text-xs text-slate-400">AI nhận diện trực tuyến</span>
            </div>

            <div className="h-px bg-slate-100 mb-5" />

            {/* Checkin time display */}
            <div className="mb-5">
              <p className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-1">
                Giờ chấm công
              </p>
              <p className="text-3xl font-black text-slate-950 tabular-nums">
                {result?.status === 'success' ? fmtTime(result.timestamp) : '--:--'}
              </p>
              {result?.status === 'success' && (
                <p className="text-xs text-slate-400 mt-1">
                  {result.timestamp?.split(' ')[0] ?? ''}
                </p>
              )}
            </div>

            {/* Result card */}
            {result?.status === 'success' && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl
                              animate-fade-in-up">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center
                                  justify-center text-xs font-bold text-white flex-shrink-0">
                    {initials(result.name!)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{result.name}</p>
                    <p className="text-[11px] text-slate-500">{result.department}</p>
                  </div>
                  <CheckCircle2 size={18} className="text-emerald-500 ml-auto flex-shrink-0" />
                </div>
              </div>
            )}

            {status === 'already' && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">
                      {result?.name ?? 'Bạn'} — đã chấm công
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">Hôm nay đã được ghi nhận</p>
                  </div>
                </div>
              </div>
            )}

            {status === 'gps_fail' && (
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                <div className="flex items-center gap-2">
                  <MapPin size={15} className="text-orange-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-orange-800">Ngoài khu vực</p>
                    <p className="text-xs text-orange-600 mt-0.5">
                      Vui lòng chấm công tại văn phòng
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status === 'fail' && result?.reason && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                <div className="flex items-start gap-2">
                  <XCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{result.reason}</p>
                </div>
              </div>
            )}

            {status === 'scanning' && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="text-blue-500 animate-spin flex-shrink-0" />
                  <p className="text-sm text-blue-700">Hệ thống đang nhận diện khuôn mặt...</p>
                </div>
              </div>
            )}

            {status === 'locating' && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-blue-500 animate-pulse flex-shrink-0" />
                  <p className="text-sm text-blue-700">Đang xác định vị trí GPS...</p>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button onClick={reset}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3
                               bg-white border border-slate-200 hover:bg-slate-50
                               text-xs font-semibold text-slate-600 rounded-2xl transition-all">
              <RefreshCw size={12} /> Làm mới
            </button>
            <button onClick={getGps}
                    disabled={gps.loading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3
                               bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50
                               text-xs font-semibold text-slate-600 rounded-2xl transition-all">
              {gps.loading
                ? <Loader2 size={12} className="animate-spin" />
                : <MapPin size={12} />}
              Cập nhật GPS
            </button>
          </div>

          {/* GPS error banner */}
          {gps.error && !active && (
            <div className="flex items-start gap-2 bg-orange-50 border border-orange-100
                            rounded-2xl px-4 py-3 text-xs text-orange-700">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <span>{gps.error}. Chấm công sẽ không kiểm tra vị trí.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}