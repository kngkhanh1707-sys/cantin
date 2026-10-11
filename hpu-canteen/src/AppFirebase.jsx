import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, EmailAuthProvider, getIdTokenResult, onAuthStateChanged, reauthenticateWithCredential, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updatePassword, updateProfile } from 'firebase/auth';
import { ArrowLeft, Bell, Check, ChevronRight, Eye, EyeOff, Home, LockKeyhole, LogOut, Mail, Minus, Plus, Search, ShoppingBag, ShoppingCart, Soup, UserRound, Utensils, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import AdminWorkspace from './AdminWorkspace';
import { auth } from './firebase';
import Login from './pages/Login';
import { createMenuItem, createOrder, deleteMenuItem, getUserProfile, saveUserProfile, seedMenu, subscribeCategories, subscribeMenu, subscribeOrders, subscribePickupSlots, subscribeUserProfile, subscribeUsers, updateMenuItem, updateOrderStatus } from './data/firestore';
import './hpu.css';

const initialMenu = [
  { id: 'com-suon', name: 'Cơm sườn nướng', category: 'Cơm', price: 30000, image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=85', desc: 'Sườn nướng mật ong thơm mềm, ăn kèm cơm nóng và rau củ tươi.' },
  { id: 'pho-bo', name: 'Phở bò tái', category: 'Bún/Phở', price: 35000, image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=900&q=85', desc: 'Nước dùng ninh xương đậm đà, bánh phở mềm và thịt bò tươi.' },
  { id: 'bun-cha', name: 'Bún chả Hà Nội', category: 'Bún/Phở', price: 28000, image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=85', desc: 'Thịt nướng than hoa, bún tươi và nước chấm chua ngọt.' },
  { id: 'tra-dao', name: 'Trà đào cam sả', category: 'Đồ uống', price: 20000, image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=900&q=85', desc: 'Trà đào thơm dịu, cam tươi và sả mát lành.' },
  { id: 'banh-mi', name: 'Bánh mì thịt nướng', category: 'Ăn nhẹ', price: 18000, image: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=900&q=85', desc: 'Bánh mì giòn, thịt nướng đậm vị cùng rau sống và sốt nhà làm.' },
  { id: 'nuoc-cam', name: 'Nước ép cam', category: 'Đồ uống', price: 15000, image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=900&q=85', desc: 'Cam tươi ép nguyên chất, không thêm đường.' },
];
const categories = ['Tất cả', 'Cơm', 'Bún/Phở', 'Đồ uống', 'Ăn nhẹ'];
const orderStatuses = { received: 'Đã tiếp nhận', preparing: 'Đang chế biến', ready: 'Sẵn sàng lấy đồ', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
const money = (amount = 0) => `${Number(amount).toLocaleString('vi-VN')}đ`;
const DataContext = createContext(null);
const cartStorageKey = (userId) => userId ? `hpu-cart:${userId}` : 'hpu-cart:guest';

function readCart(userId) {
  try {
    const value = JSON.parse(localStorage.getItem(cartStorageKey(userId)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function roleFromClaims(claims = {}) {
  if (claims.role === 'admin' || claims.admin === true) return 'admin';
  if (['staff', 'kitchen', 'cashier'].includes(claims.role) || claims.staff === true) return 'staff';
  return 'customer';
}

function roleFromProfile(profile) {
  if (profile?.role === 'admin') return 'admin';
  if (['staff', 'kitchen', 'cashier'].includes(profile?.role)) return 'staff';
  return 'customer';
}

async function getEffectiveRole(user) {
  const token = await getIdTokenResult(user, true);
  const claimRole = roleFromClaims(token.claims);
  if (claimRole !== 'customer') return claimRole;
  return roleFromProfile(await getUserProfile(user.uid));
}

function authErrorMessage(error) {
  const messages = {
    'auth/invalid-credential': 'Email hoặc mật khẩu không đúng. Kiểm tra lại thông tin hoặc dùng Quên mật khẩu.',
    'auth/wrong-password': 'Mật khẩu không đúng. Hãy thử khôi phục mật khẩu.',
    'auth/user-not-found': 'Email này chưa có tài khoản trong Firebase Authentication.',
    'auth/too-many-requests': 'Bạn đã thử quá nhiều lần. Hãy chờ một lúc rồi thử lại.',
    'auth/network-request-failed': 'Không kết nối được Firebase. Kiểm tra mạng rồi thử lại.',
    'auth/operation-not-allowed': 'Firebase chưa bật phương thức đăng nhập Email/Password.',
    'auth/invalid-email': 'Địa chỉ email không hợp lệ.',
  };
  return messages[error.code] || `Firebase Auth lỗi (${error.code || 'unknown'}). ${error.message || ''}`;
}

function DataProvider({ children }) {
  const [user, setUser] = useState(null); const [role, setRole] = useState('customer'); const [authReady, setAuthReady] = useState(false);
  const [menuItems, setMenuItems] = useState([]); const [categories, setCategories] = useState([]); const [orders, setOrders] = useState([]); const [profile, setProfile] = useState(null); const [users, setUsers] = useState([]); const [pickupSlots, setPickupSlots] = useState([]); const [dataError, setDataError] = useState('');
  const [cart, setCart] = useState(() => readCart(null));

  useEffect(() => onAuthStateChanged(auth, async (current) => {
    setAuthReady(false);
    setUser(current);
    setUsers([]);
    setPickupSlots([]);
    setCart(readCart(current?.uid || null));
    if (!current) { setRole('customer'); setOrders([]); setProfile(null); setAuthReady(true); return; }
    try {
      setRole(await getEffectiveRole(current));
    } catch (error) {
      setDataError(error.message || 'Không thể tải hồ sơ Firebase.');
      setRole('customer');
    } finally { setAuthReady(true); }
  }), []);

  useEffect(() => {
    localStorage.setItem(cartStorageKey(user?.uid || null), JSON.stringify(cart));
  }, [cart, user?.uid]);

  useEffect(() => subscribeMenu(role, setMenuItems, (error) => setDataError(error.message)), [role]);
  useEffect(() => subscribeCategories(role, setCategories, (error) => setDataError(error.message)), [role]);
  useEffect(() => subscribePickupSlots(role, setPickupSlots, (error) => setDataError(error.message)), [role]);
  useEffect(() => {
    if (role !== 'admin') return undefined;
    return subscribeUsers(setUsers, (error) => setDataError(error.message));
  }, [role]);
  useEffect(() => {
    if (!user) return undefined;
    return subscribeUserProfile(user.uid, setProfile, (error) => setDataError(error.message));
  }, [user]);
  useEffect(() => {
    if (!user) return undefined;
    return subscribeOrders(user, role, setOrders, (error) => setDataError(error.message));
  }, [user, role]);

  const addToCart = (food, quantity = 1, note = '') => setCart((items) => {
    const existing = items.find((item) => item.id === food.id);
    return existing
      ? items.map((item) => item.id === food.id ? { ...item, quantity: item.quantity + quantity, note: note || item.note } : item)
      : [...items, { ...food, quantity, note }];
  });
  const updateQuantity = (id, amount) => setCart((items) => items.map((item) => item.id === id ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0));
  const removeItem = (id) => setCart((items) => items.filter((item) => item.id !== id));
  const placeOrder = async (slot) => {
    if (!user) throw new Error('Đăng nhập để lưu đơn hàng của bạn.');
    const order = await createOrder(user, cart, slot);
    setCart([]);
    return order;
  };
  const refreshRole = async () => {
    if (!user) return 'customer';
    const nextRole = await getEffectiveRole(user);
    setRole(nextRole);
    return nextRole;
  };
  const value = { user, role, authReady, menuItems, categories, orders, profile, users, pickupSlots, dataError, cart, addToCart, updateQuantity, removeItem, placeOrder, setDataError, refreshRole };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function useData() { return useContext(DataContext); }

function LoginPage() {
  const { user, role, authReady } = useData(); const navigate = useNavigate(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true); const form = new FormData(event.currentTarget); let email = String(form.get('identity')).trim();
    if (!email.includes('@')) email = `${email}@sv.hpu.edu.vn`;
    try { const result = await signInWithEmailAndPassword(auth, email, String(form.get('password'))); const nextRole = await getEffectiveRole(result.user); navigate(['admin', 'staff'].includes(nextRole) ? '/admin' : '/home'); }
    catch (cause) { setError(authErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  if (!authReady) return <div className="app-loading">Đang kiểm tra tài khoản...</div>;
  if (user) return <Navigate to={['admin', 'staff'].includes(role) ? '/admin' : '/home'} replace />;
  return <Login onSubmit={submit} busy={busy} error={error} />;
}

function RegisterPage() {
  const { setDataError } = useData(); const navigate = useNavigate(); const [show, setShow] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true); const form = new FormData(event.currentTarget); const password = String(form.get('password'));
    if (password !== form.get('confirm')) { setError('Mật khẩu xác nhận không khớp.'); setBusy(false); return; }
    let result;
    try { result = await createUserWithEmailAndPassword(auth, String(form.get('email')), password); }
    catch (cause) { setError(cause.code === 'auth/email-already-in-use' ? 'Email này đã được đăng ký. Hãy đăng nhập hoặc khôi phục mật khẩu.' : authErrorMessage(cause)); setBusy(false); return; }
    const displayName = String(form.get('name'));
    try {
      await updateProfile(result.user, { displayName });
      await saveUserProfile(result.user.uid, { displayName, studentId: String(form.get('studentId')), email: result.user.email, phone: String(form.get('phone')), role: 'customer' }, true);
      navigate('/home');
    } catch (cause) {
      setDataError(`Tài khoản Firebase Auth đã được tạo nhưng hồ sơ Firestore chưa lưu: ${cause.message}. Cần bật Firestore và deploy Rules.`);
      navigate('/home');
    } finally { setBusy(false); }
  }
  return <AuthLayout title="Đăng ký tài khoản"><form className="auth-form stacked-form" onSubmit={submit}><label>Họ và tên<input name="name" placeholder="Nguyễn Văn A" required /></label><label>Mã sinh viên<input name="studentId" placeholder="Nhập mã số sinh viên" required /></label><label>Email<input name="email" type="email" placeholder="Nhập email của bạn" required /></label><label>Số điện thoại<input name="phone" type="tel" placeholder="Nhập số điện thoại" required /></label><label>Mật khẩu<div className="password-field"><input name="password" type={show ? 'text' : 'password'} minLength="8" placeholder="Tối thiểu 8 ký tự" required /><button type="button" onClick={() => setShow(!show)} aria-label="Hiện hoặc ẩn mật khẩu">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label><label>Xác nhận mật khẩu<input name="confirm" type="password" required /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'Đang tạo tài khoản...' : 'Đăng ký'}</button></form><p className="auth-switch">Đã có tài khoản? <Link to="/">Đăng nhập</Link></p></AuthLayout>;
}

function AuthLayout({ title, children, backTo = '/' }) { return <main className="auth-page"><div className="auth-panel"><div className="auth-heading"><Link to={backTo} className="back-button" aria-label="Quay lại"><ArrowLeft size={19} /></Link><h1>{title}</h1></div>{children}</div></main>; }

function ForgotPage() {
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  async function submit(event) { event.preventDefault(); setError(''); try { await sendPasswordResetEmail(auth, new FormData(event.currentTarget).get('email')); setMessage('Đã gửi liên kết khôi phục đến email của bạn.'); } catch { setError('Không tìm thấy tài khoản với email này.'); } }
  return <AuthLayout title="Quên mật khẩu"><p className="auth-description">Nhập email đã đăng ký để nhận liên kết khôi phục tài khoản</p><form className="auth-form forgot-form" onSubmit={submit}><label>Email<div className="icon-input"><Mail size={17} /><input name="email" type="email" required placeholder="Nhập email của bạn..." /></div></label>{message && <p className="form-success">{message}</p>}{error && <p className="form-error">{error}</p>}<button className="primary-button auth-submit">Gửi liên kết khôi phục</button></form><Link className="center-link" to="/">Quay lại Đăng nhập</Link></AuthLayout>;
}

function BottomNav({ active }) {
  const links = [['/home', Home, 'Trang chủ'], ['/history', ShoppingBag, 'Đơn hàng'], ['/notifications', Bell, 'Thông báo'], ['/profile', UserRound, 'Tài khoản']];
  return <nav className="bottom-nav">{links.map(([to, Icon, label]) => <Link key={label} className={active === label ? 'active' : ''} to={to}><Icon size={19} /><small>{label}</small></Link>)}</nav>;
}

function HomePage() {
  const { user, menuItems, categories: categoryDocs, cart, addToCart, dataError } = useData(); const [category, setCategory] = useState('Tất cả'); const [search, setSearch] = useState('');
  const categoryOptions = categoryDocs.length ? ['Tất cả', ...categoryDocs.filter((item) => item.active).map((item) => item.name)] : categories;
  const items = menuItems.filter((item) => item.availableToday !== false && (category === 'Tất cả' || item.category === category) && item.name.toLowerCase().includes(search.toLowerCase()));
  const count = cart.reduce((sum, item) => sum + item.quantity, 0); const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return <div className="mobile-app home-screen"><header className="home-header"><div className="user-greeting"><div className="avatar">{(user?.displayName || 'K').slice(0, 1)}</div><div><span>Xin chào, {user?.displayName || 'Khách hàng'}</span><small>Chào mừng bạn đến HPU Canteen</small></div></div><Link className="icon-button notification-button" to="/notifications" aria-label="Mở thông báo"><Bell size={19} /></Link></header><main className="home-main"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm món ăn..." /></label><div className="category-tabs">{categoryOptions.map((item) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="section-heading"><h2>Thực đơn hôm nay</h2><span>HPU Canteen</span></div>{dataError && <p className="form-error">Lỗi đồng bộ Firebase: {dataError}</p>}{items.length ? <div className="food-grid">{items.map((item) => <FoodCard key={item.id} food={item} onAdd={addToCart} />)}</div> : <div className="empty-state"><Utensils size={30} /><strong>Chưa có món ăn đang bán</strong><span>Thực đơn sẽ hiển thị tại đây khi căn tin cập nhật.</span></div>}</main>{count > 0 && <Link className="floating-cart" to="/cart"><ShoppingCart size={18} /><span>{count} món</span><strong>{money(total)}</strong><ChevronRight size={17} /></Link>}<BottomNav active="Trang chủ" /></div>;
}

function FoodCard({ food, onAdd }) { return <article className="food-card"><Link to={`/food/${food.id}`} className="food-image"><img src={food.image} alt={food.name} loading="lazy" /></Link><div className="food-info"><Link to={`/food/${food.id}`} className="food-name">{food.name}</Link><div className="food-price-row"><strong>{money(food.price)}</strong><button className="add-button" onClick={() => onAdd(food)} aria-label={`Thêm ${food.name}`}><Plus size={16} /></button></div><span className="available-label">Còn hàng</span></div></article>; }

function FoodPage() {
  const { id } = useParams(); const { menuItems, addToCart } = useData(); const navigate = useNavigate(); const [quantity, setQuantity] = useState(1); const [note, setNote] = useState(''); const food = menuItems.find((item) => item.id === id);
  if (!food) return <div className="empty-state"><strong>Không tìm thấy món ăn</strong><Link to="/home">Quay lại thực đơn</Link></div>;
  return <div className="mobile-app detail-screen"><div className="detail-photo"><img src={food.image} alt={food.name} /><button className="photo-back" onClick={() => navigate(-1)} aria-label="Quay lại"><ArrowLeft size={19} /></button></div><main className="detail-content"><span className="eyebrow">{food.category} · Còn hàng</span><div className="detail-title-row"><h1>{food.name}</h1><strong>{money(food.price)}</strong></div><p className="food-description">{food.desc}</p><div className="quantity-row"><strong>Số lượng</strong><div className="stepper"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={14} /></button><strong>{quantity}</strong><button onClick={() => setQuantity(quantity + 1)}><Plus size={14} /></button></div></div><label className="note-label">Ghi chú cho quán<textarea value={note} onChange={(event) => setNote(event.target.value)} rows="3" placeholder="VD: Không hành, nhiều rau..." /></label></main><div className="sticky-action"><button className="primary-button" onClick={() => { addToCart(food, quantity, note); navigate('/cart'); }}>Thêm vào giỏ hàng — {money(food.price * quantity)}</button></div></div>;
}

function CartPage() {
  const { cart, updateQuantity, removeItem, placeOrder, user, pickupSlots } = useData(); const [selectedSlot, setSelectedSlot] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const navigate = useNavigate(); const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const activeSlots = pickupSlots.filter((slot) => slot.enabled);
  const slot = activeSlots.find((item) => item.label === selectedSlot)?.label || activeSlots[0]?.label || '';
  async function checkout() { if (!slot) { setError('Căn tin chưa cấu hình khung giờ nhận món.'); return; } setBusy(true); setError(''); try { const order = await placeOrder(slot); navigate(`/orders/${order.id}`); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }
  return <div className="mobile-app cart-screen"><PageHeader title="Giỏ hàng" /><main className="cart-content">{cart.map((item) => <article className="cart-item" key={item.id}><img src={item.image} alt="" /><div className="cart-item-info"><strong>{item.name}</strong><span>{money(item.price)}</span><div className="cart-stepper"><button onClick={() => updateQuantity(item.id, -1)}><Minus size={13} /></button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.id, 1)}><Plus size={13} /></button></div></div><button className="remove-button" onClick={() => removeItem(item.id)} aria-label="Xóa món"><X size={16} /></button></article>)}{cart.length > 0 && <><div className="total-line"><span>Tổng cộng</span><strong>{money(total)}</strong></div><h2 className="slot-heading">Chọn khung giờ nhận món</h2>{activeSlots.length ? <div className="slot-grid">{activeSlots.map((pickupSlot) => <button key={pickupSlot.id} className={slot === pickupSlot.label ? 'chosen' : ''} onClick={() => setSelectedSlot(pickupSlot.label)}>{pickupSlot.label}</button>)}</div> : <p className="form-error">Căn tin chưa cấu hình khung giờ nhận món.</p>}</>}{error && <p className="form-error">{error} {user ? '' : <Link to="/">Đăng nhập</Link>}</p>}{cart.length === 0 && <div className="empty-state"><ShoppingBag size={32} /><strong>Giỏ hàng đang trống</strong><Link className="primary-button" to="/home">Khám phá thực đơn</Link></div>}</main>{cart.length > 0 && <div className="sticky-action checkout-action"><button className="primary-button" disabled={busy || !slot} onClick={checkout}>{busy ? 'Đang lưu đơn...' : `Xác nhận đặt đơn — ${money(total)}`}</button></div>}</div>;
}

function PageHeader({ title, to = -1 }) { const navigate = useNavigate(); return <header className="page-header"><button className="back-button" onClick={() => typeof to === 'string' ? navigate(to) : navigate(to)} aria-label="Quay lại"><ArrowLeft size={19} /></button><h1>{title}</h1><span className="header-spacer" /></header>; }

function OrderPage() {
  const { id } = useParams(); const { orders } = useData(); const order = orders.find((item) => item.id === id || item.code === id);
  const steps = ['received', 'preparing', 'ready', 'completed']; const currentStep = steps.indexOf(order?.status || 'received');
  return <div className="mobile-app order-screen"><PageHeader title="Chi tiết đơn hàng" to="/home" /><main className="order-content"><span className="eyebrow">MÃ ĐƠN HÀNG</span><h2>#{order?.code || 'Đang tải đơn hàng'}</h2><div className="qr-card"><div className="qr-code">{order?.code ? <QRCodeSVG value={order.code} size={128} level="M" includeMargin /> : <span>Đang tải mã QR...</span>}</div><strong>Đưa mã QR này cho nhân viên tại quầy để nhận món</strong></div><section className="status-card"><h3>TRẠNG THÁI CHUẨN BỊ</h3><div className="timeline">{steps.map((status, index) => <div key={status} className={`timeline-step ${index <= currentStep ? 'done' : ''} ${index === currentStep ? 'current' : ''}`}><span>{index < currentStep ? <Check size={12} /> : index + 1}</span><strong>{orderStatuses[status]}</strong></div>)}</div></section></main></div>;
}

function HistoryPage() {
  const { orders } = useData(); const navigate = useNavigate(); const [filter, setFilter] = useState('Tất cả');
  const filtered = orders.filter((order) => filter === 'Tất cả'
    || (filter === 'Hoàn thành' && order.status === 'completed')
    || (filter === 'Đang xử lý' && !['completed', 'cancelled'].includes(order.status)));
  return <div className="mobile-app history-screen"><PageHeader title="Lịch sử đặt món" to="/profile" /><div className="history-filter">{['Tất cả','Đang xử lý','Hoàn thành'].map((item) => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><main className="history-list">{filtered.map((order) => <button className="history-order" key={order.id} onClick={() => navigate(`/orders/${order.id}`)}><span className="history-order-top"><strong>#{order.code}</strong><i className={`status-pill ${order.status === 'completed' ? 'status-done' : order.status === 'cancelled' ? 'status-cancelled' : ''}`}>{orderStatuses[order.status] || order.status}</i></span><small>{order.pickupSlot || 'Đang cập nhật'}</small><span className="order-items-text">{order.items?.map((item) => `${item.name} x${item.quantity}`).join(', ')}</span><span className="history-total">Tổng cộng <b>{money(order.total)}</b></span></button>)}</main><BottomNav active="Đơn hàng" /></div>;
}

function NotificationsPage() {
  const { user, orders } = useData(); const navigate = useNavigate();
  const storageKey = `hpu-read-notifications:${user.uid}`;
  const [readIds, setReadIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });
  const notifications = orders.map((order) => ({
    id: `${order.id}:${order.status}`,
    orderId: order.id,
    code: order.code,
    status: order.status,
    items: order.items?.map((item) => `${item.name} x${item.quantity}`).join(', '),
    updatedAt: order.updatedAt?.toDate?.() || order.createdAt?.toDate?.() || null,
  })).sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
  function markRead(id) {
    setReadIds((current) => {
      const next = current.includes(id) ? current : [...current, id];
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }
  function markAllRead() {
    const next = notifications.map((item) => item.id);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setReadIds(next);
  }
  return <div className="mobile-app notifications-screen"><header className="page-header"><button className="back-button" onClick={() => navigate('/home')} aria-label="Về trang chủ"><ArrowLeft size={19} /></button><h1>Thông báo</h1><button className="notification-read-all" onClick={markAllRead} disabled={notifications.every((item) => readIds.includes(item.id))} aria-label="Đánh dấu đã đọc"><Check size={17} /></button></header><main className="notifications-list">{notifications.length ? notifications.map((item) => <button key={item.id} className={`notification-item ${readIds.includes(item.id) ? '' : 'unread'}`} onClick={() => { markRead(item.id); navigate(`/orders/${item.orderId}`); }}><span className="notification-icon"><Bell size={16} /></span><span className="notification-copy"><strong>Đơn #{item.code} đã cập nhật</strong><small>Trạng thái: {orderStatuses[item.status] || item.status}</small><small>{item.items}</small><time>{item.updatedAt ? item.updatedAt.toLocaleString('vi-VN') : 'Vừa cập nhật'}</time></span>{!readIds.includes(item.id) && <i className="notification-unread-dot" />}</button>) : <div className="empty-state"><Bell size={30} /><strong>Chưa có thông báo</strong><span>Thông tin đơn hàng sẽ xuất hiện tại đây.</span></div>}</main><BottomNav active="Thông báo" /></div>;
}

function ProfilePage() {
  const { user, profile } = useData(); const [saved, setSaved] = useState(false); const [error, setError] = useState('');
  async function submit(event) { event.preventDefault(); const form = new FormData(event.currentTarget); const displayName = String(form.get('name')); try { await saveUserProfile(user.uid, { displayName, phone: String(form.get('phone')), studentId: profile?.studentId || '' }); await updateProfile(user, { displayName }); setSaved(true); } catch (cause) { setError(cause.message); } }
  const logout = () => signOut(auth);
  return <div className="mobile-app profile-screen"><main className="profile-content"><div className="profile-avatar">{(user?.displayName || 'K').slice(0,1)}</div><h1>{user?.displayName || 'Khách hàng'}</h1><p>{profile?.studentId || user?.email}</p><form className="profile-form" onSubmit={submit}><label>Họ và tên<input name="name" defaultValue={profile?.displayName || user?.displayName || ''} required /></label><label>Mã sinh viên<input defaultValue={profile?.studentId || ''} disabled /></label><label>Email<input defaultValue={user?.email || ''} disabled /></label><label>Số điện thoại<input name="phone" defaultValue={profile?.phone || ''} /></label><button className="primary-button">{saved ? 'Đã lưu thay đổi' : 'Lưu thay đổi'}</button></form>{error && <p className="form-error">{error}</p>}<div className="profile-links"><Link to="/change-password"><LockKeyhole size={16} />Đổi mật khẩu<ChevronRight size={16} /></Link><Link to="/history"><ShoppingBag size={16} />Lịch sử đặt món<ChevronRight size={16} /></Link><button className="logout-link" onClick={logout}><LogOut size={16} />Đăng xuất<ChevronRight size={16} /></button></div></main><BottomNav active="Tài khoản" /></div>;
}

function ChangePasswordPage() {
  const { user } = useData(); const navigate = useNavigate(); const [error, setError] = useState(''); const [saved, setSaved] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setSaved(false); setBusy(true);
    const form = new FormData(event.currentTarget); const oldPassword = String(form.get('oldPassword')); const newPassword = String(form.get('newPassword'));
    if (newPassword.length < 8) { setError('Mật khẩu mới cần có ít nhất 8 ký tự.'); setBusy(false); return; }
    if (newPassword !== form.get('confirmPassword')) { setError('Mật khẩu xác nhận không khớp.'); setBusy(false); return; }
    try {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setSaved(true);
      window.setTimeout(() => navigate('/profile'), 900);
    } catch (cause) {
      setError(cause.code === 'auth/invalid-credential' || cause.code === 'auth/wrong-password'
        ? 'Mật khẩu cũ không đúng.'
        : `Không thể đổi mật khẩu: ${cause.message}`);
    } finally { setBusy(false); }
  }
  return <AuthLayout title="Đổi mật khẩu" backTo="/profile"><form className="auth-form stacked-form change-password-form" onSubmit={submit}><label>Mật khẩu cũ<input name="oldPassword" type="password" autoComplete="current-password" required /></label><label>Mật khẩu mới<input name="newPassword" type="password" autoComplete="new-password" minLength="8" required /></label><small className="password-hint">Mật khẩu phải có ít nhất 8 ký tự</small><label>Xác nhận mật khẩu mới<input name="confirmPassword" type="password" autoComplete="new-password" required /></label>{error && <p className="form-error">{error}</p>}{saved && <p className="form-success">Đã cập nhật mật khẩu.</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu thay đổi'}</button></form></AuthLayout>;
}

function LegacyAdminPage() {
  const { role, user, menuItems, orders, dataError, setDataError } = useData(); const [tab, setTab] = useState(role === 'staff' ? 'Đơn hàng' : 'Tổng quan'); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const nav = role === 'admin' ? ['Tổng quan', 'Đơn hàng', 'Món ăn'] : ['Đơn hàng', 'Bảng bếp'];
  async function submitMenu(event) { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setBusy(true); setDataError(''); try { await createMenuItem({ name: String(form.get('name')), category: String(form.get('category')), price: Number(form.get('price')), image: String(form.get('image') || initialMenu[0].image), desc: String(form.get('desc') || ''), active: true }); formElement.reset(); setNotice('Đã lưu món vào Firestore.'); } catch (cause) { setDataError(cause.message); } finally { setBusy(false); } }
  async function seed() { setBusy(true); setDataError(''); try { await seedMenu(initialMenu); setNotice('Đã nạp thực đơn mẫu vào Firestore.'); } catch (cause) { setDataError(cause.message); } finally { setBusy(false); } }
  return <div className="admin-layout"><aside className="admin-sidebar"><Link className="admin-brand" to="/home"><span className="brand-mark brand-mark-small"><Soup size={19} /></span><span><b>HPU Canteen</b><small>HỆ THỐNG QUẢN LÝ</small></span></Link><nav>{nav.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav><button className="admin-logout" onClick={() => signOut(auth)}>Đăng xuất</button></aside><main className="admin-main"><header className="admin-topbar"><div><span className="eyebrow">HPU CANTEEN / {role.toUpperCase()}</span><h1>{tab}</h1></div><span>{user?.email}</span></header>{dataError && <p className="form-error">Firebase: {dataError}</p>}{notice && <p className="form-success">{notice}</p>}{tab === 'Tổng quan' && <div className="metric-grid"><Metric title="Món đang bán" value={menuItems.filter((item) => item.active).length} /><Metric title="Tổng đơn" value={orders.length} /><Metric title="Đang xử lý" value={orders.filter((order) => !['completed','cancelled'].includes(order.status)).length} /><Metric title="Doanh thu hoàn tất" value={money(orders.filter((order) => order.status === 'completed').reduce((sum, order) => sum + order.total, 0))} /></div>}{tab === 'Món ăn' && <section className="admin-panel"><div className="manage-heading"><div><h2>Danh sách món ăn ({menuItems.length})</h2><p>Dữ liệu realtime từ Cloud Firestore</p></div>{menuItems.length === 0 && <button className="primary-button admin-add-button" disabled={busy} onClick={seed}>Nạp menu mẫu</button>}</div><form className="quick-add" onSubmit={submitMenu}><label>Tên món<input name="name" required /></label><label>Nhóm<select name="category"><option>Cơm</option><option>Bún/Phở</option><option>Đồ uống</option><option>Ăn nhẹ</option></select></label><label>Giá<input name="price" type="number" min="0" required /></label><label>Ảnh URL<input name="image" /></label><button className="primary-button" disabled={busy}>Thêm món</button></form><div className="table-scroll"><table><thead><tr><th>TÊN MÓN</th><th>NHÓM</th><th>GIÁ</th><th>ĐANG BÁN</th><th></th></tr></thead><tbody>{menuItems.map((item) => <tr key={item.id}><td className="food-table-cell">{item.name}</td><td>{item.category}</td><td>{money(item.price)}</td><td><input aria-label={`Đang bán ${item.name}`} type="checkbox" checked={item.active} onChange={(event) => updateMenuItem(item.id, { active: event.target.checked }).catch((cause) => setDataError(cause.message))} /></td><td><button className="table-action" onClick={() => deleteMenuItem(item.id).catch((cause) => setDataError(cause.message))} aria-label={`Xóa ${item.name}`}><X size={15} /></button></td></tr>)}</tbody></table></div></section>}{(tab === 'Đơn hàng' || tab === 'Bảng bếp') && <section className="admin-panel"><h2>Đơn hàng realtime ({orders.length})</h2><div className="table-scroll"><table><thead><tr><th>MÃ ĐƠN</th><th>KHÁCH HÀNG</th><th>MÓN</th><th>NHẬN MÓN</th><th>TỔNG</th><th>TRẠNG THÁI</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{order.code}</td><td>{order.customerName}</td><td>{order.items?.map((item) => `${item.name} x${item.quantity}`).join(', ')}</td><td>{order.pickupSlot}</td><td>{money(order.total)}</td><td><select aria-label={`Trạng thái ${order.code}`} value={order.status} onChange={(event) => updateOrderStatus(order.id, event.target.value).catch((cause) => setDataError(cause.message))}>{Object.entries(orderStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></td></tr>)}</tbody></table></div></section>}</main></div>;
}

function Metric({ title, value }) { return <article className="metric-card"><small>{title}</small><strong>{value}</strong></article>; }

function AdminPage() { return <AdminWorkspace {...useData()} />; }

function RootRedirect() { const { user, role, authReady } = useData(); if (!authReady) return <div className="app-loading">HPU Canteen</div>; return <Navigate to={user && ['admin','staff'].includes(role) ? '/admin' : user ? '/home' : '/login'} replace />; }
function CustomerAuthOnly({ children }) { const { user, role, authReady } = useData(); if (!authReady) return <div className="app-loading">Đang kiểm tra tài khoản...</div>; if (['admin', 'staff'].includes(role)) return <Navigate to="/admin" replace />; return user ? children : <Navigate to="/login" replace />; }
function CustomerOnly({ children }) { const { role, authReady } = useData(); if (!authReady) return <div className="app-loading">Đang kiểm tra tài khoản...</div>; return ['admin', 'staff'].includes(role) ? <Navigate to="/admin" replace /> : children; }
function HomeAccess() { const { authReady } = useData(); return authReady ? <HomePage /> : <div className="app-loading">Đang tải trang chủ...</div>; }
function TeamOnly({ children }) { const { user, role, authReady } = useData(); if (!authReady) return <div className="app-loading">Đang kiểm tra quyền...</div>; if (!user) return <Navigate to="/login" replace />; return ['admin','staff'].includes(role) ? children : <RoleAccessDenied />; }

function RoleAccessDenied() {
  const { user, refreshRole } = useData(); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function checkAgain() {
    setBusy(true); setMessage('');
    try { const role = await refreshRole(); setMessage(role === 'admin' || role === 'staff' ? 'Đã nhận quyền mới. Đang tải khu vực quản trị...' : 'Firebase chưa cấp claim role=admin/staff hoặc admin=true/staff=true cho tài khoản này.'); }
    catch (error) { setMessage(`Không đọc được quyền từ Firebase: ${error.message}`); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-panel"><div className="auth-heading"><h1>Chưa có quyền quản trị</h1></div><p className="auth-description">Tài khoản {user.email} chưa được Firebase xác nhận là admin hoặc nhân viên.</p>{message && <p className="form-error">{message}</p>}<button className="primary-button auth-submit" disabled={busy} onClick={checkAgain}>{busy ? 'Đang kiểm tra...' : 'Làm mới quyền Firebase'}</button><button className="text-action" onClick={() => signOut(auth)}>Đăng xuất</button></section></main>;
}

function AppFirebase() {
  return <BrowserRouter><DataProvider><Routes><Route path="/" element={<RootRedirect />} /><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/forgot-password" element={<ForgotPage />} /><Route path="/change-password" element={<CustomerAuthOnly><ChangePasswordPage /></CustomerAuthOnly>} /><Route path="/home" element={<HomeAccess />} /><Route path="/food/:id" element={<CustomerOnly><FoodPage /></CustomerOnly>} /><Route path="/cart" element={<CustomerOnly><CartPage /></CustomerOnly>} /><Route path="/orders/:id" element={<CustomerAuthOnly><OrderPage /></CustomerAuthOnly>} /><Route path="/history" element={<CustomerAuthOnly><HistoryPage /></CustomerAuthOnly>} /><Route path="/notifications" element={<CustomerAuthOnly><NotificationsPage /></CustomerAuthOnly>} /><Route path="/profile" element={<CustomerAuthOnly><ProfilePage /></CustomerAuthOnly>} /><Route path="/admin-legacy/*" element={<TeamOnly><LegacyAdminPage /></TeamOnly>} /><Route path="/admin/*" element={<TeamOnly><AdminPage /></TeamOnly>} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></DataProvider></BrowserRouter>;
}

export default AppFirebase;