import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CircleDollarSign, CircleX, ClipboardList, Clock3, Home, LayoutDashboard, LogOut, Pencil, Plus, Search, ShoppingBag, Soup, Trash2, Users, Utensils, X } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { createManagedAccount, deleteManagedAccount, updateManagedAccount } from './data/accounts';
import { createCategory, createMenuItem, createPickupSlot, deleteCategory, deleteMenuItem, deletePickupSlot, reconcileOrder, seedCategories, seedMenu, seedPickupSlots, updateCategory, updateMenuItem, updateOrderStatus, updatePickupSlot } from './data/firestore';

const statuses = { received: 'Đã tiếp nhận', preparing: 'Đang chế biến', ready: 'Sẵn sàng lấy đồ', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
const slotsTemplate = [
  ['11:00-11:15', '11:00', '11:15'], ['11:15-11:30', '11:15', '11:30'],
  ['11:30-11:45', '11:30', '11:45'], ['11:45-12:00', '11:45', '12:00'],
  ['12:00-12:15', '12:00', '12:15'], ['12:15-12:30', '12:15', '12:30'],
].map(([label, start, end]) => ({ id: `slot-${start.replace(':', '')}`, label, start, end, capacity: 20 }));
const sampleMenu = [
  { id: 'com-suon', name: 'Cơm sườn nướng', category: 'Cơm', price: 30000, image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=85', availableToday: true },
  { id: 'pho-bo', name: 'Phở bò tái', category: 'Bún/Phở', price: 35000, image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=900&q=85', availableToday: true },
  { id: 'bun-cha', name: 'Bún chả Hà Nội', category: 'Bún/Phở', price: 28000, image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=85', availableToday: true },
  { id: 'tra-dao', name: 'Trà đào cam sả', category: 'Đồ uống', price: 20000, image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=900&q=85', availableToday: true },
  { id: 'banh-mi', name: 'Bánh mì thịt nướng', category: 'Ăn nhẹ', price: 18000, image: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=900&q=85', availableToday: true },
  { id: 'nuoc-cam', name: 'Nước ép cam', category: 'Đồ uống', price: 15000, image: 'https://images.unsplash.com/photo-1600271886742-fba5fdfcdfb7?auto=format&fit=crop&w=900&q=85', availableToday: true },
];
const money = (value = 0) => `${Number(value).toLocaleString('vi-VN')}đ`;

export default function AdminWorkspace({ role, user, menuItems, categories, orders, users, pickupSlots, dataError, setDataError }) {
  const [tab, setTab] = useState(role === 'staff' ? 'Đơn hàng' : 'Tổng quan');
  const [reportRange, setReportRange] = useState('Tuần này');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const navigation = role === 'admin'
    ? [['Dashboard Báo cáo', LayoutDashboard], ['Quản lý danh mục', ClipboardList], ['Quản lý món ăn', Utensils], ['Thực đơn ngày', Check], ['Khung giờ', Clock3], ['Đơn hàng', ClipboardList], ['Đối soát', Check], ['Tài khoản', Users]]
    : [['Đơn hàng', ClipboardList], ['Bảng bếp', Soup]];
  const activeTab = tab === 'Tổng quan' ? 'Dashboard Báo cáo'
    : tab === 'Danh mục' ? 'Quản lý danh mục'
      : tab === 'Món ăn' ? 'Quản lý món ăn'
        : tab === 'Khung giờ nhận hàng' ? 'Khung giờ' : tab;
  const pendingOrders = orders.filter((order) => !['completed', 'cancelled'].includes(order.status));
  const completedOrders = orders.filter((order) => order.status === 'completed');
  const reportOrders = getRangeOrders(orders, reportRange);

  function clearMessages() { setDataError(''); setNotice(''); }
  async function runAction(action, success) {
    clearMessages(); setBusy(true);
    try { await action(); if (success) setNotice(success); return true; }
    catch (error) { setDataError(error.message || 'Không thể hoàn tất thao tác.'); return false; }
    finally { setBusy(false); }
  }
  async function submitMenu(event) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    clearMessages(); setBusy(true);
    try {
      await createMenuItem({ name: String(form.get('name')).trim(), category: String(form.get('category')), price: Number(form.get('price')), image: String(form.get('image') || ''), desc: String(form.get('desc') || ''), active: true, availableToday: true });
      formElement.reset(); setNotice('Đã thêm món vào Firestore.'); return true;
    } catch (error) { setDataError(error.message); return false; }
    finally { setBusy(false); }
  }
  async function submitSlot(event, editingSlot = null) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const start = String(form.get('start')); const end = String(form.get('end'));
    if (start >= end) { setDataError('Giờ kết thúc phải sau giờ bắt đầu.'); return; }
    const updates = { label: `${start}-${end}`, start, end, capacity: Number(form.get('capacity')) };
    const saved = await runAction(
      () => editingSlot ? updatePickupSlot(editingSlot.id, updates) : createPickupSlot(updates),
      editingSlot ? 'Đã cập nhật khung giờ.' : 'Đã thêm khung giờ nhận món.',
    );
    if (saved) formElement.reset();
  }

  return <div className="admin-layout">
    <aside className="admin-sidebar">
      <Link className="admin-brand" to="/home"><span className="brand-mark brand-mark-small"><Soup size={19} /></span><span><b>HPU Canteen</b><small>HỆ THỐNG QUẢN LÝ</small></span></Link>
      <nav>
        {role === 'admin' && <Link className="admin-home-link" to="/home"><Home size={16} />Trang chủ</Link>}
        {navigation.map(([label, Icon]) => {
          const destination = label === 'Dashboard Báo cáo' ? 'Tổng quan'
            : label === 'Quản lý danh mục' ? 'Danh mục'
              : label === 'Quản lý món ăn' ? 'Món ăn'
                : label === 'Khung giờ' ? 'Khung giờ nhận hàng' : label;
          return <button key={label} className={activeTab === label ? 'active' : ''} onClick={() => { setTab(destination); clearMessages(); }}><Icon size={16} />{label}</button>;
        })}
      </nav>
      <div className="admin-user"><span className="avatar">{(user?.displayName || user?.email || 'A').slice(0, 1).toUpperCase()}</span><span><b>{user?.displayName || 'Quản trị viên'}</b><small>{role === 'admin' ? 'Quản lý căn tin' : 'Nhân viên'}</small></span><button className="admin-logout-icon" onClick={() => signOut(auth)} aria-label="Đăng xuất"><LogOut size={16} /></button></div>
    </aside>
    <main className="admin-main">
      <header className={`admin-topbar ${tab === 'Tổng quan' ? 'admin-topbar-dashboard' : ''}`}><div><span className="eyebrow">HPU CANTEEN / {role.toUpperCase()}</span><h1>{tab === 'Tổng quan' ? 'Dashboard Báo cáo doanh thu' : tab === 'Danh mục' ? 'Quản lý danh mục sản phẩm' : tab === 'Món ăn' ? 'Quản lý món ăn' : tab === 'Thực đơn ngày' ? 'Lên thực đơn ngày' : tab === 'Khung giờ nhận hàng' ? 'Thiết lập khung giờ nhận hàng' : tab === 'Bảng bếp' ? 'Bảng đơn hàng Bếp (KDS)' : tab === 'Đối soát' ? 'Đối soát & Bàn giao quầy' : tab === 'Tài khoản' ? 'Quản lý tài khoản' : tab}</h1><p className="admin-page-subtitle">{tab === 'Tổng quan' ? 'Tổng quan kết quả kinh doanh nhà ăn và xu hướng tuần' : tab === 'Danh mục' ? 'Tổ chức các món ăn trong căng tin theo nhóm phù hợp' : tab === 'Món ăn' ? 'Danh sách các sản phẩm đang kinh doanh tại căn tin' : tab === 'Thực đơn ngày' ? 'Thiết lập các món sẽ mở bán trong ngày cụ thể của tuần' : tab === 'Khung giờ nhận hàng' ? 'Quản lý và giới hạn số đơn tối đa đã có thể nhận theo từng khung giờ' : tab === 'Tài khoản' ? 'Quản trị danh sách khách hàng, nhân viên và quản lý căn tin' : ''}</p></div>{tab === 'Tổng quan' ? <div className="admin-range-control admin-top-range">{['Hôm nay','Tuần này','Tháng này'].map((value) => <button key={value} className={reportRange === value ? 'active' : ''} onClick={() => setReportRange(value)}>{value}</button>)}<button onClick={() => exportOrdersCsv(reportOrders)}>Xuất Excel</button></div> : <span>{user?.email}</span>}</header>
      {dataError && <p className="form-error">Firebase: {dataError}</p>}{notice && <p className="form-success">{notice}</p>}
      {tab === 'Tổng quan' && <Overview orders={orders} range={reportRange} />}
      {tab === 'Danh mục' && <Categories categories={categories} items={menuItems} busy={busy} onSeed={() => runAction(() => seedCategories(defaultCategories), 'Đã tạo danh mục mẫu.')} onCreate={(category) => runAction(() => createCategory(category), 'Đã thêm danh mục.')} onUpdate={(category, updates) => runAction(() => updateCategory(category.id, updates), 'Đã cập nhật danh mục.')} onToggle={(category, active) => runAction(() => updateCategory(category.id, { active }), 'Đã cập nhật danh mục.')} onDelete={(category) => menuItems.some((item) => item.category === category.name) ? setDataError(`Không thể xóa danh mục ${category.name} vì vẫn còn món đang dùng.`) : runAction(() => deleteCategory(category.id), `Đã xóa danh mục ${category.name}.`)} />}
      {tab === 'Đơn hàng' && <OrdersTable orders={orders} busy={busy} onChange={(order, status) => runAction(() => updateOrderStatus(order.id, status), `Đã cập nhật đơn ${order.code}.`)} />}
      {tab === 'Bảng bếp' && <KitchenBoard orders={pendingOrders} onChange={(order, status) => runAction(() => updateOrderStatus(order.id, status), `Đã chuyển đơn ${order.code} sang ${statuses[status]}.`)} />}
      {tab === 'Món ăn' && <MenuManager items={menuItems} categories={categories} busy={busy} onSubmit={submitMenu} onUpdate={(item, updates) => runAction(() => updateMenuItem(item.id, updates), 'Đã cập nhật món ăn.')} onSeed={() => runAction(() => seedMenu(sampleMenu), 'Đã nạp thực đơn mẫu.')} onToggle={(item, active) => runAction(() => updateMenuItem(item.id, { active }), 'Đã cập nhật món.')} onDelete={(item) => runAction(() => deleteMenuItem(item.id), `Đã xóa ${item.name}.`)} />}
      {tab === 'Thực đơn ngày' && <DailyMenu items={menuItems} busy={busy} onToggle={(item, updates) => runAction(() => updateMenuItem(item.id, updates), 'Đã cập nhật thực đơn ngày.')} />}
      {tab === 'Khung giờ nhận hàng' && <PickupSlots slots={pickupSlots} busy={busy} onSubmit={submitSlot} onSeed={() => runAction(() => seedPickupSlots(slotsTemplate), 'Đã tạo 6 khung giờ mẫu.')} onToggle={(slot, enabled) => runAction(() => updatePickupSlot(slot.id, { enabled }), 'Đã cập nhật khung giờ.')} onDelete={(slot) => runAction(() => deletePickupSlot(slot.id), `Đã xóa khung ${slot.label}.`)} />}
      {tab === 'Đối soát' && <Reconciliation orders={completedOrders} busy={busy} onConfirm={(order) => runAction(() => reconcileOrder(order.id, user.uid), `Đã đối soát đơn ${order.code}.`)} />}
      {tab === 'Tài khoản' && <Accounts users={users} currentUser={user} busy={busy} onCreate={(account) => runAction(() => createManagedAccount(account), 'Đã tạo tài khoản.')} onUpdate={(account) => runAction(() => updateManagedAccount(account), 'Đã cập nhật tài khoản.')} onDelete={(account) => runAction(() => deleteManagedAccount(account.id), 'Đã xóa tài khoản.')} />}
    </main>
  </div>;
}

function Overview({ orders, range }) {
  const now = new Date();
  const start = getRangeStart(range, now);
  const rangeOrders = orders.filter((order) => order.createdAt?.toDate && order.createdAt.toDate() >= start);
  const rangeCompleted = rangeOrders.filter((order) => order.status === 'completed');
  const rangeRevenue = rangeCompleted.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const servingsSold = rangeCompleted.reduce((sum, order) => sum + (order.items || []).reduce((itemTotal, item) => itemTotal + Number(item.quantity || 0), 0), 0);
  const cancelledCount = rangeOrders.filter((order) => order.status === 'cancelled').length;
  const buckets = range === 'Hôm nay'
    ? [8, 10, 12, 14, 16, 18].map((hour) => ({ label: `${hour}:00`, matches: (date) => date.getHours() >= hour && date.getHours() < hour + 2 }))
    : range === 'Tháng này'
      ? Array.from({ length: Math.ceil(now.getDate() / 7) }, (_, index) => ({ label: `Tuần ${index + 1}`, matches: (date) => Math.ceil(date.getDate() / 7) === index + 1 }))
      : Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return { label: date.toLocaleDateString('vi-VN', { weekday: 'short' }), matches: (orderDate) => orderDate.toDateString() === date.toDateString() }; });
  const bars = buckets.map((bucket) => ({ ...bucket, amount: rangeCompleted.filter((order) => bucket.matches(order.createdAt.toDate())).reduce((sum, order) => sum + Number(order.total || 0), 0) }));
  const max = Math.max(1, ...bars.map((bar) => bar.amount));
  const bestSellers = new Map();
  rangeCompleted.forEach((order) => order.items?.forEach((item) => {
    const current = bestSellers.get(item.name) || { quantity: 0, revenue: 0 };
    current.quantity += Number(item.quantity || 0); current.revenue += Number(item.unitPrice || 0) * Number(item.quantity || 0); bestSellers.set(item.name, current);
  }));
  const topItems = [...bestSellers.entries()].sort((a, b) => b[1].quantity - a[1].quantity).slice(0, 5);
  return <><div className="metric-grid"><Metric label={`Tổng doanh thu · ${range.toLowerCase()}`} value={money(rangeRevenue)} icon={CircleDollarSign} /><Metric label="Đơn hoàn thành" value={`${rangeCompleted.length} đơn`} icon={ShoppingBag} /><Metric label="Suất ăn bán ra" value={`${servingsSold} suất`} icon={Utensils} /><Metric label="Đơn hủy" value={`${cancelledCount} đơn`} icon={CircleX} /></div><div className="admin-panels"><section className="admin-panel"><div className="panel-heading"><div><h2>Biểu đồ doanh thu {range.toLowerCase()}</h2><p>Doanh thu từ các đơn hàng hoàn tất</p></div></div><div className="admin-status-chart revenue-chart">{rangeCompleted.length ? bars.map((bar) => <div className="admin-status-bar" key={bar.label}><span>{money(bar.amount)}</span><i style={{ height: `${bar.amount ? Math.max(5, bar.amount / max * 100) : 0}%` }} /><small>{bar.label}</small></div>) : <p className="admin-hint">Chưa có đơn hoàn tất trong khoảng thời gian này.</p>}</div></section><section className="admin-panel"><div className="panel-heading"><div><h2>Top 5 món bán chạy nhất</h2><p>Xếp hạng dựa trên lượng tiêu thụ trong thời gian đã chọn</p></div></div>{topItems.length ? <div className="table-scroll"><table className="dashboard-top-table"><thead><tr><th>#</th><th>MÓN ĂN</th><th>SỐ LƯỢNG</th><th>DOANH THU</th></tr></thead><tbody>{topItems.map(([name, stats], index) => <tr key={name}><td>{index + 1}</td><td>{name}</td><td>{stats.quantity} suất</td><td>{money(stats.revenue)}</td></tr>)}</tbody></table></div> : <p className="admin-hint">Chưa có đơn hoàn tất trong khoảng thời gian này.</p>}</section></div></>;
}

function Metric({ label, value, icon: Icon }) { return <article className="metric-card"><span className="metric-icon"><Icon size={16} /></span><small>{label}</small><strong>{value}</strong></article>; }

function getRangeOrders(orders, range, now = new Date()) {
  const start = getRangeStart(range, now);
  return orders.filter((order) => order.createdAt?.toDate && order.createdAt.toDate() >= start);
}

function getRangeStart(range, now) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'Hôm nay') start.setHours(0, 0, 0, 0);
  else if (range === 'Tháng này') start.setDate(1);
  else { const day = (start.getDay() + 6) % 7; start.setDate(start.getDate() - day); }
  return start;
}

function exportOrdersCsv(rangeOrders) {
  const rows = [['Mã đơn', 'Khách hàng', 'Món', 'Khung giờ', 'Tổng tiền', 'Trạng thái'], ...rangeOrders.map((order) => [order.code, order.customerName, order.items?.map((item) => `${item.name} x${item.quantity}`).join('; '), order.pickupSlot, order.total, statuses[order.status] || order.status])];
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'hpu-canteen-orders.csv'; link.style.display = 'none';
  document.body.appendChild(link); link.click();
  window.setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 1000);
}

