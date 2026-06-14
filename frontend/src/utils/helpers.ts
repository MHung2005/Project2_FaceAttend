/**
 * helpers.ts — Các hàm tiện ích dùng chung toàn ứng dụng.
 * Trích xuất từ các trang RegisterFace, EmployeeDirectory, ManagerDashboard
 * để tránh lặp lại code.
 */

// ── Chữ cái viết tắt từ tên (lấy 2 từ cuối) ──────────────────────────────
export const initials = (name: string): string =>
  name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();

// ── Màu gradient cho Avatar (dùng ở trang Employee Directory) ─────────────
const AV_GRADIENT_COLORS = [
  'from-blue-400 to-blue-600',
  'from-violet-400 to-violet-600',
  'from-emerald-400 to-emerald-600',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-rose-600',
] as const;

export const avGradientColor = (userId: string): string =>
  AV_GRADIENT_COLORS[userId.charCodeAt(userId.length - 1) % AV_GRADIENT_COLORS.length];

// ── Màu nền đơn sắc cho Avatar (dùng ở bảng điểm danh Dashboard) ─────────
const AV_SOLID_COLORS = [
  'bg-blue-600',
  'bg-sky-500',
  'bg-violet-600',
  'bg-emerald-600',
  'bg-rose-500',
] as const;

export const avSolidColor = (userId: string): string =>
  AV_SOLID_COLORS[userId.charCodeAt(userId.length - 1) % AV_SOLID_COLORS.length];

// ── Định dạng timestamp "YYYY-MM-DD HH:MM:SS" → "HH:MM" ──────────────────
export const timeStr = (ts: string): string =>
  ts.includes(' ') ? ts.split(' ')[1].slice(0, 5) : ts;
