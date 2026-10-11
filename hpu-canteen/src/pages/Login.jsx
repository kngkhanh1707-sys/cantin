import { useState } from 'react';
import { Eye, EyeOff, Soup } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Login({ onSubmit, busy, error }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="auth-page login-page">
      <div className="login-content">
        <div className="brand-mark"><Soup size={29} /></div>
        <h1 className="brand-title">HPU Canteen</h1>
        <p className="brand-subtitle">Hệ thống đặt món thông minh</p>
        <form className="auth-form login-form" onSubmit={onSubmit}>
          <label>
            Mã sinh viên / Email
            <input
              name="identity"
              autoComplete="username"
              placeholder="Nhập mã sinh viên hoặc email..."
              required
            />
          </label>
          <label>
            Mật khẩu
            <div className="password-field">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu của bạn"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <div className="form-link-row">
            <Link to="/forgot-password">Quên mật khẩu?</Link>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button auth-submit" disabled={busy}>
            {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
        <p className="auth-switch">
          Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
        </p>
      </div>
    </main>
  );
}