function OrdersTable({ orders, busy, onChange }) {
  const [view, setView] = useState('board');
  return <section className="order-manager"><div className="manage-heading"><div><h2>{view === 'board' ? 'Bảng đơn hàng Bếp (KDS)' : `Tất cả đơn hàng (${orders.length})`}</h2><p>{view === 'board' ? 'Theo dõi quá trình chế biến và bàn giao đơn theo thời gian thực' : 'Đơn mới nhất hiển thị trước'}</p></div><div className="account-filters" role="group" aria-label="Chế độ xem đơn hàng"><button className={view === 'board' ? 'selected' : ''} onClick={() => setView('board')}>Bảng bếp</button><button className={view === 'table' ? 'selected' : ''} onClick={() => setView('table')}>Danh sách</button></div></div>{view === 'board' ? <KitchenBoard orders={orders.filter((order) => !['completed', 'cancelled'].includes(order.status))} onChange={onChange} busy={busy} /> : <section className="admin-panel"><div className="table-scroll"><table><thead><tr><th>MÃ ĐƠN</th><th>KHÁCH HÀNG</th><th>MÓN</th><th>GIỜ NHẬN</th><th>TỔNG</th><th>TRẠNG THÁI</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{order.code}</td><td>{order.customerName}</td><td>{order.items?.map((item) => `${item.name} x${item.quantity}`).join(', ')}</td><td>{order.pickupSlot}</td><td>{money(order.total)}</td><td><select aria-label={`Trạng thái ${order.code}`} value={order.status} disabled={busy} onChange={(event) => onChange(order, event.target.value)}>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></td></tr>)}</tbody></table></div></section>}</section>;
}

