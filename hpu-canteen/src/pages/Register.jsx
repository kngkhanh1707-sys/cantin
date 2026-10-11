import { useState } from 'react';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 overflow-y-auto">
      <div className="w-full max-w-md mt-12">
        
        {/* Nút Back và Tiêu đề */}
        <div className="flex items-center mb-8 relative">
          <Link to="/" className="absolute left-0 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
            <ChevronLeft size={24} className="text-gray-700" />
          </Link>
          <h1 className="w-full text-center text-xl font-bold text-gray-900">Đăng ký tài khoản</h1>
        </div>

        {/* Form Đăng ký */}
        <div className="space-y-4">
          
          {/* Họ và tên */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Họ và tên</label>
            <input 
              type="text" 
              placeholder="Nguyễn Văn A" 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0056D2] text-sm" 
            />
          </div>

          {/* Mã sinh viên */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Mã sinh viên</label>
            <input 
              type="text" 
              placeholder="Nhập mã số sinh viên" 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0056D2] text-sm" 
            />
          </div>

          {/* Email - Đang demo trạng thái lỗi */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Email</label>
            <input 
              type="email" 
              placeholder="Nhập email của bạn" 
              defaultValue="nguyenvana_invalid"
              className="w-full px-4 py-3 border border-red-500 bg-red-50 rounded-xl focus:outline-none text-red-500 text-sm" 
            />
            <p className="text-red-500 text-xs mt-1 font-medium">Email không hợp lệ</p>
          </div>

          {/* Số điện thoại */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Số điện thoại</label>
            <input 
              type="tel" 
              placeholder="Nhập số điện thoại" 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0056D2] text-sm" 
            />
          </div>

          {/* Mật khẩu */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Mật khẩu</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Tối thiểu 8 ký tự" 
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0056D2] text-sm" 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Xác nhận mật khẩu */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Xác nhận mật khẩu</label>
            <div className="relative">
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                placeholder="Nhập lại mật khẩu" 
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0056D2] text-sm" 
              />
              <button 
                type="button" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Nút Đăng ký */}
        <button className="w-full bg-[#0056D2] text-white py-3.5 rounded-xl font-semibold mt-8 hover:bg-blue-700 transition-colors">
          Đăng ký
        </button>

        {/* Chuyển về Đăng nhập */}
        <p className="mt-6 text-sm text-gray-600 text-center pb-8">
          Đã có tài khoản?{' '}
          <Link to="/" className="text-[#0056D2] font-semibold">
            Đăng nhập
          </Link>
        </p>

      </div>
    </div>
  );
};

export default Register;