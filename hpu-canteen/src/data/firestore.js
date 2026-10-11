import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

const menuCollection = collection(db, 'menuItems');
const orderCollection = collection(db, 'orders');
const userCollection = collection(db, 'users');
const pickupSlotCollection = collection(db, 'pickupSlots');
const categoryCollection = collection(db, 'categories');

export function subscribeMenu(role, onChange, onError) {
  const menuQuery = role === 'admin'
    ? query(menuCollection, orderBy('name'))
    : query(menuCollection, where('active', '==', true));

  return onSnapshot(menuQuery, (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}

export function seedMenu(items) {
  const batch = writeBatch(db);
  items.forEach((item) => {
    const { id, ...data } = item;
    batch.set(doc(db, 'menuItems', String(id)), {
      ...data,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return batch.commit();
}

export function createMenuItem(item) {
  return addDoc(menuCollection, {
    ...item,
    active: true,
    availableToday: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeOrders(user, role, onChange, onError) {
  const ordersQuery = role === 'admin' || role === 'staff'
    ? query(orderCollection, orderBy('createdAt', 'desc'))
    : query(orderCollection, where('userId', '==', user.uid));

  return onSnapshot(ordersQuery, (snapshot) => {
    const orders = snapshot.docs.map((order) => ({ id: order.id, ...order.data() }));
    onChange(role === 'admin' || role === 'staff'
      ? orders
      : orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
  }, onError);
}

export function createOrder(user, cart, pickupSlot) {
  const code = `HPU-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const items = cart.map((item) => ({
    menuItemId: String(item.id),
    name: item.name,
    unitPrice: Number(item.price),
    quantity: Number(item.quantity),
    note: item.note || '',
  }));
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return addDoc(orderCollection, {
    code,
    userId: user.uid,
    customerName: user.displayName || user.email || 'Khách hàng',
    items,
    total,
    pickupSlot,
    status: 'received',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).then((reference) => ({ id: reference.id, code }));
}

export function updateOrderStatus(orderId, status) {
  return updateDoc(doc(db, 'orders', orderId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export function saveUserProfile(userId, profile, isNew = false) {
  return setDoc(doc(db, 'users', userId), {
    ...profile,
    role: 'customer',
    ...(isNew ? { createdAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function updateMenuItem(itemId, updates) {
  return updateDoc(doc(db, 'menuItems', itemId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export function deleteMenuItem(itemId) {
  return deleteDoc(doc(db, 'menuItems', itemId));
}

export async function getUserProfile(userId) {
  const snapshot = await getDoc(doc(db, 'users', userId));
  return snapshot.exists() ? snapshot.data() : null;
}

export function subscribeUserProfile(userId, onChange, onError) {
  return onSnapshot(doc(db, 'users', userId), (snapshot) => {
    onChange(snapshot.exists() ? snapshot.data() : null);
  }, onError);
}

export function reconcileOrder(orderId, adminUid) {
  return updateDoc(doc(db, 'orders', orderId), {
    reconciled: true,
    reconciledBy: adminUid,
    reconciledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeUsers(onChange, onError) {
  return onSnapshot(userCollection, (snapshot) => {
    const users = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    onChange(users.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'vi')));
  }, onError);
}

export function subscribePickupSlots(role, onChange, onError) {
  const slotsQuery = role === 'customer'
    ? query(pickupSlotCollection, where('enabled', '==', true))
    : pickupSlotCollection;
  return onSnapshot(slotsQuery, (snapshot) => {
    const slots = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    onChange(slots.sort((a, b) => (a.start || '').localeCompare(b.start || '')));
  }, onError);
}

export function createPickupSlot(slot) {
  return addDoc(pickupSlotCollection, {
    ...slot,
    enabled: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updatePickupSlot(slotId, updates) {
  return updateDoc(doc(db, 'pickupSlots', slotId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export function deletePickupSlot(slotId) {
  return deleteDoc(doc(db, 'pickupSlots', slotId));
}

export function seedPickupSlots(slots) {
  const batch = writeBatch(db);
  slots.forEach((slot) => {
    const reference = doc(db, 'pickupSlots', slot.id);
    const data = { ...slot };
    delete data.id;
    batch.set(reference, { ...data, enabled: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  return batch.commit();
}

export function subscribeCategories(role, onChange, onError) {
  const categoriesQuery = role === 'admin'
    ? query(categoryCollection, orderBy('name'))
    : query(categoryCollection, where('active', '==', true));
  return onSnapshot(categoriesQuery, (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}

export function createCategory(category) {
  return addDoc(categoryCollection, {
    ...category,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateCategory(categoryId, updates) {
  return updateDoc(doc(db, 'categories', categoryId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export function deleteCategory(categoryId) {
  return deleteDoc(doc(db, 'categories', categoryId));
}

export function seedCategories(categories) {
  const batch = writeBatch(db);
  categories.forEach((category) => {
    const reference = doc(db, 'categories', category.id);
    const data = { ...category };
    delete data.id;
    batch.set(reference, { ...data, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  return batch.commit();
}