import { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { RefreshCw, HelpCircle, Wifi, Cloud, MapPin, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { checkinFace } from '../api/api';

type Status = 'idle' | 'scanning' | 'success' | 'fail' | 'already_checked';
type Result = {
  status: string; name?: string; department?: string;
  position?: string; timestamp?: string; reason?: string;
} | null;

const initials = (n: string) =>
  n.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();

export default function GuestCheckIn() {
  const navigate            = useNavigate();
  const webcamRef           = useRef<Webcam>(null);
  const intervalRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<Result>(null);
  const [score,  setScore]  = useState(0);
  const [active, setActive] = useState(false);
  const [time,   setTime]   = useState('');
  const [camErr, setCamErr] = useState(false);

  /* ── Lấy GPS một lần, cache lại ── */
  const gpsRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => { gpsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
      () => {},
      { timeout: 8000, maximumAge: 60_000 }
    );
  }, []);

  /* ── Clock ── */
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setTime(
        `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')} · `+
        `${n.getDate()}/${n.getMonth()+1}/${n.getFullYear()}`
      );
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);

  const stopScan = useCallback(() => {
    setActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const doScan = useCallback(async () => {
    if (!webcamRef.current) return;
    const src = webcamRef.current.getScreenshot();
    if (!src) return;
    setStatus('scanning');

    let s = 0;
    const anim = setInterval(() => {
      s += 5; setScore(Math.min(s, 92));
      if (s >= 92) clearInterval(anim);
    }, 30);

    try {
      const blob = await (await fetch(src)).blob();
      const fd   = new FormData();
      fd.append('file', blob, 'capture.jpg');

      /* ── Thêm GPS nếu có ── */
      if (gpsRef.current) {
        fd.append('lat', String(gpsRef.current.lat));
        fd.append('lng', String(gpsRef.current.lng));
      }

      const res = await checkinFace(fd);
      clearInterval(anim);
      setResult(res.data);

      if (res.data.status === 'success')         { setScore(92); setStatus('success'); }
      else if (res.data.status === 'already_checked') { setStatus('already_checked'); }
      else                                        { setScore(0);  setStatus('fail'); }
    } catch {
      clearInterval(anim);
      setStatus('fail');
      setScore(0);
    }
  }, []);

  const startScan = useCallback(() => {
    setActive(true); setResult(null); setScore(0); setStatus('scanning');
    doScan();
    intervalRef.current = setInterval(doScan, 3500);
  }, [doScan]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 px-6 py-5
                         flex items-center justify-between">
        <span className="text-sm font-black tracking-widest text-slate-950 uppercase">
          FaceAttend
        </span>
        <div className="flex items-center gap-5 text-sm text-slate-400">
          <span className="tabular-nums text-[15px]">{time}</span>

          {/* ── THÊM: nút đăng nhập nhân viên ── */}
          <button onClick={() => navigate('/employee/login')}
                  className="flex items-center gap-1.5 text-emerald-600 font-semibold
                             hover:text-emerald-800 transition-colors">
            <User size={14} /> Đăng nhập nhân viên
          </button>

          <a href="/login" className="text-slate-400 hover:text-slate-700 transition-colors">
            Admin Login
          </a>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 gap-5 p-5">

        {/* Camera panel */}
        <div className="flex-[1.5] bg-[#0e1624] rounded-3xl relative overflow-hidden
                        shadow-2xl shadow-slate-900/20 flex flex-col">

          {camErr ? (
            <div className="flex-1 flex items-center justify-center text-slate-600">
              <span className="text-sm">Camera không khả dụng</span>
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
                <div key={i} className={`absolute w-7 h-7 border-blue-400 ${cls}`} />
              ))}
              {active && (
                <div className="absolute left-0 right-0 h-px animate-scan-laser"
                     style={{
                       background: 'linear-gradient(90deg,transparent,#3b82f6cc,#60a5faff,#3b82f6cc,transparent)',
                       boxShadow: '0 0 8px 2px rgba(96,165,250,0.5)',
                     }} />
              )}
            </div>
          </div>

          {/* ── GPS indicator badge ── */}
          {gpsRef.current && (
            <div className="absolute top-4 left-4 z-10">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                              bg-emerald-600/80 backdrop-blur-sm text-white text-xs font-semibold">
                <MapPin size={11} /> GPS đã sẵn sàng
              </div>
            </div>
          )}

          {/* Start / Stop */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
            {!active ? (
              <button onClick={startScan}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500
                                 text-white text-xs font-semibold px-7 py-3 rounded-full
                                 shadow-lg shadow-blue-900/40 transition-all active:scale-95">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" opacity=".2"/>
                  <circle cx="12" cy="12" r="4"/>
                </svg>
                Bắt đầu quét
              </button>
            ) : (
              <button onClick={stopScan}
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20
                                 border border-white/20 text-white text-xs font-semibold
                                 px-7 py-3 rounded-full backdrop-blur-sm transition-all">
                Dừng quét
              </button>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-100 flex flex-col gap-4">

          {/* Result card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex-1">
            <p className="text-[14px] text-slate-400 tracking-widest uppercase mb-3 font-bold">
              Kết quả
            </p>

            <h2 className={`text-2xl font-extrabold mb-4 transition-colors
                ${status === 'success'       ? 'text-slate-950'
                : status === 'scanning'      ? 'text-blue-600'
                : status === 'already_checked' ? 'text-amber-500'
                : status === 'fail'          ? 'text-red-500'
                :                              'text-slate-300'}`}>
              {status === 'idle'           ? 'Chờ bắt đầu'
               : status === 'scanning'     ? 'Đang quét...'
               : status === 'success'      ? result?.name ?? 'Nhận diện xong'
               : status === 'already_checked'
                 ? (result?.name ? `${result.name} — Đã điểm danh` : 'Đã điểm danh')
               :                             'Không tìm thấy'}
            </h2>

            {/* AI status */}
            <div className="flex items-center gap-4 mb-5">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Cloud size={15} className="text-green-500" />
                  <span className="text-[14px] text-slate-400">AI trực tuyến</span>
                </div>
                <p className="text-[14px] text-slate-500 leading-relaxed">
                  {status === 'scanning' ? 'Hệ thống đang nhận diện khuôn mặt.'
                   : status === 'success' ? 'Nhận diện thành công.'
                   : 'Hệ thống đã sẵn sàng nhận diện khuôn mặt.'}
                </p>
              </div>
            </div>

            <div className="h-px bg-slate-100 mb-4" />

            {/* Scanning status */}
            <div className="mb-4">
              <p className="text-[14px] text-slate-400 tracking-widest uppercase mb-1 font-bold">
                Trạng thái
              </p>
              <p className="text-lg font-bold text-slate-950">
                {active ? 'Đang quét' : 'Dừng'}
              </p>
              <p className="text-[14px] text-slate-400 mt-1">
                {active
                  ? 'Yêu cầu người dùng đứng đúng khung quét'
                  : 'Bấm nút để bắt đầu quét'}
              </p>
            </div>

            <div className="h-px bg-slate-100 mb-4" />

            {/* Checkin time */}
            <div>
              <p className="text-[14px] text-slate-400 tracking-widest uppercase mb-1 font-bold">
                Điểm danh
              </p>
              <p className="text-lg font-bold text-slate-950 tabular-nums">
                {result?.status === 'success' && result?.timestamp
                  ? result.timestamp.split(' ')[1]?.slice(0, 5) ?? '--:--'
                  : '--:--'}
              </p>
              <p className="text-[14px] text-slate-400 mt-1">Lần cuối ghi nhận: Chưa có dữ liệu</p>
            </div>

            {/* Success card */}
            {result?.status === 'success' && (
              <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-2xl animate-fade-in-up">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center
                                  justify-center text-[11px] font-bold text-white flex-shrink-0">
                    {initials(result.name!)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-950">{result.name}</p>
                    <p className="text-[11px] text-slate-500">{result.department}</p>
                  </div>
                </div>
              </div>
            )}

            {/* GPS fail card */}
            {result?.reason?.includes('phạm vi') && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-100 rounded-2xl">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-orange-500 flex-shrink-0" />
                  <p className="text-xs text-orange-700 font-medium">{result.reason}</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={() => { setResult(null); setStatus('idle'); setScore(0); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                               bg-white border border-slate-200 hover:bg-slate-50
                               text-xs font-semibold text-slate-600 rounded-2xl transition-all">
              <RefreshCw size={12} /> Làm mới
            </button>
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                               bg-white border border-slate-200 hover:bg-slate-50
                               text-xs font-semibold text-slate-600 rounded-2xl transition-all">
              <HelpCircle size={12} /> Hỗ trợ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}