function KitchenBoard({ orders, onChange, busy }) {
  const columns = [['received', 'Chờ chế biến'], ['preparing', 'Đang chế biến'], ['ready', 'Sẵn sàng']];
  const next = { received: 'preparing', preparing: 'ready', ready: 'completed' };
  return <div className="kitchen-board">{columns.map(([status, label]) => <section className={`kitchen-column kitchen-${status}`} key={status}><h2>{label}<span>{orders.filter((order) => order.status === status).length}</span></h2>{orders.filter((order) => order.status === status).map((order) => <article className="kitchen-order" key={order.id}><strong>#{order.code}</strong><small>{order.customerName} · {order.pickupSlot}</small><p>{order.items?.map((item) => `${item.name} x${item.quantity}`).join(', ')}</p><b>{money(order.total)}</b><button className="primary-button" disabled={busy} onClick={() => onChange(order, next[status])}>{status === 'ready' ? 'Hoàn thành' : `Chuyển: ${statuses[next[status]]}`}</button></article>)}</section>)}</div>;
}

function MenuManager({ items, categories, busy, onSubmit, onUpdate, onSeed, onToggle, onDelete }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [formOpen, setFormOpen] = useState(true);
  const [editing, setEditing] = useState(null);
  const visibleItems = items.filter((item) => (category === 'all' || item.category === category)
    && item.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));

  async function submitEdit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = await onUpdate(editing, {
      name: String(form.get('name')).trim(),
      category: String(form.get('category')),
      price: Number(form.get('price')),
      image: String(form.get('image') || ''),
      desc: String(form.get('desc') || ''),
    });
    if (saved) { setFormOpen(false); setEditing(null); }
  }

  async function submitNew(event) {
    const saved = await onSubmit(event);
    if (saved) setFormOpen(false);
  }

  return <div className={`catalog-workspace ${formOpen ? 'editing' : ''}`}>
    <section className="admin-panel catalog-list-panel">
      <div className="manage-heading"><div><h2>Danh sách món ăn ({items.length})</h2><p>Món có thể tạm dừng mà không xóa lịch sử đơn</p></div><div className="menu-toolbar"><label className="account-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm món ăn..." aria-label="Tìm kiếm món ăn" /></label><select aria-label="Lọc theo danh mục" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Tất cả danh mục</option>{categories.filter((item) => item.active).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><button className="primary-button admin-add-button" disabled={busy} onClick={() => { setEditing(null); setFormOpen((open) => !open); }}>+ Thêm món mới</button>{items.length === 0 && <button className="admin-outline" disabled={busy} onClick={onSeed}>Nạp menu mẫu</button>}</div></div>
      <div className="table-scroll"><table><thead><tr><th>ẢNH</th><th>TÊN MÓN</th><th>DANH MỤC</th><th>GIÁ BÁN</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead><tbody>{visibleItems.map((item) => <tr key={item.id}><td><img className="menu-row-image" src={item.image} alt="" /></td><td>{item.name}</td><td>{item.category}</td><td>{money(item.price)}</td><td><button className={`account-toggle ${item.active ? 'enabled' : ''}`} role="switch" aria-checked={Boolean(item.active)} aria-label={`${item.active ? 'Tạm dừng' : 'Mở bán'} ${item.name}`} disabled={busy} onClick={() => onToggle(item, !item.active)}><i /></button></td><td><div className="account-actions"><button className="table-action" aria-label={`Sửa ${item.name}`} disabled={busy} onClick={() => { setEditing(item); setFormOpen(true); }}><Pencil size={14} /></button><button className="table-action account-delete" aria-label={`Xóa ${item.name}`} disabled={busy} onClick={() => onDelete(item)}><Trash2 size={14} /></button></div></td></tr>)}{visibleItems.length === 0 && <tr><td colSpan="6" className="account-empty">Không tìm thấy món ăn.</td></tr>}</tbody></table></div>
    </section>
    {formOpen && <aside className="admin-panel account-form-panel catalog-form-panel">
      <div className="account-form-heading"><div><h2>{editing ? 'Chỉnh sửa món ăn' : 'Thêm món mới'}</h2><p>Nhập thông tin món trong thực đơn</p></div><button className="table-action" onClick={() => { setFormOpen(false); setEditing(null); }} aria-label="Đóng biểu mẫu"><X size={16} /></button></div>
      <form className="account-form" key={editing?.id || 'new'} onSubmit={editing ? submitEdit : submitNew}>
        <label>Ảnh món ăn<input name="image" type="url" defaultValue={editing?.image || ''} placeholder="https://..." /></label>
        <label>Tên món<input name="name" defaultValue={editing?.name || ''} required /></label>
        <label>Danh mục<select name="category" defaultValue={editing?.category || categories.find((item) => item.active)?.name} required>{categories.filter((item) => item.active).map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label>Giá bán (VND)<input name="price" type="number" min="1" defaultValue={editing?.price || ''} required /></label>
        <label>Mô tả<input name="desc" defaultValue={editing?.desc || ''} /></label>
        <div className="account-form-actions"><button type="button" className="admin-outline" onClick={() => { setFormOpen(false); setEditing(null); }}>Hủy</button><button className="primary-button" disabled={busy}>{editing ? 'Lưu thay đổi' : 'Thêm món'}</button></div>
      </form>
    </aside>}
  </div>;
}

const defaultCategories = [
  { id: 'com', name: 'Cơm', description: 'Các món cơm' },
  { id: 'bun-pho', name: 'Bún/Phở', description: 'Bún và phở' },
  { id: 'do-uong', name: 'Đồ uống', description: 'Thức uống' },
  { id: 'an-nhe', name: 'Ăn nhẹ', description: 'Món ăn nhẹ' },
];

function Categories({ categories, items, busy, onSeed, onCreate, onUpdate, onToggle, onDelete }) {
  const [formOpen, setFormOpen] = useState(true);
  const [editing, setEditing] = useState(null);
  async function submit(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const formElement = event.currentTarget;
    const values = { name: String(form.get('name')).trim(), description: String(form.get('description') || '') };
    const saved = editing ? await onUpdate(editing, values) : await onCreate(values);
    if (saved) { formElement.reset(); setFormOpen(false); setEditing(null); }
  }
  return <div className={`catalog-workspace ${formOpen ? 'editing' : ''}`}>
    <section className="admin-panel catalog-list-panel">
      <div className="manage-heading"><div><h2>Danh mục món ăn ({categories.length})</h2><p>Tổ chức món ăn trong căn tin theo nhóm phù hợp</p></div><div className="account-actions"><button className="primary-button admin-add-button" disabled={busy} onClick={() => { setEditing(null); setFormOpen((open) => !open); }}><Plus size={14} /> Thêm danh mục</button>{categories.length === 0 && <button className="admin-outline" disabled={busy} onClick={onSeed}>Nạp danh mục mẫu</button>}</div></div>
      <div className="table-scroll"><table><thead><tr><th>STT</th><th>TÊN DANH MỤC</th><th>SỐ MÓN ĂN</th><th>NGÀY TẠO</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead><tbody>{categories.map((category, index) => <tr key={category.id}><td>{index + 1}</td><td>{category.name}</td><td>{items.filter((item) => item.category === category.name).length} món</td><td>{category.createdAt?.toDate ? category.createdAt.toDate().toLocaleDateString('vi-VN') : '—'}</td><td><button className={`account-toggle ${category.active ? 'enabled' : ''}`} role="switch" aria-checked={Boolean(category.active)} aria-label={`Bật danh mục ${category.name}`} disabled={busy} onClick={() => onToggle(category, !category.active)}><i /></button></td><td><div className="account-actions"><button className="table-action" aria-label={`Sửa ${category.name}`} disabled={busy} onClick={() => { setEditing(category); setFormOpen(true); }}><Pencil size={14} /></button><button className="table-action account-delete" aria-label={`Xóa ${category.name}`} disabled={busy} onClick={() => onDelete(category)}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>
    </section>
    {formOpen && <aside className="admin-panel account-form-panel catalog-form-panel">
      <div className="account-form-heading"><div><h2>{editing ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}</h2><p>Nhập thông tin nhóm món ăn</p></div><button className="table-action" onClick={() => { setFormOpen(false); setEditing(null); }} aria-label="Đóng biểu mẫu"><X size={16} /></button></div>
      <form className="account-form" key={editing?.id || 'new'} onSubmit={submit}>
        <label>Tên danh mục<input name="name" defaultValue={editing?.name || ''} required /></label>
        <label>Mô tả danh mục<input name="description" defaultValue={editing?.description || ''} /></label>
        <div className="account-form-actions"><button type="button" className="admin-outline" onClick={() => { setFormOpen(false); setEditing(null); }}>Hủy</button><button className="primary-button" disabled={busy}>{editing ? 'Lưu lại' : 'Thêm danh mục'}</button></div>
      </form>
    </aside>}
  </div>;
}

function DailyMenu({ items, busy, onToggle }) {
  const days = [['mon', 'Thứ 2'], ['tue', 'Thứ 3'], ['wed', 'Thứ 4'], ['thu', 'Thứ 5'], ['fri', 'Thứ 6'], ['sat', 'Thứ 7'], ['sun', 'Chủ Nhật']];
  const todayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const selectedCount = items.filter((item) => {
    const enabledDays = Array.isArray(item.availableDays) ? item.availableDays : item.availableToday === false ? [] : days.map(([key]) => key);
    return enabledDays.includes(selectedDay);
  }).length;
  const groups = [...new Set(items.map((item) => item.category || 'Khác'))];

  function toggleDay(item, checked) {
    const enabledDays = new Set(Array.isArray(item.availableDays)
      ? item.availableDays
      : item.availableToday === false ? [] : days.map(([key]) => key));
    if (checked) enabledDays.add(selectedDay);
    else enabledDays.delete(selectedDay);
    const availableDays = days.map(([key]) => key).filter((key) => enabledDays.has(key));
    onToggle(item, {
      availableDays,
      ...(selectedDay === todayKey ? { availableToday: checked } : {}),
    });
  }

  return <section className="daily-menu-page"><div className="daily-week-switch" role="tablist" aria-label="Chọn ngày trong tuần">{days.map(([key, label]) => <button key={key} role="tab" aria-selected={selectedDay === key} className={selectedDay === key ? 'selected' : ''} onClick={() => setSelectedDay(key)}>{label}</button>)}</div><div className="daily-menu-groups">{groups.map((group) => <section className="admin-panel daily-menu-group" key={group}><h2>{group}</h2>{items.filter((item) => (item.category || 'Khác') === group).map((item) => {
    const enabledDays = Array.isArray(item.availableDays) ? item.availableDays : item.availableToday === false ? [] : days.map(([key]) => key);
    const isAvailable = enabledDays.includes(selectedDay);
    return <label className={`daily-menu-item ${isAvailable ? 'is-selected' : ''}`} key={item.id}><input type="checkbox" checked={isAvailable} disabled={busy || !item.active} onChange={(event) => toggleDay(item, event.target.checked)} /><span>{item.name}</span><b>{money(item.price)}</b></label>;
  })}</section>)}</div><div className="daily-menu-summary"><span>Thực đơn {days.find(([key]) => key === selectedDay)?.[1]} · Đã chọn: <b>{selectedCount} món</b></span><small>Các thay đổi được lưu trực tiếp vào Firestore.</small></div></section>;
}

function PickupSlots({ slots, busy, onSubmit, onSeed, onToggle, onDelete }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  async function submit(event) {
    const saved = await onSubmit(event, editing);
    if (saved) { setFormOpen(false); setEditing(null); }
  }
  return <section className="admin-panel"><div className="manage-heading"><div><h2>Khung giờ nhận hàng ({slots.length})</h2><p>Quản lý và giới hạn số đơn tối đa theo từng khung giờ</p></div><div className="account-actions"><button className="primary-button admin-add-button" disabled={busy} onClick={() => { setEditing(null); setFormOpen((open) => !open); }}><Plus size={14} /> Thêm khung giờ</button>{slots.length === 0 && <button className="admin-outline" disabled={busy} onClick={onSeed}>Tạo 6 khung giờ mẫu</button>}</div></div>{formOpen && <form className="quick-add category-edit-form" key={editing?.id || 'new'} onSubmit={submit}><label>Bắt đầu<input name="start" type="time" defaultValue={editing?.start || ''} required /></label><label>Kết thúc<input name="end" type="time" defaultValue={editing?.end || ''} required /></label><label>Sức chứa<input name="capacity" type="number" min="1" defaultValue={editing?.capacity || 20} required /></label><button className="primary-button" disabled={busy}>{editing ? 'Lưu thay đổi' : 'Thêm khung'}</button><button type="button" className="admin-outline" onClick={() => { setFormOpen(false); setEditing(null); }}>Hủy</button></form>}<div className="table-scroll"><table><thead><tr><th>STT</th><th>KHUNG GIỜ GIAO NHẬN</th><th>SỐ ĐƠN TỐI ĐA / KHUNG</th><th>TRẠNG THÁI HOẠT ĐỘNG</th><th>THAO TÁC</th></tr></thead><tbody>{slots.map((slot, index) => <tr key={slot.id}><td>{index + 1}</td><td>{slot.label}</td><td>{slot.capacity}</td><td><button className={`account-toggle ${slot.enabled ? 'enabled' : ''}`} role="switch" aria-checked={Boolean(slot.enabled)} aria-label={`Mở khung ${slot.label}`} disabled={busy} onClick={() => onToggle(slot, !slot.enabled)}><i /></button></td><td><div className="account-actions"><button className="table-action" aria-label={`Sửa khung ${slot.label}`} disabled={busy} onClick={() => { setEditing(slot); setFormOpen(true); }}><Pencil size={14} /></button><button className="table-action account-delete" aria-label={`Xóa khung ${slot.label}`} disabled={busy} onClick={() => onDelete(slot)}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div><p className="admin-hint">Giới hạn số đơn tối đa giúp bếp ăn căn tin điều phối chuẩn xác, tránh quá tải suất ăn trong một thời điểm nhận hàng.</p></section>;
}

function Reconciliation({ orders, busy, onConfirm }) {
  const [code, setCode] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(0);
  const matchingOrder = orders.find((order) => order.code?.toLowerCase() === searchCode.toLowerCase());
  const visibleOrders = searchCode ? orders.filter((order) => order.code?.toLowerCase().includes(searchCode.toLowerCase())) : orders;
  function submit(event) { event.preventDefault(); setSearchCode(code.trim()); }
  function stopCamera() {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }
  useEffect(() => () => {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  async function startCamera() {
    setCameraError('');
    if (!('BarcodeDetector' in window)) {
      setCameraError('Trình duyệt này chưa hỗ trợ quét QR trực tiếp. Hãy nhập mã đơn thủ công.');
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (!videoRef.current) throw new Error('Không thể mở khung xem camera.');
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play();
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      setCameraActive(true);
      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) {
            setCode(codes[0].rawValue);
            setSearchCode(codes[0].rawValue);
            stopCamera();
            return;
          }
        } catch (error) {
          setCameraError(`Không thể quét mã QR: ${error.message}`);
          stopCamera();
          return;
        }
        frameRef.current = window.requestAnimationFrame(scan);
      };
      frameRef.current = window.requestAnimationFrame(scan);
    } catch (error) {
      stopCamera();
      setCameraError(`Không thể mở camera: ${error.message}`);
    }
  }
  return <div className="reconciliation-page"><div className="reconciliation-tools"><section className="admin-panel reconcile-card"><span className="reconcile-icon">⌕</span><h2>Quét mã QR đơn hàng</h2><p>Sử dụng camera của thiết bị để quét mã QR trên màn hình đặt món.</p><video ref={videoRef} className={`reconcile-video ${cameraActive ? 'active' : ''}`} muted playsInline />{cameraError && <p className="form-error">{cameraError}</p>}{cameraActive ? <button className="admin-outline" onClick={stopCamera}>Đóng camera</button> : <button className="primary-button admin-add-button" onClick={startCamera}>Mở camera quét QR</button>}<small>Nhập mã đơn bên cạnh nếu không thể sử dụng camera.</small></section><section className="admin-panel reconcile-card"><span className="reconcile-icon">▦</span><h2>Nhập mã đơn hàng thủ công</h2><form className="reconcile-search" onSubmit={submit}><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="VD: HPU-2026-123456" aria-label="Mã đơn hàng" /><button className="primary-button">Tra cứu đơn hàng</button></form>{searchCode && <p className={matchingOrder ? 'form-success' : 'form-error'}>{matchingOrder ? `Đã tìm thấy đơn ${matchingOrder.code}.` : 'Không tìm thấy đơn hoàn tất có mã này.'}</p>}</section></div><section className="admin-panel"><div className="manage-heading"><div><h2>Lịch sử đối soát và bàn giao gần đây</h2><p>{orders.filter((order) => !order.reconciled).length} đơn chờ · {orders.filter((order) => order.reconciled).length} đã đối soát</p></div></div><div className="table-scroll"><table><thead><tr><th>MÃ ĐƠN</th><th>KHÁCH HÀNG</th><th>GIỜ NHẬN</th><th>TỔNG TIỀN</th><th>ĐỐI SOÁT</th></tr></thead><tbody>{visibleOrders.map((order) => <tr key={order.id}><td>{order.code}</td><td>{order.customerName}</td><td>{order.pickupSlot}</td><td>{money(order.total)}</td><td>{order.reconciled ? <span className="status-pill status-done">Đã đối soát</span> : <button className="primary-button admin-add-button" disabled={busy} onClick={() => onConfirm(order)}>Xác nhận</button>}</td></tr>)}{visibleOrders.length === 0 && <tr><td colSpan="5" className="account-empty">Không có đơn phù hợp.</td></tr>}</tbody></table></div></section></div>;
}

const roleNames = { admin: 'Admin', staff: 'Nhân viên', kitchen: 'Nhân viên bếp', cashier: 'Nhân viên quầy', customer: 'Khách hàng' };
const accountFilters = [
  ['all', 'Tất cả'],
  ['admin', 'Admin'],
  ['kitchen', 'Nhân viên bếp'],
  ['cashier', 'Nhân viên quầy'],
  ['customer', 'Khách hàng'],
];

function Accounts({ users, currentUser, busy, onCreate, onUpdate, onDelete }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState('');
  const filteredUsers = users.filter((account) => {
    const matchesRole = filter === 'all' || (account.role || 'customer') === filter
      || (filter === 'kitchen' && account.role === 'staff');
    const text = `${account.displayName || ''} ${account.email || ''} ${account.studentId || ''}`.toLocaleLowerCase('vi');
    return matchesRole && text.includes(search.toLocaleLowerCase('vi'));
  });

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = {
      displayName: String(form.get('displayName')).trim(),
      studentId: String(form.get('studentId') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      role: String(form.get('role')),
      enabled: form.get('enabled') === 'on',
    };
    setFormError('');
    const saved = editing.id
      ? await onUpdate({ ...data, uid: editing.id })
      : await onCreate({
        ...data,
        email: String(form.get('email')).trim(),
        password: String(form.get('password')),
      });
    if (saved) setEditing(null);
  }

  async function toggleEnabled(account) {
    await onUpdate({
      uid: account.id,
      displayName: account.displayName || account.email || 'Tài khoản',
      studentId: account.studentId || '',
      phone: account.phone || '',
      role: account.role || 'customer',
      enabled: account.enabled === false,
    });
  }

  async function remove(account) {
    if (account.id === currentUser?.uid) {
      setFormError('Không thể xóa tài khoản admin đang đăng nhập.');
      return;
    }
    if (window.confirm(`Xóa tài khoản ${account.displayName || account.email}? Tài khoản sẽ không thể đăng nhập nữa.`)) {
      await onDelete(account);
    }
  }

  return <div className={`account-workspace ${editing ? 'editing-account' : ''}`}>
    <section className="admin-panel account-list-panel">
      <div className="account-toolbar">
        <div className="account-filters" role="tablist" aria-label="Lọc vai trò tài khoản">
          {accountFilters.map(([value, label]) => <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <div className="account-toolbar-actions"><label className="account-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm tài khoản..." aria-label="Tìm kiếm tài khoản" /></label><button className="primary-button admin-add-button" onClick={() => { setFormError(''); setEditing({ id: '' }); }}><Plus size={14} /> Thêm tài khoản</button></div>
      </div>
      {formError && <p className="form-error">{formError}</p>}
      <div className="table-scroll"><table className="account-table"><thead><tr><th>STT</th><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>
        {filteredUsers.map((account, index) => <tr key={account.id}>
          <td>{index + 1}</td>
          <td>{account.displayName || 'Chưa cập nhật'}</td>
          <td>{account.email || '—'}</td>
          <td><span className={`account-role account-role-${account.role || 'customer'}`}>{roleNames[account.role] || roleNames.customer}</span></td>
          <td><button className={`account-toggle ${account.enabled === false ? '' : 'enabled'}`} role="switch" aria-checked={account.enabled !== false} aria-label={`${account.enabled === false ? 'Kích hoạt' : 'Tạm khóa'} ${account.displayName || account.email}`} disabled={busy || account.id === currentUser?.uid} onClick={() => toggleEnabled(account)}><i /></button></td>
          <td>{account.createdAt?.toDate ? account.createdAt.toDate().toLocaleDateString('vi-VN') : '—'}</td>
          <td><div className="account-actions"><button className="table-action" aria-label={`Sửa ${account.displayName || account.email}`} disabled={busy} onClick={() => { setFormError(''); setEditing(account); }}><Pencil size={14} /></button><button className="table-action account-delete" aria-label={`Xóa ${account.displayName || account.email}`} disabled={busy || account.id === currentUser?.uid} onClick={() => remove(account)}><Trash2 size={14} /></button></div></td>
        </tr>)}
        {filteredUsers.length === 0 && <tr><td colSpan="7" className="account-empty">Không tìm thấy tài khoản phù hợp.</td></tr>}
      </tbody></table></div>
    </section>

    {editing && <aside className="admin-panel account-form-panel">
      <div className="account-form-heading"><div><h2>{editing.id ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản'}</h2><p>{editing.id ? 'Cập nhật hồ sơ và quyền truy cập' : 'Tạo hồ sơ đăng nhập mới'}</p></div><button className="table-action" onClick={() => setEditing(null)} aria-label="Đóng biểu mẫu"><X size={16} /></button></div>
      <form className="account-form" onSubmit={submit} key={editing.id || 'new'}>
        <label>Họ tên<input name="displayName" defaultValue={editing.displayName || ''} required maxLength="100" /></label>
        <label>Mã sinh viên<input name="studentId" defaultValue={editing.studentId || ''} maxLength="50" /></label>
        <label>Email<input name="email" type="email" defaultValue={editing.email || ''} required disabled={Boolean(editing.id)} /></label>
        <label>Số điện thoại<input name="phone" type="tel" defaultValue={editing.phone || ''} maxLength="30" /></label>
        {!editing.id && <label>Mật khẩu<input name="password" type="password" minLength="8" autoComplete="new-password" required /></label>}
        <label>Vai trò<select name="role" defaultValue={editing.role || 'customer'} disabled={editing.id === currentUser?.uid}><option value="admin">Admin</option><option value="kitchen">Nhân viên bếp</option><option value="cashier">Nhân viên quầy</option><option value="staff">Nhân viên (cũ)</option><option value="customer">Khách hàng</option></select>{editing.id === currentUser?.uid && <input type="hidden" name="role" value={editing.role || 'admin'} />}</label>
        {Boolean(editing.id) && editing.id !== currentUser?.uid && <label className="account-enabled-field"><input type="checkbox" name="enabled" defaultChecked={editing.enabled !== false} /> Tài khoản đang hoạt động</label>}
        {editing.id === currentUser?.uid && <input type="hidden" name="enabled" value={editing.enabled !== false ? 'on' : ''} />}
        {editing.id === currentUser?.uid && <p className="admin-hint">Không thể tự đổi vai trò hoặc trạng thái của tài khoản đang sử dụng.</p>}
        <div className="account-form-actions"><button type="button" className="admin-outline" disabled={busy} onClick={() => setEditing(null)}>Hủy</button><button className="primary-button" disabled={busy}>{busy ? 'Đang lưu...' : editing.id ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button></div>
      </form>
    </aside>}
  </div>;
}
